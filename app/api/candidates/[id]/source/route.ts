/**
 * GET /api/candidates/[id]/source
 * 후보자의 원본 파일에 대한 signed URL 반환
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // 후보자 조회 (source_file 가져오기)
        const { data: candidate, error: candidateError } = await supabase
            .from("candidates")
            .select("source_file, file_type")
            .eq("id", id)
            .single();

        if (candidateError || !candidate) {
            return NextResponse.json(
                { error: "Candidate not found" },
                { status: 404 }
            );
        }

        // Cast to proper type
        const candidateData = candidate as { source_file?: string; file_type?: string };

        const sourceFile = candidateData.source_file;
        if (!sourceFile) {
            return NextResponse.json(
                { error: "Source file not available", url: null },
                { status: 200 }
            );
        }

        // PDF만 미리보기 지원
        const fileType = candidateData.file_type?.toLowerCase();
        if (fileType !== "pdf") {
            return NextResponse.json({
                error: `Preview not supported for ${fileType || "unknown"} files. Only PDF is supported.`,
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
            return NextResponse.json(
                { error: "Failed to generate preview URL", url: null },
                { status: 500 }
            );
        }

        return NextResponse.json({
            url: signedUrlData.signedUrl,
            fileType,
        });
    } catch (error) {
        console.error("Source file API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
