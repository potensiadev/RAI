-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RAI v6.0 Migration 002: Week 5 Missing Columns
-- 스키마-코드 불일치 해결
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ─────────────────────────────────────────────────────────────────────────
-- 1. candidate_chunks: chunk_index 추가
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE candidate_chunks ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. candidates: 누락된 컬럼 추가
-- ─────────────────────────────────────────────────────────────────────────

-- 마스킹된 연락처 (표시용)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone_masked TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email_masked TEXT;

-- 파일 정보
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 필드별 신뢰도 점수
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS field_confidence JSONB DEFAULT '{}';

-- 학교명, 전공 (정규화된 필드)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education_school TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education_major TEXT;

-- 포트폴리오/소셜 링크
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- name NOT NULL 제거 (이름 추출 실패 가능)
ALTER TABLE candidates ALTER COLUMN name DROP NOT NULL;

-- phone_encrypted, email_encrypted를 TEXT로 변경 (Fernet base64 호환)
ALTER TABLE candidates ALTER COLUMN phone_encrypted TYPE TEXT USING phone_encrypted::TEXT;
ALTER TABLE candidates ALTER COLUMN email_encrypted TYPE TEXT USING email_encrypted::TEXT;
ALTER TABLE candidates ALTER COLUMN address_encrypted TYPE TEXT USING address_encrypted::TEXT;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. processing_jobs: 누락된 컬럼 추가
-- ─────────────────────────────────────────────────────────────────────────

-- 파싱된 원문 텍스트
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- 청크/PII 카운트
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS chunk_count INTEGER;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS pii_count INTEGER;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. 인덱스 추가
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_candidate_chunks_index ON candidate_chunks(candidate_id, chunk_index);

-- ─────────────────────────────────────────────────────────────────────────
-- COMMENTS
-- ─────────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN candidates.phone_masked IS '마스킹된 전화번호 (010-****-5678)';
COMMENT ON COLUMN candidates.email_masked IS '마스킹된 이메일 (h***@example.com)';
COMMENT ON COLUMN candidates.field_confidence IS '필드별 AI 추출 신뢰도 점수';
COMMENT ON COLUMN candidate_chunks.chunk_index IS '청크 순서 인덱스';
COMMENT ON COLUMN processing_jobs.raw_text IS '파싱된 원문 텍스트';
