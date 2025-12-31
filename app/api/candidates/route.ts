/**
 * GET /api/candidates
 * 후보자 목록 조회 (페이지네이션)
 * - RLS 자동 적용 (user_id)
 * - status=completed, is_latest=true 필터
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCandidateListItem, type CandidateListItem, type ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { error: { code: "UNAUTHORIZED", message: "인증이 필요합니다." } },
        { status: 401 }
      );
    }

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "completed";
    const offset = (page - 1) * limit;

    // 후보자 목록 조회 (RLS가 user_id 필터 자동 적용)
    const { data, error, count } = await supabase
      .from("candidates")
      .select("*", { count: "exact" })
      .eq("status", status)
      .eq("is_latest", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Candidates fetch error:", error);
      return NextResponse.json<ApiResponse<null>>(
        { error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    // DB row를 CandidateListItem으로 변환
    const candidates: CandidateListItem[] = (data || []).map(row =>
      toCandidateListItem(row as Record<string, unknown>)
    );

    return NextResponse.json<ApiResponse<CandidateListItem[]>>({
      data: candidates,
      meta: {
        total: count ?? 0,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("Candidates API error:", error);
    return NextResponse.json<ApiResponse<null>>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
