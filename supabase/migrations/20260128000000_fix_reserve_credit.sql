-- =====================================================
-- Migration: Fix reserve_credit function
-- 문제: current_setting이 에러를 발생시킬 수 있음
-- 해결: 하드코딩된 기본값 사용
-- =====================================================

DROP FUNCTION IF EXISTS reserve_credit(UUID, UUID, TEXT);

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
  p_description TEXT DEFAULT ''
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
    RAISE WARNING 'User not found: %', p_user_id;
    RETURN FALSE;
  END IF;

  -- 플랜별 기본 크레딧 (하드코딩 - 설정 의존성 제거)
  v_base_credits := CASE v_plan
    WHEN 'starter' THEN 50
    WHEN 'pro' THEN 150
    WHEN 'enterprise' THEN 300
    ELSE 50
  END;

  -- 남은 크레딧 계산
  v_remaining := v_base_credits - COALESCE(v_credits_used, 0) + COALESCE(v_credits, 0);

  RAISE NOTICE 'reserve_credit: user=%, plan=%, base=%, used=%, extra=%, remaining=%',
    p_user_id, v_plan, v_base_credits, v_credits_used, v_credits, v_remaining;

  IF v_remaining <= 0 THEN
    RETURN FALSE;
  END IF;

  -- 크레딧 차감 (월간 사용량 증가)
  UPDATE users
  SET credits_used_this_month = COALESCE(credits_used_this_month, 0) + 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- 새 잔액 계산
  v_new_balance := v_remaining - 1;

  -- 트랜잭션 기록
  BEGIN
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
      COALESCE(p_description, '이력서 분석 크레딧 예약'),
      p_job_id
    );
  EXCEPTION WHEN OTHERS THEN
    -- credit_transactions 테이블 INSERT 실패해도 예약은 성공으로 처리
    RAISE WARNING 'Failed to insert credit_transaction: %', SQLERRM;
  END;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_credit(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_credit(UUID, UUID, TEXT) TO service_role;
