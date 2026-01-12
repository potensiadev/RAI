-- Enable pg_trgm extension for trigram-based similarity search
-- This significantly improves similar name search performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index for fast trigram matching on candidate names
CREATE INDEX IF NOT EXISTS idx_candidates_name_trgm
ON candidates USING gin(name gin_trgm_ops);

-- Also create index on last_company for similar company search
CREATE INDEX IF NOT EXISTS idx_candidates_company_trgm
ON candidates USING gin(last_company gin_trgm_ops);

-- RPC function for similar name search
-- Uses trigram similarity for fuzzy matching
CREATE OR REPLACE FUNCTION search_similar_names(
  p_user_id UUID,
  p_name TEXT,
  p_threshold FLOAT DEFAULT 0.3,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  last_position TEXT,
  last_company TEXT,
  created_at TIMESTAMPTZ,
  source_file TEXT,
  similarity_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.last_position,
    c.last_company,
    c.created_at,
    c.source_file,
    similarity(c.name, p_name)::FLOAT AS similarity_score
  FROM candidates c
  WHERE c.user_id = p_user_id
    AND c.is_latest = true
    AND c.status = 'completed'
    AND c.name IS NOT NULL
    AND similarity(c.name, p_name) > p_threshold
  ORDER BY similarity(c.name, p_name) DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_similar_names(UUID, TEXT, FLOAT, INT) TO authenticated;

COMMENT ON FUNCTION search_similar_names IS
'Search for candidates with similar names using PostgreSQL trigram similarity.
Returns candidates ordered by name similarity score.';
