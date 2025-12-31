/**
 * GET /api/candidates/[id]
 * 후보자 상세 조회
 *
 * PATCH /api/candidates/[id]
 * 후보자 정보 수정 (검토 후 편집)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  type CandidateDetail,
  type ApiResponse,
  getConfidenceLevel,
  type Career,
  type Project,
  type Education,
  type RiskLevel,
} from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DB row를 CandidateDetail로 변환
 */
function toCandidateDetail(row: Record<string, unknown>): CandidateDetail {
  const confidence = (row.confidence_score as number) ?? 0;
  const confidencePercent = Math.round(confidence * 100);

  return {
    id: row.id as string,
    name: row.name as string,
    role: (row.last_position as string) ?? "",
    company: (row.last_company as string) ?? "",
    expYears: (row.exp_years as number) ?? 0,
    skills: (row.skills as string[]) ?? [],
    photoUrl: row.photo_url as string | undefined,
    summary: row.summary as string | undefined,
    aiConfidence: confidencePercent,
    confidenceLevel: getConfidenceLevel(confidencePercent),
    riskLevel: (row.risk_level as RiskLevel) ?? "low",
    requiresReview: (row.requires_review as boolean) ?? false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,

    // Detail specific fields
    birthYear: row.birth_year as number | undefined,
    gender: row.gender as "male" | "female" | "other" | undefined,
    careers: (row.careers as Career[]) ?? [],
    projects: (row.projects as Project[]) ?? [],
    education: (row.education as Education[]) ?? [],
    strengths: (row.strengths as string[]) ?? [],
    portfolioThumbnailUrl: row.portfolio_thumbnail_url as string | undefined,
    version: (row.version as number) ?? 1,
    parentId: row.parent_id as string | undefined,
    isLatest: (row.is_latest as boolean) ?? true,
    analysisMode: (row.analysis_mode as "phase_1" | "phase_2") ?? "phase_1",
    warnings: (row.warnings as string[]) ?? [],
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { error: { code: "UNAUTHORIZED", message: "인증이 필요합니다." } },
        { status: 401 }
      );
    }

    // 후보자 상세 조회 (RLS가 user_id 필터 자동 적용)
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json<ApiResponse<null>>(
          { error: { code: "NOT_FOUND", message: "후보자를 찾을 수 없습니다." } },
          { status: 404 }
        );
      }
      console.error("Candidate fetch error:", error);
      return NextResponse.json<ApiResponse<null>>(
        { error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    const candidate = toCandidateDetail(data as Record<string, unknown>);

    return NextResponse.json<ApiResponse<CandidateDetail>>({
      data: candidate,
    });
  } catch (error) {
    console.error("Candidate detail API error:", error);
    return NextResponse.json<ApiResponse<null>>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { error: { code: "UNAUTHORIZED", message: "인증이 필요합니다." } },
        { status: 401 }
      );
    }

    // 요청 바디 파싱
    const body = await request.json();

    // 허용된 필드만 업데이트 (보안)
    const allowedFields = [
      "name",
      "skills",
      "exp_years",
      "last_company",
      "last_position",
      "education_level",
      "location_city",
      "summary",
      "strengths",
      "careers",
      "projects",
      "requires_review",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        { error: { code: "INVALID_REQUEST", message: "업데이트할 필드가 없습니다." } },
        { status: 400 }
      );
    }

    // 후보자 업데이트 (RLS가 user_id 검증)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("candidates")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json<ApiResponse<null>>(
          { error: { code: "NOT_FOUND", message: "후보자를 찾을 수 없습니다." } },
          { status: 404 }
        );
      }
      console.error("Candidate update error:", error);
      return NextResponse.json<ApiResponse<null>>(
        { error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    const candidate = toCandidateDetail(data as unknown as Record<string, unknown>);

    return NextResponse.json<ApiResponse<CandidateDetail>>({
      data: candidate,
    });
  } catch (error) {
    console.error("Candidate update API error:", error);
    return NextResponse.json<ApiResponse<null>>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
