-- =====================================================
-- Migration 009: Fix deduct_credit function and RLS
-- =====================================================

CREATE OR REPLACE FUNCTION deduct_credit(
    p_user_id UUID,
    p_candidate_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT ''
)
RETURNS BOOLEAN AS $$
DECLARE
    v_credits INTEGER;
    v_credits_used INTEGER;
    v_plan plan_type;
    v_base_credits INTEGER;
BEGIN
    -- ?꾩옱 ?щ젅??議고쉶
    SELECT credits, credits_used_this_month, plan
    INTO v_credits, v_credits_used, v_plan
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    -- ?ъ슜???놁쓬
    IF NOT FOUND THEN
        RETURN FALSE;
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

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- auth.jwt()?먯꽌 ?대찓?쇱쓣 異붿텧?섏뿬 public.users?먯꽌 ID 議고쉶
    SELECT u.id INTO v_user_id
    FROM public.users u
    WHERE u.email = auth.jwt()->>'email'
    LIMIT 1;
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Users can view own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can insert own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can update own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can delete own candidates" ON candidates;

CREATE POLICY "Users can view own candidates"
    ON candidates FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own candidates"
    ON candidates FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own candidates"
    ON candidates FOR UPDATE
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can delete own candidates"
    ON candidates FOR DELETE
    USING (user_id = get_current_user_id());

UPDATE candidates
SET is_latest = true, version = 1
WHERE is_latest IS NULL OR is_latest = false;

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

