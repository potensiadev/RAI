-- Migration 030: Subscription Refund Infrastructure
--
-- PRD: prd_refund_policy_v0.4.md Section 5, 6
-- QA: refund_policy_test_scenarios_v1.0.md (EC-061 ~ EC-070)
--


DO $$
BEGIN
    CREATE TYPE refund_type AS ENUM (
        'full',           -- ?꾩븸 ?섎텋 (7???대궡)
        'prorata',        -- Pro-rata 遺遺??섎텋
        'quality',        -- ?덉쭏 誘몃떖 ?섎텋
        'service_credit'  -- ?쒕퉬???щ젅??蹂댁긽
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE refund_status AS ENUM (
        'pending',    -- 泥섎- ?湲?
        'processing', -- 泥섎- 以?
        'completed',  -- ?꾨즺
        'failed',     -- ?ㅽ뙣
        'rejected'    -- 嫄곕? (80% 珥덇낵 ?ъ슜 ??
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;


CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- ?섎텋 ?좏삎 諛??곹깭
    refund_type refund_type NOT NULL,
    status refund_status DEFAULT 'pending',

    -- 湲덉븸 ?뺣낫
    original_amount INTEGER NOT NULL,        -- ?먭껐??湲덉븸 (??
    refund_amount INTEGER NOT NULL,          -- ?섎텋 湲덉븸 (??
    currency VARCHAR(3) DEFAULT 'KRW',

    -- 援щ룆 ?뺣낫
    subscription_id VARCHAR(255),            -- Paddle subscription ID
    transaction_id VARCHAR(255),             -- Paddle transaction ID
    plan VARCHAR(50),                        -- ?섎텋 ????뚮옖

    -- 怨꾩궛 ?곸꽭
    calculation_details JSONB DEFAULT '{}',  -- {remaining_days, total_days, usage_rate, adjustment_factor, used_credits, etc.}

    -- Paddle ?섎텋 ?뺣낫
    paddle_refund_id VARCHAR(255),           -- Paddle refund ID
    paddle_response JSONB,                   -- Paddle API ?묐떟

    -- 泥섎- ?뺣낫
    reason TEXT,                             -- ?섎텋 ?ъ쑀
    admin_note TEXT,                         -- 愿由ъ옄 硫붾え
    processed_at TIMESTAMPTZ,                -- 泥섎- ?꾨즺 ?쒓컖
    processed_by VARCHAR(255),               -- 泥섎-??(system/admin)

    -- Idempotency
    idempotency_key VARCHAR(255) UNIQUE,

    -- 硫뷀?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_type ON refund_requests(refund_type);
CREATE INDEX IF NOT EXISTS idx_refund_requests_subscription ON refund_requests(subscription_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created ON refund_requests(created_at DESC);



ALTER TABLE users ADD COLUMN IF NOT EXISTS paddle_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS paddle_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_amount INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_paddle_customer ON users(paddle_customer_id) WHERE paddle_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);


CREATE OR REPLACE FUNCTION create_subscription_refund_request(
    p_user_id UUID,
    p_refund_type refund_type,
    p_original_amount INTEGER,
    p_refund_amount INTEGER,
    p_subscription_id VARCHAR(255),
    p_plan VARCHAR(50),
    p_calculation_details JSONB,
    p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_request_id UUID;
    v_idempotency_key TEXT;
    v_existing_id UUID;
    v_lock_key BIGINT;
BEGIN
    -- Advisory Lock?쇰줈 ?숈떆 ?붿껌 諛⑹?
    v_lock_key := hashtext('subscription_refund_' || p_user_id::TEXT);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Idempotency key ?앹꽦
    v_idempotency_key := 'subscription_refund_' || p_subscription_id || '_' || date_trunc('day', NOW())::TEXT;

    -- ?대? 泥섎-???섎텋?몄? ?뺤씤
    SELECT id INTO v_existing_id
    FROM refund_requests
    WHERE idempotency_key = v_idempotency_key
      AND status IN ('pending', 'processing', 'completed');

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'request_id', v_existing_id,
            'message', 'Refund request already exists'
        );
    END IF;

    -- ?섎텋 ?붿껌 ?앹꽦
    INSERT INTO refund_requests (
        user_id,
        refund_type,
        status,
        original_amount,
        refund_amount,
        subscription_id,
        plan,
        calculation_details,
        reason,
        idempotency_key
    ) VALUES (
        p_user_id,
        p_refund_type,
        'pending',
        p_original_amount,
        p_refund_amount,
        p_subscription_id,
        p_plan,
        p_calculation_details,
        p_reason,
        v_idempotency_key
    ) RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'request_id', v_request_id,
        'refund_amount', p_refund_amount
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION update_refund_request_status(
    p_request_id UUID,
    p_status refund_status,
    p_paddle_refund_id VARCHAR(255) DEFAULT NULL,
    p_paddle_response JSONB DEFAULT NULL,
    p_processed_by VARCHAR(255) DEFAULT 'system'
) RETURNS JSONB AS $$
BEGIN
    UPDATE refund_requests
    SET
        status = p_status,
        paddle_refund_id = COALESCE(p_paddle_refund_id, paddle_refund_id),
        paddle_response = COALESCE(p_paddle_response, paddle_response),
        processed_at = CASE WHEN p_status IN ('completed', 'failed', 'rejected') THEN NOW() ELSE processed_at END,
        processed_by = p_processed_by,
        updated_at = NOW()
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Refund request not found'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', p_status::TEXT
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refund_requests_select ON refund_requests;
CREATE POLICY refund_requests_select ON refund_requests
    FOR SELECT USING (user_id = auth.uid());



