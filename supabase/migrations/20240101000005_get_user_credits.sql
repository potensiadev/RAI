-- Drop existing function to change return type
DROP FUNCTION IF EXISTS get_user_credits(UUID);

CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS TABLE (
    plan plan_type,
    base_credits INTEGER,
    credits_used INTEGER,
    bonus_credits INTEGER,
    remaining_credits INTEGER
) AS $$
DECLARE
    v_plan plan_type;
    v_credits INTEGER;
    v_credits_used INTEGER;
    v_base INTEGER;
BEGIN
    -- ?ъ슜???뺣낫 議고쉶
    SELECT u.plan, u.credits, u.credits_used_this_month
    INTO v_plan, v_credits, v_credits_used
    FROM users u
    WHERE u.id = p_user_id;

    -- ?뚮옖蹂?湲곕낯 ?щ젅??
    v_base := CASE v_plan
        WHEN 'starter' THEN 50
        WHEN 'pro' THEN 150
        WHEN 'enterprise' THEN 300
        ELSE 50
    END;

    RETURN QUERY SELECT
        v_plan AS plan,
        v_base AS base_credits,
        v_credits_used AS credits_used,
        v_credits AS bonus_credits,
        (v_base - v_credits_used + v_credits) AS remaining_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

