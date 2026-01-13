/**
 * Storage Cleanup 배치
 *
 * PRD: prd_refund_policy_v0.4.md Section 2.4
 * QA: refund_policy_test_scenarios_v1.0.md (EC-051 ~ EC-060)
 *
 * - Vercel Cron 또는 수동 실행
 * - refunded/deleted 상태인데 Storage에 파일이 남아있는 케이스 정리
 * - error_message 필드를 사용하여 cleanup 상태 추적
 */

import { createClient } from "@supabase/supabase-js";

// Service Role Key 사용 (RLS 우회)
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

interface CleanupResult {
  success: boolean;
  processed: number;
  cleaned: number;
  failed: number;
  errors: string[];
}

/**
 * Orphaned 파일 정리
 *
 * EC-051: refunded 상태 job 파일 정리
 * EC-052: deleted 상태 candidate 파일 정리
 * EC-053: Storage 삭제 실패 시 error_message 기록
 */
export async function cleanupOrphanedFiles(): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    processed: 0,
    cleaned: 0,
    failed: 0,
    errors: [],
  };

  console.log("[Cleanup] Starting orphaned files cleanup...");

  try {
    const supabaseAdmin = createAdminClient();

    // refunded 상태의 processing_jobs 중 아직 cleanup 안 된 것 조회
    // error_message가 NULL이거나 STORAGE_DELETE_FAILED로 시작하는 것
    const { data: jobs, error } = await supabaseAdmin
      .from("processing_jobs")
      .select("id, user_id, file_name, error_message")
      .eq("status", "refunded")
      .or("error_message.is.null,error_message.like.STORAGE_DELETE_FAILED%")
      .limit(100); // 배치 사이즈 제한

    if (error) {
      console.error("[Cleanup] Failed to fetch jobs:", error);
      result.success = false;
      result.errors.push(`DB fetch error: ${error.message}`);
      return result;
    }

    if (!jobs || jobs.length === 0) {
      console.log("[Cleanup] No jobs to process");
      return result;
    }

    console.log(`[Cleanup] Found ${jobs.length} jobs to process`);
    result.processed = jobs.length;

    for (const job of jobs) {
      if (!job.file_name || !job.user_id) {
        // 파일 정보가 없으면 cleaned로 마킹
        await supabaseAdmin
          .from("processing_jobs")
          .update({ error_message: "STORAGE_CLEANED_NO_FILE" })
          .eq("id", job.id);
        result.cleaned++;
        continue;
      }

      // Storage 경로 계산: uploads/{user_id}/{job_id}.{ext}
      const ext = job.file_name.split(".").pop() || "pdf";
      const storagePath = `uploads/${job.user_id}/${job.id}.${ext}`;

      try {
        // Storage에서 파일 삭제 시도
        const { error: storageError } = await supabaseAdmin.storage
          .from("resumes")
          .remove([storagePath]);

        if (storageError) {
          // 삭제 실패 시 error_message에 기록
          const failMessage = `STORAGE_DELETE_FAILED: ${storageError.message}`;
          await supabaseAdmin
            .from("processing_jobs")
            .update({ error_message: failMessage })
            .eq("id", job.id);

          console.error(`[Cleanup] Failed to delete ${storagePath}:`, storageError);
          result.failed++;
          result.errors.push(`${job.id}: ${storageError.message}`);
        } else {
          // 성공 시 마커 기록
          await supabaseAdmin
            .from("processing_jobs")
            .update({ error_message: "STORAGE_CLEANED" })
            .eq("id", job.id);

          console.log(`[Cleanup] Deleted: ${storagePath}`);
          result.cleaned++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Cleanup] Error processing ${job.id}:`, err);
        result.failed++;
        result.errors.push(`${job.id}: ${errorMsg}`);
      }
    }

    console.log(`[Cleanup] Completed - Processed: ${result.processed}, Cleaned: ${result.cleaned}, Failed: ${result.failed}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cleanup] Fatal error:", err);
    result.success = false;
    result.errors.push(`Fatal error: ${errorMsg}`);
  }

  return result;
}

/**
 * 90일 경과된 Soft Delete 데이터 Hard Delete
 *
 * EC-054: 90일 경과 데이터 정리
 * EC-055: CASCADE 삭제 확인
 */
export async function purgeOldDeletedRecords(): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    processed: 0,
    cleaned: 0,
    failed: 0,
    errors: [],
  };

  console.log("[Purge] Starting old deleted records purge...");

  try {
    const supabaseAdmin = createAdminClient();
    const retentionDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // 90일 이상 경과된 삭제 후보자 조회
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("candidates")
      .select("id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoffDate.toISOString())
      .limit(100);

    if (fetchError) {
      console.error("[Purge] Failed to fetch candidates:", fetchError);
      result.success = false;
      result.errors.push(`DB fetch error: ${fetchError.message}`);
      return result;
    }

    if (!candidates || candidates.length === 0) {
      console.log("[Purge] No candidates to purge");
      return result;
    }

    console.log(`[Purge] Found ${candidates.length} candidates to purge`);
    result.processed = candidates.length;

    // Hard Delete 실행 (CASCADE로 관련 데이터 자동 삭제)
    const { error: deleteError } = await supabaseAdmin
      .from("candidates")
      .delete()
      .in(
        "id",
        candidates.map((c) => c.id)
      );

    if (deleteError) {
      console.error("[Purge] Failed to delete candidates:", deleteError);
      result.success = false;
      result.errors.push(`Delete error: ${deleteError.message}`);
    } else {
      result.cleaned = candidates.length;
      console.log(`[Purge] Successfully purged ${result.cleaned} candidates`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Purge] Fatal error:", err);
    result.success = false;
    result.errors.push(`Fatal error: ${errorMsg}`);
  }

  return result;
}

/**
 * 전체 Cleanup 실행 (Cron Job용)
 */
export async function runFullCleanup(): Promise<{
  orphanedFiles: CleanupResult;
  oldRecords: CleanupResult;
}> {
  const orphanedFiles = await cleanupOrphanedFiles();
  const oldRecords = await purgeOldDeletedRecords();

  return { orphanedFiles, oldRecords };
}
