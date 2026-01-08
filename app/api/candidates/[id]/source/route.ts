/**
 * GET /api/candidates/[id]/source
 * 후보자의 원본 파일에 대한 signed URL 반환
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

        // 후보자 조회 (source_file 가져오기) - user_id로 소유권 검증
        const { data: candidate, error: candidateError } = await supabase
            .from("candidates")
            .select("source_file, file_type")
            .eq("id", id)
            .eq("user_id", user.id)  // IDOR 방지: 본인 소유 데이터만 접근 가능
            .single();

        if (candidateError || !candidate) {
            return apiNotFound("후보자를 찾을 수 없습니다.");
        }

        // Cast to proper type
        const candidateData = candidate as { source_file?: string; file_type?: string };

        const sourceFile = candidateData.source_file;
        if (!sourceFile) {
            return apiSuccess({ error: "원본 파일이 없습니다.", url: null });
        }

        // PDF만 미리보기 지원
        const fileType = candidateData.file_type?.toLowerCase();
        if (fileType !== "pdf") {
            return apiSuccess({
                error: `${fileType || "unknown"} 파일은 미리보기를 지원하지 않습니다. PDF만 지원됩니다.`,
                url: null,
                fileType,
            });
        }

        // Supabase Storage에서 signed URL 생성 (1시간 유효)
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
        });
    } catch (error) {
        console.error("Source file API error:", error);
        return apiInternalError();
    }
}
