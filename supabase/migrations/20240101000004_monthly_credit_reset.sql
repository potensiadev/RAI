-- Migration 004: Monthly Credit Reset


ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle_start DATE;

UPDATE users
SET billing_cycle_start = date_trunc('month', CURRENT_DATE)::date,
    credits_reset_at = date_trunc('month', CURRENT_TIMESTAMP)
WHERE billing_cycle_start IS NULL;


CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS JSON AS $$
DECLARE
    v_reset_count INTEGER := 0;
    v_current_month DATE := date_trunc('month', CURRENT_DATE)::date;
BEGIN
    -- ?대쾲 ?ъ뿉 ?꾩쭅 由ъ뀑?섏? ?딆? ?ъ슜?먮쭔 由ъ뀑
    UPDATE users
    SET
        credits_used_this_month = 0,
        credits_reset_at = NOW(),
        billing_cycle_start = v_current_month
    WHERE
        billing_cycle_start IS NULL
        OR billing_cycle_start < v_current_month;

    GET DIAGNOSTICS v_reset_count = ROW_COUNT;

    -- 由ъ뀑 濡쒓렇 湲곕줉 (credit_transactions ?뚯씠釉??쒖슜)
    INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
    SELECT
        id,
        'adjustment',
        0,
        credits,
        '' || to_char(v_current_month, 'YYYY-MM') || ')'
    FROM users
    WHERE credits_reset_at >= NOW() - INTERVAL '5 minutes';  -- 諛⑷툑 由ъ뀑???ъ슜?먮쭔

    RETURN json_build_object(
        'success', true,
        'reset_count', v_reset_count,
        'reset_month', to_char(v_current_month, 'YYYY-MM'),
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION check_and_reset_user_credits(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_billing_cycle DATE;
    v_current_month DATE := date_trunc('month', CURRENT_DATE)::date;
BEGIN
    -- ?꾩옱 billing cycle 議고쉶
    SELECT billing_cycle_start INTO v_billing_cycle
    FROM users
    WHERE id = p_user_id;

    -- ???ъ씠硫?由ъ뀑
    IF v_billing_cycle IS NULL OR v_billing_cycle < v_current_month THEN
        UPDATE users
        SET
            credits_used_this_month = 0,
            credits_reset_at = NOW(),
            billing_cycle_start = v_current_month
        WHERE id = p_user_id;

        -- 由ъ뀑 濡쒓렇
        INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
        SELECT id, 'adjustment', 0, credits, ''
        FROM users WHERE id = p_user_id;

        RETURN TRUE;  -- 由ъ뀑??
    END IF;

    RETURN FALSE;  -- 由ъ뀑 遺덊븘??
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_user RECORD;
    v_base_credits INTEGER;
    v_remaining INTEGER;
    v_was_reset BOOLEAN;
BEGIN
    -- ??蹂寃????먮룞 由ъ뀑
    SELECT check_and_reset_user_credits(p_user_id) INTO v_was_reset;

    -- ?ъ슜???뺣낫 議고쉶
    SELECT plan, credits, credits_used_this_month, billing_cycle_start
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

    RETURN json_build_object(
        'plan', v_user.plan,
        'base_credits', v_base_credits,
        'additional_credits', v_user.credits,
        'used_this_month', v_user.credits_used_this_month,
        'remaining', GREATEST(0, v_remaining),
        'billing_cycle_start', v_user.billing_cycle_start,
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
    -- ??蹂寃????먮룞 由ъ뀑
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


-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- SELECT cron.schedule(
--     'monthly-credit-reset',
--     '0 15 1 * *',  -- UTC 15:00 = KST 00:00
--     $$SELECT reset_monthly_credits()$$
-- );



