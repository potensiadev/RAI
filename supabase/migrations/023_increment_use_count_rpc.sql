-- Create RPC function for atomic use_count increment
-- Fixes race condition in saved search use tracking

CREATE OR REPLACE FUNCTION increment_saved_search_use_count(
  search_id UUID,
  requesting_user_id UUID
)
RETURNS TABLE (
  query TEXT,
  filters JSONB,
  new_use_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Verify ownership first
  SELECT user_id INTO v_owner_id
  FROM saved_searches
  WHERE id = search_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Saved search not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != requesting_user_id THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Atomic increment and return updated values
  RETURN QUERY
  UPDATE saved_searches
  SET
    use_count = COALESCE(use_count, 0) + 1,
    last_used_at = NOW()
  WHERE id = search_id
  RETURNING
    saved_searches.query,
    saved_searches.filters,
    saved_searches.use_count AS new_use_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_saved_search_use_count(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION increment_saved_search_use_count IS
'Atomically increments use_count for a saved search. Prevents race conditions.';
