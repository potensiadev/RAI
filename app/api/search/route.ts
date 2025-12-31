/**
 * POST /api/search
 * 하이브리드 검색 (RDB 필터 + Vector 검색)
 * - Step 1: RDB 필터 (exp_years, skills, location)
 * - Step 2: Vector 검색 (필터된 후보자 대상)
 * - 청크 타입별 가중치 적용
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  type SearchRequest,
  type SearchResponse,
  type CandidateSearchResult,
  type ApiResponse,
  getConfidenceLevel,
  type RiskLevel,
} from "@/types";

/**
 * DB row를 CandidateSearchResult로 변환
 */
function toSearchResult(
  row: Record<string, unknown>,
  matchScore: number
): CandidateSearchResult {
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
    matchScore: Math.round(matchScore * 100),
    matchedChunks: [], // 추후 청크 매칭 시 채움
  };
}

export async function POST(request: NextRequest) {
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

    // 요청 바디 파싱
    const body: SearchRequest = await request.json();
    const { query, filters, limit = 20, offset = 0 } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        { error: { code: "INVALID_REQUEST", message: "검색어를 입력해주세요." } },
        { status: 400 }
      );
    }

    // 검색 모드 결정: 10자 이상이면 Semantic(Vector), 아니면 Keyword(RDB)
    const isSemanticSearch = query.length > 10;

    let results: CandidateSearchResult[] = [];
    let total = 0;

    if (isSemanticSearch) {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Semantic Search (Vector)
      // 실제 구현에서는 OpenAI Embedding API 호출 필요
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // TODO: OpenAI API로 쿼리 임베딩 생성
      // const embedding = await generateEmbedding(query);

      // 현재는 RDB 기반 텍스트 검색으로 대체 (임베딩 없이)
      // 실제 Vector 검색은 search_candidates RPC 함수 사용

      // 일시적 Fallback: summary 필드에서 텍스트 검색
      let queryBuilder = supabase
        .from("candidates")
        .select("*", { count: "exact" })
        .eq("status", "completed")
        .eq("is_latest", true)
        .or(`summary.ilike.%${query}%,last_position.ilike.%${query}%`);

      // RDB 필터 적용
      if (filters?.expYearsMin) {
        queryBuilder = queryBuilder.gte("exp_years", filters.expYearsMin);
      }
      if (filters?.expYearsMax) {
        queryBuilder = queryBuilder.lte("exp_years", filters.expYearsMax);
      }
      if (filters?.skills && filters.skills.length > 0) {
        queryBuilder = queryBuilder.overlaps("skills", filters.skills);
      }
      if (filters?.location) {
        queryBuilder = queryBuilder.ilike("location_city", `%${filters.location}%`);
      }

      const { data, error, count } = await queryBuilder
        .order("confidence_score", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Search error:", error);
        return NextResponse.json<ApiResponse<null>>(
          { error: { code: "DB_ERROR", message: error.message } },
          { status: 500 }
        );
      }

      // 텍스트 매칭 기반 점수 계산 (임시)
      results = (data || []).map((row, index) => {
        // 간단한 점수: 순서에 따라 95 -> 60 범위
        const score = Math.max(0.6, 0.95 - index * 0.03);
        return toSearchResult(row as Record<string, unknown>, score);
      });

      total = count ?? 0;
    } else {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Keyword Search (RDB)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // 쉼표로 키워드 분리
      const keywords = query.split(",").map(k => k.trim()).filter(Boolean);

      let queryBuilder = supabase
        .from("candidates")
        .select("*", { count: "exact" })
        .eq("status", "completed")
        .eq("is_latest", true);

      // 키워드 검색: 스킬, 직책, 회사명에서 검색
      if (keywords.length > 0) {
        const orConditions = keywords.map(keyword => {
          return `skills.cs.{${keyword}},last_position.ilike.%${keyword}%,last_company.ilike.%${keyword}%,name.ilike.%${keyword}%`;
        }).join(",");
        queryBuilder = queryBuilder.or(orConditions);
      }

      // RDB 필터 적용
      if (filters?.expYearsMin) {
        queryBuilder = queryBuilder.gte("exp_years", filters.expYearsMin);
      }
      if (filters?.expYearsMax) {
        queryBuilder = queryBuilder.lte("exp_years", filters.expYearsMax);
      }
      if (filters?.skills && filters.skills.length > 0) {
        queryBuilder = queryBuilder.overlaps("skills", filters.skills);
      }
      if (filters?.location) {
        queryBuilder = queryBuilder.ilike("location_city", `%${filters.location}%`);
      }

      const { data, error, count } = await queryBuilder
        .order("confidence_score", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Keyword search error:", error);
        return NextResponse.json<ApiResponse<null>>(
          { error: { code: "DB_ERROR", message: error.message } },
          { status: 500 }
        );
      }

      // 키워드 매칭 기반 점수 계산
      results = (data || []).map((row, index) => {
        const score = Math.max(0.7, 0.98 - index * 0.02);
        return toSearchResult(row as Record<string, unknown>, score);
      });

      total = count ?? 0;
    }

    const response: SearchResponse = {
      results,
      total,
    };

    return NextResponse.json<ApiResponse<SearchResponse>>({
      data: response,
      meta: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
      },
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json<ApiResponse<null>>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
