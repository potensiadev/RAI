--

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- auth.users??email濡?public.users.id 議고쉶
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


DROP POLICY IF EXISTS "Users can view own candidate chunks" ON candidate_chunks;
DROP POLICY IF EXISTS "Users can insert own candidate chunks" ON candidate_chunks;
DROP POLICY IF EXISTS "Users can update own candidate chunks" ON candidate_chunks;
DROP POLICY IF EXISTS "Users can delete own candidate chunks" ON candidate_chunks;

CREATE POLICY "Users can view own candidate chunks"
    ON candidate_chunks FOR SELECT
    USING (
        candidate_id IN (
            SELECT id FROM candidates WHERE user_id = get_current_user_id()
        )
    );

CREATE POLICY "Users can insert own candidate chunks"
    ON candidate_chunks FOR INSERT
    WITH CHECK (
        candidate_id IN (
            SELECT id FROM candidates WHERE user_id = get_current_user_id()
        )
    );

CREATE POLICY "Users can update own candidate chunks"
    ON candidate_chunks FOR UPDATE
    USING (
        candidate_id IN (
            SELECT id FROM candidates WHERE user_id = get_current_user_id()
        )
    );

CREATE POLICY "Users can delete own candidate chunks"
    ON candidate_chunks FOR DELETE
    USING (
        candidate_id IN (
            SELECT id FROM candidates WHERE user_id = get_current_user_id()
        )
    );


DROP POLICY IF EXISTS "Users can view own processing jobs" ON processing_jobs;
DROP POLICY IF EXISTS "Users can insert own processing jobs" ON processing_jobs;
DROP POLICY IF EXISTS "Users can update own processing jobs" ON processing_jobs;

CREATE POLICY "Users can view own processing jobs"
    ON processing_jobs FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own processing jobs"
    ON processing_jobs FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own processing jobs"
    ON processing_jobs FOR UPDATE
    USING (user_id = get_current_user_id());

