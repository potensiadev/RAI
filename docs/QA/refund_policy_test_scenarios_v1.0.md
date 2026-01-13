# 환불 정책 E2E 테스트 시나리오 및 엣지 케이스

**문서 버전:** 1.0
**작성일:** 2025.01.13
**작성자:** Senior QA Engineer
**대상 PRD:** prd_refund_policy_v0.4.md
**목적:** 환불 정책의 정확한 코드 반영 검증 및 운영 이슈 사전 방지

---

## 1. 테스트 범위 및 전략

### 1.1 테스트 범위

| 영역 | Phase | 우선순위 |
|------|-------|----------|
| 품질 기반 자동 환불 | Phase 1 | P0 |
| Config 기반 환불 조건 | Phase 0-1 | P0 |
| Idempotency & 동시성 | Phase 0-1 | P0 |
| Monthly Credit Reset (Lazy) | Phase 0-1 | P0 |
| Storage 파일 삭제 & Cleanup | Phase 0-1 | P1 |
| PII 암호화 | Phase 1 | P1 |
| 사용자 알림 (Realtime) | Phase 1 | P2 |
| 구독 환불 (Pro-rata) | Phase 2 | P1 |
| Paddle API 연동 | Phase 2 | P1 |
| 서비스 장애 보상 | Phase 3 | P2 |

### 1.2 테스트 환경

| 환경 | 용도 |
|------|------|
| Local | 단위 테스트, 개발 검증 |
| Staging | 통합 테스트, E2E 테스트 |
| Sandbox (Paddle) | 결제 환불 테스트 |
| Production (Canary) | 최종 검증 (1% 트래픽) |

### 1.3 테스트 데이터 전략

```typescript
// 테스트 사용자 시드 데이터
const TEST_USERS = {
  normal: { plan: 'pro', credits_used: 50 },
  heavy: { plan: 'pro', credits_used: 140 },  // 80% 초과
  new: { plan: 'pro', credits_used: 5 },      // 7일 이내
  free: { plan: 'starter', credits_used: 0 },
  enterprise: { plan: 'enterprise', credits_used: 100 },
};

// 테스트 분석 결과 시드 데이터
const TEST_ANALYSIS_RESULTS = {
  high_quality: { confidence: 0.95, name: '홍길동', phone: '010-1234-5678', email: 'test@test.com', last_company: '삼성전자' },
  low_quality: { confidence: 0.25, name: null, phone: null, email: null, last_company: null },
  boundary: { confidence: 0.3, name: '김철수', phone: null, email: null, last_company: null },
  partial: { confidence: 0.2, name: '이영희', phone: null, email: 'lee@test.com', last_company: null },
};
```

---

## 2. E2E 테스트 시나리오

### 2.1 품질 기반 자동 환불 (Phase 1 Core)

#### Scenario 2.1.1: 정상 환불 플로우
```gherkin
Feature: 품질 미달 자동 환불
  As a 사용자
  I want 품질이 낮은 분석에 대해 자동으로 크레딧을 환불받고 싶다
  So that 불량 분석에 대한 비용을 지불하지 않아도 된다

  Background:
    Given 사용자 "user_A"가 Pro 플랜으로 로그인되어 있다
    And 사용자의 credits_used_this_month는 50이다
    And REFUND_CONFIG.quality.confidenceThreshold는 0.3이다
    And REFUND_CONFIG.quality.requiredMissingFields는 2이다

  Scenario: 품질 미달 (confidence < 0.3, 필드 3개 누락) 시 자동 환불
    Given 사용자가 이력서 파일 "resume_low_quality.pdf"를 업로드한다
    When Worker가 분석을 완료하고 다음 결과를 반환한다:
      | confidence_score | 0.25 |
      | name             | null |
      | phone            | null |
      | email            | null |
      | last_company     | null |
    Then Webhook 핸들러가 환불 조건을 체크한다
    And checkQualityRefundCondition()이 { eligible: true, missingFields: ["name", "contact", "last_company"] }를 반환한다
    And process_quality_refund RPC가 호출된다
    And candidates 테이블에서 해당 candidate의 status가 "refunded"로 변경된다
    And candidates 테이블에서 해당 candidate의 deleted_at이 설정된다
    And credit_transactions 테이블에 type="refund", refund_reason="quality_fail" 레코드가 생성된다
    And users 테이블에서 credits_used_this_month가 49로 감소한다
    And processing_jobs 테이블에서 status가 "refunded"로 변경된다
    And Storage에서 원본 파일이 삭제된다
    And 사용자에게 Realtime 토스트 알림이 전송된다
    And 알림 메시지는 "분석 품질 미달로 크레딧이 환불되었습니다. 파일 확인 후 다시 업로드해주세요."이다

  Scenario: 품질 충분 (confidence >= 0.3) 시 환불 안 됨
    Given 사용자가 이력서 파일 "resume_good.pdf"를 업로드한다
    When Worker가 분석을 완료하고 다음 결과를 반환한다:
      | confidence_score | 0.85 |
      | name             | 홍길동 |
      | phone            | 010-1234-5678 |
      | email            | hong@test.com |
      | last_company     | 삼성전자 |
    Then checkQualityRefundCondition()이 { eligible: false, missingFields: [] }를 반환한다
    And 환불 처리가 진행되지 않는다
    And candidate의 status는 "completed"로 유지된다
    And credits_used_this_month는 51로 유지된다

  Scenario: 경계값 (confidence = 0.3) 시 환불 안 됨
    Given 사용자가 이력서 파일 "resume_boundary.pdf"를 업로드한다
    When Worker가 분석을 완료하고 confidence_score = 0.3을 반환한다
    Then checkQualityRefundCondition()이 { eligible: false }를 반환한다
    And 환불 처리가 진행되지 않는다
```

#### Scenario 2.1.2: 필드 누락 조합 테스트
```gherkin
  Scenario Outline: 핵심 필드 누락 개수별 환불 여부
    Given confidence_score = <confidence>
    And name = <name>
    And phone = <phone>
    And email = <email>
    And last_company = <last_company>
    When 환불 조건을 체크한다
    Then 환불 여부는 <refund_eligible>이다
    And 누락 필드 개수는 <missing_count>이다

    Examples:
      | confidence | name   | phone         | email          | last_company | missing_count | refund_eligible |
      | 0.25       | null   | null          | null           | null         | 3             | true            |
      | 0.25       | 홍길동 | null          | null           | null         | 2             | true            |
      | 0.25       | 홍길동 | 010-1234-5678 | null           | null         | 1             | false           |
      | 0.25       | 홍길동 | null          | hong@test.com  | null         | 1             | false           |
      | 0.25       | null   | 010-1234-5678 | null           | 삼성전자     | 1             | false           |
      | 0.25       | null   | null          | hong@test.com  | 삼성전자     | 1             | false           |
      | 0.29       | null   | null          | null           | null         | 3             | true            |
      | 0.30       | null   | null          | null           | null         | 3             | false           |
      | 0.31       | null   | null          | null           | null         | 3             | false           |
```

### 2.2 Idempotency & 동시성 테스트

#### Scenario 2.2.1: 중복 환불 방지
```gherkin
Feature: Idempotency 보장
  As a 시스템
  I want 동일한 환불 요청이 여러 번 들어와도 한 번만 처리되어야 한다
  So that 크레딧 이중 환불을 방지할 수 있다

  Scenario: 동일 candidate에 대한 중복 환불 요청
    Given candidate_id = "cand_001"에 대한 환불이 이미 처리되었다
    And credit_transactions에 idempotency_key = "quality_refund_cand_001" 레코드가 존재한다
    When 동일 candidate에 대해 환불 요청이 다시 들어온다
    Then process_quality_refund RPC가 { success: true, idempotent: true }를 반환한다
    And credit_transactions에 새로운 레코드가 생성되지 않는다
    And credits_used_this_month가 변경되지 않는다
    And 로그에 "[Refund] Idempotent: cand_001"이 기록된다

  Scenario: 동시에 2개의 환불 요청이 들어오는 경우
    Given candidate_id = "cand_002"가 아직 환불되지 않았다
    When 동시에 2개의 환불 요청이 병렬로 들어온다
    Then Advisory Lock에 의해 첫 번째 요청이 먼저 처리된다
    And 두 번째 요청은 Lock 대기 후 Idempotency 체크에서 걸린다
    And 최종적으로 1건의 환불만 처리된다
    And credit_transactions에 1건의 레코드만 존재한다

  Scenario: Worker 재시도로 인한 Webhook 중복 호출
    Given Worker가 분석을 완료하고 Webhook을 호출했다
    And 첫 번째 Webhook 호출이 성공적으로 환불을 처리했다
    When Worker가 응답 지연으로 Webhook을 재시도한다
    Then 두 번째 Webhook 호출은 idempotent: true를 반환한다
    And 환불은 중복 처리되지 않는다
```

#### Scenario 2.2.2: Advisory Lock 동작 검증
```gherkin
  Scenario: Advisory Lock으로 동시 처리 직렬화
    Given 3개의 병렬 요청이 동일 candidate에 대해 환불을 요청한다
    When 모든 요청이 process_quality_refund RPC를 호출한다
    Then pg_advisory_xact_lock이 hashtext('refund_cand_003')로 Lock을 획득한다
    And 첫 번째 요청만 실제 환불을 처리한다
    And 나머지 요청은 Lock 해제 후 Idempotent 체크에서 걸린다
    And 전체 처리 시간은 순차 처리 시간과 유사하다 (병렬 아님)
```

### 2.3 Monthly Credit Reset (Lazy Reset)

#### Scenario 2.3.1: 월 변경 시 Lazy Reset
```gherkin
Feature: 월간 크레딧 Lazy Reset
  As a 시스템
  I want 환불 처리 시점에 월간 크레딧을 자동으로 리셋하고 싶다
  So that 별도의 Cron job 없이도 정확한 크레딧 관리가 가능하다

  Scenario: 월 변경 후 첫 환불 시 자동 리셋
    Given 사용자의 billing_cycle_start = "2025-01-01"
    And credits_used_this_month = 100
    And 현재 날짜 = "2025-02-01"
    When 품질 미달로 환불이 처리된다
    Then check_and_reset_user_credits가 먼저 호출된다
    And credits_used_this_month가 0으로 리셋된다
    And billing_cycle_start가 "2025-02-01"로 업데이트된다
    And 그 후 환불 처리가 진행된다
    And 최종 credits_used_this_month = 0 (리셋 후 -1 하지 않음, GREATEST(0, 0-1) = 0)

  Scenario: 같은 월 내에서는 리셋하지 않음
    Given 사용자의 billing_cycle_start = "2025-02-01"
    And credits_used_this_month = 50
    And 현재 날짜 = "2025-02-15"
    When 품질 미달로 환불이 처리된다
    Then check_and_reset_user_credits가 호출되지만 조건 불충족으로 리셋하지 않음
    And credits_used_this_month = 49 (50 - 1)

  Scenario: 월말 경계 (1월 31일 23:59:59 → 2월 1일 00:00:00)
    Given 업로드 시점 = "2025-01-31 23:59:59"
    And 환불 처리 시점 = "2025-02-01 00:00:01"
    And 업로드 시 credits_used_this_month = 100 (1월 기준)
    When 환불이 처리된다
    Then 2월 기준으로 리셋 후 처리
    And 최종 credits_used_this_month = 0
    And credit_transactions의 created_at은 2월 1일로 기록됨
```

### 2.4 Storage 파일 삭제 & Cleanup

#### Scenario 2.4.1: 환불 시 Storage 삭제
```gherkin
Feature: Storage 파일 삭제
  As a 시스템
  I want 환불 처리 시 원본 파일을 삭제하고 싶다
  So that 스토리지 비용을 절감하고 개인정보를 보호할 수 있다

  Scenario: 환불 시 Storage 파일 정상 삭제
    Given candidate_id = "cand_004"의 job_id = "job_004"
    And Storage 경로 = "uploads/user_001/job_004.pdf"
    When 품질 미달로 환불이 처리된다
    Then RPC로 DB 업데이트가 완료된다
    And Storage에서 "uploads/user_001/job_004.pdf" 파일이 삭제된다
    And 로그에 "[QualityRefund] File deleted: uploads/user_001/job_004.pdf"가 기록된다

  Scenario: Storage 삭제 실패해도 환불은 성공
    Given Storage API가 503 에러를 반환하는 상황
    When 품질 미달로 환불이 처리된다
    Then RPC로 DB 업데이트가 완료된다 (환불 성공)
    And Storage 삭제는 실패한다
    And 로그에 "[QualityRefund] Storage deletion failed: ..."가 기록된다
    And processing_jobs.error_message는 null로 유지 (배치에서 재시도 대상)
    And 환불 응답은 { success: true }를 반환한다

  Scenario: 배치 Cleanup으로 잔존 파일 삭제
    Given processing_jobs에 status = "refunded", error_message = null인 레코드가 존재한다
    When cleanupOrphanedFiles() 배치가 실행된다
    Then Storage에서 해당 파일 삭제를 시도한다
    And 삭제 성공 시 error_message = "STORAGE_CLEANED"로 업데이트
    And 삭제 실패 시 error_message = "STORAGE_DELETE_FAILED: {error}"로 업데이트
    And 로그에 "[Cleanup] Deleted: ..." 또는 "[Cleanup] Failed: ..."가 기록된다
```

### 2.5 Config 외부화 검증

#### Scenario 2.5.1: 환경 변수 오버라이드
```gherkin
Feature: Config 환경 변수 오버라이드
  As a 운영자
  I want 환경 변수로 환불 조건을 변경하고 싶다
  So that 코드 배포 없이 정책을 조정할 수 있다

  Scenario: confidence threshold 환경 변수 오버라이드
    Given REFUND_CONFIDENCE_THRESHOLD = "0.4" 환경 변수가 설정되었다
    When 서버가 시작된다
    Then REFUND_CONFIG.quality.confidenceThreshold = 0.4
    And confidence = 0.35인 분석은 환불 대상이 된다 (0.35 < 0.4)

  Scenario: requiredMissingFields 환경 변수 오버라이드
    Given REFUND_REQUIRED_MISSING_FIELDS = "3" 환경 변수가 설정되었다
    When 서버가 시작된다
    Then REFUND_CONFIG.quality.requiredMissingFields = 3
    And 필드 2개 누락인 경우 환불 대상이 아니다

  Scenario: 환경 변수 없을 때 기본값 사용
    Given 환경 변수가 설정되지 않았다
    When 서버가 시작된다
    Then REFUND_CONFIG.quality.confidenceThreshold = 0.3 (기본값)
    And REFUND_CONFIG.quality.requiredMissingFields = 2 (기본값)
```

### 2.6 사용자 알림 (Realtime)

#### Scenario 2.6.1: 토스트 알림 전송
```gherkin
Feature: 환불 알림
  As a 사용자
  I want 환불이 처리되면 실시간으로 알림을 받고 싶다
  So that 크레딧이 복구되었음을 즉시 알 수 있다

  Scenario: 환불 시 Realtime 토스트 알림
    Given 사용자가 대시보드 페이지에 접속해 있다
    And Supabase Realtime 채널 "user:{userId}"에 구독 중이다
    When 해당 사용자의 candidate가 품질 미달로 환불된다
    Then Realtime broadcast로 "quality_refund" 이벤트가 전송된다
    And 클라이언트에서 토스트 알림이 표시된다
    And 알림 메시지는 "분석 품질 미달로 크레딧이 환불되었습니다. 파일 확인 후 다시 업로드해주세요."

  Scenario: 사용자가 오프라인일 때 알림
    Given 사용자가 페이지를 닫고 오프라인 상태이다
    When 해당 사용자의 candidate가 환불된다
    Then Realtime broadcast가 전송되지만 수신자 없음
    And 알림 실패는 무시되고 환불은 정상 처리됨
    And 사용자가 다음에 접속하면 크레딧 잔액으로 환불을 확인 가능
```

### 2.7 구독 환불 (Phase 2)

#### Scenario 2.7.1: 7일 이내 전액 환불
```gherkin
Feature: 7일 이내 전액 환불
  As a 사용자
  I want 구독 후 7일 이내에 취소하면 전액 환불받고 싶다
  So that 서비스가 맞지 않으면 부담 없이 취소할 수 있다

  Scenario: 7일 이내 + 10건 이하 사용 시 전액 환불
    Given 구독 시작일 = "2025-02-01"
    And 현재 날짜 = "2025-02-05" (4일 경과)
    And credits_used_this_month = 8
    When 구독 취소를 요청한다
    Then isFullRefundEligible()이 true를 반환한다
    And 전액 환불이 처리된다
    And Paddle Refund API가 전체 금액으로 호출된다

  Scenario: 7일 이내 + 11건 사용 시 부분 환불
    Given 구독 시작일 = "2025-02-01"
    And 현재 날짜 = "2025-02-05" (4일 경과)
    And credits_used_this_month = 11
    When 구독 취소를 요청한다
    Then isFullRefundEligible()이 false를 반환한다 (크레딧 초과)
    And Pro-rata 부분 환불이 계산된다

  Scenario: 8일 경과 시 부분 환불
    Given 구독 시작일 = "2025-02-01"
    And 현재 날짜 = "2025-02-09" (8일 경과)
    And credits_used_this_month = 5
    When 구독 취소를 요청한다
    Then isFullRefundEligible()이 false를 반환한다 (기간 초과)
    And Pro-rata 부분 환불이 계산된다
```

#### Scenario 2.7.2: Pro-rata 환불 계산
```gherkin
  Scenario Outline: Pro-rata 환불 금액 계산
    Given 결제 금액 = <payment>원
    And 잔여 일수 = <remaining_days>일
    And 크레딧 사용률 = <usage_rate>
    And 사용 크레딧 = <used_credits>건
    And 플랜 = <plan>
    When calculateRefund()를 호출한다
    Then 조정 계수는 <factor>이다
    And 환불 금액은 <refund_amount>원이다

    Examples:
      | payment | remaining_days | usage_rate | used_credits | plan       | factor | refund_amount |
      | 49000   | 20             | 0.3        | 45           | pro        | 0.8    | 8133          |
      | 49000   | 20             | 0.6        | 90           | pro        | 0.5    | 0             |
      | 49000   | 20             | 0.85       | 127          | pro        | 0      | 0             |
      | 99000   | 15             | 0.4        | 120          | enterprise | 0.8    | 0             |
      | 49000   | 0              | 0.3        | 45           | pro        | 0.8    | 0             |
```

---

## 3. 엣지 케이스 (50개 이상)

### 3.1 Confidence Score 엣지 케이스 (EC-001 ~ EC-010)

| ID | 케이스 | 입력 | 기대 결과 | 우선순위 |
|----|--------|------|----------|----------|
| EC-001 | confidence = null | `{ confidence_score: null }` | 0으로 처리, 환불 조건 체크 진행 | P0 |
| EC-002 | confidence = undefined | `{ confidence_score: undefined }` | 0으로 처리, 환불 조건 체크 진행 | P0 |
| EC-003 | confidence = 0 | `{ confidence_score: 0 }` | 환불 대상 (0 < 0.3) | P0 |
| EC-004 | confidence = 0.29999 | `{ confidence_score: 0.29999 }` | 환불 대상 (0.29999 < 0.3) | P0 |
| EC-005 | confidence = 0.3 (정확히) | `{ confidence_score: 0.3 }` | 환불 안 됨 (0.3 >= 0.3) | P0 |
| EC-006 | confidence = 0.30001 | `{ confidence_score: 0.30001 }` | 환불 안 됨 | P0 |
| EC-007 | confidence = -0.1 (음수) | `{ confidence_score: -0.1 }` | 환불 대상 (-0.1 < 0.3), 경고 로깅 | P1 |
| EC-008 | confidence = 1.5 (범위 초과) | `{ confidence_score: 1.5 }` | 환불 안 됨, 경고 로깅 | P1 |
| EC-009 | confidence = "0.25" (문자열) | `{ confidence_score: "0.25" }` | 타입 에러 또는 변환 후 처리 | P1 |
| EC-010 | confidence = NaN | `{ confidence_score: NaN }` | 0으로 처리 또는 에러 | P1 |

### 3.2 필드 누락 엣지 케이스 (EC-011 ~ EC-025)

| ID | 케이스 | 입력 | 기대 결과 | 우선순위 |
|----|--------|------|----------|----------|
| EC-011 | name = 빈 문자열 | `{ name: "" }` | 누락으로 처리 | P0 |
| EC-012 | name = 공백만 | `{ name: "   " }` | 누락으로 처리 (trim 후) | P1 |
| EC-013 | phone = 빈 문자열, email = null | `{ phone: "", email: null }` | contact 누락 | P0 |
| EC-014 | phone = null, email = 빈 문자열 | `{ phone: null, email: "" }` | contact 누락 | P0 |
| EC-015 | phone 형식 불량 | `{ phone: "not-a-phone" }` | contact 존재로 처리 (형식 검증 안 함) | P1 |
| EC-016 | email 형식 불량 | `{ email: "not-an-email" }` | contact 존재로 처리 (형식 검증 안 함) | P1 |
| EC-017 | last_company = 빈 문자열 | `{ last_company: "" }` | 누락으로 처리 | P0 |
| EC-018 | last_company = 0 (숫자) | `{ last_company: 0 }` | Falsy로 누락 처리? 또는 존재? | P1 |
| EC-019 | quick_data 전체 null | `{ quick_data: null }` | 모든 필드 누락 (3개) | P0 |
| EC-020 | quick_data 없음 | `{}` | 모든 필드 누락 (3개) | P0 |
| EC-021 | 필드 1개만 누락 (name) | `{ name: null, phone: "010", email: "a@b", last_company: "삼성" }` | missing_count = 1, 환불 안 됨 | P0 |
| EC-022 | 필드 1개만 누락 (contact) | `{ name: "홍길동", phone: null, email: null, last_company: "삼성" }` | missing_count = 1, 환불 안 됨 | P0 |
| EC-023 | 필드 1개만 누락 (last_company) | `{ name: "홍길동", phone: "010", email: null, last_company: null }` | missing_count = 1, 환불 안 됨 | P0 |
| EC-024 | phone 있고 email 없음 | `{ phone: "010-1234", email: null }` | contact 존재 (누락 아님) | P0 |
| EC-025 | phone 없고 email 있음 | `{ phone: null, email: "test@test.com" }` | contact 존재 (누락 아님) | P0 |

### 3.3 동시성 & Idempotency 엣지 케이스 (EC-026 ~ EC-035)

| ID | 케이스 | 시나리오 | 기대 결과 | 우선순위 |
|----|--------|----------|----------|----------|
| EC-026 | 완전 동시 요청 (< 1ms 차이) | 2개 요청이 거의 동시에 RPC 호출 | Advisory Lock으로 직렬화, 1건만 처리 | P0 |
| EC-027 | Lock 대기 중 타임아웃 | 첫 요청 처리 중 두 번째 요청이 30초 대기 | Lock 대기 후 Idempotent 반환 또는 타임아웃 | P1 |
| EC-028 | 이미 환불된 candidate에 DELETE 호출 | status = "refunded"인 candidate에 DELETE API | Idempotent 응답, 추가 처리 없음 | P0 |
| EC-029 | 환불 중 서버 재시작 | RPC 중간에 서버 다운 | Transaction rollback, 재시도 시 정상 처리 | P1 |
| EC-030 | idempotency_key 충돌 | 다른 candidate인데 같은 key (버그 상황) | UNIQUE 제약 위반 에러 | P1 |
| EC-031 | 같은 사용자 다른 candidate 동시 환불 | user_A의 cand_1, cand_2 동시 환불 | 각각 독립적으로 처리 (다른 Lock key) | P0 |
| EC-032 | 다른 사용자 같은 시간 환불 | user_A와 user_B가 동시에 환불 | 각각 독립적으로 처리 | P0 |
| EC-033 | Webhook 3회 재시도 | Worker가 타임아웃으로 3회 재시도 | 첫 번째만 처리, 나머지 Idempotent | P0 |
| EC-034 | RPC 성공 후 응답 전 네트워크 끊김 | DB 업데이트 완료, 응답 전송 실패 | 재시도 시 Idempotent 반환 | P1 |
| EC-035 | Advisory Lock key 해시 충돌 | hashtext()가 다른 candidate에 같은 값 | 확률 극히 낮음, 직렬화 발생 시 성능 저하 | P2 |

### 3.4 Monthly Reset 엣지 케이스 (EC-036 ~ EC-042)

| ID | 케이스 | 시나리오 | 기대 결과 | 우선순위 |
|----|--------|----------|----------|----------|
| EC-036 | 월 첫날 00:00:00 환불 | 2025-02-01 00:00:00에 환불 | 리셋 후 처리, credits = 0 | P0 |
| EC-037 | 월 마지막날 23:59:59 환불 | 2025-01-31 23:59:59에 환불 | 리셋 안 함, 정상 차감 | P0 |
| EC-038 | 2월 → 3월 (28일/29일) | 2월 28일 billing_cycle, 3월 1일 환불 | 정상 리셋 | P1 |
| EC-039 | 윤년 2월 29일 | 2024-02-29 billing_cycle | 정상 처리 | P2 |
| EC-040 | credits_used = 0 상태에서 환불 | 이미 0인데 환불 처리 | GREATEST(0, 0-1) = 0, 음수 방지 | P0 |
| EC-041 | 동시 환불로 음수 시도 | 2건 동시 환불, credits_used = 1 | Lock으로 직렬화, 최종 0 | P0 |
| EC-042 | billing_cycle_start = null | 신규 사용자, 첫 환불 | 리셋 로직 스킵 또는 현재 월 설정 | P1 |

### 3.5 Storage 엣지 케이스 (EC-043 ~ EC-050)

| ID | 케이스 | 시나리오 | 기대 결과 | 우선순위 |
|----|--------|----------|----------|----------|
| EC-043 | 파일이 이미 삭제됨 | Storage에 파일 없는 상태에서 삭제 시도 | 에러 무시, 환불 성공 | P0 |
| EC-044 | file_name = null | processing_jobs.file_name이 null | Storage 삭제 스킵, 환불 성공 | P0 |
| EC-045 | 확장자 없는 파일 | file_name = "resume" (확장자 없음) | ext = undefined, 경로 오류 가능 | P1 |
| EC-046 | 특수문자 파일명 | file_name = "이력서 (최종).pdf" | URL 인코딩 필요, 정상 처리 | P1 |
| EC-047 | Storage bucket 없음 | "resumes" 버킷이 존재하지 않음 | 에러 로깅, 환불 성공 | P1 |
| EC-048 | Storage 권한 없음 | Service Role Key 권한 부족 | 에러 로깅, 환불 성공, 배치로 재시도 | P1 |
| EC-049 | 대용량 파일 삭제 지연 | 10MB 파일 삭제에 시간 소요 | 타임아웃 내 완료 또는 에러 처리 | P2 |
| EC-050 | 배치 실행 중 서버 종료 | Cleanup 중간에 종료 | 다음 배치에서 재시도 (null 체크) | P2 |

### 3.6 PII 암호화 엣지 케이스 (EC-051 ~ EC-055)

| ID | 케이스 | 시나리오 | 기대 결과 | 우선순위 |
|----|--------|----------|----------|----------|
| EC-051 | phone = null 암호화 | null 값 암호화 시도 | null 그대로 저장, 암호화 스킵 | P0 |
| EC-052 | 빈 문자열 암호화 | "" 암호화 시도 | 빈 문자열 암호화 또는 null 처리 | P1 |
| EC-053 | 암호화 키 없음 | PII_ENCRYPTION_KEY 미설정 | 서버 시작 실패 또는 에러 | P0 |
| EC-054 | 암호화 키 변경 | 기존 데이터와 다른 키 | 복호화 실패, 환불 판단에는 영향 없음 | P1 |
| EC-055 | 이모지 포함 이름 | name = "홍길동🎉" | 정상 저장 (UTF-8) | P2 |

### 3.7 API & Webhook 엣지 케이스 (EC-056 ~ EC-062)

| ID | 케이스 | 시나리오 | 기대 결과 | 우선순위 |
|----|--------|----------|----------|----------|
| EC-056 | Webhook payload 빈 객체 | `{}` payload 수신 | 에러 응답 또는 스킵 | P0 |
| EC-057 | candidate_id 유효하지 않음 | 존재하지 않는 candidate_id | 에러 로깅, 404 또는 무시 | P0 |
| EC-058 | user_id 불일치 | Webhook의 user_id와 candidate의 user_id 다름 | 보안 에러, 환불 거부 | P0 |
| EC-059 | DELETE API 인증 없음 | Authorization 헤더 없이 호출 | 401 Unauthorized | P0 |
| EC-060 | DELETE API 권한 없음 | 다른 사용자의 candidate 삭제 시도 | 403 Forbidden | P0 |
| EC-061 | RPC 타임아웃 | process_quality_refund가 30초 초과 | 타임아웃 에러, 재시도 필요 | P1 |
| EC-062 | Supabase 서비스 다운 | Supabase 전체 장애 | 에러 응답, 재시도 필요 | P1 |

### 3.8 구독 환불 엣지 케이스 (EC-063 ~ EC-070)

| ID | 케이스 | 시나리오 | 기대 결과 | 우선순위 |
|----|--------|----------|----------|----------|
| EC-063 | 정확히 7일차 취소 | 7일 00:00:00에 취소 | 전액 환불 대상 (7일 이내) | P0 |
| EC-064 | 7일 + 1초 취소 | 7일 00:00:01에 취소 | 부분 환불 (8일차 시작) | P0 |
| EC-065 | 80% 정확히 사용 | usageRate = 0.8 (120/150) | 조정 계수 0.5 적용 | P0 |
| EC-066 | 80.01% 사용 | usageRate = 0.8001 | 환불 불가 (0 반환) | P0 |
| EC-067 | 잔여 일수 0일 | remainingDays = 0 | 환불 금액 0원 | P0 |
| EC-068 | 결제 금액 0원 | paymentAmount = 0 (무료 체험) | 환불 금액 0원 | P1 |
| EC-069 | Enterprise 단가 적용 | plan = "enterprise" | creditUnitPrice = 350 | P0 |
| EC-070 | Starter 플랜 환불 | plan = "starter" (무료) | 환불 대상 아님 | P1 |

### 3.9 Realtime 알림 엣지 케이스 (EC-071 ~ EC-075)

| ID | 케이스 | 시나리오 | 기대 결과 | 우선순위 |
|----|--------|----------|----------|----------|
| EC-071 | Realtime 연결 끊김 | 알림 전송 시 연결 없음 | 에러 무시, 환불 성공 | P0 |
| EC-072 | 다중 탭 열림 | 사용자가 3개 탭 열어둠 | 모든 탭에 알림 전송 | P1 |
| EC-073 | 채널 구독 전 알림 | 페이지 로드 중 환불 발생 | 알림 누락 가능, 크레딧 잔액으로 확인 | P2 |
| EC-074 | 알림 메시지 XSS | 악의적 메시지 주입 | 클라이언트에서 이스케이프 | P1 |
| EC-075 | 대량 알림 (동시 환불 100건) | 부하 테스트 | Realtime 서비스 안정성 확인 | P2 |

### 3.10 Config 엣지 케이스 (EC-076 ~ EC-080)

| ID | 케이스 | 시나리오 | 기대 결과 | 우선순위 |
|----|--------|----------|----------|----------|
| EC-076 | threshold 음수 설정 | REFUND_CONFIDENCE_THRESHOLD = "-0.1" | 모든 분석이 환불 대상 (버그 상황) | P1 |
| EC-077 | threshold 1 초과 | REFUND_CONFIDENCE_THRESHOLD = "1.5" | 환불 불가 (모든 confidence < 1.5) | P1 |
| EC-078 | requiredMissingFields = 0 | 0으로 설정 | confidence만으로 환불 판단 | P1 |
| EC-079 | requiredMissingFields = 4 | 4로 설정 (불가능한 값) | 환불 불가 (최대 3개 필드) | P1 |
| EC-080 | 환경 변수 숫자 아님 | REFUND_CONFIDENCE_THRESHOLD = "abc" | parseFloat("abc") = NaN, 기본값 사용? | P1 |

---

## 4. 테스트 실행 계획

### 4.1 자동화 테스트 구성

```typescript
// __tests__/refund/quality-refund.test.ts
describe('Quality Refund', () => {
  describe('checkQualityRefundCondition', () => {
    // EC-001 ~ EC-025 커버
    test.each([
      [0.25, null, null, null, null, true, ['name', 'contact', 'last_company']],
      [0.3, null, null, null, null, false, []],
      // ... 모든 케이스
    ])('confidence=%p, name=%p, phone=%p, email=%p, last_company=%p => eligible=%p, missing=%p',
      (confidence, name, phone, email, lastCompany, expectedEligible, expectedMissing) => {
        const result = checkQualityRefundCondition({
          confidence_score: confidence,
          quick_data: { name, phone, email, last_company: lastCompany }
        });
        expect(result.eligible).toBe(expectedEligible);
        expect(result.missingFields).toEqual(expectedMissing);
      }
    );
  });

  describe('process_quality_refund RPC', () => {
    // EC-026 ~ EC-035 커버
    test('동시 요청 시 1건만 처리', async () => {
      const promises = Array(5).fill(null).map(() =>
        supabase.rpc('process_quality_refund', { ... })
      );
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.data?.idempotent === false).length;
      expect(successCount).toBe(1);
    });
  });
});
```

### 4.2 E2E 테스트 구성

```typescript
// e2e/refund.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test.describe('Quality Refund E2E', () => {
  test('저품질 분석 시 자동 환불 + 토스트 알림', async ({ page }) => {
    // 1. 로그인
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // 2. 파일 업로드
    await page.goto('/candidates');
    await page.setInputFiles('input[type="file"]', 'fixtures/low_quality_resume.pdf');

    // 3. 분석 완료 대기 (Worker mock)
    await page.waitForSelector('[data-status="refunded"]', { timeout: 30000 });

    // 4. 토스트 알림 확인
    await expect(page.locator('.toast')).toContainText('분석 품질 미달로 크레딧이 환불되었습니다');

    // 5. 크레딧 잔액 확인
    const credits = await page.textContent('[data-testid="credits-remaining"]');
    expect(parseInt(credits)).toBe(100); // 환불되어 원래대로
  });
});
```

### 4.3 부하 테스트 구성

```yaml
# k6/refund-load.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    concurrent_refunds: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 100,
    },
  },
};

export default function () {
  const res = http.post(`${BASE_URL}/api/webhooks/worker`, {
    job_id: `job_${__VU}_${__ITER}`,
    status: 'completed',
    result: {
      confidence_score: 0.2,
      quick_data: { name: null, phone: null, email: null, last_company: null }
    }
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

---

## 5. 테스트 리포팅

### 5.1 커버리지 목표

| 영역 | 목표 커버리지 | 측정 방법 |
|------|--------------|----------|
| 단위 테스트 | 90% 이상 | Jest coverage |
| 엣지 케이스 | 100% (80개 모두) | 수동 체크리스트 |
| E2E 시나리오 | 100% | Playwright report |
| RPC 함수 | 100% | pgTAP |

### 5.2 결함 분류

| 심각도 | 정의 | 예시 |
|--------|------|------|
| Critical | 환불 누락/이중 환불 | EC-026, EC-041 |
| Major | 잘못된 금액 계산 | EC-065, EC-066 |
| Minor | 알림 누락 | EC-071 |
| Trivial | 로그 메시지 오타 | - |

---

## 6. 체크리스트

### 6.1 Phase 0 완료 체크리스트

- [ ] EC-001 ~ EC-010: Confidence score 경계값 테스트 통과
- [ ] EC-011 ~ EC-025: 필드 누락 조합 테스트 통과
- [ ] EC-026 ~ EC-035: Idempotency & 동시성 테스트 통과
- [ ] EC-036 ~ EC-042: Monthly reset 테스트 통과
- [ ] EC-043 ~ EC-050: Storage 테스트 통과
- [ ] EC-076 ~ EC-080: Config 테스트 통과

### 6.2 Phase 1 완료 체크리스트

- [ ] E2E Scenario 2.1.1: 정상 환불 플로우 통과
- [ ] E2E Scenario 2.1.2: 필드 누락 조합 통과
- [ ] E2E Scenario 2.2: Idempotency 통과
- [ ] E2E Scenario 2.3: Monthly reset 통과
- [ ] E2E Scenario 2.4: Storage cleanup 통과
- [ ] E2E Scenario 2.5: Config 오버라이드 통과
- [ ] E2E Scenario 2.6: 사용자 알림 통과
- [ ] EC-051 ~ EC-055: PII 암호화 테스트 통과
- [ ] EC-056 ~ EC-062: API & Webhook 테스트 통과

### 6.3 Phase 2 완료 체크리스트

- [ ] E2E Scenario 2.7: 구독 환불 통과
- [ ] EC-063 ~ EC-070: 구독 환불 엣지 케이스 통과
- [ ] Paddle Sandbox 연동 테스트 통과

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025.01.13 | 초안 작성 - 7개 E2E 시나리오, 80개 엣지 케이스 |
