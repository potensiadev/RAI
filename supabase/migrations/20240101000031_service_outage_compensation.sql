-- Migration 031: Service Outage Compensation
--
-- PRD: prd_refund_policy_v0.4.md Section 7
-- QA: refund_policy_test_scenarios_v1.0.md (Phase 3)
--


DO $$
BEGIN
    CREATE TYPE incident_level AS ENUM ('P1', 'P2', 'P3');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE incident_status AS ENUM ('ongoing', 'resolved', 'compensation_pending', 'compensation_completed');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;


CREATE TABLE IF NOT EXISTS incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ?μ븷 ?뺣낫
    level incident_level NOT NULL,
    status incident_status DEFAULT 'ongoing',
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- ?μ븷 湲곌컙
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_hours FLOAT GENERATED ALWAYS AS (
        CASE
            WHEN ended_at IS NOT NULL THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600
            ELSE NULL
        END
    ) STORED,

    -- ?곹뼢 踰붿쐞
    affected_services TEXT[] DEFAULT '{}',
    affected_user_count INTEGER,

    -- 蹂댁긽 泥섎-
    compensation_rate FLOAT,  -- ?먮룞 怨꾩궛 ?먮뒗 ?섎룞 ?ㅼ젙
    compensation_processed_at TIMESTAMPTZ,

    -- 愿由ъ옄 ?뺣낫
    created_by VARCHAR(255),  -- admin email
    resolved_by VARCHAR(255),

    -- 硫뷀?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_level ON incident_reports(level);
CREATE INDEX IF NOT EXISTS idx_incident_reports_started ON incident_reports(started_at DESC);



CREATE TABLE IF NOT EXISTS incident_compensations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 蹂댁긽 ?뺣낫
    credits_granted INTEGER NOT NULL,
    plan_at_incident VARCHAR(50),  -- ?μ븷 ?쒖젏???ъ슜???뚮옖

    -- Idempotency
    idempotency_key VARCHAR(255) UNIQUE,

    -- ?뚮┝ ?곹깭
    notification_sent BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMPTZ,

    -- 硫뷀?
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_compensations_incident ON incident_compensations(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_compensations_user ON incident_compensations(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_compensations_unique ON incident_compensations(incident_id, user_id);



CREATE OR REPLACE FUNCTION calculate_compensation_credits(
    p_plan VARCHAR(50),
    p_incident_level incident_level
) RETURNS INTEGER AS $$
DECLARE
    v_base_credits INTEGER;
    v_rate FLOAT;
BEGIN
    -- ?뚮옖蹂?湲곕낯 ?щ젅??
    v_base_credits := CASE p_plan
        WHEN 'starter' THEN 50
        WHEN 'pro' THEN 150
        WHEN 'enterprise' THEN 300
        ELSE 50
    END;

    -- ?μ븷 ?깃툒蹂?蹂댁긽瑜?
    v_rate := CASE p_incident_level
        WHEN 'P1' THEN 0.15
        WHEN 'P2' THEN 0.10
        WHEN 'P3' THEN 0.05
        ELSE 0.05
    END;

    RETURN CEIL(v_base_credits * v_rate);
END;
$$ LANGUAGE plpgsql IMMUTABLE;


CREATE OR REPLACE FUNCTION process_incident_compensation(
    p_incident_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_incident RECORD;
    v_user RECORD;
    v_credits INTEGER;
    v_idempotency_key TEXT;
    v_processed_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
BEGIN
    -- ?μ븷 ?뺣낫 議고쉶
    SELECT * INTO v_incident
    FROM incident_reports
    WHERE id = p_incident_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Incident not found'
        );
    END IF;

    -- ?대? 泥섎-??寃쎌슦
    IF v_incident.status = 'compensation_completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Already processed'
        );
    END IF;

    -- ?쒖꽦 援щ룆?????蹂댁긽 泥섎-
    FOR v_user IN
        SELECT id, plan
        FROM users
        WHERE subscription_status = 'active'
          AND plan != 'starter'  -- 臾대즺 ?뚮옖 ?쒖쇅
    LOOP
        v_idempotency_key := 'incident_' || p_incident_id || '_user_' || v_user.id;

        -- ?대? 蹂댁긽 諛쏆? 寃쎌슦 ?ㅽ궢
        IF EXISTS (SELECT 1 FROM incident_compensations WHERE idempotency_key = v_idempotency_key) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- 蹂댁긽 ?щ젅??怨꾩궛
        v_credits := calculate_compensation_credits(v_user.plan, v_incident.level);

        -- 蹂댁긽 湲곕줉 ?앹꽦
        INSERT INTO incident_compensations (
            incident_id,
            user_id,
            credits_granted,
            plan_at_incident,
            idempotency_key
        ) VALUES (
            p_incident_id,
            v_user.id,
            v_credits,
            v_user.plan,
            v_idempotency_key
        );

        -- ?щ젅??吏湲?(異붽? ?щ젅?㏃쑝濡?
        UPDATE users
        SET credits = credits + v_credits
        WHERE id = v_user.id;

        -- ?щ젅???몃옖??뀡 湲곕줉
        INSERT INTO credit_transactions (
            user_id,
            type,
            amount,
            balance_after,
            description,
            metadata
        )
        SELECT
            v_user.id,
            'compensation',
            v_credits,
            credits,
            '' || v_incident.level || ')',
            jsonb_build_object(
                'incident_id', p_incident_id,
                'incident_title', v_incident.title,
                'incident_level', v_incident.level::TEXT
            )
        FROM users
        WHERE id = v_user.id;

        v_processed_count := v_processed_count + 1;
    END LOOP;

    -- ?μ븷 ?곹깭 ?낅뜲?댄듃
    UPDATE incident_reports
    SET
        status = 'compensation_completed',
        compensation_processed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_incident_id;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'processed_count', v_processed_count,
        'skipped_count', v_skipped_count,
        'incident_id', p_incident_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION resolve_incident(
    p_incident_id UUID,
    p_resolved_by VARCHAR(255) DEFAULT 'system'
) RETURNS JSONB AS $$
DECLARE
    v_incident RECORD;
    v_duration FLOAT;
    v_auto_rate FLOAT;
BEGIN
    -- ?μ븷 ?뺣낫 議고쉶
    SELECT * INTO v_incident
    FROM incident_reports
    WHERE id = p_incident_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Incident not found');
    END IF;

    -- 醫낅즺 ?쒓컙 ?ㅼ젙
    UPDATE incident_reports
    SET
        ended_at = NOW(),
        status = 'compensation_pending',
        resolved_by = p_resolved_by,
        updated_at = NOW()
    WHERE id = p_incident_id
    RETURNING EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600 INTO v_duration;

    -- ?먮룞 蹂댁긽瑜??ㅼ젙 (?깃툒 湲곗?)
    v_auto_rate := CASE v_incident.level
        WHEN 'P1' THEN 0.15
        WHEN 'P2' THEN 0.10
        WHEN 'P3' THEN 0.05
    END;

    UPDATE incident_reports
    SET compensation_rate = v_auto_rate
    WHERE id = p_incident_id AND compensation_rate IS NULL;

    RETURN jsonb_build_object(
        'success', true,
        'incident_id', p_incident_id,
        'duration_hours', ROUND(v_duration::NUMERIC, 2),
        'compensation_rate', v_auto_rate
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_compensations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incident_reports_select ON incident_reports;
CREATE POLICY incident_reports_select ON incident_reports
    FOR SELECT USING (true);

DROP POLICY IF EXISTS incident_compensations_select ON incident_compensations;
CREATE POLICY incident_compensations_select ON incident_compensations
    FOR SELECT USING (user_id = auth.uid());


