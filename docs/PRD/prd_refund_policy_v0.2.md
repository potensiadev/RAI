# PRD: 환불 시스템 구현

**문서 버전:** 1.1
**작성일:** 2025.01.13
**작성자:** Product Manager
**대상:** Senior Engineer
**정책 문서:** [refund_policy_v0.2.md](../operation_policy/refund_policy_v0.2.md)

---

## 1. 개요

### 1.1 목적
RAI 서비스의 환불 정책(v0.2)을 시스템에 구현하여, 구독 취소/환불/크레딧 환불을 자동화한다.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| 구독 취소 및 Pro-rata 환불 | 프로모션/할인 결제 환불 (별도 정책) |
| 크레딧 자동 환불 | 수동 CS 처리 |
| 분석 품질 불량 자동 환불 | |
| 서비스 장애 보상 | |
| Paddle 환불 API 연동 | |

### 1.3 우선순위

| Phase | 기능 | 우선순위 |
|-------|------|----------|
| Phase 1 | 크레딧 자동 환불 (품질 불량) | **P0 - Critical** |
| Phase 1 | 파일 업로드 사전 검증 강화 | **P0 - Critical** |
| Phase 2 | 구독 취소 및 Pro-rata 환불 | **P1 - High** |
| Phase 2 | Paddle Refund API 연동 | **P1 - High** |
| Phase 3 | 서비스 장애 자동 보상 | **P2 - Medium** |
| Phase 3 | 환불 신청 UI | **P2 - Medium** |

---

## 2. 기능 요구사항

### 2.1 [P0] 분석 품질 불량 자동 환불

#### 2.1.1 요구사항

분석 완료 시 품질 기준 미달인 경우:
1. 크레딧 자동 환불
2. **Candidate 레코드 및 원본 파일 삭제**

#### 2.1.2 자동 환불 조건

```
IF confidence_score < 0.3
   AND missing_critical_fields >= 2
THEN auto_refund = true
```

**핵심 필드 (critical_fields):**
- `name` (이름)
- `phone` 또는 `email` (연락처)
- `careers` (경력) - 배열이 비어있거나 null

#### 2.1.3 구현 명세

**트리거 위치:** Worker 분석 완료 후 webhook 또는 DB 업데이트 시점

**처리 로직:**

```python
def handle_quality_refund(candidate_id: str, user_id: str, analysis_result: dict) -> bool:
    """
    품질 미달 시 환불 처리
    - 크레딧 환불
    - Candidate 레코드 삭제
    - 원본 파일 삭제
    """
    confidence = analysis_result.get("confidence_score", 0)

    # 핵심 필드 누락 카운트
    missing_count = 0
    if not analysis_result.get("name"):
        missing_count += 1
    if not analysis_result.get("phone") and not analysis_result.get("email"):
        missing_count += 1
    if not analysis_result.get("careers") or len(analysis_result.get("careers", [])) == 0:
        missing_count += 1

    # 환불 조건 체크
    if confidence < 0.3 and missing_count >= 2:
        # 1. 크레딧 환불
        refund_credit(user_id, candidate_id)

        # 2. 원본 파일 삭제 (Supabase Storage)
        delete_resume_file(candidate_id)

        # 3. Candidate 레코드 삭제
        delete_candidate(candidate_id)

        # 4. 환불 기록 (감사용)
        log_refund_transaction(user_id, candidate_id, reason="quality_below_threshold")

        # 5. 사용자 알림
        notify_user(user_id, "quality_refund")

        return True

    return False
```

**DB 변경:**

```sql
-- 1. credit_transactions 테이블에 환불 기록
INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    description,
    reference_id
) VALUES (
    :user_id,
    'refund',
    1,
    '분석 품질 미달 자동 환불',
    :candidate_id
);

-- 2. users 테이블 크레딧 복구
UPDATE users
SET credits_used_this_month = credits_used_this_month - 1
WHERE id = :user_id;

-- 3. 관련 데이터 삭제 (순서 중요: FK 제약)
DELETE FROM candidate_chunks WHERE candidate_id = :candidate_id;
DELETE FROM candidates WHERE id = :candidate_id;

-- 4. processing_jobs 상태 업데이트
UPDATE processing_jobs
SET status = 'refunded', error_code = 'QUALITY_BELOW_THRESHOLD'
WHERE candidate_id = :candidate_id;
```

**Storage 삭제:**

```typescript
// Supabase Storage에서 원본 파일 삭제
await supabase.storage
  .from('resumes')
  .remove([`${candidate_id}.pdf`]);
```

#### 2.1.4 사용자 알림

| 채널 | 메시지 |
|------|--------|
| 토스트 | "분석 품질 미달로 크레딧이 환불되었습니다. 파일 확인 후 다시 업로드해주세요." |

> **Note:** 환불 시 Candidate가 삭제되므로 분석 결과 화면 배너는 불필요

#### 2.1.5 악용 방지

| 보호 장치 | 설명 |
|-----------|------|
| **Candidate 삭제** | 환불 시 데이터 삭제 → 수동 수정 불가 → 악용 원천 차단 |
| **파일 사전 검증** | Magic bytes, 크기, 암호화 체크 → 쓰레기 파일 업로드 전 차단 |
| **환불 조건 엄격** | confidence < 0.3 AND 필드 2개 누락 동시 충족 필요 |

> **월간 환불 한도 불필요:** Candidate 삭제로 악용 불가, 한도는 정상 사용자만 불편하게 함

#### 2.1.6 Acceptance Criteria

- [ ] confidence < 0.3 AND 핵심 필드 2개 이상 누락 시 크레딧 자동 환불
- [ ] 환불 시 candidate 레코드 삭제
- [ ] 환불 시 원본 파일 (Supabase Storage) 삭제
- [ ] 환불 시 candidate_chunks 삭제
- [ ] credit_transactions 테이블에 type='refund'로 기록
- [ ] processing_jobs 상태를 'refunded'로 업데이트
- [ ] 사용자에게 토스트 알림 표시

---

### 2.2 [P0] 파일 업로드 사전 검증 강화

#### 2.2.1 요구사항

크레딧 차감 전에 파일을 검증하여 환불 이슈를 원천 차단한다.

#### 2.2.2 검증 항목

| 검증 | 방법 | 에러 코드 |
|------|------|----------|
| 파일 형식 | 확장자 + Magic Bytes | `INVALID_FILE_TYPE` |
| 파일 크기 | < 10MB | `FILE_TOO_LARGE` |
| 암호화 여부 | PDF 암호화 플래그 체크 | `FILE_ENCRYPTED` |

#### 2.2.3 구현 명세

**현재 상태:** 이미 `lib/file-validation.ts`에 구현되어 있음

**확인 필요:**
- [ ] 암호화된 PDF 탐지 로직 존재 여부
- [ ] Magic Bytes 검증이 크레딧 차감 전에 실행되는지 확인
- [ ] 에러 메시지가 사용자 친화적인지 확인

#### 2.2.4 Acceptance Criteria

- [ ] 지원되지 않는 파일 형식 업로드 시 크레딧 미차감 + 명확한 에러 메시지
- [ ] 10MB 초과 파일 업로드 시 크레딧 미차감 + 에러 메시지
- [ ] 암호화된 PDF 업로드 시 크레딧 미차감 + 에러 메시지

---

### 2.3 [P1] 구독 취소 및 Pro-rata 환불

#### 2.3.1 요구사항

사용자가 구독을 취소할 때 사용량에 따라 부분 환불을 처리한다.

#### 2.3.2 환불 공식

```typescript
interface RefundCalculation {
  paymentAmount: number;      // 결제 금액
  remainingDays: number;      // 잔여 일수
  totalDays: number;          // 총 일수 (30)
  usageRate: number;          // 크레딧 사용률 (0~1)
  creditUnitPrice: number;    // 크레딧 단가 (Pro: 400, Enterprise: 350)
  usedCredits: number;        // 사용한 크레딧 수
}

function calculateRefund(input: RefundCalculation): number {
  const { paymentAmount, remainingDays, totalDays, usageRate, creditUnitPrice, usedCredits } = input;

  // 조정 계수
  let adjustmentFactor: number;
  if (usageRate < 0.5) {
    adjustmentFactor = 0.8;
  } else if (usageRate <= 0.8) {
    adjustmentFactor = 0.5;
  } else {
    return 0; // 80% 초과 사용 시 환불 불가
  }

  // 환불 금액 계산
  const proRataAmount = paymentAmount * (remainingDays / totalDays) * adjustmentFactor;
  const usedCreditsCost = usedCredits * creditUnitPrice;

  const refundAmount = Math.max(0, proRataAmount - usedCreditsCost);

  return Math.floor(refundAmount); // 원 단위 절삭
}
```

#### 2.3.3 7일 이내 전액 환불

```typescript
function isFullRefundEligible(
  subscriptionStartDate: Date,
  usedCredits: number
): boolean {
  const daysSinceStart = differenceInDays(new Date(), subscriptionStartDate);
  return daysSinceStart <= 7 && usedCredits <= 10;
}
```

#### 2.3.4 취소 후 서비스 처리

| 항목 | 처리 |
|------|------|
| `subscription_status` | `canceled` |
| `cancel_at_period_end` | `true` |
| 잔여 크레딧 | 현재 결제 주기 종료일까지 사용 가능 |
| 데이터 | 취소 후 30일 보관, 이후 삭제 예약 |

#### 2.3.5 DB 스키마 추가

```sql
-- 환불 요청 테이블
CREATE TABLE refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    transaction_id VARCHAR(255),           -- Paddle transaction ID
    type VARCHAR(50) NOT NULL,             -- 'full' | 'prorata' | 'credit'
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending' | 'approved' | 'processed' | 'rejected'
    requested_amount INTEGER NOT NULL,     -- 요청 환불 금액 (원)
    approved_amount INTEGER,               -- 승인 환불 금액
    reason TEXT,
    calculation_details JSONB,             -- 계산 내역 저장
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    paddle_refund_id VARCHAR(255)          -- Paddle 환불 ID
);

CREATE INDEX idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);
```

#### 2.3.6 Acceptance Criteria

- [ ] 7일 이내 + 10건 이하 사용 시 전액 환불 처리
- [ ] 8일 이후 취소 시 Pro-rata 공식에 따른 부분 환불 계산
- [ ] 80% 초과 사용 시 환불 불가 메시지 표시
- [ ] 취소 후에도 결제 주기 종료일까지 서비스 이용 가능
- [ ] refund_requests 테이블에 모든 환불 요청 기록

---

### 2.4 [P1] Paddle Refund API 연동

#### 2.4.1 요구사항

Paddle을 통해 결제된 구독의 환불을 API로 처리한다.

#### 2.4.2 API 명세

**Endpoint:** `POST https://api.paddle.com/transactions/{transaction_id}/refund`

**Request:**
```json
{
  "amount": "35300",
  "reason": "partial_refund_prorata"
}
```

**Response:**
```json
{
  "data": {
    "id": "rfnd_01abc123",
    "transaction_id": "txn_01xyz789",
    "amount": "35300",
    "currency_code": "KRW",
    "status": "completed"
  }
}
```

#### 2.4.3 구현 명세

**새 파일:** `lib/paddle/refund.ts`

```typescript
interface RefundRequest {
  transactionId: string;
  amount: number;
  reason: 'full_refund_7day' | 'partial_refund_prorata' | 'service_credit';
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

async function createPaddleRefund(request: RefundRequest): Promise<RefundResult> {
  const response = await fetch(
    `${PADDLE_CONFIG.apiUrl}/transactions/${request.transactionId}/refund`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PADDLE_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: request.amount.toString(),
        reason: request.reason,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    return { success: false, error: error.message };
  }

  const data = await response.json();
  return { success: true, refundId: data.data.id };
}
```

#### 2.4.4 Webhook 처리

**새 이벤트 추가:** `refund.created`, `refund.completed`

```typescript
// app/api/webhooks/paddle/route.ts에 추가
case "refund.created":
case "refund.completed":
  await handleRefundEvent(event);
  break;
```

#### 2.4.5 제한 사항

| 제한 | 값 |
|------|-----|
| 최대 환불 기간 | 거래 후 180일 이내 |
| 최대 환불 금액 | 원거래 금액 |
| 부분 환불 | 지원됨 |

#### 2.4.6 Acceptance Criteria

- [ ] Paddle Refund API 호출 및 응답 처리
- [ ] 환불 성공 시 refund_requests 테이블 업데이트
- [ ] 환불 실패 시 에러 로깅 및 관리자 알림
- [ ] Webhook으로 환불 완료 확인
- [ ] 사용자에게 환불 완료 이메일 발송

---

### 2.5 [P2] 서비스 장애 자동 보상

#### 2.5.1 요구사항

서비스 장애 발생 시 정책에 따라 크레딧을 자동 보상한다.

#### 2.5.2 장애 등급 및 보상

| 등급 | 조건 | 보상 |
|------|------|------|
| P1 | 전체 서비스 불가 4시간+ | 월 요금의 15% 크레딧 |
| P2 | 핵심 기능 불가 8시간+ | 월 요금의 10% 크레딧 |
| P3 | 일부 기능 저하 24시간+ | 월 요금의 5% 크레딧 |

#### 2.5.3 보상 크레딧 계산

```typescript
function calculateCompensationCredits(
  plan: 'starter' | 'pro' | 'enterprise',
  incidentLevel: 'P1' | 'P2' | 'P3'
): number {
  const monthlyCredits = {
    starter: 50,
    pro: 150,
    enterprise: 300,
  };

  const compensationRate = {
    P1: 0.15,
    P2: 0.10,
    P3: 0.05,
  };

  return Math.ceil(monthlyCredits[plan] * compensationRate[incidentLevel]);
}
```

#### 2.5.4 처리 흐름

```
1. 관리자가 장애 공지 등록 (incident_reports 테이블)
2. 장애 종료 시 영향받은 사용자 목록 추출
3. 익월 1일 배치 작업으로 크레딧 자동 지급
4. 사용자에게 이메일 통보
```

#### 2.5.5 DB 스키마 추가

```sql
-- 장애 보고서 테이블
CREATE TABLE incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(10) NOT NULL,            -- 'P1' | 'P2' | 'P3'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    affected_services TEXT[],              -- ['upload', 'search', 'analysis']
    compensation_processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 보상 지급 기록
CREATE TABLE incident_compensations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES incident_reports(id),
    user_id UUID REFERENCES users(id),
    credits_granted INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2.5.6 Acceptance Criteria

- [ ] 관리자가 장애 등급 및 기간 등록 가능
- [ ] 익월 1일 자동으로 보상 크레딧 지급
- [ ] 보상 지급 시 이메일 통보
- [ ] incident_compensations 테이블에 기록

---

### 2.6 [P2] 환불 신청 UI

#### 2.6.1 요구사항

사용자가 설정 페이지에서 환불을 신청할 수 있는 UI를 제공한다.

#### 2.6.2 UI 위치

```
설정 → 구독 관리 → [환불 신청] 버튼
```

#### 2.6.3 환불 신청 플로우

```
1. [환불 신청] 버튼 클릭
2. 환불 금액 미리보기 표시 (계산 공식 적용)
3. 환불 사유 선택 (선택사항)
4. [환불 신청] 확인
5. 처리 완료 메시지 표시
```

#### 2.6.4 UI 컴포넌트

**환불 미리보기 모달:**

```
┌─────────────────────────────────────────┐
│           환불 신청                      │
├─────────────────────────────────────────┤
│                                         │
│  현재 플랜: Pro (₩49,000/월)            │
│  결제일: 2025.01.01                     │
│  사용 크레딧: 30/150건                   │
│                                         │
│  ─────────────────────────────────      │
│                                         │
│  예상 환불 금액: ₩7,600                  │
│                                         │
│  * 잔여 15일 × 조정계수 0.8             │
│  * 사용 크레딧 비용: ₩12,000 차감        │
│                                         │
│  ⚠️ 환불 후에도 1월 31일까지             │
│     잔여 크레딧 사용 가능                 │
│                                         │
├─────────────────────────────────────────┤
│        [취소]        [환불 신청]         │
└─────────────────────────────────────────┘
```

#### 2.6.5 Acceptance Criteria

- [ ] 설정 > 구독 관리에 환불 신청 버튼 표시
- [ ] 환불 금액 미리 계산하여 표시
- [ ] 환불 신청 후 상태 표시 (처리 중 → 완료)
- [ ] 이미 환불 신청한 경우 중복 신청 방지

---

## 3. 비기능 요구사항

### 3.1 성능

| 항목 | 요구사항 |
|------|----------|
| 품질 체크 + 삭제 | 분석 완료 후 500ms 이내 |
| 환불 금액 계산 | 500ms 이내 |
| Paddle API 호출 | 타임아웃 30초 |

### 3.2 보안

| 항목 | 요구사항 |
|------|----------|
| 환불 요청 | 인증된 사용자만 가능 |
| 금액 조작 | 서버에서만 계산 (클라이언트 값 무시) |
| Paddle API Key | 서버 사이드에서만 사용 |
| 삭제 확인 | FK 제약 순서 준수 (chunks → candidates) |

### 3.3 모니터링

| 이벤트 | 로깅 |
|--------|------|
| 환불 요청 | `[Refund] Request: user_id, amount, type` |
| 환불 성공 | `[Refund] Success: refund_id, amount` |
| 환불 실패 | `[Refund] Failed: error, transaction_id` |
| 품질 환불 | `[QualityRefund] Deleted: candidate_id, confidence, missing_fields` |

---

## 4. 테스트 요구사항

### 4.1 단위 테스트

| 테스트 | 케이스 |
|--------|--------|
| `calculateRefund()` | 각 조정계수 경계값 테스트 |
| `isFullRefundEligible()` | 7일/10건 경계값 테스트 |
| `handle_quality_refund()` | 신뢰도/필드 누락 조합 테스트 |
| `handle_quality_refund()` | 삭제 순서 (chunks → candidate → file) |

### 4.2 통합 테스트

| 테스트 | 케이스 |
|--------|--------|
| Paddle 환불 | Sandbox 환경에서 실제 환불 처리 |
| 크레딧 환불 | DB 트랜잭션 정합성 |
| 동시성 | 중복 환불 요청 방지 |
| 삭제 검증 | 환불 후 candidate 조회 불가 확인 |

---

## 5. 롤아웃 계획

| Phase | 기간 | 내용 |
|-------|------|------|
| Phase 1 | Week 1 | 크레딧 자동 환불 + 삭제 로직 + 파일 검증 강화 |
| Phase 2 | Week 2-3 | 구독 환불 + Paddle 연동 |
| Phase 3 | Week 4 | 장애 보상 + 환불 UI |
| Monitoring | Week 5 | 환불률 모니터링 및 정책 조정 |

---

## 6. 성공 지표

| 지표 | 목표 |
|------|------|
| 품질 자동 환불 처리율 | 100% (수동 처리 0건) |
| 환불 처리 시간 | 7일 이내 환불: 즉시, 부분 환불: 5영업일 |
| 환불 관련 CS 문의 | 월 10건 이하 |
| 월 환불률 | 매출 대비 3~4% 이하 |

---

## 7. 최종 권장안 요약

| 항목 | 결정 |
|------|------|
| 환불 시 처리 | Candidate 레코드 + 원본 파일 **삭제** |
| 월간 환불 한도 | **없음** (삭제로 악용 불가, 한도는 정상 사용자만 불편) |
| 분석 결과 배너 | **없음** (삭제되므로 불필요) |
| 토스트 메시지 | "분석 품질 미달로 크레딧이 환불되었습니다. 파일 확인 후 다시 업로드해주세요." |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025.01.13 | 초안 작성 |
| 1.1 | 2025.01.13 | 품질 환불 시 삭제 정책 적용, 월간 한도 제거, 배너 제거 |
