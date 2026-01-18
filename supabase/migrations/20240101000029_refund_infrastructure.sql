-- Migration 029: Refund Infrastructure
--
-- PRD: prd_refund_policy_v0.4.md Section 2.3
-- QA: refund_policy_test_scenarios_v1.0.md (EC-031 ~ EC-040, EC-071 ~ EC-080)
--


DO $$
BEGIN
    -- refunded 異붽?
    BEGIN
        ALTER TYPE candidate_status ADD VALUE 'refunded';
    EXCEPTION WHEN duplicate_object THEN
        -- ?대? 議댁옱?섎㈃ 臾댁떆
        NULL;
    END;

    -- deleted 異붽?
    BEGIN
        ALTER TYPE candidate_status ADD VALUE 'deleted';
    EXCEPTION WHEN duplicate_object THEN
        -- ?대? 議댁옱?섎㈃ 臾댁떆
        NULL;
    END;
END $$;

DO $$
BEGIN
    ALTER TYPE processing_status ADD VALUE 'refunded';
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;


ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delete_reason VARCHAR(50);



ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS refund_reason VARCHAR(50),
ADD COLUMN IF NOT EXISTS original_transaction_id UUID REFERENCES credit_transactions(id),
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

DO $$
BEGIN
    ALTER TABLE credit_transactions
    ADD CONSTRAINT credit_transactions_idempotency_key_unique UNIQUE (idempotency_key);
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;



ALTER TABLE processing_jobs
DROP CONSTRAINT IF EXISTS processing_jobs_candidate_id_fkey;

ALTER TABLE processing_jobs
ADD CONSTRAINT processing_jobs_candidate_id_fkey
FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;


CREATE INDEX IF NOT EXISTS idx_credit_transactions_refund
ON credit_transactions(refund_reason)
WHERE refund_reason IS NOT NULL;

-- CREATE INDEX IF NOT EXISTS idx_credit_transactions_idempotency
-- ON credit_transactions(idempotency_key)
-- WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_deleted
ON candidates(deleted_at)
WHERE deleted_at IS NOT NULL;

-- CREATE INDEX IF NOT EXISTS idx_candidates_status_deleted
-- ON candidates(status, deleted_at)
-- WHERE status IN ('refunded', 'deleted');


CREATE OR REPLACE FUNCTION process_quality_refund(
    p_candidate_id UUID,
    p_user_id UUID,
    p_job_id UUID,
    p_confidence FLOAT,
    p_missing_fields TEXT[]
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_idempotency_key TEXT;
    v_existing_refund UUID;
    v_lock_key BIGINT;
    v_balance_after INTEGER;
BEGIN
    -- ?????????????????????????????????????????????????
    -- Advisory Lock?쇰줈 ?숈떆 ?붿껌 諛⑹?
    -- EC-033, EC-034: ?숈떆 ?섎텋 ?붿껌 泥섎-
    -- ?????????????????????????????????????????????????
    v_lock_key := hashtext('refund_' || p_candidate_id::TEXT);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- ?????????????????????????????????????????????????
    -- Idempotency 泥댄겕
    -- EC-031, EC-032: 以묐났 ?섎텋 諛⑹?
    -- ?????????????????????????????????????????????????
    v_idempotency_key := 'quality_refund_' || p_candidate_id::TEXT;

    SELECT id INTO v_existing_refund
    FROM credit_transactions
    WHERE idempotency_key = v_idempotency_key;

    IF v_existing_refund IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Already refunded',
            'transaction_id', v_existing_refund
        );
    END IF;

    -- ?????????????????????????????????????????????????
    -- Lazy reset: ?붽컙 ?щ젅??由ъ뀑 泥댄겕
    -- ?????????????????????????????????????????????????
    PERFORM check_and_reset_user_credits(p_user_id);

    -- ?????????????????????????????????????????????????
    -- ?щ젅??蹂듦뎄 (?뚯닔 諛⑹?)
    -- EC-035, EC-036: ?щ젅??寃쎄퀎媛?泥섎-
    -- ?????????????????????????????????????????????????
    UPDATE users
    SET credits_used_this_month = GREATEST(0, credits_used_this_month - 1)
    WHERE id = p_user_id;

    -- ?꾩옱 ?붿븸 議고쉶
    SELECT credits INTO v_balance_after
    FROM users
    WHERE id = p_user_id;

    -- ?????????????????????????????????????????????????
    -- ?섎텋 ?몃옖??뀡 湲곕줉
    -- ?????????????????????????????????????????????????
    INSERT INTO credit_transactions (
        user_id,
        type,
        amount,
        balance_after,
        description,
        candidate_id,
        refund_reason,
        idempotency_key,
        metadata
    ) VALUES (
        p_user_id,
        'refund',
        1,
        COALESCE(v_balance_after, 0),
        '遺꾩꽍 ?덉쭏 誘몃떖 ?먮룞 ?섎텋',
        p_candidate_id,
        'quality_fail',
        v_idempotency_key,
        jsonb_build_object(
            'confidence_score', p_confidence,
            'missing_fields', p_missing_fields,
            'refund_type', 'auto_quality',
            'processed_at', NOW()
        )
    );

    -- ?????????????????????????????????????????????????
    -- Candidate Soft Delete
    -- EC-037, EC-038: Soft Delete 泥섎-
    -- ?????????????????????????????????????????????????
    UPDATE candidates
    SET
        status = 'refunded',
        deleted_at = NOW(),
        delete_reason = 'quality_refund'
    WHERE id = p_candidate_id;

    -- ?????????????????????????????????????????????????
    -- Processing Job ?곹깭 ?낅뜲?댄듃
    -- ?????????????????????????????????????????????????
    IF p_job_id IS NOT NULL THEN
        UPDATE processing_jobs
        SET
            status = 'refunded',
            error_code = 'QUALITY_BELOW_THRESHOLD',
            error_message = 'Auto refund: confidence=' || p_confidence::TEXT ||
                           ', missing_fields=' || array_to_string(p_missing_fields, ',')
        WHERE id = p_job_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'candidate_id', p_candidate_id,
        'confidence', p_confidence,
        'missing_fields', p_missing_fields
    );

EXCEPTION WHEN OTHERS THEN
    -- EC-039, EC-040: ?덉쇅 泥섎-
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION release_credit_reservation_with_reason(
    p_user_id UUID,
    p_job_id UUID,
    p_reason VARCHAR(50) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_reservation_id UUID;
    v_balance_after INTEGER;
BEGIN
    -- ?덉빟 議고쉶
    SELECT id INTO v_reservation_id
    FROM credit_reservations
    WHERE user_id = p_user_id AND job_id = p_job_id AND status = 'reserved'
    FOR UPDATE;

    IF v_reservation_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reservation not found or already released'
        );
    END IF;

    -- Lazy reset 泥댄겕
    PERFORM check_and_reset_user_credits(p_user_id);

    -- ?щ젅??蹂듦뎄
    UPDATE users
    SET credits_used_this_month = GREATEST(0, credits_used_this_month - 1)
    WHERE id = p_user_id;

    -- ?꾩옱 ?붿븸 議고쉶
    SELECT credits INTO v_balance_after FROM users WHERE id = p_user_id;

    -- ?덉빟 ?곹깭 ?낅뜲?댄듃
    UPDATE credit_reservations
    SET status = 'released', released_at = NOW()
    WHERE id = v_reservation_id;

    -- ?섎텋 ?몃옖??뀡 湲곕줉
    INSERT INTO credit_transactions (
        user_id,
        type,
        amount,
        balance_after,
        description,
        refund_reason
    ) VALUES (
        p_user_id,
        'refund',
        1,
        COALESCE(v_balance_after, 0),
        CASE
            WHEN p_reason = 'upload_fail' THEN 'Upload failure refund'
            WHEN p_reason = 'quality_fail' THEN 'Quality failure refund'
            ELSE 'Credit refund'
        END,
        p_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'reason', p_reason
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

