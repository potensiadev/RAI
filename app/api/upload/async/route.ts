import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  validateFile,
  calculateRemainingCredits,
  type UserCreditsInfo,
} from "@/lib/file-validation";
import { withRateLimit } from "@/lib/rate-limit";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  apiNotFound,
  apiInsufficientCredits,
  apiInternalError,
  apiFileValidationError,
} from "@/lib/api-response";

/**
 * Async Upload Endpoint
 *
 * 파일을 업로드하고 Queue에 작업을 추가합니다.
 * 즉시 반환하고 Worker가 백그라운드에서 처리합니다.
 *
 * Flow:
 * 1. 파일 업로드 → Supabase Storage
 * 2. processing_jobs 레코드 생성 (status: queued)
 * 3. Redis Queue에 작업 추가
 * 4. 즉시 job_id 반환
 * 5. Worker가 처리 완료 시 Webhook으로 알림
 */

// Worker URL for queue operations
const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    // 레이트 제한 체크
    const rateLimitResponse = await withRateLimit(request, "upload");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiUnauthorized();
    }

    // 크레딧 확인
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("credits, credits_used_this_month, plan")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return apiNotFound("사용자를 찾을 수 없습니다.");
    }

    // 크레딧 계산 (공통 유틸리티 사용)
    const userInfo = userData as UserCreditsInfo;
    const remaining = calculateRemainingCredits(userInfo);

    if (remaining <= 0) {
      return apiInsufficientCredits();
    }

    // FormData 파싱
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiBadRequest("파일이 제공되지 않았습니다.");
    }

    // 파일 버퍼 읽기 (매직 바이트 검증용)
    const fileBuffer = await file.arrayBuffer();

    // 파일 검증 (확장자 + 크기 + 매직 바이트)
    const validation = validateFile({
      fileName: file.name,
      fileSize: file.size,
      fileBuffer: fileBuffer,
    });

    if (!validation.valid) {
      return apiFileValidationError(validation.error || "파일 검증에 실패했습니다.");
    }

    const ext = validation.extension || "." + file.name.split(".").pop()?.toLowerCase();

    // processing_jobs 레코드 생성
    const { data: job, error: jobError } = await supabaseAny
      .from("processing_jobs")
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: ext.replace(".", ""),
        status: "queued",
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Failed to create job:", jobError);
      return apiInternalError("작업 생성에 실패했습니다.");
    }

    const jobData = job as { id: string };

    // Supabase Storage에 파일 업로드
    const storagePath = `uploads/${user.id}/${jobData.id}/${file.name}`;
    // fileBuffer는 위에서 매직 바이트 검증 시 이미 읽음

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      // 업로드 실패 시 job 상태 업데이트
      await supabaseAny
        .from("processing_jobs")
        .update({ status: "failed", error_message: uploadError.message })
        .eq("id", jobData.id);

      console.error("Storage upload failed:", uploadError);
      return apiInternalError("파일 업로드에 실패했습니다.");
    }

    // Worker에 Queue 작업 추가 요청
    try {
      const queueResponse = await fetch(`${WORKER_URL}/queue/enqueue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobData.id,
          user_id: user.id,
          file_path: storagePath,
          file_name: file.name,
          mode: userInfo.plan === "pro" ? "phase_2" : "phase_1", // Pro: 3-Way Cross-Check
        }),
      });

      if (!queueResponse.ok) {
        // Queue 추가 실패해도 job은 queued 상태로 유지
        // 나중에 Worker가 polling으로 처리 가능
        console.warn("Failed to enqueue job, keeping in queued state");
      } else {
        const queueResult = await queueResponse.json();
        console.log(`Job queued: ${jobData.id}, rq_job_id: ${queueResult.rq_job_id}`);
      }
    } catch (queueError) {
      // Queue 서비스 연결 실패해도 계속 진행
      console.warn("Queue service unavailable:", queueError);
    }

    return apiSuccess({
      jobId: jobData.id,
      message: "파일이 업로드되어 처리 대기 중입니다.",
    });

  } catch (error) {
    console.error("Async upload error:", error);
    return apiInternalError();
  }
}
