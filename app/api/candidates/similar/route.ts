/**
 * GET /api/candidates/similar
 * 유사 이름 후보자 검색 (PostgreSQL pg_trgm 기반)
 *
 * Query Params:
 * - name: 검색할 이름 (필수)
 * - threshold: 유사도 임계값 (0.0-1.0, 기본 0.3)
 * - limit: 결과 개수 제한 (기본 10, 최대 50)
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
} from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

interface SimilarCandidate {
  id: string;
  name: string;
  lastPosition: string | null;
  lastCompany: string | null;
  createdAt: string;
  sourceFile: string | null;
  similarityScore: number;
}

interface SimilarNameResult {
  id: string;
  name: string;
  last_position: string | null;
  last_company: string | null;
  created_at: string;
  source_file: string | null;
  similarity_score: number;
}

export async function GET(request: NextRequest) {
  try {
    // Rate limit check
    const rateLimitResponse = await withRateLimit(request, "default");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiUnauthorized();
    }

    // Query params 파싱
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const thresholdParam = searchParams.get("threshold");
    const limitParam = searchParams.get("limit");

    // 이름 필수 검증
    if (!name || name.trim().length === 0) {
      return apiBadRequest("검색할 이름을 입력해주세요.");
    }

    // 이름 길이 제한 (DoS 방지)
    if (name.length > 100) {
      return apiBadRequest("이름은 100자 이하로 입력해주세요.");
    }

    // threshold 검증 (0.0-1.0)
    let threshold = 0.3;
    if (thresholdParam) {
      const parsed = parseFloat(thresholdParam);
      if (isNaN(parsed) || parsed < 0 || parsed > 1) {
        return apiBadRequest("threshold는 0.0에서 1.0 사이의 값이어야 합니다.");
      }
      threshold = parsed;
    }

    // limit 검증 (1-50)
    let limit = 10;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 50) {
        return apiBadRequest("limit는 1에서 50 사이의 값이어야 합니다.");
      }
      limit = parsed;
    }

    // pg_trgm 기반 유사 이름 검색 (RPC 함수 사용)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("search_similar_names", {
      p_user_id: user.id,
      p_name: name.trim(),
      p_threshold: threshold,
      p_limit: limit,
    });

    if (error) {
      console.error("Similar names search error:", error);
      return apiInternalError();
    }

    // 결과 변환
    const results: SimilarCandidate[] = (data || []).map((row: SimilarNameResult) => ({
      id: row.id,
      name: row.name,
      lastPosition: row.last_position,
      lastCompany: row.last_company,
      createdAt: row.created_at,
      sourceFile: row.source_file,
      similarityScore: Math.round(row.similarity_score * 100) / 100,
    }));

    return apiSuccess({
      candidates: results,
      total: results.length,
      searchedName: name.trim(),
      threshold,
    });
  } catch (error) {
    console.error("Similar names API error:", error);
    return apiInternalError();
  }
}
