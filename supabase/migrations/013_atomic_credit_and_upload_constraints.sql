-- =====================================================
-- Migration 013: Atomic Credit Reservation & Upload Constraints
-- 동시 업로드 스트레스 테스트 대응
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. Atomic 크레딧 예약 함수 (Race Condition 방지)
-- ─────────────────────────────────────────────────────

-- 기존 함수가 있으면 삭제
DROP FUNCTION IF EXISTS reserve_credit(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS release_credit_reservation(UUID, UUID);

/**
 * reserve_credit: 크레딧 사전 예약 (업로드 시작 시 호출)
 * - Row-level lock으로 동시성 제어
 * - 크레딧이 있으면 즉시 차감하고 TRUE 반환
 * - 크레딧이 없으면 FALSE 반환
 *
 * @param p_user_id: public.users의 ID
 * @param p_job_id: processing_jobs의 ID (추적용)
 * @param p_description: 트랜잭션 설명
 * @returns: 예약 성공 여부
 */
CREATE OR REPLACE FUNCTION reserve_credit(
  p_user_id UUID,
  p_job_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT '이력서 분석 크레딧 예약'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan TEXT;
  v_base_credits INT;
  v_credits INT;
  v_credits_used INT;
  v_remaining INT;
  v_new_balance INT;
BEGIN
  -- Row-level lock으로 동시 접근 방지
  SELECT plan, credits, credits_used_this_month
  INTO v_plan, v_credits, v_credits_used
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- 플랜별 기본 크레딧
  v_base_credits := CASE v_plan
    WHEN 'starter' THEN COALESCE(current_setting('app.plan_credits_starter', true)::INT, 50)
    WHEN 'pro' THEN COALESCE(current_setting('app.plan_credits_pro', true)::INT, 150)
    WHEN 'enterprise' THEN COALESCE(current_setting('app.plan_credits_enterprise', true)::INT, 300)
    ELSE 50
  END;

  -- 남은 크레딧 계산
  v_remaining := v_base_credits - v_credits_used + v_credits;

  IF v_remaining <= 0 THEN
    RETURN FALSE;
  END IF;

  -- 크레딧 차감 (월간 사용량 증가)
  UPDATE users
  SET credits_used_this_month = credits_used_this_month + 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- 새 잔액 계산
  v_new_balance := v_remaining - 1;

  -- 트랜잭션 기록
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    candidate_id
  ) VALUES (
    p_user_id,
    'reserve',
    -1,
    v_new_balance,
    p_description,
    p_job_id
  );

  RETURN TRUE;
END;
$$;

/**
 * release_credit_reservation: 크레딧 예약 해제 (실패 시 롤백)
 * - 업로드 처리 실패 시 호출하여 크레딧 복원
 *
 * @param p_user_id: public.users의 ID
 * @param p_job_id: processing_jobs의 ID (추적용)
 * @returns: 해제 성공 여부
 */
CREATE OR REPLACE FUNCTION release_credit_reservation(
  p_user_id UUID,
  p_job_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan TEXT;
  v_base_credits INT;
  v_credits INT;
  v_credits_used INT;
  v_new_balance INT;
BEGIN
  -- Row-level lock
  SELECT plan, credits, credits_used_this_month
  INTO v_plan, v_credits, v_credits_used
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 이미 0이면 해제 불가
  IF v_credits_used <= 0 THEN
    RETURN FALSE;
  END IF;

  -- 크레딧 복원
  UPDATE users
  SET credits_used_this_month = credits_used_this_month - 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- 플랜별 기본 크레딧
  v_base_credits := CASE v_plan
    WHEN 'starter' THEN 50
    WHEN 'pro' THEN 150
    WHEN 'enterprise' THEN 300
    ELSE 50
  END;

  -- 새 잔액 계산
  v_new_balance := v_base_credits - (v_credits_used - 1) + v_credits;

  -- 트랜잭션 기록
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    candidate_id
  ) VALUES (
    p_user_id,
    'refund',
    1,
    v_new_balance,
    '업로드 실패로 인한 크레딧 환불',
    p_job_id
  );

  RETURN TRUE;
END;
$$;

-- RPC 함수 접근 권한 설정
GRANT EXECUTE ON FUNCTION reserve_credit(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION release_credit_reservation(UUID, UUID) TO authenticated;

-- ─────────────────────────────────────────────────────
-- 2. 중복 업로드 방지를 위한 Partial Unique Index
-- ─────────────────────────────────────────────────────

-- 기존 인덱스가 있으면 삭제
DROP INDEX IF EXISTS idx_processing_jobs_active_upload;

/**
 * 동일 사용자가 같은 파일명으로 진행 중인 업로드가 있으면 INSERT 실패
 * - status가 'queued' 또는 'processing'인 경우에만 적용
 * - 완료/실패된 업로드는 같은 파일명으로 재업로드 가능
 */
CREATE UNIQUE INDEX idx_processing_jobs_active_upload
ON processing_jobs (user_id, file_name)
WHERE status IN ('queued', 'processing');

-- ─────────────────────────────────────────────────────
-- 3. 사용자별 동시 업로드 제한 체크 함수
-- ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS check_concurrent_upload_limit(UUID, INT);

/**
 * check_concurrent_upload_limit: 동시 업로드 개수 체크
 * - 사용자별로 동시에 처리 중인 업로드 수를 제한
 *
 * @param p_user_id: public.users의 ID
 * @param p_max_concurrent: 최대 동시 업로드 수 (기본: 5)
 * @returns: 업로드 가능하면 TRUE
 */
CREATE OR REPLACE FUNCTION check_concurrent_upload_limit(
  p_user_id UUID,
  p_max_concurrent INT DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_count INT;
BEGIN
  SELECT COUNT(*)
  INTO v_active_count
  FROM processing_jobs
  WHERE user_id = p_user_id
    AND status IN ('queued', 'processing')
    AND created_at > NOW() - INTERVAL '10 minutes';

  RETURN v_active_count < p_max_concurrent;
END;
$$;

GRANT EXECUTE ON FUNCTION check_concurrent_upload_limit(UUID, INT) TO authenticated;

-- ─────────────────────────────────────────────────────
-- 4. Orphaned 레코드 정리 함수
-- ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS cleanup_orphaned_uploads();

/**
 * cleanup_orphaned_uploads: 고아 레코드 정리
 * - 10분 이상 'queued' 상태로 대기 중인 job을 'failed'로 변경
 * - 1시간 이상 'processing' 상태인 job을 'failed'로 변경
 * - 대응하는 candidate도 'failed'로 업데이트
 *
 * 이 함수는 Supabase Edge Function cron job으로 주기적 실행 권장
 */
CREATE OR REPLACE FUNCTION cleanup_orphaned_uploads()
RETURNS TABLE (
  cleaned_jobs INT,
  cleaned_candidates INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleaned_jobs INT := 0;
  v_cleaned_candidates INT := 0;
BEGIN
  -- 10분 이상 queued 상태인 job 실패 처리
  WITH stale_queued AS (
    UPDATE processing_jobs
    SET status = 'failed',
        error_code = 'STALE_QUEUED',
        error_message = '처리 대기 시간 초과 (10분)',
        completed_at = NOW()
    WHERE status = 'queued'
      AND created_at < NOW() - INTERVAL '10 minutes'
    RETURNING id, candidate_id
  )
  SELECT COUNT(*) INTO v_cleaned_jobs FROM stale_queued;

  -- 1시간 이상 processing 상태인 job 실패 처리
  WITH stale_processing AS (
    UPDATE processing_jobs
    SET status = 'failed',
        error_code = 'PROCESSING_TIMEOUT',
        error_message = '처리 시간 초과 (1시간)',
        completed_at = NOW()
    WHERE status = 'processing'
      AND started_at < NOW() - INTERVAL '1 hour'
    RETURNING id, candidate_id
  )
  SELECT v_cleaned_jobs + COUNT(*) INTO v_cleaned_jobs FROM stale_processing;

  -- 대응하는 candidate 상태 업데이트
  WITH orphan_candidates AS (
    UPDATE candidates c
    SET status = 'failed',
        updated_at = NOW()
    FROM processing_jobs j
    WHERE c.id = j.candidate_id
      AND j.status = 'failed'
      AND c.status = 'processing'
      AND j.completed_at > NOW() - INTERVAL '5 minutes'
    RETURNING c.id
  )
  SELECT COUNT(*) INTO v_cleaned_candidates FROM orphan_candidates;

  RETURN QUERY SELECT v_cleaned_jobs, v_cleaned_candidates;
END;
$$;

-- Admin만 실행 가능
GRANT EXECUTE ON FUNCTION cleanup_orphaned_uploads() TO service_role;

-- ─────────────────────────────────────────────────────
-- 5. credit_transactions 테이블에 'reserve' 및 'refund' 타입 지원 확인
-- ─────────────────────────────────────────────────────

-- type 컬럼이 TEXT이므로 별도 수정 불필요
-- 기존 타입: 'usage', 'purchase', 'bonus', 'monthly_reset'
-- 추가 타입: 'reserve', 'refund'

COMMENT ON FUNCTION reserve_credit IS '동시 업로드 시 Race Condition 방지를 위한 Atomic 크레딧 예약';
COMMENT ON FUNCTION release_credit_reservation IS '업로드 실패 시 크레딧 예약 해제 (환불)';
COMMENT ON FUNCTION check_concurrent_upload_limit IS '사용자별 동시 업로드 개수 제한 체크';
COMMENT ON FUNCTION cleanup_orphaned_uploads IS '고아 레코드 정리 (cron job으로 주기적 실행)';
COMMENT ON INDEX idx_processing_jobs_active_upload IS '동일 사용자의 중복 업로드 방지 (진행 중인 업로드만)';
