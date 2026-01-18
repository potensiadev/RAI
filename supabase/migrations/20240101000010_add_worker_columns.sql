-- =====================================================
-- Migration 010: Add Missing Worker Columns
-- =====================================================


ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone_masked TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email_masked TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS address_masked TEXT;

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS field_confidence JSONB DEFAULT '{}';

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS file_type TEXT;

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education_school TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education_major TEXT;

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

DO $$
BEGIN
    -- warnings 而щ읆??TEXT[] ??낆씤 寃쎌슦 JSONB濡?蹂??
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
        -- ?대? JSONB?닿굅???ㅻⅨ ??낆씤 寃쎌슦 臾댁떆
        NULL;
END $$;

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS warnings JSONB DEFAULT '[]';

ALTER TABLE candidates ALTER COLUMN name DROP NOT NULL;

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

ALTER TABLE candidate_chunks ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0;

ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS chunk_count INTEGER;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS pii_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_candidate_chunks_index ON candidate_chunks(candidate_id, chunk_index);

-- COMMENTS

