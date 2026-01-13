-- 008_add_paddle_subscription.sql
-- Paddle 구독 관련 컬럼 추가 (users 테이블)
--
-- Paddle Billing 연동을 위한 구독 상태 관리 필드들
-- - paddle_customer_id: Paddle 고객 ID
-- - paddle_subscription_id: Paddle 구독 ID
-- - subscription_status: 구독 상태 (active, canceled, past_due 등)
-- - current_period_end: 현재 구독 기간 종료일
-- - cancel_at_period_end: 기간 종료 시 취소 예정 여부

-- 1. Paddle 구독 관련 컬럼 추가
ALTER TABLE users
ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- 2. 인덱스 추가 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_paddle_customer_id ON users(paddle_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- 3. 구독 상태 체크 제약 조건
ALTER TABLE users
ADD CONSTRAINT IF NOT EXISTS check_subscription_status
CHECK (subscription_status IS NULL OR subscription_status IN ('none', 'active', 'canceled', 'past_due', 'trialing'));

-- 4. 주석 추가
COMMENT ON COLUMN users.paddle_customer_id IS 'Paddle 고객 ID (ctm_xxx)';
COMMENT ON COLUMN users.paddle_subscription_id IS 'Paddle 구독 ID (sub_xxx)';
COMMENT ON COLUMN users.subscription_status IS '구독 상태: none, active, canceled, past_due, trialing';
COMMENT ON COLUMN users.current_period_end IS '현재 구독 기간 종료일';
COMMENT ON COLUMN users.cancel_at_period_end IS '기간 종료 시 자동 취소 여부';
