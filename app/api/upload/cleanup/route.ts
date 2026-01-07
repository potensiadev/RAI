/**
 * POST /api/upload/cleanup
 * 업로드 실패 시 orphan 데이터 정리
 *
 * - processing_jobs 레코드 삭제 또는 상태 업데이트
 * - candidates 레코드 삭제
 * - Storage 파일 삭제
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
} from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiUnauthorized();
    }

    const { jobId, candidateId, storagePath } = await request.json();

    if (!jobId) {
      return apiBadRequest("jobId가 필요합니다.");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // 1. Job 상태를 failed로 업데이트
    await supabaseAny
      .from("processing_jobs")
      .update({
        status: "failed",
        error_message: "Upload cancelled or failed",
      })
      .eq("id", jobId);

    // 2. Candidate 삭제 (존재하는 경우)
    if (candidateId) {
      await supabaseAny
        .from("candidates")
        .delete()
        .eq("id", candidateId);
    }

    // 3. Storage 파일 삭제 (존재하는 경우)
    if (storagePath) {
      await supabase.storage
        .from("resumes")
        .remove([storagePath]);
    }

    return apiSuccess({
      message: "Cleanup completed",
      cleaned: { jobId, candidateId, storagePath },
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    // 정리 작업 실패는 200 반환 (best effort)
    return apiSuccess({
      message: "Cleanup attempted with errors",
      error: (error as Error).message,
    });
  }
}
