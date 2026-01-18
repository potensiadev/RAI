-- ============================================================
-- Migration 022: Saved Searches
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,                    -- 寃???대쫫 (?ъ슜??吏??
  query TEXT,                            -- 寃??荑쇰-
  filters JSONB DEFAULT '{}',            -- ?꾪꽣 議곌굔

  -- ?뚮┝ ?ㅼ젙 (?ν썑 ?뺤옣??
  notify_on_new_match BOOLEAN DEFAULT false,
  last_notified_at TIMESTAMPTZ,

  -- ?ъ슜 ?듦퀎
  use_count INTEGER DEFAULT 0,           -- ?ъ슜 ?잛닔
  last_used_at TIMESTAMPTZ,              -- 留덉?留??ъ슜 ?쒓컙

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_created_at ON saved_searches(created_at DESC);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_searches_select_policy ON saved_searches
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY saved_searches_insert_policy ON saved_searches
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_searches_update_policy ON saved_searches
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY saved_searches_delete_policy ON saved_searches
  FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION update_saved_searches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saved_searches_updated_at_trigger
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_searches_updated_at();

CREATE OR REPLACE FUNCTION increment_saved_search_usage(p_search_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE saved_searches
  SET
    use_count = use_count + 1,
    last_used_at = NOW()
  WHERE id = p_search_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

