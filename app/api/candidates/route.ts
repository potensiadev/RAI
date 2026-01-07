/**
 * GET /api/candidates
 * 후보자 목록 조회 (페이지네이션)
 * - RLS 자동 적용 (user_id)
 * - status=completed, is_latest=true 필터
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCandidateListItem, type CandidateListItem } from "@/types";
import {
  apiSuccess,
  apiUnauthorized,
  apiInternalError,
} from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiUnauthorized();
    }

    // 쿼리 파라미터 파싱 및 검증
    const { searchParams } = new URL(request.url);

    // 페이지네이션 파라미터 검증 (정수 오버플로우 및 DoS 방지)
    const MAX_LIMIT = 100;
    const MIN_LIMIT = 1;
    const MIN_PAGE = 1;

    let page = parseInt(searchParams.get("page") || "1", 10);
    let limit = parseInt(searchParams.get("limit") || "20", 10);

    // NaN 또는 범위 외 값 처리
    if (isNaN(page) || page < MIN_PAGE) page = MIN_PAGE;
    if (isNaN(limit) || limit < MIN_LIMIT) limit = MIN_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

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
      return apiInternalError();
    }

    // DB row를 CandidateListItem으로 변환
    const candidates: CandidateListItem[] = (data || []).map(row =>
      toCandidateListItem(row as Record<string, unknown>)
    );

    return apiSuccess(candidates, {
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Candidates API error:", error);
    return apiInternalError();
  }
}
