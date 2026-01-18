-- ============================================================
-- Migration: 017_progressive_loading.sql
-- ============================================================

DO $$
BEGIN
    -- ENUM??議댁옱?섏? ?딆쑝硫??앹꽦
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'candidate_status') THEN
        CREATE TYPE candidate_status AS ENUM ('processing', 'parsed', 'analyzed', 'completed', 'failed', 'rejected');
    ELSE
        -- ENUM??議댁옱?섎㈃ ??媛?異붽?
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'parsed'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'candidate_status')
        ) THEN
            ALTER TYPE candidate_status ADD VALUE 'parsed' AFTER 'processing';
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'candidate_status') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'analyzed'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'candidate_status')
        ) THEN
            ALTER TYPE candidate_status ADD VALUE 'analyzed' AFTER 'parsed';
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_status') THEN
        CREATE TYPE processing_status AS ENUM ('queued', 'processing', 'parsing', 'analyzing', 'completed', 'failed', 'rejected');
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'parsing'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'processing_status')
        ) THEN
            ALTER TYPE processing_status ADD VALUE 'parsing' AFTER 'processing';
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_status') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'analyzing'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'processing_status')
        ) THEN
            ALTER TYPE processing_status ADD VALUE 'analyzing' AFTER 'parsing';
        END IF;
    END IF;
END $$;

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS quick_extracted JSONB DEFAULT NULL;

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS parsing_completed_at TIMESTAMPTZ;

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS analysis_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_candidates_user_status_latest
ON candidates(user_id, status)
WHERE is_latest = true;

CREATE INDEX IF NOT EXISTS idx_candidates_status_created
ON candidates(status, created_at DESC)
WHERE is_latest = true;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = 'candidates'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE candidates;
        END IF;
    END IF;
END $$;


