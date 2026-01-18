-- =====================================================
-- Migration 012: Fix Users Table RLS Policy
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (email = auth.jwt()->>'email');

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (email = auth.jwt()->>'email');

