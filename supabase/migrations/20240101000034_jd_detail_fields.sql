-- Migration: Add JD detail fields to positions table

-- Add new TEXT columns for detailed JD sections
ALTER TABLE positions ADD COLUMN IF NOT EXISTS responsibilities TEXT;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS qualifications TEXT;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS preferred_qualifications TEXT;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS benefits TEXT;

-- Add comments for documentation

