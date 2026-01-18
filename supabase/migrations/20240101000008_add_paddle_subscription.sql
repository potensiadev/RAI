-- 008_add_paddle_subscription.sql
--
-- - paddle_customer_id: Paddle 怨좉컼 ID
-- - paddle_subscription_id: Paddle 援щ룆 ID

ALTER TABLE users
ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_paddle_customer_id ON users(paddle_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_subscription_status') THEN
        ALTER TABLE users ADD CONSTRAINT check_subscription_status
        CHECK (subscription_status IS NULL OR subscription_status IN ('none', 'active', 'canceled', 'past_due', 'trialing'));
    END IF;
END $$;


