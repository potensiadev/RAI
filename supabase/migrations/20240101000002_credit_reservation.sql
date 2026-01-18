-- Migration: 013_credit_reservation.sql

ALTER TABLE users
ADD COLUMN IF NOT EXISTS credits_reserved INTEGER DEFAULT 0;

-- (Korean comment removed due to encoding)

CREATE TABLE IF NOT EXISTS credit_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES processing_jobs(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'reserved',
    release_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    CONSTRAINT valid_status CHECK (status IN ('reserved', 'confirmed', 'released'))
);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_id ON credit_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_job_id ON credit_reservations(job_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_status ON credit_reservations(status);

-- (Korean comment removed due to encoding)

ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE OR REPLACE FUNCTION get_available_credits(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_credits INTEGER;
    v_used INTEGER;
    v_reserved INTEGER;
    v_plan VARCHAR;
    v_base INTEGER;
    v_remaining INTEGER;
BEGIN
    SELECT credits, credits_used_this_month, credits_reserved, plan
    INTO v_credits, v_used, v_reserved, v_plan
    FROM users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    v_base := CASE v_plan
        WHEN 'pro' THEN 150
        WHEN 'enterprise' THEN 300
        ELSE 50  -- starter
    END;

    v_remaining := GREATEST(0, v_base - v_used - COALESCE(v_reserved, 0)) + COALESCE(v_credits, 0);

    RETURN v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_reservation RECORD;
BEGIN
    FOR v_reservation IN
        SELECT id, user_id, amount
        FROM credit_reservations
        WHERE status = 'reserved'
        AND created_at < NOW() - INTERVAL '30 minutes'
    LOOP
        UPDATE credit_reservations
        SET status = 'released',
            released_at = NOW()
        WHERE id = v_reservation.id;

        UPDATE users
        SET credits_reserved = GREATEST(0, credits_reserved - v_reservation.amount)
        WHERE id = v_reservation.user_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE credit_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reservations"
    ON credit_reservations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage reservations"
    ON credit_reservations FOR ALL
    USING (auth.role() = 'service_role');

