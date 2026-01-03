-- =====================================================
-- Migration 011: Add Missing Contact Columns
-- phone, email, address 원본 컬럼 추가
-- =====================================================

-- 원본 연락처 컬럼 추가 (UI 표시용)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS address TEXT;

-- COMMENTS
COMMENT ON COLUMN candidates.phone IS '원본 전화번호 (UI 표시용)';
COMMENT ON COLUMN candidates.email IS '원본 이메일 (UI 표시용)';
COMMENT ON COLUMN candidates.address IS '원본 주소 (UI 표시용)';
