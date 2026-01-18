-- Migration: 014_webhook_failures.sql

CREATE TABLE IF NOT EXISTS webhook_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_retry_count CHECK (retry_count >= 0 AND retry_count <= 10)
);

CREATE INDEX IF NOT EXISTS idx_webhook_failures_job_id ON webhook_failures(job_id);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_created_at ON webhook_failures(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_unresolved ON webhook_failures(created_at) WHERE resolved_at IS NULL;


ALTER TABLE webhook_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage webhook_failures"
    ON webhook_failures FOR ALL
    USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION retry_failed_webhooks()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- ???⑥닔??諛곗튂 ?묒뾽?먯꽌 ?몄텧?????덉쓬
    -- ?ㅼ젣 ?ъ떆??濡쒖쭅? Worker?먯꽌 泥섎-
    SELECT COUNT(*) INTO v_count
    FROM webhook_failures
    WHERE resolved_at IS NULL
    AND retry_count < 10
    AND (last_retry_at IS NULL OR last_retry_at < NOW() - INTERVAL '5 minutes');

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

