-- =============================================
-- Rate Limit 분산 저장소
-- 서버리스 환경에서 인스턴스 간 공유되는 레이트 제한
-- =============================================

-- Rate limit 기록 테이블
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 동일 identifier + window에 대한 유니크 제약
  CONSTRAINT unique_rate_limit_window UNIQUE (identifier, window_start)
);

-- 인덱스: identifier로 빠른 조회
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- 만료된 레코드 자동 정리 (1시간 이전 데이터)
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON rate_limits(window_start)
WHERE window_start < NOW() - INTERVAL '1 hour';

-- =============================================
-- Rate Limit 체크 RPC 함수
-- 원자적으로 요청 수를 체크하고 증가시킴
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
  -- 윈도우 시작 시간 계산 (밀리초를 인터벌로 변환)
  v_window_start := DATE_TRUNC('second', NOW() - (p_window_ms || ' milliseconds')::INTERVAL);
  v_reset_at := NOW() + (p_window_ms || ' milliseconds')::INTERVAL;

  -- 현재 윈도우 내의 요청 수 조회 및 증가 (UPSERT)
  INSERT INTO rate_limits (identifier, window_start, request_count)
  VALUES (p_identifier, DATE_TRUNC('minute', NOW()), 1)
  ON CONFLICT (identifier, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_current_count;

  -- 이전 윈도우의 요청도 포함하여 총 카운트 계산
  SELECT COALESCE(SUM(request_count), 0) INTO v_current_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND window_start >= v_window_start;

  -- 제한 체크
  v_allowed := v_current_count <= p_limit;

  RETURN json_build_object(
    'allowed', v_allowed,
    'count', v_current_count,
    'reset_at', v_reset_at
  );
END;
$$;

-- =============================================
-- 만료된 Rate Limit 레코드 정리 함수
-- 주기적으로 호출하여 테이블 크기 관리
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

-- RLS 비활성화 (서비스 역할만 접근)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- 서비스 역할만 접근 가능
CREATE POLICY "Service role only" ON rate_limits
  FOR ALL
  USING (auth.role() = 'service_role');

-- 정기적 정리를 위한 pg_cron 설정 (Supabase에서 pg_cron 사용 가능 시)
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', 'SELECT cleanup_expired_rate_limits()');
