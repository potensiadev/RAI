-- =====================================================
-- Migration: Fix User Credits (One-time fix)
-- 중복 차감된 크레딧 복원
--
-- 문제: presign + worker 양쪽에서 크레딧 차감 발생
-- 해결: Worker의 deduct_credit 호출 제거 후,
--       이미 중복 차감된 크레딧 복원
-- =====================================================

-- 특정 사용자의 크레딧 복원 (실제 업로드 2개, 차감 8개 → 6개 복원)
-- 주의: 이 마이그레이션은 한 번만 실행되어야 함

UPDATE users
SET credits_used_this_month = GREATEST(0, credits_used_this_month - 6),
    updated_at = NOW()
WHERE id = 'c8b8ed34-63d4-4abe-bbae-73a9aefb7a81';

-- 복원 기록
INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description
)
SELECT
    'c8b8ed34-63d4-4abe-bbae-73a9aefb7a81',
    'refund',
    6,
    50 - credits_used_this_month + 6,
    '크레딧 중복 차감 버그 수정 (presign + worker 이중 차감)'
FROM users
WHERE id = 'c8b8ed34-63d4-4abe-bbae-73a9aefb7a81';
