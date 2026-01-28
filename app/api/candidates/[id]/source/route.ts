/**
 * GET /api/candidates/[id]/source
 * 후보자의 PDF 미리보기를 위한 signed URL 반환
 *
 * 우선순위:
 * 1. pdf_url이 있으면 변환된 PDF 반환 (DOC/DOCX/HWP → PDF 변환 결과)
 * 2. 원본이 PDF인 경우 source_file 반환
 * 3. 그 외는 미리보기 불가
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
} from "@/lib/api-response";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const supabase = await createClient();

        // 인증 확인
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return apiUnauthorized();
        }

        // 후보자 조회 (source_file, file_type, pdf_url 가져오기) - user_id로 소유권 검증
        const { data: candidate, error: candidateError } = await supabase
            .from("candidates")
            .select("source_file, file_type, pdf_url")
            .eq("id", id)
            .eq("user_id", user.id)  // IDOR 방지: 본인 소유 데이터만 접근 가능
            .single();

        if (candidateError || !candidate) {
            return apiNotFound("후보자를 찾을 수 없습니다.");
        }

        // Cast to proper type
        const candidateData = candidate as {
            source_file?: string;
            file_type?: string;
            pdf_url?: string;
        };

        const fileType = candidateData.file_type?.toLowerCase();

        // 1. 변환된 PDF가 있는 경우 (DOC/DOCX/HWP에서 변환됨)
        if (candidateData.pdf_url) {
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from("resumes")
                .createSignedUrl(candidateData.pdf_url, 3600); // 1시간

            if (signedUrlError || !signedUrlData) {
                console.error("Failed to create signed URL for converted PDF:", signedUrlError);
                return apiInternalError("미리보기 URL 생성에 실패했습니다.");
            }

            return apiSuccess({
                url: signedUrlData.signedUrl,
                fileType,
                isConverted: true, // 변환된 PDF임을 표시
            });
        }

        // 2. 원본 파일이 없는 경우
        const sourceFile = candidateData.source_file;
        if (!sourceFile) {
            return apiSuccess({ error: "원본 파일이 없습니다.", url: null });
        }

        // 3. 원본이 PDF인 경우
        if (fileType === "pdf") {
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from("resumes")
                .createSignedUrl(sourceFile, 3600); // 1시간

            if (signedUrlError || !signedUrlData) {
                console.error("Failed to create signed URL:", signedUrlError);
                return apiInternalError("미리보기 URL 생성에 실패했습니다.");
            }

            return apiSuccess({
                url: signedUrlData.signedUrl,
                fileType,
                isConverted: false,
            });
        }

        // 4. 원본이 PDF가 아니고 변환된 PDF도 없는 경우
        // (이전에 업로드된 파일이거나 변환이 실패한 경우)
        return apiSuccess({
            error: `${fileType || "unknown"} 파일의 PDF 변환이 아직 완료되지 않았습니다.`,
            url: null,
            fileType,
        });
    } catch (error) {
        console.error("Source file API error:", error);
        return apiInternalError();
    }
}
