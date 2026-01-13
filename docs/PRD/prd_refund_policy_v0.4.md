# PRD: 환불 시스템 구현

**문서 버전:** 1.3
**작성일:** 2025.01.13
**최종 수정:** 2025.01.13
**작성자:** Product Manager
**검토자:** Senior Engineer, Senior Technical Architect, Senior QA
**대상:** Engineering Team
**정책 문서:** [refund_policy_v0.2.md](../operation_policy/refund_policy_v0.2.md)

---

## 0. 버전 변경 요약

### v0.3 → v0.4 주요 변경 (전원 합의 반영)

| # | v0.3 | v0.4 (합의안) | 변경 사유 |
|---|------|--------------|----------|
| 1 | `careers` 필드로 환불 판단 | **`last_company`로 대체** | Worker quick_data에 careers 미포함 |
| 2 | 환불 조건 하드코딩 | **Config 외부화** | 정책 변경 시 코드 수정 최소화 |
| 3 | Quick data 저장 로직 없음 | **Webhook에서 저장 + PII 암호화** | 환불 판단에 필요한 데이터 확보 |
| 4 | `orphaned_files` 테이블 신설 | **로깅 + error_message + 배치** | 복잡도 감소 |
| 5 | pg_cron으로 monthly reset | **Lazy reset 패턴** | Supabase 호환성, Cron 의존성 제거 |
| 6 | RPC 동시성 미고려 | **Advisory Lock 추가** | 동시 환불 요청 방지 |

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
| **Phase 0** | 선행 인프라 구축 (DELETE API, 스키마, Config) | **P0 - Blocker** |
| Phase 1 | 크레딧 자동 환불 (품질 불량) | **P0 - Critical** |
| Phase 1 | 파일 업로드 사전 검증 강화 | **P0 - Critical** |
| Phase 2 | 구독 취소 및 Pro-rata 환불 | **P1 - High** |
| Phase 2 | Paddle Refund API 연동 | **P1 - High** |
| Phase 3 | 서비스 장애 자동 보상 | **P2 - Medium** |
| Phase 3 | 환불 신청 UI | **P2 - Medium** |

---

## 2. [Phase 0] 선행 인프라 구축

> ⚠️ **Blocker**: Phase 1 시작 전 반드시 완료 필요

### 2.1 환불 조건 Config 외부화

**새 파일:** `lib/refund/config.ts`

```typescript
/**
 * 환불 정책 설정
 * - 정책 변경 시 이 파일만 수정
 * - 코드 배포 없이 환경 변수로 오버라이드 가능
 */
export const REFUND_CONFIG = {
  // 품질 환불 조건
  quality: {
    confidenceThreshold: parseFloat(process.env.REFUND_CONFIDENCE_THRESHOLD || "0.3"),
    requiredMissingFields: parseInt(process.env.REFUND_REQUIRED_MISSING_FIELDS || "2"),
    criticalFields: ["name", "contact", "last_company"] as const,
  },

  // 구독 환불 조건
  subscription: {
    fullRefundDays: 7,
    fullRefundMaxCredits: 10,
    adjustmentFactors: {
      low: { threshold: 0.5, factor: 0.8 },
      medium: { threshold: 0.8, factor: 0.5 },
      high: { threshold: 1.0, factor: 0 }, // 환불 불가
    },
    creditUnitPrice: {
      pro: 400,
      enterprise: 350,
    },
  },

  // Soft Delete 보존 기간
  retention: {
    softDeleteDays: 90,
  },
} as const;

export type CriticalField = typeof REFUND_CONFIG.quality.criticalFields[number];
```

### 2.2 Candidate DELETE API 생성

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

      const { error: storageError } = await supabase.storage
        .from("resumes")
        .remove([storagePath]);

      // Storage 삭제 실패 시 로깅만 (환불은 진행)
      if (storageError) {
        console.error(`[DELETE Candidate] Storage deletion failed: ${storagePath}`, storageError);
      }
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

### 2.3 DB 스키마 마이그레이션

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
ALTER TABLE processing_jobs
DROP CONSTRAINT IF EXISTS processing_jobs_candidate_id_fkey;

ALTER TABLE processing_jobs
ADD CONSTRAINT processing_jobs_candidate_id_fkey
FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;

-- 5. processing_jobs에 refunded 상태 추가
DO $$
BEGIN
  ALTER TABLE processing_jobs
  DROP CONSTRAINT IF EXISTS processing_jobs_status_check;

  ALTER TABLE processing_jobs
  ADD CONSTRAINT processing_jobs_status_check
  CHECK (status IN ('queued', 'processing', 'parsing', 'analyzing', 'completed', 'failed', 'refunded'));
END $$;

-- 6. 환불 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_credit_transactions_refund
ON credit_transactions(refund_reason)
WHERE refund_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_deleted
ON candidates(deleted_at)
WHERE deleted_at IS NOT NULL;

-- 7. 환불 처리 RPC 함수 (Atomic + Idempotent + Advisory Lock)
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
  v_lock_key BIGINT;
BEGIN
  -- Advisory Lock으로 동시 요청 방지
  v_lock_key := hashtext('refund_' || p_candidate_id::TEXT);
  PERFORM pg_advisory_xact_lock(v_lock_key);

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

  -- Lazy reset: 월간 크레딧 리셋 체크
  PERFORM check_and_reset_user_credits(p_user_id);

  -- 트랜잭션 내에서 처리
  -- 1. 크레딧 복구 (음수 방지)
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

-- 8. Monthly credit reset 함수 (이미 존재하면 스킵)
CREATE OR REPLACE FUNCTION check_and_reset_user_credits(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET
    credits_used_this_month = 0,
    billing_cycle_start = date_trunc('month', CURRENT_DATE)
  WHERE id = p_user_id
    AND billing_cycle_start < date_trunc('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;
```

### 2.4 Storage Cleanup 배치 Job

**새 파일:** `lib/refund/cleanup.ts`

```typescript
/**
 * Storage Cleanup 배치
 * - Vercel Cron 또는 수동 실행
 * - refunded 상태인데 Storage에 파일이 남아있는 케이스 정리
 */
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function cleanupOrphanedFiles() {
  console.log("[Cleanup] Starting orphaned files cleanup...");

  // 1. refunded 상태의 processing_jobs 조회
  const { data: jobs, error } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, user_id, file_name, error_message")
    .eq("status", "refunded")
    .is("error_message", null); // 아직 cleanup 시도 안 한 것만

  if (error || !jobs) {
    console.error("[Cleanup] Failed to fetch jobs:", error);
    return;
  }

  console.log(`[Cleanup] Found ${jobs.length} jobs to process`);

  for (const job of jobs) {
    if (!job.file_name) continue;

    const ext = job.file_name.split(".").pop();
    const storagePath = `uploads/${job.user_id}/${job.id}.${ext}`;

    // Storage에서 파일 존재 여부 확인 후 삭제
    const { error: storageError } = await supabaseAdmin.storage
      .from("resumes")
      .remove([storagePath]);

    if (storageError) {
      // 삭제 실패 시 error_message에 기록
      await supabaseAdmin
        .from("processing_jobs")
        .update({ error_message: `STORAGE_DELETE_FAILED: ${storageError.message}` })
        .eq("id", job.id);

      console.error(`[Cleanup] Failed to delete ${storagePath}:`, storageError);
    } else {
      // 성공 시 마커 기록
      await supabaseAdmin
        .from("processing_jobs")
        .update({ error_message: "STORAGE_CLEANED" })
        .eq("id", job.id);

      console.log(`[Cleanup] Deleted: ${storagePath}`);
    }
  }

  console.log("[Cleanup] Completed");
}
```

**Vercel Cron 설정:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-storage",
      "schedule": "0 3 * * *"
    }
  ]
}
```

### 2.5 Acceptance Criteria (Phase 0)

- [ ] `lib/refund/config.ts` 생성 및 환경 변수 오버라이드 동작 확인
- [ ] `DELETE /api/candidates/[id]` API 생성 및 동작 확인
- [ ] Storage 파일 삭제 실패 시 로깅되고 환불은 정상 진행
- [ ] candidates 테이블에 `deleted_at`, `delete_reason` 컬럼 추가
- [ ] credit_transactions 테이블에 `refund_reason`, `idempotency_key` 컬럼 추가
- [ ] `process_quality_refund` RPC 함수에 Advisory Lock 포함
- [ ] `check_and_reset_user_credits` 함수가 RPC 내에서 호출됨
- [ ] processing_jobs FK가 ON DELETE SET NULL로 설정
- [ ] Storage cleanup 배치 job 생성

---

## 3. [Phase 1] 분석 품질 불량 자동 환불

### 3.1 요구사항

분석 완료 시 품질 기준 미달인 경우:
1. 크레딧 자동 환불
2. Candidate Soft Delete (감사 추적 유지)
3. Storage 파일 삭제 (실패 시 배치로 재시도)

### 3.2 자동 환불 조건

```typescript
import { REFUND_CONFIG } from "@/lib/refund/config";

// Config 기반 환불 조건
IF confidence_score < REFUND_CONFIG.quality.confidenceThreshold  // 기본 0.3
   AND missing_critical_fields >= REFUND_CONFIG.quality.requiredMissingFields  // 기본 2
THEN auto_refund = true
```

**핵심 필드 (critical_fields):** `REFUND_CONFIG.quality.criticalFields`
- `name` (이름)
- `contact` (phone 또는 email) - 둘 다 없으면 1개 누락
- `last_company` (최근 회사) - null이면 누락

### 3.3 구현 명세

#### 3.3.1 트리거 위치

**확정:** `app/api/webhooks/worker/route.ts` (Worker Webhook 핸들러)

#### 3.3.2 Webhook 핸들러 수정

**파일:** `app/api/webhooks/worker/route.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { REFUND_CONFIG } from "@/lib/refund/config";
import { encryptPII } from "@/lib/encryption"; // 기존 암호화 유틸

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Worker webhook 처리 부분에 추가
async function handleAnalysisComplete(payload: WorkerPayload) {
  const { job_id, candidate_id, user_id, result } = payload;

  // 1. Quick data를 candidates 테이블에 저장 (PII 암호화)
  if (result.quick_data) {
    const quickData = result.quick_data;

    await supabaseAdmin.from("candidates").update({
      name: quickData.name || null,
      phone_encrypted: quickData.phone ? await encryptPII(quickData.phone) : null,
      email_encrypted: quickData.email ? await encryptPII(quickData.email) : null,
      last_company: quickData.last_company || null,
      last_position: quickData.last_position || null,
    }).eq("id", candidate_id);
  }

  // 2. 품질 환불 조건 체크
  const shouldRefund = checkQualityRefundCondition(result);

  if (shouldRefund.eligible) {
    const refundResult = await processQualityRefund({
      candidateId: candidate_id,
      userId: user_id,
      jobId: job_id,
      confidence: result.confidence_score,
      missingFields: shouldRefund.missingFields,
    });

    if (refundResult.success) {
      // 3. 사용자 알림
      await notifyUserRefund(user_id, "quality_refund");

      return {
        received: true,
        action: "refunded",
        reason: "quality_below_threshold",
        idempotent: refundResult.idempotent
      };
    }
  }

  return { received: true, action: "completed" };
}

// 품질 환불 조건 체크 함수 (Config 기반)
function checkQualityRefundCondition(result: AnalysisResult): {
  eligible: boolean;
  missingFields: string[];
} {
  const { quality } = REFUND_CONFIG;
  const missingFields: string[] = [];

  // confidence 체크
  const confidence = result.confidence_score ?? 0;
  if (confidence >= quality.confidenceThreshold) {
    return { eligible: false, missingFields: [] };
  }

  // 핵심 필드 누락 체크 (Config 기반)
  const quickData = result.quick_data || {};

  // name 체크
  if (!quickData.name) {
    missingFields.push("name");
  }

  // contact 체크 (phone 또는 email)
  if (!quickData.phone && !quickData.email) {
    missingFields.push("contact");
  }

  // last_company 체크 (careers 대체)
  if (!quickData.last_company) {
    missingFields.push("last_company");
  }

  return {
    eligible: missingFields.length >= quality.requiredMissingFields,
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
}): Promise<{ success: boolean; idempotent?: boolean; error?: string }> {
  const { candidateId, userId, jobId, confidence, missingFields } = params;

  // 1. RPC로 Atomic 환불 처리 (Advisory Lock 포함)
  const { data, error } = await supabaseAdmin.rpc("process_quality_refund", {
    p_candidate_id: candidateId,
    p_user_id: userId,
    p_job_id: jobId,
    p_confidence: confidence,
    p_missing_fields: missingFields,
  });

  if (error) {
    console.error("[QualityRefund] RPC Error:", error);
    return { success: false, error: error.message };
  }

  // RPC 결과 확인
  if (!data.success) {
    console.error("[QualityRefund] RPC returned failure:", data.error);
    return { success: false, error: data.error };
  }

  // 2. Storage 파일 삭제 시도 (실패해도 환불은 완료된 상태)
  try {
    const { data: job } = await supabaseAdmin
      .from("processing_jobs")
      .select("file_name")
      .eq("id", jobId)
      .single();

    if (job?.file_name) {
      const ext = job.file_name.split(".").pop();
      const storagePath = `uploads/${userId}/${jobId}.${ext}`;

      const { error: storageError } = await supabaseAdmin.storage
        .from("resumes")
        .remove([storagePath]);

      if (storageError) {
        // Storage 삭제 실패 - 로깅 (배치 cleanup에서 재시도)
        console.error(`[QualityRefund] Storage deletion failed: ${storagePath}`, storageError);
        // error_message는 남기지 않음 (배치에서 null인 것만 처리)
      } else {
        console.log(`[QualityRefund] File deleted: ${storagePath}`);
      }
    }
  } catch (storageErr) {
    console.error("[QualityRefund] Storage operation error:", storageErr);
    // Storage 실패는 무시하고 환불 성공으로 처리
  }

  console.log(`[QualityRefund] Processed: candidate=${candidateId}, confidence=${confidence}, missing=${missingFields.join(",")}, idempotent=${data.idempotent}`);

  return { success: true, idempotent: data.idempotent };
}

// 사용자 알림 (Supabase Realtime Broadcast)
async function notifyUserRefund(userId: string, type: "quality_refund") {
  try {
    const channel = supabaseAdmin.channel(`user:${userId}`);
    await channel.send({
      type: "broadcast",
      event: type,
      payload: {
        message: "분석 품질 미달로 크레딧이 환불되었습니다. 파일 확인 후 다시 업로드해주세요.",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[QualityRefund] Notification failed:", err);
    // 알림 실패는 무시
  }
}
```

### 3.4 사용자 알림

| 채널 | 메시지 |
|------|--------|
| 토스트 (Realtime) | "분석 품질 미달로 크레딧이 환불되었습니다. 파일 확인 후 다시 업로드해주세요." |

**클라이언트 구현:**

```typescript
// hooks/useRefundNotification.ts
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function useRefundNotification(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`user:${userId}`)
      .on("broadcast", { event: "quality_refund" }, (payload) => {
        toast.info(payload.payload.message);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
```

### 3.5 악용 방지

| 보호 장치 | 설명 |
|-----------|------|
| **Advisory Lock** | RPC 내에서 candidate 단위 락 → 동시 환불 요청 직렬화 |
| **Idempotency Key** | `quality_refund_{candidate_id}` → UNIQUE 제약으로 중복 방지 |
| **Soft Delete** | 환불 시 `deleted_at` 설정 → 감사 추적 유지, 패턴 분석 가능 |
| **Config 외부화** | 정책 변경 시 코드 수정 없이 환경 변수로 대응 |

### 3.6 Acceptance Criteria (Phase 1 - 품질 환불)

- [ ] Worker Webhook에서 quick_data를 candidates 테이블에 저장 (PII 암호화)
- [ ] `confidence < 0.3 AND 필드 2개 이상 누락` 시 자동 환불 (Config 기반)
- [ ] `last_company`로 경력 필드 체크 (`careers` 대체)
- [ ] `process_quality_refund` RPC 호출로 Atomic 처리 (Advisory Lock)
- [ ] Lazy reset으로 월간 크레딧 자동 리셋
- [ ] 환불 시 Candidate `status = 'refunded'`, `deleted_at` 설정
- [ ] Storage 파일 삭제 시도, 실패 시 로깅 (배치 cleanup)
- [ ] `credit_transactions`에 `refund_reason = 'quality_fail'` 기록
- [ ] `idempotency_key`로 중복 환불 방지
- [ ] 사용자에게 Realtime 토스트 알림 표시
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

### 4.3 Acceptance Criteria (Phase 1 - 파일 검증)

- [ ] 지원되지 않는 파일 형식 업로드 시 크레딧 미차감 + 명확한 에러 메시지
- [ ] 10MB 초과 파일 업로드 시 크레딧 미차감 + 에러 메시지
- [ ] 암호화된 PDF 업로드 시 크레딧 미차감 + 에러 메시지
- [ ] 이중 확장자 파일 업로드 차단 확인

---

## 5. [Phase 2] 구독 취소 및 Pro-rata 환불

### 5.1 요구사항

사용자가 구독을 취소할 때 사용량에 따라 부분 환불을 처리한다.

### 5.2 환불 공식 (Config 기반)

```typescript
import { REFUND_CONFIG } from "@/lib/refund/config";

function calculateRefund(input: RefundCalculation): number {
  const { paymentAmount, remainingDays, totalDays, usageRate, usedCredits, plan } = input;
  const { adjustmentFactors, creditUnitPrice } = REFUND_CONFIG.subscription;

  // 조정 계수 (Config 기반)
  let adjustmentFactor: number;
  if (usageRate < adjustmentFactors.low.threshold) {
    adjustmentFactor = adjustmentFactors.low.factor;
  } else if (usageRate <= adjustmentFactors.medium.threshold) {
    adjustmentFactor = adjustmentFactors.medium.factor;
  } else {
    return 0; // 80% 초과 사용 시 환불 불가
  }

  // 환불 금액 계산
  const proRataAmount = paymentAmount * (remainingDays / totalDays) * adjustmentFactor;
  const usedCreditsCost = usedCredits * creditUnitPrice[plan];

  return Math.max(0, Math.floor(proRataAmount - usedCreditsCost));
}
```

### 5.3 7일 이내 전액 환불

```typescript
function isFullRefundEligible(subscriptionStartDate: Date, usedCredits: number): boolean {
  const { fullRefundDays, fullRefundMaxCredits } = REFUND_CONFIG.subscription;
  const daysSinceStart = differenceInDays(new Date(), subscriptionStartDate);
  return daysSinceStart <= fullRefundDays && usedCredits <= fullRefundMaxCredits;
}
```

### 5.4 Acceptance Criteria (Phase 2)

- [ ] 7일 이내 + 10건 이하 사용 시 전액 환불 처리 (Config 기반)
- [ ] 8일 이후 취소 시 Pro-rata 공식에 따른 부분 환불 계산
- [ ] 80% 초과 사용 시 환불 불가 메시지 표시
- [ ] 취소 후에도 결제 주기 종료일까지 서비스 이용 가능
- [ ] refund_requests 테이블에 모든 환불 요청 기록

---

## 6. [Phase 2] Paddle Refund API 연동

(v0.3과 동일 - 생략)

---

## 7. [Phase 3] 서비스 장애 자동 보상

(v0.3과 동일 - 생략)

---

## 8. [Phase 3] 환불 신청 UI

(v0.3과 동일 - 생략)

---

## 9. 비기능 요구사항

### 9.1 성능

| 항목 | 요구사항 |
|------|----------|
| 품질 체크 + Soft Delete | 분석 완료 후 500ms 이내 |
| RPC 함수 실행 (Advisory Lock 포함) | 100ms 이내 |
| 환불 금액 계산 | 500ms 이내 |
| Paddle API 호출 | 타임아웃 30초 |

### 9.2 보안

| 항목 | 요구사항 |
|------|----------|
| 환불 요청 | 인증된 사용자만 가능 |
| 금액 조작 | 서버에서만 계산 (클라이언트 값 무시) |
| PII 암호화 | quick_data 저장 시 phone, email 암호화 필수 |
| Advisory Lock | 동시 환불 요청 직렬화 |
| Idempotency | 모든 환불 작업에 idempotency_key 필수 |

### 9.3 모니터링

| 이벤트 | 로깅 |
|--------|------|
| 환불 요청 | `[Refund] Request: user_id, amount, type` |
| 환불 성공 | `[Refund] Success: candidate_id, idempotent` |
| 환불 실패 | `[Refund] Failed: error, candidate_id` |
| Storage 삭제 실패 | `[QualityRefund] Storage deletion failed: path` |
| 중복 환불 시도 | `[Refund] Idempotent: candidate_id` |
| 배치 Cleanup | `[Cleanup] Deleted: path` |

### 9.4 데이터 보존

| 데이터 | 보존 기간 | 삭제 방식 |
|--------|----------|----------|
| Soft Deleted Candidates | 90일 (Config) | 배치 Hard Delete |
| credit_transactions | 영구 | 보존 |
| refund_requests | 영구 | 보존 |
| Storage 파일 | 환불 시 삭제 시도, 실패 시 배치 | 배치 cleanup |

---

## 10. 테스트 요구사항

### 10.1 단위 테스트

| 테스트 | 케이스 |
|--------|--------|
| `checkQualityRefundCondition()` | confidence 0.29, 0.3, 0.31, null, -0.1 |
| `checkQualityRefundCondition()` | 필드 누락 조합 (0, 1, 2, 3개) |
| `checkQualityRefundCondition()` | `last_company` null vs 빈 문자열 |
| `checkQualityRefundCondition()` | phone/email 조합 (둘 다 null, 하나만 존재) |
| `calculateRefund()` | 각 조정계수 경계값 (0.49, 0.5, 0.8, 0.81) |
| `isFullRefundEligible()` | 7일/10건 경계값 |
| `REFUND_CONFIG` | 환경 변수 오버라이드 |

### 10.2 통합 테스트

| 테스트 | 케이스 |
|--------|--------|
| Advisory Lock | 동일 candidate 동시 환불 요청 → 1회만 처리 |
| Idempotency | 동일 요청 재시도 → idempotent: true 반환 |
| Lazy Reset | 월 변경 후 첫 환불 → credits_used_this_month 리셋 후 처리 |
| PII 암호화 | quick_data 저장 후 복호화 검증 |
| Storage 실패 | Storage API 503 → 로깅되고 환불은 성공 |
| 배치 Cleanup | refunded 상태 + Storage 잔존 → 배치로 삭제 |

### 10.3 E2E 테스트

| 테스트 | 시나리오 |
|--------|---------|
| 품질 환불 | 업로드 → 분석 (저품질) → 자동 환불 → 토스트 확인 |
| 월말 환불 | 1월 31일 업로드 → 2월 1일 환불 → 음수 방지 확인 |
| 동시 업로드 | 동일 파일 동시 업로드 → 2건 다 저품질 → 각각 환불 |

---

## 11. 롤아웃 계획

| Phase | 내용 | 의존성 |
|-------|------|--------|
| **Phase 0** | Config, DELETE API, 스키마 마이그레이션, 배치 setup | 없음 |
| **Phase 1** | 크레딧 자동 환불 + 파일 검증 강화 | Phase 0 완료 |
| **Phase 2** | 구독 환불 + Paddle 연동 | Phase 1 완료 |
| **Phase 3** | 장애 보상 + 환불 UI | Phase 2 완료 |

---

## 12. 성공 지표

| 지표 | 목표 | 측정 쿼리 |
|------|------|----------|
| 품질 자동 환불 처리율 | 100% | `SELECT COUNT(*) FROM credit_transactions WHERE refund_reason = 'quality_fail'` |
| 중복 환불 발생 | 0건 | Idempotent 로그 모니터링 |
| 환불 처리 시간 | < 500ms | RPC 실행 시간 메트릭 |
| Storage 잔존 파일 | 0건 (1일 이내) | 배치 cleanup 로그 |

---

## 13. 최종 권장안 요약 (v0.4)

| 항목 | v0.3 | v0.4 (전원 합의) |
|------|------|-----------------|
| 환불 조건 필드 | careers | **last_company** |
| 환불 조건 관리 | 하드코딩 | **Config 외부화** |
| Quick data 저장 | 없음 | **Webhook에서 저장 + PII 암호화** |
| Storage 삭제 실패 | orphaned_files 테이블 | **로깅 + 배치 cleanup** |
| Monthly reset | pg_cron | **Lazy reset (RPC 내 호출)** |
| RPC 동시성 | 없음 | **Advisory Lock** |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025.01.13 | 초안 작성 |
| 1.1 | 2025.01.13 | 품질 환불 시 삭제 정책 적용, 월간 한도 제거 |
| 1.2 | 2025.01.13 | Engineer 검토 반영: Phase 0 추가, Soft Delete, Idempotency |
| **1.3** | 2025.01.13 | **전원 합의 반영:** careers→last_company, Config 외부화, PII 암호화, Lazy reset, Advisory Lock, 배치 cleanup |
