-- =====================================================
-- Migration 012: Fix Users Table RLS Policy
-- users 테이블도 email 기반 조회로 변경
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- 새 정책: email 기반 조회 (Google OAuth + Email 로그인 호환)
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (email = auth.jwt()->>'email');

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (email = auth.jwt()->>'email');
