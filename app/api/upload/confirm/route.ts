/**
 * POST /api/upload/confirm
 * 클라이언트가 Storage에 직접 업로드 완료 후 Worker 파이프라인 트리거
 *
 * 보안: 업로드된 파일의 매직 바이트를 검증하여 위조된 파일 차단
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateMagicBytes, validateZipStructure } from "@/lib/file-validation";
import { withRateLimit } from "@/lib/rate-limit";
import { callWorkerPipelineAsync } from "@/lib/fetch-retry";
import { releaseCreditReservation } from "@/lib/supabase/admin";
import {
    apiSuccess,
    apiUnauthorized,
    apiBadRequest,
    apiInternalError,
    apiFileValidationError,
} from "@/lib/api-response";

// Worker URL
const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
    try {
        // 레이트 제한 체크
        const rateLimitResponse = await withRateLimit(request, "upload");
        if (rateLimitResponse) return rateLimitResponse;

        const supabase = await createClient();

        // 인증 확인
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return apiUnauthorized();
        }

        // 요청 바디 파싱
        const { jobId, candidateId, storagePath, fileName, plan } = await request.json();

        if (!jobId || !storagePath || !fileName) {
            return apiBadRequest("업로드 정보가 올바르지 않습니다. 페이지를 새로고침하고 다시 시도해주세요.");
        }

        // ─────────────────────────────────────────────────
        // 보안: IDOR 방지 - jobId 소유권 검증
        // 클라이언트가 전달한 userId를 신뢰하지 않고, DB에서 직접 확인
        // ─────────────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: jobData, error: jobError } = await (supabase as any)
            .from("processing_jobs")
            .select("user_id, status")
            .eq("id", jobId)
            .single();

        if (jobError || !jobData) {
            console.warn(`[Upload Confirm] Job not found: jobId=${jobId}, user=${user.id}`);
            return apiBadRequest("업로드 작업을 찾을 수 없습니다. 페이지를 새로고침하고 다시 시도해주세요.");
        }

        // public.users에서 현재 사용자의 ID 조회
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: userData, error: userError } = await (supabase as any)
            .from("users")
            .select("id")
            .eq("email", user.email)
            .single();

        if (userError || !userData) {
            return apiBadRequest("사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
        }

        const publicUserId = userData.id;

        // 소유권 검증: job의 user_id와 현재 사용자의 public.users.id 비교
        if (jobData.user_id !== publicUserId) {
            console.error(`[Upload Confirm] IDOR attempt detected: jobUserId=${jobData.user_id}, currentUser=${publicUserId}, jobId=${jobId}`);
            return apiUnauthorized();
        }

        // 이미 처리된 job인지 확인
        if (jobData.status !== "queued") {
            console.warn(`[Upload Confirm] Job already processed: jobId=${jobId}, status=${jobData.status}`);
            return apiBadRequest("이미 처리된 업로드입니다.");
        }

        // 파일 확장자 안전하게 추출
        const fileNameParts = fileName.split(".");
        if (fileNameParts.length < 2) {
            return apiBadRequest("파일 확장자가 없습니다. HWP, HWPX, DOC, DOCX, PDF 형식의 파일을 선택해주세요.");
        }
        const ext = "." + fileNameParts[fileNameParts.length - 1].toLowerCase();

        // ─────────────────────────────────────────────────
        // 보안: Storage에서 파일 헤더를 읽어 매직 바이트 검증
        // 위조된 파일 (예: .exe를 .pdf로 변경) 차단
        // ─────────────────────────────────────────────────
        try {
            const { data: fileData, error: downloadError } = await supabase.storage
                .from("resumes")
                .download(storagePath);

            if (downloadError || !fileData) {
                console.error("[Upload Confirm] Failed to download file for validation:", downloadError);
                return apiInternalError("파일 검증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }

            // 파일 버퍼로 변환 (처음 16바이트만 필요하지만 전체를 읽음)
            const fileBuffer = await fileData.arrayBuffer();

            // 매직 바이트 검증
            const magicValidation = validateMagicBytes(fileBuffer, ext);
            if (!magicValidation.valid) {
                console.error("[Upload Confirm] Magic byte validation failed:", magicValidation.error);

                // 위조된 파일 삭제
                await supabase.storage.from("resumes").remove([storagePath]);

                // job 상태 업데이트
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any)
                    .from("processing_jobs")
                    .update({ status: "failed", error_message: magicValidation.error })
                    .eq("id", jobId);

                // candidate 삭제
                if (candidateId) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase as any)
                        .from("candidates")
                        .delete()
                        .eq("id", candidateId);
                }

                // 파일 검증 실패 시 크레딧 복구
                await releaseCreditReservation(publicUserId, jobId);

                return apiFileValidationError(magicValidation.error || "파일 형식이 올바르지 않습니다. 파일이 손상되었거나 확장자가 변경되었을 수 있습니다. 원본 파일을 확인해주세요.");
            }

            // ─────────────────────────────────────────────────
            // Issue #10: ZIP 기반 파일 내부 구조 검증 (DOCX, HWPX)
            // 매직 바이트만으로는 위조된 ZIP 파일을 탐지할 수 없으므로
            // 실제 파일 내부 구조를 검증
            // ─────────────────────────────────────────────────
            if ([".docx", ".hwpx"].includes(ext)) {
                const zipValidation = await validateZipStructure(fileBuffer, ext);
                if (!zipValidation.valid) {
                    console.error("[Upload Confirm] ZIP structure validation failed:", zipValidation.error);

                    // 위조된 파일 삭제
                    await supabase.storage.from("resumes").remove([storagePath]);

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase as any)
                        .from("processing_jobs")
                        .update({ status: "failed", error_message: zipValidation.error })
                        .eq("id", jobId);

                    if (candidateId) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (supabase as any)
                            .from("candidates")
                            .delete()
                            .eq("id", candidateId);
                    }

                    // ZIP 구조 검증 실패 시 크레딧 복구
                    await releaseCreditReservation(publicUserId, jobId);

                    return apiFileValidationError(zipValidation.error || "파일 구조가 올바르지 않습니다.");
                }
            }
        } catch (validationError) {
            console.error("[Upload Confirm] File validation error:", validationError);

            // 파일 검증 예외 발생 시 크레딧 복구
            await releaseCreditReservation(publicUserId, jobId);

            return apiInternalError("파일 검증 중 오류가 발생했습니다. 파일이 손상되었을 수 있습니다. 다른 파일로 다시 시도해주세요.");
        }

        // Worker 파이프라인 호출 (비동기, 재시도 로직 포함)
        // 보안: 클라이언트가 전달한 userId 대신 DB에서 검증된 publicUserId 사용
        const workerPayload = {
            file_url: storagePath,
            file_name: fileName,
            user_id: publicUserId,  // DB에서 검증된 사용자 ID
            job_id: jobId,
            candidate_id: candidateId,
            mode: plan === "pro" ? "phase_2" : "phase_1", // Pro: 3-Way Cross-Check
        };

        console.log("[Upload Confirm] Calling Worker pipeline with retry:", {
            url: `${WORKER_URL}/pipeline`,
            jobId,
        });

        // 비동기 호출: 재시도 로직 포함, 실패 시 상태 업데이트 + 크레딧 복구
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabaseAny = supabase as any;
        callWorkerPipelineAsync(WORKER_URL, workerPayload, async (error, attempts) => {
            console.error(`[Upload Confirm] Worker pipeline failed after ${attempts} attempts: ${error}`);

            // 모든 재시도 실패 시 job 상태를 failed로 업데이트
            await supabaseAny
                .from("processing_jobs")
                .update({
                    status: "failed",
                    error_message: `Worker connection failed after ${attempts} attempts: ${error}`,
                })
                .eq("id", jobId);

            // candidate 상태도 업데이트
            if (candidateId) {
                await supabaseAny
                    .from("candidates")
                    .update({ status: "failed" })
                    .eq("id", candidateId);
            }

            // Worker 연결 실패 시 크레딧 복구
            // presign에서 예약된 크레딧을 돌려줌
            try {
                const releaseResult = await releaseCreditReservation(publicUserId, jobId);
                if (releaseResult.success) {
                    console.log(`[Upload Confirm] Credit released for user ${publicUserId}`);
                } else {
                    console.warn(`[Upload Confirm] Failed to release credit: ${releaseResult.error}`);
                }
            } catch (releaseError) {
                console.error(`[Upload Confirm] Error releasing credit:`, releaseError);
            }
        });

        return apiSuccess({
            jobId,
            message: "파일이 업로드되었습니다. 백그라운드에서 분석 중입니다.",
        });
    } catch (error) {
        console.error("Confirm error:", error);
        return apiInternalError();
    }
}
