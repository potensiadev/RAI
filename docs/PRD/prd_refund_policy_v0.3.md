# PRD: 환불 시스템 구현

**문서 버전:** 1.2
**작성일:** 2025.01.13
**최종 수정:** 2025.01.13
**작성자:** Product Manager
**검토자:** Senior Engineer
**대상:** Engineering Team
**정책 문서:** [refund_policy_v0.2.md](../operation_policy/refund_policy_v0.2.md)

---

## 0. 엔지니어 검토 반영 사항

> 이 섹션은 Senior Engineer의 코드베이스 분석 및 PRD 검토 의견을 반영한 내용입니다.

### 0.1 식별된 치명적 오류 및 해결

| 오류 | 원인 | 해결 |
|------|------|------|
| DELETE API 부재 | `app/api/candidates/[id]/route.ts`에 DELETE 핸들러 없음 | **Phase 0에서 선행 구현** |
| Storage 경로 불일치 | PRD: `candidate_id.pdf` vs 실제: `uploads/{user_id}/{jobId}.ext` | **경로 수정** |
| confidence_score 계산 위치 | Worker(Python)에서 계산, 이 repo에 로직 없음 | **Webhook 핸들러에서 환불 판단** |

### 0.2 식별된 리스크 및 완화 방안

| 리스크 | 영향 | 완화 |
|--------|------|------|
| CASCADE 삭제 미설정 | processing_jobs 고아 레코드 | **ON DELETE SET NULL 추가** |
| 환불 추적 불가 | 감사/분석 불가 | **refund_reason 컬럼 추가** |
| Webhook 실패 시 환불 누락 | 크레딧 손실 | **Fallback 메커니즘 추가** |
| 월간 리셋 Race Condition | 크레딧 음수 발생 | **트랜잭션 격리 + 체크** |
| Hard Delete로 감사 상실 | 악용 패턴 분석 불가 | **Soft Delete로 변경** |
| 동시 환불 요청 | 이중 환불 | **Idempotency 보장** |

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
| **Phase 0** | 선행 인프라 구축 (DELETE API, 스키마) | **P0 - Blocker** |
| Phase 1 | 크레딧 자동 환불 (품질 불량) | **P0 - Critical** |
| Phase 1 | 파일 업로드 사전 검증 강화 | **P0 - Critical** |
| Phase 2 | 구독 취소 및 Pro-rata 환불 | **P1 - High** |
| Phase 2 | Paddle Refund API 연동 | **P1 - High** |
| Phase 3 | 서비스 장애 자동 보상 | **P2 - Medium** |
| Phase 3 | 환불 신청 UI | **P2 - Medium** |

---

## 2. [Phase 0] 선행 인프라 구축

> ⚠️ **Blocker**: Phase 1 시작 전 반드시 완료 필요

### 2.0.1 Candidate DELETE API 생성

**현재 상태:** RLS 정책은 삭제 허용하나 API Route 없음

**새 파일:** `app/api/candidates/[id]/route.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidateId = params.id;

  // 1. Candidate 조회 (권한 확인 + job_id 획득)
  const { data: candidate, error: fetchError } = await supabase
    .from("candidates")
    .select("id, user_id, job_id, status")
    .eq("id", candidateId)
    .single();

  if (fetchError || !candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (candidate.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. 이미 환불/삭제된 경우 Idempotent 처리
  if (candidate.status === "refunded" || candidate.status === "deleted") {
    return NextResponse.json({
      success: true,
      message: "Already processed",
      idempotent: true
    });
  }

  // 3. Storage 파일 삭제 (실제 경로: uploads/{user_id}/{job_id}.ext)
  if (candidate.job_id) {
    const { data: job } = await supabase
      .from("processing_jobs")
      .select("file_name")
      .eq("id", candidate.job_id)
      .single();

    if (job?.file_name) {
      const ext = job.file_name.split('.').pop();
      const storagePath = `uploads/${user.id}/${candidate.job_id}.${ext}`;

      await supabase.storage
        .from("resumes")
        .remove([storagePath]);
    }
  }

  // 4. Soft Delete (deleted_at 설정)
  const { error: updateError } = await supabase
    .from("candidates")
    .update({
      status: "deleted",
      deleted_at: new Date().toISOString()
    })
    .eq("id", candidateId);

  if (updateError) {
    console.error("[DELETE Candidate] Error:", updateError);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, candidateId });
}
```

### 2.0.2 DB 스키마 마이그레이션

**새 파일:** `supabase/migrations/0XX_refund_infrastructure.sql`

```sql
-- =====================================================
-- 환불 시스템 인프라 마이그레이션
-- =====================================================

-- 1. candidate_status ENUM에 'refunded', 'deleted' 추가
ALTER TYPE candidate_status ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE candidate_status ADD VALUE IF NOT EXISTS 'deleted';

-- 2. candidates 테이블에 Soft Delete 컬럼 추가
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delete_reason VARCHAR(50);

COMMENT ON COLUMN candidates.deleted_at IS '소프트 삭제 시각';
COMMENT ON COLUMN candidates.delete_reason IS '삭제 사유: quality_refund, user_request, admin';

-- 3. credit_transactions 테이블 환불 추적 컬럼 추가
ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS refund_reason VARCHAR(50),
ADD COLUMN IF NOT EXISTS original_transaction_id UUID REFERENCES credit_transactions(id),
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) UNIQUE;

COMMENT ON COLUMN credit_transactions.refund_reason IS '환불 사유: quality_fail, upload_fail, user_cancel, cs_request';
COMMENT ON COLUMN credit_transactions.original_transaction_id IS '원거래 ID (환불 시)';
COMMENT ON COLUMN credit_transactions.idempotency_key IS '중복 환불 방지 키';

-- 4. processing_jobs FK 설정 (ON DELETE SET NULL)
-- 기존 FK가 있다면 삭제 후 재생성
ALTER TABLE processing_jobs
DROP CONSTRAINT IF EXISTS processing_jobs_candidate_id_fkey;

ALTER TABLE processing_jobs
ADD CONSTRAINT processing_jobs_candidate_id_fkey
FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;

-- 5. processing_jobs에 refunded 상태 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    -- job_status가 VARCHAR인 경우 체크 제약 추가
    ALTER TABLE processing_jobs
    DROP CONSTRAINT IF EXISTS processing_jobs_status_check;

    ALTER TABLE processing_jobs
    ADD CONSTRAINT processing_jobs_status_check
    CHECK (status IN ('queued', 'processing', 'parsing', 'analyzing', 'completed', 'failed', 'refunded'));
  END IF;
END $$;

-- 6. 환불 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_credit_transactions_refund
ON credit_transactions(refund_reason)
WHERE refund_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_deleted
ON candidates(deleted_at)
WHERE deleted_at IS NOT NULL;

-- 7. 환불 처리 RPC 함수 (Atomic + Idempotent)
CREATE OR REPLACE FUNCTION process_quality_refund(
  p_candidate_id UUID,
  p_user_id UUID,
  p_job_id UUID,
  p_confidence FLOAT,
  p_missing_fields TEXT[]
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_idempotency_key TEXT;
  v_existing_refund UUID;
BEGIN
  -- Idempotency key 생성
  v_idempotency_key := 'quality_refund_' || p_candidate_id::TEXT;

  -- 이미 처리된 환불인지 확인
  SELECT id INTO v_existing_refund
  FROM credit_transactions
  WHERE idempotency_key = v_idempotency_key;

  IF v_existing_refund IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Already refunded'
    );
  END IF;

  -- 트랜잭션 내에서 처리
  -- 1. 크레딧 복구
  UPDATE users
  SET credits_used_this_month = GREATEST(0, credits_used_this_month - 1)
  WHERE id = p_user_id;

  -- 2. 환불 기록
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    description,
    candidate_id,
    refund_reason,
    idempotency_key,
    metadata
  ) VALUES (
    p_user_id,
    'refund',
    1,
    '분석 품질 미달 자동 환불',
    p_candidate_id,
    'quality_fail',
    v_idempotency_key,
    jsonb_build_object(
      'confidence_score', p_confidence,
      'missing_fields', p_missing_fields,
      'refund_type', 'auto_quality'
    )
  );

  -- 3. Candidate Soft Delete
  UPDATE candidates
  SET
    status = 'refunded',
    deleted_at = NOW(),
    delete_reason = 'quality_refund'
  WHERE id = p_candidate_id;

  -- 4. Processing Job 상태 업데이트
  UPDATE processing_jobs
  SET
    status = 'refunded',
    error_code = 'QUALITY_BELOW_THRESHOLD'
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'candidate_id', p_candidate_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql;
```

### 2.0.3 Acceptance Criteria (Phase 0)

- [ ] `DELETE /api/candidates/[id]` API 생성 및 동작 확인
- [ ] Storage 파일 삭제 시 올바른 경로 사용 (`uploads/{user_id}/{job_id}.ext`)
- [ ] candidates 테이블에 `deleted_at`, `delete_reason` 컬럼 추가
- [ ] credit_transactions 테이블에 `refund_reason`, `idempotency_key` 컬럼 추가
- [ ] `process_quality_refund` RPC 함수 생성 및 테스트
- [ ] processing_jobs FK가 ON DELETE SET NULL로 설정

---

## 3. [Phase 1] 분석 품질 불량 자동 환불

### 3.1 요구사항

분석 완료 시 품질 기준 미달인 경우:
1. 크레딧 자동 환불
2. Candidate Soft Delete (감사 추적 유지)
3. Storage 파일 삭제

### 3.2 자동 환불 조건

```
IF confidence_score < 0.3
   AND missing_critical_fields >= 2
THEN auto_refund = true
```

**핵심 필드 (critical_fields):**
- `name` (이름)
- `phone` 또는 `email` (연락처) - 둘 다 없으면 1개 누락
- `careers` (경력) - 배열이 비어있거나 null

### 3.3 구현 명세

#### 3.3.1 트리거 위치

**확정:** `app/api/webhooks/worker/route.ts` (Worker Webhook 핸들러)

> Worker(Python)에서 confidence_score를 계산하여 전송하면, Webhook 핸들러에서 환불 조건을 판단합니다.

#### 3.3.2 Webhook 핸들러 수정

**파일:** `app/api/webhooks/worker/route.ts`

```typescript
// 기존 import 추가
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Phase 2 완료 (analyzed) 처리 부분에 추가
if (phase === "analyzed" || phase === "completed") {
  const analysisResult = payload.analysis_result;

  // 품질 환불 조건 체크
  const shouldRefund = checkQualityRefundCondition(analysisResult);

  if (shouldRefund.eligible) {
    await processQualityRefund({
      candidateId: payload.candidate_id,
      userId: payload.user_id,
      jobId: payload.job_id,
      confidence: analysisResult.confidence_score,
      missingFields: shouldRefund.missingFields,
    });

    // 환불 알림 (Realtime 또는 별도 알림 시스템)
    await notifyUserRefund(payload.user_id, "quality_refund");

    return NextResponse.json({
      received: true,
      action: "refunded",
      reason: "quality_below_threshold"
    });
  }
}

// 품질 환불 조건 체크 함수
function checkQualityRefundCondition(result: AnalysisResult): {
  eligible: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  // confidence 체크
  const confidence = result.confidence_score ?? 0;
  if (confidence >= 0.3) {
    return { eligible: false, missingFields: [] };
  }

  // 핵심 필드 누락 체크
  if (!result.name) {
    missingFields.push("name");
  }
  if (!result.phone && !result.email) {
    missingFields.push("contact");
  }
  if (!result.careers || result.careers.length === 0) {
    missingFields.push("careers");
  }

  return {
    eligible: confidence < 0.3 && missingFields.length >= 2,
    missingFields,
  };
}

// 품질 환불 처리 함수 (RPC 호출)
async function processQualityRefund(params: {
  candidateId: string;
  userId: string;
  jobId: string;
  confidence: number;
  missingFields: string[];
}) {
  const { candidateId, userId, jobId, confidence, missingFields } = params;

  // 1. RPC로 Atomic 환불 처리
  const { data, error } = await supabaseAdmin.rpc("process_quality_refund", {
    p_candidate_id: candidateId,
    p_user_id: userId,
    p_job_id: jobId,
    p_confidence: confidence,
    p_missing_fields: missingFields,
  });

  if (error) {
    console.error("[QualityRefund] RPC Error:", error);
    throw error;
  }

  // 2. Storage 파일 삭제
  const { data: job } = await supabaseAdmin
    .from("processing_jobs")
    .select("file_name")
    .eq("id", jobId)
    .single();

  if (job?.file_name) {
    const ext = job.file_name.split(".").pop();
    const storagePath = `uploads/${userId}/${jobId}.${ext}`;

    await supabaseAdmin.storage
      .from("resumes")
      .remove([storagePath]);

    console.log(`[QualityRefund] File deleted: ${storagePath}`);
  }

  console.log(`[QualityRefund] Processed: candidate=${candidateId}, confidence=${confidence}, missing=${missingFields.join(",")}`);

  return data;
}
```

#### 3.3.3 월간 리셋 Race Condition 방지

**문제:** 월말에 환불 시 `credits_used_this_month`가 이미 0으로 리셋되어 음수 발생 가능

**해결:** RPC 함수에서 `GREATEST(0, credits_used_this_month - 1)` 사용 (3.0.2에 반영됨)

```sql
-- 음수 방지
UPDATE users
SET credits_used_this_month = GREATEST(0, credits_used_this_month - 1)
WHERE id = p_user_id;
```

### 3.4 사용자 알림

| 채널 | 메시지 |
|------|--------|
| 토스트 | "분석 품질 미달로 크레딧이 환불되었습니다. 파일 확인 후 다시 업로드해주세요." |

**구현:** Supabase Realtime 또는 Polling

```typescript
// 클라이언트에서 환불 알림 수신
const channel = supabase
  .channel(`refund:${userId}`)
  .on("broadcast", { event: "quality_refund" }, (payload) => {
    toast.info("분석 품질 미달로 크레딧이 환불되었습니다. 파일 확인 후 다시 업로드해주세요.");
  })
  .subscribe();
```

### 3.5 악용 방지

| 보호 장치 | 설명 |
|-----------|------|
| **Soft Delete** | 환불 시 `deleted_at` 설정 → 감사 추적 유지, 패턴 분석 가능 |
| **Idempotency Key** | `quality_refund_{candidate_id}` → 중복 환불 원천 차단 |
| **조건 엄격** | confidence < 0.3 AND 필드 2개 누락 동시 충족 |
| **환불 사유 기록** | `credit_transactions.refund_reason` → 분석/모니터링 |

### 3.6 Acceptance Criteria (Phase 1 - 품질 환불)

- [ ] Worker Webhook에서 confidence < 0.3 AND 필드 2개 누락 시 자동 환불
- [ ] `process_quality_refund` RPC 호출로 Atomic 처리
- [ ] 환불 시 Candidate `status = 'refunded'`, `deleted_at` 설정 (Soft Delete)
- [ ] Storage 파일 삭제 시 올바른 경로 사용 (`uploads/{user_id}/{job_id}.ext`)
- [ ] `credit_transactions`에 `refund_reason = 'quality_fail'` 기록
- [ ] `idempotency_key`로 중복 환불 방지
- [ ] 사용자에게 토스트 알림 표시
- [ ] `credits_used_this_month` 음수 방지 확인

---

## 4. [Phase 1] 파일 업로드 사전 검증 강화

### 4.1 요구사항

크레딧 차감 전에 파일을 검증하여 환불 이슈를 원천 차단한다.

### 4.2 검증 항목

| 검증 | 방법 | 에러 코드 | 현재 상태 |
|------|------|----------|----------|
| 파일 형식 | 확장자 + Magic Bytes | `INVALID_FILE_TYPE` | ✅ 구현됨 |
| 파일 크기 | < 10MB | `FILE_TOO_LARGE` | ✅ 구현됨 |
| 암호화 여부 | PDF 암호화 플래그 체크 | `FILE_ENCRYPTED` | ⚠️ 확인 필요 |
| 이중 확장자 | `.pdf.exe` 등 탐지 | `INVALID_FILE_TYPE` | ✅ 구현됨 |

### 4.3 확인 필요 사항

**파일:** `lib/file-validation.ts`

```typescript
// 암호화 PDF 탐지 로직 확인 필요
// PDF 파일의 /Encrypt 딕셔너리 존재 여부 체크
function isPdfEncrypted(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder().decode(bytes.slice(0, 1024));
  return text.includes("/Encrypt");
}
```

### 4.4 Acceptance Criteria (Phase 1 - 파일 검증)

- [ ] 지원되지 않는 파일 형식 업로드 시 크레딧 미차감 + 명확한 에러 메시지
- [ ] 10MB 초과 파일 업로드 시 크레딧 미차감 + 에러 메시지
- [ ] 암호화된 PDF 업로드 시 크레딧 미차감 + 에러 메시지
- [ ] 이중 확장자 파일 업로드 차단 확인

---

## 5. [Phase 2] 구독 취소 및 Pro-rata 환불

### 5.1 요구사항

사용자가 구독을 취소할 때 사용량에 따라 부분 환불을 처리한다.

### 5.2 환불 공식

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

### 5.3 7일 이내 전액 환불

```typescript
function isFullRefundEligible(
  subscriptionStartDate: Date,
  usedCredits: number
): boolean {
  const daysSinceStart = differenceInDays(new Date(), subscriptionStartDate);
  return daysSinceStart <= 7 && usedCredits <= 10;
}
```

### 5.4 취소 후 서비스 처리

| 항목 | 처리 |
|------|------|
| `subscription_status` | `canceled` |
| `cancel_at_period_end` | `true` |
| 잔여 크레딧 | 현재 결제 주기 종료일까지 사용 가능 |
| 데이터 | 취소 후 30일 보관, 이후 삭제 예약 |

### 5.5 DB 스키마 추가

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
    paddle_refund_id VARCHAR(255),         -- Paddle 환불 ID
    idempotency_key VARCHAR(255) UNIQUE    -- 중복 요청 방지
);

CREATE INDEX idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);
```

### 5.6 Acceptance Criteria (Phase 2 - 구독 환불)

- [ ] 7일 이내 + 10건 이하 사용 시 전액 환불 처리
- [ ] 8일 이후 취소 시 Pro-rata 공식에 따른 부분 환불 계산
- [ ] 80% 초과 사용 시 환불 불가 메시지 표시
- [ ] 취소 후에도 결제 주기 종료일까지 서비스 이용 가능
- [ ] refund_requests 테이블에 모든 환불 요청 기록
- [ ] idempotency_key로 중복 환불 요청 방지

---

## 6. [Phase 2] Paddle Refund API 연동

### 6.1 요구사항

Paddle을 통해 결제된 구독의 환불을 API로 처리한다.

### 6.2 API 명세

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

### 6.3 구현 명세

**새 파일:** `lib/paddle/refund.ts`

```typescript
interface RefundRequest {
  transactionId: string;
  amount: number;
  reason: 'full_refund_7day' | 'partial_refund_prorata' | 'service_credit';
  idempotencyKey: string;
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
  idempotent?: boolean;
}

async function createPaddleRefund(request: RefundRequest): Promise<RefundResult> {
  // Idempotency 체크 (DB에서 기존 처리 확인)
  const existing = await checkExistingRefund(request.idempotencyKey);
  if (existing) {
    return { success: true, refundId: existing.paddle_refund_id, idempotent: true };
  }

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

  // 환불 기록 저장
  await saveRefundRecord(request, data.data.id);

  return { success: true, refundId: data.data.id };
}
```

### 6.4 Webhook 처리

**파일:** `app/api/webhooks/paddle/route.ts`에 추가

```typescript
case "refund.created":
case "refund.completed":
  await handleRefundEvent(event);
  break;
```

### 6.5 제한 사항

| 제한 | 값 |
|------|-----|
| 최대 환불 기간 | 거래 후 180일 이내 |
| 최대 환불 금액 | 원거래 금액 |
| 부분 환불 | 지원됨 |

### 6.6 Acceptance Criteria (Phase 2 - Paddle)

- [ ] Paddle Refund API 호출 및 응답 처리
- [ ] 환불 성공 시 refund_requests 테이블 업데이트
- [ ] 환불 실패 시 에러 로깅 및 관리자 알림
- [ ] Webhook으로 환불 완료 확인
- [ ] 사용자에게 환불 완료 이메일 발송
- [ ] Idempotency key로 중복 API 호출 방지

---

## 7. [Phase 3] 서비스 장애 자동 보상

### 7.1 장애 등급 및 보상

| 등급 | 조건 | 보상 |
|------|------|------|
| P1 | 전체 서비스 불가 4시간+ | 월 요금의 15% 크레딧 |
| P2 | 핵심 기능 불가 8시간+ | 월 요금의 10% 크레딧 |
| P3 | 일부 기능 저하 24시간+ | 월 요금의 5% 크레딧 |

### 7.2 보상 크레딧 계산

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

### 7.3 DB 스키마

```sql
CREATE TABLE incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(10) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    affected_services TEXT[],
    compensation_processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE incident_compensations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES incident_reports(id),
    user_id UUID REFERENCES users(id),
    credits_granted INTEGER NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 7.4 Acceptance Criteria (Phase 3 - 장애 보상)

- [ ] 관리자가 장애 등급 및 기간 등록 가능
- [ ] 익월 1일 자동으로 보상 크레딧 지급
- [ ] 보상 지급 시 이메일 통보
- [ ] idempotency_key로 중복 보상 방지

---

## 8. [Phase 3] 환불 신청 UI

### 8.1 UI 위치

```
설정 → 구독 관리 → [환불 신청] 버튼
```

### 8.2 환불 미리보기 모달

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

### 8.3 Acceptance Criteria (Phase 3 - UI)

- [ ] 설정 > 구독 관리에 환불 신청 버튼 표시
- [ ] 환불 금액 미리 계산하여 표시
- [ ] 환불 신청 후 상태 표시 (처리 중 → 완료)
- [ ] 이미 환불 신청한 경우 중복 신청 방지

---

## 9. 비기능 요구사항

### 9.1 성능

| 항목 | 요구사항 |
|------|----------|
| 품질 체크 + Soft Delete | 분석 완료 후 500ms 이내 |
| 환불 금액 계산 | 500ms 이내 |
| Paddle API 호출 | 타임아웃 30초 |
| RPC 함수 실행 | 100ms 이내 |

### 9.2 보안

| 항목 | 요구사항 |
|------|----------|
| 환불 요청 | 인증된 사용자만 가능 |
| 금액 조작 | 서버에서만 계산 (클라이언트 값 무시) |
| Paddle API Key | 서버 사이드에서만 사용 |
| Idempotency | 모든 환불 작업에 idempotency_key 필수 |
| Soft Delete | 감사 추적을 위해 Hard Delete 금지 |

### 9.3 모니터링

| 이벤트 | 로깅 |
|--------|------|
| 환불 요청 | `[Refund] Request: user_id, amount, type` |
| 환불 성공 | `[Refund] Success: refund_id, amount, idempotent` |
| 환불 실패 | `[Refund] Failed: error, transaction_id` |
| 품질 환불 | `[QualityRefund] Processed: candidate_id, confidence, missing_fields` |
| 중복 환불 시도 | `[Refund] Idempotent: idempotency_key, original_refund_id` |

### 9.4 데이터 보존

| 데이터 | 보존 기간 | 삭제 방식 |
|--------|----------|----------|
| Soft Deleted Candidates | 90일 | 배치 Hard Delete |
| credit_transactions | 영구 | 보존 |
| refund_requests | 영구 | 보존 |
| Storage 파일 | 환불 시 즉시 삭제 | 즉시 |

---

## 10. 테스트 요구사항

### 10.1 단위 테스트

| 테스트 | 케이스 |
|--------|--------|
| `calculateRefund()` | 각 조정계수 경계값 (0.49, 0.5, 0.8, 0.81) |
| `isFullRefundEligible()` | 7일/10건 경계값 |
| `checkQualityRefundCondition()` | confidence 0.29, 0.3, 0.31 |
| `checkQualityRefundCondition()` | 필드 누락 조합 (0, 1, 2, 3개) |
| `process_quality_refund` RPC | Idempotency 테스트 |
| `process_quality_refund` RPC | 월간 리셋 후 환불 (음수 방지) |

### 10.2 통합 테스트

| 테스트 | 케이스 |
|--------|--------|
| Paddle 환불 | Sandbox 환경에서 실제 환불 처리 |
| 크레딧 환불 | DB 트랜잭션 정합성 |
| 동시성 | 동일 candidate 동시 환불 요청 → 1회만 처리 |
| Soft Delete | 환불 후 candidate 조회 시 deleted_at 확인 |
| Storage | 환불 후 파일 삭제 확인 |
| Webhook 실패 | Worker 성공 → Webhook 실패 → 재시도 시 Idempotent |

### 10.3 E2E 테스트

| 테스트 | 시나리오 |
|--------|---------|
| 품질 환불 | 업로드 → 분석 (저품질) → 자동 환불 → 토스트 확인 |
| 구독 환불 | 구독 → 7일 내 취소 → 전액 환불 확인 |
| 중복 방지 | 동일 파일 2회 업로드 → 2회 다 저품질 → 1회만 환불 |

---

## 11. 롤아웃 계획

| Phase | 내용 | 의존성 |
|-------|------|--------|
| **Phase 0** | 선행 인프라 (DELETE API, 스키마 마이그레이션) | 없음 |
| **Phase 1** | 크레딧 자동 환불 + 파일 검증 강화 | Phase 0 완료 |
| **Phase 2** | 구독 환불 + Paddle 연동 | Phase 1 완료 |
| **Phase 3** | 장애 보상 + 환불 UI | Phase 2 완료 |
| **Monitoring** | 환불률 모니터링 및 정책 조정 | Phase 3 완료 |

---

## 12. 성공 지표

| 지표 | 목표 |
|------|------|
| 품질 자동 환불 처리율 | 100% (수동 처리 0건) |
| 환불 처리 시간 | 7일 이내 환불: 즉시, 부분 환불: 5영업일 |
| 환불 관련 CS 문의 | 월 10건 이하 |
| 월 환불률 | 매출 대비 3~4% 이하 |
| 중복 환불 발생 | 0건 |

---

## 13. 최종 권장안 요약

| 항목 | v0.2 결정 | v0.3 변경 |
|------|----------|----------|
| 환불 시 처리 | Hard Delete | **Soft Delete** (감사 추적) |
| 파일 삭제 경로 | `${candidate_id}.pdf` | **`uploads/${user_id}/${job_id}.ext`** |
| 환불 판단 위치 | 미정 | **Webhook 핸들러** |
| 중복 환불 방지 | 없음 | **Idempotency Key 필수** |
| 월간 리셋 Race | 미고려 | **GREATEST(0, ...) 사용** |
| 환불 사유 추적 | 없음 | **refund_reason 컬럼 추가** |
| Phase 0 | 없음 | **선행 인프라 구축 추가** |

---

## 14. 리스크 및 완화

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| Worker 장애로 환불 누락 | 중 | 높 | Webhook 재시도 + Dead Letter Queue |
| 월간 리셋 Race Condition | 낮 | 중 | `GREATEST(0, ...)` + 트랜잭션 격리 |
| 악의적 환불 남용 | 낮 | 중 | Soft Delete로 패턴 분석 가능 |
| Paddle API 장애 | 낮 | 높 | 재시도 로직 + 수동 처리 Fallback |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025.01.13 | 초안 작성 |
| 1.1 | 2025.01.13 | 품질 환불 시 삭제 정책 적용, 월간 한도 제거, 배너 제거 |
| **1.2** | 2025.01.13 | **Senior Engineer 검토 반영:** Phase 0 추가, Soft Delete 변경, Storage 경로 수정, Idempotency 추가, 월간 리셋 Race Condition 해결, 환불 사유 추적 추가 |
