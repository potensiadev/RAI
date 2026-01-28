-- =====================================================
-- Migration: Grant Service Role Access
-- Service Role에 테이블 직접 접근 권한 부여
-- =====================================================

-- processing_jobs 테이블 권한
GRANT ALL ON processing_jobs TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- candidates 테이블 권한
GRANT ALL ON candidates TO service_role;

-- credit_transactions 테이블 권한
GRANT ALL ON credit_transactions TO service_role;

-- users 테이블 권한 (읽기/수정)
GRANT SELECT, UPDATE ON users TO service_role;
