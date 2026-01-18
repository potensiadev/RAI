-- =============================================
-- =============================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- ?숈씪 identifier + window??????좊땲???쒖빟
  CONSTRAINT unique_rate_limit_window UNIQUE (identifier, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- Partial index with NOW() not allowed (not immutable)
-- Use regular index instead
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON rate_limits(window_start);

-- =============================================
-- =============================================
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_window_ms BIGINT,
  p_limit INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_allowed BOOLEAN;
BEGIN
  -- ?덈룄???쒖옉 ?쒓컙 怨꾩궛 (諛由ъ큹瑜??명꽣踰뚮줈 蹂??
  v_window_start := DATE_TRUNC('second', NOW() - (p_window_ms || ' milliseconds')::INTERVAL);
  v_reset_at := NOW() + (p_window_ms || ' milliseconds')::INTERVAL;

  -- ?꾩옱 ?덈룄???댁쓽 ?붿껌 ??議고쉶 諛?利앷? (UPSERT)
  INSERT INTO rate_limits (identifier, window_start, request_count)
  VALUES (p_identifier, DATE_TRUNC('minute', NOW()), 1)
  ON CONFLICT (identifier, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_current_count;

  -- ?댁쟾 ?덈룄?곗쓽 ?붿껌???ы븿?섏뿬 珥?移댁슫??怨꾩궛
  SELECT COALESCE(SUM(request_count), 0) INTO v_current_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND window_start >= v_window_start;

  -- ?쒗븳 泥댄겕
  v_allowed := v_current_count <= p_limit;

  RETURN json_build_object(
    'allowed', v_allowed,
    'count', v_current_count,
    'reset_at', v_reset_at
  );
END;
$$;

-- =============================================
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < NOW() - INTERVAL '2 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON rate_limits
  FOR ALL
  USING (auth.role() = 'service_role');

-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', 'SELECT cleanup_expired_rate_limits()');

