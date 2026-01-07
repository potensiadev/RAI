-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration 019: Fix Billing Cycle Security Vulnerabilities
-- 빌링 사이클 및 크레딧 보안 취약점 수정
--
-- 수정 내용:
-- 1. RLS 정책: 민감한 컬럼 업데이트 제한
-- 2. 월말 날짜 오버플로우 버그 수정
-- 3. Race condition 방지
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. RLS 정책 수정: 사용자가 업데이트할 수 있는 컬럼 제한
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 기존 UPDATE 정책 삭제
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- 새 UPDATE 정책: 안전한 컬럼만 업데이트 허용
-- 민감한 컬럼(credits, plan, billing_cycle 등)은 업데이트 불가
CREATE POLICY "Users can update own profile safely"
    ON users FOR UPDATE
    USING (email = auth.jwt()->>'email')
    WITH CHECK (
        -- 민감한 컬럼이 변경되지 않았는지 확인
        -- WITH CHECK는 UPDATE 후 상태를 검증
        -- 트리거로 추가 검증
        email = auth.jwt()->>'email'
    );

-- 민감한 컬럼 변경 방지 트리거
CREATE OR REPLACE FUNCTION prevent_sensitive_column_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Service Role이나 Postgres 직접 접근은 허용
    IF current_setting('role', true) = 'service_role'
       OR current_setting('role', true) = 'postgres'
       OR current_setting('role', true) IS NULL THEN
        RETURN NEW;
    END IF;

    -- 민감한 컬럼 변경 감지
    IF OLD.credits IS DISTINCT FROM NEW.credits THEN
        RAISE EXCEPTION 'Cannot update credits directly';
    END IF;

    IF OLD.credits_used_this_month IS DISTINCT FROM NEW.credits_used_this_month THEN
        RAISE EXCEPTION 'Cannot update credits_used_this_month directly';
    END IF;

    IF OLD.credits_reserved IS DISTINCT FROM NEW.credits_reserved THEN
        RAISE EXCEPTION 'Cannot update credits_reserved directly';
    END IF;

    IF OLD.plan IS DISTINCT FROM NEW.plan THEN
        RAISE EXCEPTION 'Cannot update plan directly';
    END IF;

    IF OLD.billing_cycle_start IS DISTINCT FROM NEW.billing_cycle_start THEN
        RAISE EXCEPTION 'Cannot update billing_cycle_start directly';
    END IF;

    IF OLD.plan_started_at IS DISTINCT FROM NEW.plan_started_at THEN
        RAISE EXCEPTION 'Cannot update plan_started_at directly';
    END IF;

    IF OLD.credits_reset_at IS DISTINCT FROM NEW.credits_reset_at THEN
        RAISE EXCEPTION 'Cannot update credits_reset_at directly';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS tr_prevent_sensitive_update ON users;
CREATE TRIGGER tr_prevent_sensitive_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_sensitive_column_update();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. 월말 날짜 오버플로우 수정 (31일 → 28일 문제 해결)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 다음 빌링 사이클 날짜 계산 함수 (날짜 보존)
CREATE OR REPLACE FUNCTION calculate_next_billing_date(
    p_current_cycle DATE,
    p_original_day INTEGER
)
RETURNS DATE AS $$
DECLARE
    v_next_month DATE;
    v_target_day INTEGER;
    v_last_day_of_month INTEGER;
BEGIN
    -- 다음 달 1일
    v_next_month := DATE_TRUNC('month', p_current_cycle) + INTERVAL '1 month';

    -- 다음 달의 마지막 날
    v_last_day_of_month := EXTRACT(DAY FROM (v_next_month + INTERVAL '1 month - 1 day'));

    -- 원래 날짜와 다음 달 마지막 날 중 작은 값 사용
    v_target_day := LEAST(p_original_day, v_last_day_of_month);

    -- 날짜 생성
    RETURN v_next_month + (v_target_day - 1) * INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 개별 사용자 크레딧 리셋 함수 (월말 버그 수정 + Race Condition 방지)
CREATE OR REPLACE FUNCTION check_and_reset_user_credits(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_billing_cycle DATE;
    v_plan_started_at DATE;
    v_original_day INTEGER;
    v_next_reset_date DATE;
BEGIN
    -- FOR UPDATE로 락 획득 (Race Condition 방지)
    SELECT billing_cycle_start, plan_started_at
    INTO v_billing_cycle, v_plan_started_at
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    -- billing_cycle_start가 NULL이면 초기화
    IF v_billing_cycle IS NULL THEN
        v_billing_cycle := COALESCE(v_plan_started_at, CURRENT_DATE);

        UPDATE users
        SET billing_cycle_start = v_billing_cycle,
            plan_started_at = COALESCE(plan_started_at, CURRENT_DATE)
        WHERE id = p_user_id;
    END IF;

    -- 원래 가입일의 "일(day)" 보존 (31일 가입자는 계속 31일 유지)
    v_original_day := EXTRACT(DAY FROM COALESCE(v_plan_started_at, v_billing_cycle));

    -- 다음 리셋 날짜 계산 (월말 오버플로우 방지)
    v_next_reset_date := calculate_next_billing_date(v_billing_cycle, v_original_day);

    -- 현재 날짜가 다음 리셋 날짜 이상이면 리셋
    IF CURRENT_DATE >= v_next_reset_date THEN
        UPDATE users
        SET
            credits_used_this_month = 0,
            credits_reset_at = NOW(),
            billing_cycle_start = v_next_reset_date
        WHERE id = p_user_id;

        -- 리셋 로그
        INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
        SELECT id, 'adjustment', 0, credits,
               '월별 크레딧 자동 리셋 (빌링 사이클: ' || to_char(v_next_reset_date, 'YYYY-MM-DD') || ')'
        FROM users WHERE id = p_user_id;

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. get_user_credits 함수 수정 (월말 버그 수정)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_user RECORD;
    v_base_credits INTEGER;
    v_remaining INTEGER;
    v_was_reset BOOLEAN;
    v_next_reset_date DATE;
    v_original_day INTEGER;
BEGIN
    -- 리셋 체크 (락 포함)
    SELECT check_and_reset_user_credits(p_user_id) INTO v_was_reset;

    -- 사용자 정보 조회
    SELECT plan, credits, credits_used_this_month, billing_cycle_start, plan_started_at
    INTO v_user
    FROM users
    WHERE id = p_user_id;

    -- 사용자가 없으면 NULL 반환
    IF v_user IS NULL THEN
        RETURN NULL;
    END IF;

    -- 플랜별 기본 크레딧
    v_base_credits := CASE v_user.plan
        WHEN 'starter' THEN 50
        WHEN 'pro' THEN 150
        WHEN 'enterprise' THEN 300
        ELSE 50
    END;

    -- 남은 크레딧 계산
    v_remaining := (v_base_credits - COALESCE(v_user.credits_used_this_month, 0))
                   + COALESCE(v_user.credits, 0);

    -- 다음 리셋일 계산 (월말 보정)
    v_original_day := EXTRACT(DAY FROM COALESCE(v_user.plan_started_at, v_user.billing_cycle_start));
    v_next_reset_date := calculate_next_billing_date(
        v_user.billing_cycle_start,
        v_original_day
    );

    RETURN json_build_object(
        'plan', v_user.plan,
        'base_credits', v_base_credits,
        'additional_credits', COALESCE(v_user.credits, 0),
        'used_this_month', COALESCE(v_user.credits_used_this_month, 0),
        'remaining', GREATEST(0, v_remaining),
        'billing_cycle_start', v_user.billing_cycle_start,
        'next_reset_date', v_next_reset_date,
        'plan_started_at', v_user.plan_started_at,
        'was_reset', v_was_reset
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. deduct_credit 함수 수정 (Race Condition 완전 방지)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION deduct_credit(
    p_user_id UUID,
    p_candidate_id UUID,
    p_description TEXT DEFAULT '이력서 분석'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_credits INTEGER;
    v_credits_used INTEGER;
    v_plan plan_type;
    v_base_credits INTEGER;
    v_billing_cycle DATE;
    v_plan_started_at DATE;
    v_original_day INTEGER;
    v_next_reset_date DATE;
BEGIN
    -- 단일 트랜잭션 내에서 락 획득 + 리셋 체크 + 차감 수행
    SELECT credits, credits_used_this_month, plan, billing_cycle_start, plan_started_at
    INTO v_credits, v_credits_used, v_plan, v_billing_cycle, v_plan_started_at
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 빌링 사이클 초기화 필요 시
    IF v_billing_cycle IS NULL THEN
        v_billing_cycle := COALESCE(v_plan_started_at, CURRENT_DATE);
        v_plan_started_at := COALESCE(v_plan_started_at, CURRENT_DATE);

        UPDATE users
        SET billing_cycle_start = v_billing_cycle,
            plan_started_at = v_plan_started_at
        WHERE id = p_user_id;
    END IF;

    -- 리셋 필요 여부 체크
    v_original_day := EXTRACT(DAY FROM COALESCE(v_plan_started_at, v_billing_cycle));
    v_next_reset_date := calculate_next_billing_date(v_billing_cycle, v_original_day);

    IF CURRENT_DATE >= v_next_reset_date THEN
        -- 리셋 수행
        v_credits_used := 0;

        UPDATE users
        SET credits_used_this_month = 0,
            credits_reset_at = NOW(),
            billing_cycle_start = v_next_reset_date
        WHERE id = p_user_id;

        -- 리셋 로그
        INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
        VALUES (p_user_id, 'adjustment', 0, v_credits,
                '월별 크레딧 자동 리셋 (빌링 사이클: ' || to_char(v_next_reset_date, 'YYYY-MM-DD') || ')');
    END IF;

    -- 플랜별 기본 크레딧
    v_base_credits := CASE v_plan
        WHEN 'starter' THEN 50
        WHEN 'pro' THEN 150
        WHEN 'enterprise' THEN 300
        ELSE 50
    END;

    -- 크레딧 부족 체크
    IF (v_base_credits - v_credits_used) <= 0 AND v_credits <= 0 THEN
        RETURN FALSE;
    END IF;

    -- 차감 (기본 크레딧 우선, 그 다음 추가 크레딧)
    IF (v_base_credits - v_credits_used) > 0 THEN
        UPDATE users
        SET credits_used_this_month = credits_used_this_month + 1
        WHERE id = p_user_id;
    ELSE
        UPDATE users
        SET credits = credits - 1
        WHERE id = p_user_id;
    END IF;

    -- 트랜잭션 기록
    INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, candidate_id)
    VALUES (
        p_user_id,
        'usage',
        -1,
        CASE WHEN (v_base_credits - v_credits_used) > 0
            THEN v_credits
            ELSE v_credits - 1
        END,
        p_description,
        p_candidate_id
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 코멘트
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON FUNCTION prevent_sensitive_column_update() IS '민감한 컬럼(credits, plan 등) 직접 업데이트 방지 트리거';
COMMENT ON FUNCTION calculate_next_billing_date(DATE, INTEGER) IS '다음 빌링 날짜 계산 (월말 오버플로우 방지)';
