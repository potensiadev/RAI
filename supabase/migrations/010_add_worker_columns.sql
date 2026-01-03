-- =====================================================
-- Migration 010: Add Missing Worker Columns
-- Worker가 저장하려는 컬럼들 추가
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. candidates 테이블: 누락된 컬럼 추가
-- ─────────────────────────────────────────────────────

-- 마스킹된 연락처 (표시용)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone_masked TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email_masked TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS address_masked TEXT;

-- 필드별 신뢰도 점수
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS field_confidence JSONB DEFAULT '{}';

-- 파일 정보
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 학교명, 전공 (정규화된 필드)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education_school TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education_major TEXT;

-- 포트폴리오/소셜 링크
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- warnings를 JSONB로 변경 (TEXT[] -> JSONB)
-- 기존 TEXT[] 데이터가 있으면 변환
DO $$
BEGIN
    -- warnings 컬럼이 TEXT[] 타입인 경우 JSONB로 변환
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'candidates'
        AND column_name = 'warnings'
        AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE candidates ALTER COLUMN warnings TYPE JSONB USING to_jsonb(warnings);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- 이미 JSONB이거나 다른 타입인 경우 무시
        NULL;
END $$;

-- warnings 컬럼이 없으면 추가
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS warnings JSONB DEFAULT '[]';

-- name NOT NULL 제거 (이름 추출 실패 가능)
ALTER TABLE candidates ALTER COLUMN name DROP NOT NULL;

-- phone_encrypted, email_encrypted, address_encrypted를 TEXT로 변경 (Fernet base64 호환)
DO $$
BEGIN
    ALTER TABLE candidates ALTER COLUMN phone_encrypted TYPE TEXT USING phone_encrypted::TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE candidates ALTER COLUMN email_encrypted TYPE TEXT USING email_encrypted::TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE candidates ALTER COLUMN address_encrypted TYPE TEXT USING address_encrypted::TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────
-- 2. candidate_chunks 테이블: chunk_index 추가
-- ─────────────────────────────────────────────────────
ALTER TABLE candidate_chunks ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0;

-- ─────────────────────────────────────────────────────
-- 3. processing_jobs 테이블: 누락된 컬럼 추가
-- ─────────────────────────────────────────────────────
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS chunk_count INTEGER;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS pii_count INTEGER;

-- ─────────────────────────────────────────────────────
-- 4. 인덱스 추가
-- ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_candidate_chunks_index ON candidate_chunks(candidate_id, chunk_index);

-- ─────────────────────────────────────────────────────
-- COMMENTS
-- ─────────────────────────────────────────────────────
COMMENT ON COLUMN candidates.phone_masked IS '마스킹된 전화번호 (010-****-5678)';
COMMENT ON COLUMN candidates.email_masked IS '마스킹된 이메일 (h***@example.com)';
COMMENT ON COLUMN candidates.address_masked IS '마스킹된 주소';
COMMENT ON COLUMN candidates.field_confidence IS '필드별 AI 추출 신뢰도 점수';
COMMENT ON COLUMN candidate_chunks.chunk_index IS '청크 순서 인덱스';
