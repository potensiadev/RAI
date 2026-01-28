-- =====================================================
-- Migration: Service Role Policies
-- Service Role이 processing_jobs, candidates 테이블에
-- 접근할 수 있도록 정책 추가
-- =====================================================

-- Service Role은 모든 작업 허용 (processing_jobs)
DROP POLICY IF EXISTS "Service role full access on processing_jobs" ON processing_jobs;
CREATE POLICY "Service role full access on processing_jobs"
    ON processing_jobs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Service Role은 모든 작업 허용 (candidates)
DROP POLICY IF EXISTS "Service role full access on candidates" ON candidates;
CREATE POLICY "Service role full access on candidates"
    ON candidates
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Service Role은 모든 작업 허용 (credit_transactions)
DROP POLICY IF EXISTS "Service role full access on credit_transactions" ON credit_transactions;
CREATE POLICY "Service role full access on credit_transactions"
    ON credit_transactions
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
