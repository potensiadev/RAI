-- =====================================================
-- Migration: Atomic Upload Job Create Function
-- Issue #6 해결: Non-atomic multi-insert를 단일 트랜잭션으로 처리
-- =====================================================

DROP FUNCTION IF EXISTS create_upload_job(UUID, TEXT, INTEGER, TEXT, TEXT);

/**
 * create_upload_job: 업로드 작업 생성 (Atomic)
 * - processing_jobs와 candidates를 단일 트랜잭션으로 생성
 * - 중간 실패 시 자동 롤백
 * - orphan 데이터 방지
 *
 * @param p_user_id: public.users의 ID
 * @param p_file_name: 원본 파일명
 * @param p_file_size: 파일 크기 (bytes)
 * @param p_file_type: 파일 확장자 (hwp, pdf 등, 점 제외)
 * @param p_storage_path: Supabase Storage 경로
 * @returns: job_id, candidate_id를 포함한 레코드
 */
CREATE OR REPLACE FUNCTION create_upload_job(
  p_user_id UUID,
  p_file_name TEXT,
  p_file_size INTEGER,
  p_file_type TEXT,
  p_storage_path TEXT
)
RETURNS TABLE (
  job_id UUID,
  candidate_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
  v_candidate_id UUID;
BEGIN
  -- 1. processing_jobs 생성
  INSERT INTO processing_jobs (
    user_id,
    file_name,
    file_size,
    file_type,
    status,
    file_path
  ) VALUES (
    p_user_id,
    p_file_name,
    p_file_size,
    p_file_type,
    'queued',
    p_storage_path
  )
  RETURNING id INTO v_job_id;

  -- 2. candidates 생성
  INSERT INTO candidates (
    user_id,
    name,
    status,
    is_latest,
    version,
    source_file,
    file_type
  ) VALUES (
    p_user_id,
    p_file_name,
    'processing',
    true,
    1,
    p_storage_path,
    p_file_type
  )
  RETURNING id INTO v_candidate_id;

  -- 3. processing_jobs에 candidate_id 연결
  UPDATE processing_jobs
  SET candidate_id = v_candidate_id
  WHERE id = v_job_id;

  -- 4. 결과 반환
  RETURN QUERY SELECT v_job_id, v_candidate_id;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION create_upload_job(UUID, TEXT, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_upload_job(UUID, TEXT, INTEGER, TEXT, TEXT) TO service_role;

-- =====================================================
-- 크레딧 예약과 업로드 작업 생성을 하나로 통합한 함수
-- =====================================================

DROP FUNCTION IF EXISTS reserve_and_create_upload_job(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT);

/**
 * reserve_and_create_upload_job: 크레딧 예약 + 업로드 작업 생성 (Atomic)
 * - 모든 작업을 단일 트랜잭션으로 처리
 * - 크레딧 부족, 중복 업로드 등 모든 실패 케이스에서 자동 롤백
 *
 * @param p_user_id: public.users의 ID
 * @param p_file_name: 원본 파일명
 * @param p_file_size: 파일 크기 (bytes)
 * @param p_file_type: 파일 확장자 (hwp, pdf 등, 점 제외)
 * @param p_storage_path: Supabase Storage 경로
 * @param p_description: 크레딧 트랜잭션 설명
 * @returns: success, job_id, candidate_id, error_message를 포함한 레코드
 */
CREATE OR REPLACE FUNCTION reserve_and_create_upload_job(
  p_user_id UUID,
  p_file_name TEXT,
  p_file_size INTEGER,
  p_file_type TEXT,
  p_storage_path TEXT,
  p_description TEXT DEFAULT ''
)
RETURNS TABLE (
  success BOOLEAN,
  job_id UUID,
  candidate_id UUID,
  error_message TEXT
)
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
  v_job_id UUID;
  v_candidate_id UUID;
BEGIN
  -- 1. 크레딧 확인 (Row-level lock)
  SELECT plan, credits, credits_used_this_month
  INTO v_plan, v_credits, v_credits_used
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'User not found'::TEXT;
    RETURN;
  END IF;

  -- 플랜별 기본 크레딧
  v_base_credits := CASE v_plan
    WHEN 'starter' THEN 50
    WHEN 'pro' THEN 150
    WHEN 'enterprise' THEN 300
    ELSE 50
  END;

  -- 남은 크레딧 계산
  v_remaining := v_base_credits - v_credits_used + v_credits;

  IF v_remaining <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;

  -- 2. 크레딧 차감
  UPDATE users
  SET credits_used_this_month = credits_used_this_month + 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  v_new_balance := v_remaining - 1;

  -- 3. processing_jobs 생성
  INSERT INTO processing_jobs (
    user_id,
    file_name,
    file_size,
    file_type,
    status,
    file_path
  ) VALUES (
    p_user_id,
    p_file_name,
    p_file_size,
    p_file_type,
    'queued',
    p_storage_path
  )
  RETURNING id INTO v_job_id;

  -- 4. candidates 생성
  INSERT INTO candidates (
    user_id,
    name,
    status,
    is_latest,
    version,
    source_file,
    file_type
  ) VALUES (
    p_user_id,
    p_file_name,
    'processing',
    true,
    1,
    p_storage_path,
    p_file_type
  )
  RETURNING id INTO v_candidate_id;

  -- 5. processing_jobs에 candidate_id 연결
  UPDATE processing_jobs
  SET candidate_id = v_candidate_id
  WHERE id = v_job_id;

  -- 6. 크레딧 트랜잭션 기록
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
    COALESCE(p_description, '이력서 업로드: ' || p_file_name),
    v_candidate_id
  );

  -- 7. 성공 반환
  RETURN QUERY SELECT TRUE, v_job_id, v_candidate_id, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  -- 모든 에러 시 트랜잭션 자동 롤백
  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, SQLERRM::TEXT;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION reserve_and_create_upload_job(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_and_create_upload_job(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) TO service_role;
