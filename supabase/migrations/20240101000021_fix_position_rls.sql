-- Migration 021: Fix Position RLS Policies
-- 2026-01-10

-- Fix position_activities RLS - add WITH CHECK for INSERT operations
DROP POLICY IF EXISTS position_activities_access ON position_activities;

-- SELECT/UPDATE/DELETE policy
CREATE POLICY position_activities_select ON position_activities
    FOR SELECT USING (
        position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
    );

-- INSERT policy - check that position belongs to the user
CREATE POLICY position_activities_insert ON position_activities
    FOR INSERT WITH CHECK (
        position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
        AND (created_by IS NULL OR created_by = auth.uid())
    );

-- UPDATE policy
CREATE POLICY position_activities_update ON position_activities
    FOR UPDATE USING (
        position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
    );

-- DELETE policy
CREATE POLICY position_activities_delete ON position_activities
    FOR DELETE USING (
        position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
    );

-- Fix position_candidates RLS - add WITH CHECK for INSERT operations
DROP POLICY IF EXISTS position_candidates_access ON position_candidates;

-- SELECT policy
CREATE POLICY position_candidates_select ON position_candidates
    FOR SELECT USING (
        position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
    );

-- INSERT policy
CREATE POLICY position_candidates_insert ON position_candidates
    FOR INSERT WITH CHECK (
        position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
    );

-- UPDATE policy
CREATE POLICY position_candidates_update ON position_candidates
    FOR UPDATE USING (
        position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
    );

-- DELETE policy
CREATE POLICY position_candidates_delete ON position_candidates
    FOR DELETE USING (
        position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
    );

