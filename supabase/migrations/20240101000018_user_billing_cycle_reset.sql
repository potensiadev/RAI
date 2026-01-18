-- Migration 018: User-specific Billing Cycle Reset
--

-- Drop existing functions to allow signature changes
DROP FUNCTION IF EXISTS check_and_reset_user_credits(UUID);
DROP FUNCTION IF EXISTS get_user_credits(UUID);
DROP FUNCTION IF EXISTS deduct_credit(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS deduct_credit(UUID, UUID);
DROP FUNCTION IF EXISTS reset_monthly_credits();

ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle_start DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_started_at DATE;

UPDATE users
SET plan_started_at = created_at::date
WHERE plan_started_at IS NULL;

UPDATE users
SET billing_cycle_start = (
    -- created_at????day)??湲곗??쇰줈 ?꾩옱 ?먮뒗 ?댁쟾 鍮뚮쭅 ?ъ씠???쒖옉??怨꾩궛
    CASE
        -- ?꾩옱 ?붿쓽 ?대떦 ?쇱씠 ?대? 吏?ъ쑝硫??꾩옱 ?붿쓽 ?대떦 ??
        WHEN EXTRACT(DAY FROM CURRENT_DATE) >= EXTRACT(DAY FROM created_at)
        THEN DATE_TRUNC('month', CURRENT_DATE) + (EXTRACT(DAY FROM created_at) - 1 || ' days')::INTERVAL
        -- ?꾩쭅 ??吏?ъ쑝硫??댁쟾 ?붿쓽 ?대떦 ??
        ELSE DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + (EXTRACT(DAY FROM created_at) - 1 || ' days')::INTERVAL
    END
)::DATE
WHERE billing_cycle_start IS NULL;


CREATE OR REPLACE FUNCTION check_and_reset_user_credits(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_billing_cycle DATE;
    v_plan_started_at DATE;
    v_next_reset_date DATE;
BEGIN
    -- ?꾩옱 billing cycle怨?plan ?쒖옉??議고쉶
    SELECT billing_cycle_start, plan_started_at
    INTO v_billing_cycle, v_plan_started_at
    FROM users
    WHERE id = p_user_id;

    -- billing_cycle_start媛 NULL?대㈃ plan_started_at ?먮뒗 ?ㅻ뒛濡??ㅼ젙
    IF v_billing_cycle IS NULL THEN
        v_billing_cycle := COALESCE(v_plan_started_at, CURRENT_DATE);

        UPDATE users
        SET billing_cycle_start = v_billing_cycle,
            plan_started_at = COALESCE(plan_started_at, CURRENT_DATE)
        WHERE id = p_user_id;
    END IF;

    -- ?ㅼ쓬 由ъ뀑 ?좎쭨 怨꾩궛 (billing_cycle_start + 1 month)
    v_next_reset_date := v_billing_cycle + INTERVAL '1 month';

    -- ?꾩옱 ?좎쭨媛 ?ㅼ쓬 由ъ뀑 ?좎쭨 ?댁긽?대㈃ 由ъ뀑
    IF CURRENT_DATE >= v_next_reset_date THEN
        UPDATE users
        SET
            credits_used_this_month = 0,
            credits_reset_at = NOW(),
            -- ??鍮뚮쭅 ?ъ씠?? ?댁쟾 + 1 month (?좎쭨 ?좎?)
            billing_cycle_start = v_billing_cycle + INTERVAL '1 month'
        WHERE id = p_user_id;

        -- 由ъ뀑 濡쒓렇
        INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
        SELECT id, 'adjustment', 0, credits,
               '' || to_char(v_billing_cycle + INTERVAL '1 month', 'YYYY-MM-DD') || ')'
        FROM users WHERE id = p_user_id;

        RETURN TRUE;  -- 由ъ뀑??
    END IF;

    RETURN FALSE;  -- 由ъ뀑 遺덊븘??
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
BEGIN
    -- ??蹂寃????먮룞 由ъ뀑
    SELECT check_and_reset_user_credits(p_user_id) INTO v_was_reset;

    -- ?ъ슜???뺣낫 議고쉶
    SELECT plan, credits, credits_used_this_month, billing_cycle_start, plan_started_at
    INTO v_user
    FROM users
    WHERE id = p_user_id;

    -- ?뚮옖蹂?湲곕낯 ?щ젅??
    v_base_credits := CASE v_user.plan
        WHEN 'starter' THEN 50
        WHEN 'pro' THEN 150
        WHEN 'enterprise' THEN 300
        ELSE 50
    END;

    -- ?⑥? ?щ젅??怨꾩궛
    v_remaining := (v_base_credits - v_user.credits_used_this_month) + v_user.credits;

    -- ?ㅼ쓬 由ъ뀑??怨꾩궛
    v_next_reset_date := v_user.billing_cycle_start + INTERVAL '1 month';

    RETURN json_build_object(
        'plan', v_user.plan,
        'base_credits', v_base_credits,
        'additional_credits', v_user.credits,
        'used_this_month', v_user.credits_used_this_month,
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
BEGIN
    -- 鍮뚮쭅 ?ъ씠??湲곕컲 ?먮룞 由ъ뀑
    PERFORM check_and_reset_user_credits(p_user_id);

    -- ?꾩옱 ?щ젅??議고쉶
    SELECT credits, credits_used_this_month, plan
    INTO v_credits, v_credits_used, v_plan
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

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
    SELECT
        p_user_id,
        'usage',
        -1,
        CASE WHEN (v_base_credits - v_credits_used) > 0
            THEN v_credits
            ELSE v_credits - 1
        END,
        p_description,
        p_candidate_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS JSON AS $$
DECLARE
    v_reset_count INTEGER := 0;
    v_user RECORD;
BEGIN
    -- 鍮뚮쭅 ?ъ씠?댁씠 吏??紐⑤뱺 ?ъ슜??由ъ뀑
    FOR v_user IN
        SELECT id
        FROM users
        WHERE billing_cycle_start + INTERVAL '1 month' <= CURRENT_DATE
    LOOP
        PERFORM check_and_reset_user_credits(v_user.id);
        v_reset_count := v_reset_count + 1;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'reset_count', v_reset_count,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



