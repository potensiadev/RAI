-- =====================================================
-- Migration 013: Atomic Credit Reservation & Upload Constraints
-- =====================================================


DROP FUNCTION IF EXISTS reserve_credit(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS release_credit_reservation(UUID, UUID);

/**
 * reserve_credit: ?щ젅???ъ쟾 ?덉빟 (?낅줈???쒖옉 ???몄텧)
 * - Row-level lock?쇰줈 ?숈떆???쒖뼱
 * - ?щ젅?㏃씠 ?덉쑝硫?利됱떆 李④컧?섍퀬 TRUE 諛섑솚
 * - ?щ젅?㏃씠 ?놁쑝硫?FALSE 諛섑솚
 *
 * @param p_user_id: public.users??ID
 * @param p_job_id: processing_jobs??ID (異붿쟻??
 * @param p_description: ?몃옖??뀡 ?ㅻ챸
 * @returns: ?덉빟 ?깃났 ?щ?
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
  -- Row-level lock?쇰줈 ?숈떆 ?묎렐 諛⑹?
  SELECT plan, credits, credits_used_this_month
  INTO v_plan, v_credits, v_credits_used
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- ?뚮옖蹂?湲곕낯 ?щ젅??
  v_base_credits := CASE v_plan
    WHEN 'starter' THEN COALESCE(current_setting('app.plan_credits_starter', true)::INT, 50)
    WHEN 'pro' THEN COALESCE(current_setting('app.plan_credits_pro', true)::INT, 150)
    WHEN 'enterprise' THEN COALESCE(current_setting('app.plan_credits_enterprise', true)::INT, 300)
    ELSE 50
  END;

  -- ?⑥? ?щ젅??怨꾩궛
  v_remaining := v_base_credits - v_credits_used + v_credits;

  IF v_remaining <= 0 THEN
    RETURN FALSE;
  END IF;

  -- ?щ젅??李④컧 (?붽컙 ?ъ슜??利앷?)
  UPDATE users
  SET credits_used_this_month = credits_used_this_month + 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- ???붿븸 怨꾩궛
  v_new_balance := v_remaining - 1;

  -- ?몃옖??뀡 湲곕줉
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
 * release_credit_reservation: ?щ젅???덉빟 ?댁젣 (?ㅽ뙣 ??濡ㅻ갚)
 * - ?낅줈??泥섎- ?ㅽ뙣 ???몄텧?섏뿬 ?щ젅??蹂듭썝
 *
 * @param p_user_id: public.users??ID
 * @param p_job_id: processing_jobs??ID (異붿쟻??
 * @returns: ?댁젣 ?깃났 ?щ?
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

  -- ?대? 0?대㈃ ?댁젣 遺덇?
  IF v_credits_used <= 0 THEN
    RETURN FALSE;
  END IF;

  -- ?щ젅??蹂듭썝
  UPDATE users
  SET credits_used_this_month = credits_used_this_month - 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- ?뚮옖蹂?湲곕낯 ?щ젅??
  v_base_credits := CASE v_plan
    WHEN 'starter' THEN 50
    WHEN 'pro' THEN 150
    WHEN 'enterprise' THEN 300
    ELSE 50
  END;

  -- ???붿븸 怨꾩궛
  v_new_balance := v_base_credits - (v_credits_used - 1) + v_credits;

  -- ?몃옖??뀡 湲곕줉
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
    '',
    p_job_id
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_credit(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION release_credit_reservation(UUID, UUID) TO authenticated;


DROP INDEX IF EXISTS idx_processing_jobs_active_upload;

/**
 * ?숈씪 ?ъ슜?먭? 媛숈? ?뚯씪紐낆쑝濡?吏꾪뻾 以묒씤 ?낅줈?쒓? ?덉쑝硫?INSERT ?ㅽ뙣
 * - status媛 'queued' ?먮뒗 'processing'??寃쎌슦?먮쭔 ?곸슜
 * - ?꾨즺/?ㅽ뙣???낅줈?쒕뒗 媛숈? ?뚯씪紐낆쑝濡??ъ뾽濡쒕뱶 媛??
 */
CREATE UNIQUE INDEX idx_processing_jobs_active_upload
ON processing_jobs (user_id, file_name)
WHERE status IN ('queued', 'processing');


DROP FUNCTION IF EXISTS check_concurrent_upload_limit(UUID, INT);

/**
 * check_concurrent_upload_limit: ?숈떆 ?낅줈??媛쒖닔 泥댄겕
 * - ?ъ슜?먮퀎濡??숈떆??泥섎- 以묒씤 ?낅줈???섎? ?쒗븳
 *
 * @param p_user_id: public.users??ID
 * @param p_max_concurrent: 理쒕? ?숈떆 ?낅줈????(湲곕낯: 5)
 * @returns: ?낅줈??媛?ν븯硫?TRUE
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


DROP FUNCTION IF EXISTS cleanup_orphaned_uploads();

/**
 * cleanup_orphaned_uploads: 怨좎븘 ?덉퐫???뺣-
 * - 10遺??댁긽 'queued' ?곹깭濡??湲?以묒씤 job??'failed'濡?蹂寃?
 * - 1?쒓컙 ?댁긽 'processing' ?곹깭??job??'failed'濡?蹂寃?
 * - ??묓븯??candidate??'failed'濡??낅뜲?댄듃
 *
 * ???⑥닔??Supabase Edge Function cron job?쇰줈 二쇨린???ㅽ뻾 沅뚯옣
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
  -- 10遺??댁긽 queued ?곹깭??job ?ㅽ뙣 泥섎-
  WITH stale_queued AS (
    UPDATE processing_jobs
    SET status = 'failed',
        error_code = 'STALE_QUEUED',
        error_message = '泥섎- ?湲??쒓컙 珥덇낵 (10遺?',
        completed_at = NOW()
    WHERE status = 'queued'
      AND created_at < NOW() - INTERVAL '10 minutes'
    RETURNING id, candidate_id
  )
  SELECT COUNT(*) INTO v_cleaned_jobs FROM stale_queued;

  -- 1?쒓컙 ?댁긽 processing ?곹깭??job ?ㅽ뙣 泥섎-
  WITH stale_processing AS (
    UPDATE processing_jobs
    SET status = 'failed',
        error_code = 'PROCESSING_TIMEOUT',
        error_message = '泥섎- ?쒓컙 珥덇낵 (1?쒓컙)',
        completed_at = NOW()
    WHERE status = 'processing'
      AND started_at < NOW() - INTERVAL '1 hour'
    RETURNING id, candidate_id
  )
  SELECT v_cleaned_jobs + COUNT(*) INTO v_cleaned_jobs FROM stale_processing;

  -- ??묓븯??candidate ?곹깭 ?낅뜲?댄듃
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

GRANT EXECUTE ON FUNCTION cleanup_orphaned_uploads() TO service_role;




