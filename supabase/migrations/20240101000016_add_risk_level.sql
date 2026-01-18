-- =====================================================
-- Migration 016: Add risk_level Column
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level') THEN
        CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
    END IF;
END$$;

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS risk_level risk_level DEFAULT 'low';

CREATE INDEX IF NOT EXISTS idx_candidates_risk_level ON candidates(risk_level);

-- COMMENT

