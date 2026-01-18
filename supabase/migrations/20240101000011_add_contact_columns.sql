-- =====================================================
-- Migration 011: Add Missing Contact Columns
-- =====================================================

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS address TEXT;

-- COMMENTS

