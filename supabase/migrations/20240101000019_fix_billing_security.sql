-- Migration 019: Fix Billing Cycle Security Vulnerabilities
--

DROP FUNCTION IF EXISTS get_user_credits(UUID);
DROP FUNCTION IF EXISTS check_and_reset_user_credits(UUID);
DROP FUNCTION IF EXISTS deduct_credit(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS calculate_next_billing_date(DATE, INTEGER);


DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile safely" ON users;

CREATE POLICY "Users can update own profile safely"
    ON users FOR UPDATE
    USING (email = auth.jwt()->>'email')
    WITH CHECK (
        -- 誘쇨컧??而щ읆??蹂寃쎈릺吏 ?딆븯?붿? ?뺤씤
        -- WITH CHECK??UPDATE ???곹깭瑜?寃利?
        -- ?몃-嫄곕줈 異붽? 寃利?
        email = auth.jwt()->>'email'
    );

CREATE OR REPLACE FUNCTION prevent_sensitive_column_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Service Role?대굹 Postgres 吏곸젒 ?묎렐? ?덉슜
    IF current_setting('role', true) = 'service_role'
       OR current_setting('role', true) = 'postgres'
       OR current_setting('role', true) IS NULL THEN
        RETURN NEW;
    END IF;

    -- 誘쇨컧??而щ읆 蹂寃?媛먯?
    IF OLD.credits IS DISTINCT FROM NEW.credits THEN
        RAISE EXCEPTION 'Cannot update credits directly';
    END IF;

    IF OLD.credits_used_this_month IS DISTINCT FROM NEW.credits_used_this_month THEN
        RAISE EXCEPTION 'Cannot update credits_used_this_month directly';
    END IF;

    IF OLD.credits_reserved IS DISTINCT FROM NEW.credits_reserved THEN
        RAISE EXCEPTION 'Cannot update credits_reserved directly';
    END IF;

    IF OLD.plan IS DISTINCT FROM NEW.plan THEN
        RAISE EXCEPTION 'Cannot update plan directly';
    END IF;

    IF OLD.billing_cycle_start IS DISTINCT FROM NEW.billing_cycle_start THEN
        RAISE EXCEPTION 'Cannot update billing_cycle_start directly';
    END IF;

    IF OLD.plan_started_at IS DISTINCT FROM NEW.plan_started_at THEN
        RAISE EXCEPTION 'Cannot update plan_started_at directly';
    END IF;

    IF OLD.credits_reset_at IS DISTINCT FROM NEW.credits_reset_at THEN
        RAISE EXCEPTION 'Cannot update credits_reset_at directly';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_prevent_sensitive_update ON users;
CREATE TRIGGER tr_prevent_sensitive_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_sensitive_column_update();


CREATE OR REPLACE FUNCTION calculate_next_billing_date(
    p_current_cycle DATE,
    p_original_day INTEGER
)
RETURNS DATE AS $$
DECLARE
    v_next_month DATE;
    v_target_day INTEGER;
    v_last_day_of_month INTEGER;
BEGIN
    -- ?ㅼ쓬 ??1??
    v_next_month := DATE_TRUNC('month', p_current_cycle) + INTERVAL '1 month';

    -- ?ㅼ쓬 ?ъ쓽 留덉?留???
    v_last_day_of_month := EXTRACT(DAY FROM (v_next_month + INTERVAL '1 month - 1 day'));

    -- ?먮옒 ?좎쭨? ?ㅼ쓬 ??留덉?留???以??묒? 媛??ъ슜
    v_target_day := LEAST(p_original_day, v_last_day_of_month);

    -- ?좎쭨 ?앹꽦
    RETURN v_next_month + (v_target_day - 1) * INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION check_and_reset_user_credits(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_billing_cycle DATE;
    v_plan_started_at DATE;
    v_original_day INTEGER;
    v_next_reset_date DATE;
BEGIN
    -- FOR UPDATE濡????띾뱷 (Race Condition 諛⑹?)
    SELECT billing_cycle_start, plan_started_at
    INTO v_billing_cycle, v_plan_started_at
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    -- billing_cycle_start媛 NULL?대㈃ 珥덇린??
    IF v_billing_cycle IS NULL THEN
        v_billing_cycle := COALESCE(v_plan_started_at, CURRENT_DATE);

        UPDATE users
        SET billing_cycle_start = v_billing_cycle,
            plan_started_at = COALESCE(plan_started_at, CURRENT_DATE)
        WHERE id = p_user_id;
    END IF;

    -- ?먮옒 媛?낆씪??"??day)" 蹂댁〈 (31??媛?낆옄??怨꾩냽 31???좎?)
    v_original_day := EXTRACT(DAY FROM COALESCE(v_plan_started_at, v_billing_cycle));

    -- ?ㅼ쓬 由ъ뀑 ?좎쭨 怨꾩궛 (?붾쭚 ?ㅻ쾭?뚮줈??諛⑹?)
    v_next_reset_date := calculate_next_billing_date(v_billing_cycle, v_original_day);

    -- ?꾩옱 ?좎쭨媛 ?ㅼ쓬 由ъ뀑 ?좎쭨 ?댁긽?대㈃ 由ъ뀑
    IF CURRENT_DATE >= v_next_reset_date THEN
        UPDATE users
        SET
            credits_used_this_month = 0,
            credits_reset_at = NOW(),
            billing_cycle_start = v_next_reset_date
        WHERE id = p_user_id;

        -- 由ъ뀑 濡쒓렇
        INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
        SELECT id, 'adjustment', 0, credits,
               '' || to_char(v_next_reset_date, 'YYYY-MM-DD') || ')'
        FROM users WHERE id = p_user_id;

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS get_user_credits(UUID);
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_user RECORD;
    v_base_credits INTEGER;
    v_remaining INTEGER;
    v_was_reset BOOLEAN;
    v_next_reset_date DATE;
    v_original_day INTEGER;
BEGIN
    -- 由ъ뀑 泥댄겕 (???ы븿)
    SELECT check_and_reset_user_credits(p_user_id) INTO v_was_reset;

    -- ?ъ슜???뺣낫 議고쉶
    SELECT plan, credits, credits_used_this_month, billing_cycle_start, plan_started_at
    INTO v_user
    FROM users
    WHERE id = p_user_id;

    -- ?ъ슜?먭? ?놁쑝硫?NULL 諛섑솚
    IF v_user IS NULL THEN
        RETURN NULL;
    END IF;

    -- ?뚮옖蹂?湲곕낯 ?щ젅??
    v_base_credits := CASE v_user.plan
        WHEN 'starter' THEN 50
        WHEN 'pro' THEN 150
        WHEN 'enterprise' THEN 300
        ELSE 50
    END;

    -- ?⑥? ?щ젅??怨꾩궛
    v_remaining := (v_base_credits - COALESCE(v_user.credits_used_this_month, 0))
                   + COALESCE(v_user.credits, 0);

    -- ?ㅼ쓬 由ъ뀑??怨꾩궛 (?붾쭚 蹂댁젙)
    v_original_day := EXTRACT(DAY FROM COALESCE(v_user.plan_started_at, v_user.billing_cycle_start));
    v_next_reset_date := calculate_next_billing_date(
        v_user.billing_cycle_start,
        v_original_day
    );

    RETURN json_build_object(
        'plan', v_user.plan,
        'base_credits', v_base_credits,
        'additional_credits', COALESCE(v_user.credits, 0),
        'used_this_month', COALESCE(v_user.credits_used_this_month, 0),
        'remaining', GREATEST(0, v_remaining),
        'billing_cycle_start', v_user.billing_cycle_start,
        'next_reset_date', v_next_reset_date,
        'plan_started_at', v_user.plan_started_at,
        'was_reset', v_was_reset
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION deduct_credit(
    p_user_id UUID,
    p_candidate_id UUID,
    p_description TEXT DEFAULT ''
)
RETURNS BOOLEAN AS $$
DECLARE
    v_credits INTEGER;
    v_credits_used INTEGER;
    v_plan plan_type;
    v_base_credits INTEGER;
    v_billing_cycle DATE;
    v_plan_started_at DATE;
    v_original_day INTEGER;
    v_next_reset_date DATE;
BEGIN
    -- ?⑥씪 ?몃옖??뀡 ?댁뿉?????띾뱷 + 由ъ뀑 泥댄겕 + 李④컧 ?섑뻾
    SELECT credits, credits_used_this_month, plan, billing_cycle_start, plan_started_at
    INTO v_credits, v_credits_used, v_plan, v_billing_cycle, v_plan_started_at
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 鍮뚮쭅 ?ъ씠??珥덇린???꾩슂 ??
    IF v_billing_cycle IS NULL THEN
        v_billing_cycle := COALESCE(v_plan_started_at, CURRENT_DATE);
        v_plan_started_at := COALESCE(v_plan_started_at, CURRENT_DATE);

        UPDATE users
        SET billing_cycle_start = v_billing_cycle,
            plan_started_at = v_plan_started_at
        WHERE id = p_user_id;
    END IF;

    -- 由ъ뀑 ?꾩슂 ?щ? 泥댄겕
    v_original_day := EXTRACT(DAY FROM COALESCE(v_plan_started_at, v_billing_cycle));
    v_next_reset_date := calculate_next_billing_date(v_billing_cycle, v_original_day);

    IF CURRENT_DATE >= v_next_reset_date THEN
        -- 由ъ뀑 ?섑뻾
        v_credits_used := 0;

        UPDATE users
        SET credits_used_this_month = 0,
            credits_reset_at = NOW(),
            billing_cycle_start = v_next_reset_date
        WHERE id = p_user_id;

        -- 由ъ뀑 濡쒓렇
        INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
        VALUES (p_user_id, 'adjustment', 0, v_credits,
                '' || to_char(v_next_reset_date, 'YYYY-MM-DD') || ')');
    END IF;

    -- ?뚮옖蹂?湲곕낯 ?щ젅??
    v_base_credits := CASE v_plan
        WHEN 'starter' THEN 50
        WHEN 'pro' THEN 150
        WHEN 'enterprise' THEN 300
        ELSE 50
    END;

    -- ?щ젅??遺議?泥댄겕
    IF (v_base_credits - v_credits_used) <= 0 AND v_credits <= 0 THEN
        RETURN FALSE;
    END IF;

    -- 李④컧 (湲곕낯 ?щ젅???곗꽑, 洹??ㅼ쓬 異붽? ?щ젅??
    IF (v_base_credits - v_credits_used) > 0 THEN
        UPDATE users
        SET credits_used_this_month = credits_used_this_month + 1
        WHERE id = p_user_id;
    ELSE
        UPDATE users
        SET credits = credits - 1
        WHERE id = p_user_id;
    END IF;

    -- ?몃옖??뀡 湲곕줉
    INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, candidate_id)
    VALUES (
        p_user_id,
        'usage',
        -1,
        CASE WHEN (v_base_credits - v_credits_used) > 0
            THEN v_credits
            ELSE v_credits - 1
        END,
        p_description,
        p_candidate_id
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



