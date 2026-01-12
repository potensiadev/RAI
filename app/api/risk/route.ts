/**
 * GET /api/risk
 * 리스크 후보자 조회 (Defense in Depth - 명시적 user_id 필터)
 *
 * PRD 요구사항:
 * - RLS 정책 외에 명시적 user_id 필터링 추가
 * - 클라이언트 사이드 쿼리를 서버로 이동
 */

import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiUnauthorized, apiInternalError } from "@/lib/api-response";

interface RiskCandidate {
  id: string;
  name: string;
  last_position: string | null;
  last_company: string | null;
  confidence_score: number;
  warnings: string[];
  requires_review: boolean;
  created_at: string;
}

type RiskLevel = "critical" | "warning" | "review" | "safe";

function getRiskLevel(candidate: RiskCandidate): RiskLevel {
  const score = candidate.confidence_score || 0;
  if (score < 0.6) return "critical";
  if (score < 0.8) return "warning";
  if (candidate.requires_review || (candidate.warnings?.length || 0) > 0) return "review";
  return "safe";
}

export async function GET() {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiUnauthorized();
    }

    // Defense in Depth: RLS 외에 명시적 user_id 필터 추가
    const { data, error } = await supabase
      .from("candidates")
      .select("id, name, last_position, last_company, confidence_score, warnings, requires_review, created_at")
      .eq("user_id", user.id)  // 명시적 user_id 필터
      .eq("status", "completed")
      .eq("is_latest", true)
      .order("confidence_score", { ascending: true });

    if (error) {
      console.error("Risk candidates query error:", error);
      return apiInternalError();
    }

    const candidates = (data || []) as RiskCandidate[];

    // 리스크 레벨별 카운트
    const counts = {
      critical: 0,
      warning: 0,
      review: 0,
      safe: 0,
    };

    for (const candidate of candidates) {
      const level = getRiskLevel(candidate);
      counts[level]++;
    }

    return apiSuccess({
      candidates,
      counts,
      total: candidates.length,
    });
  } catch (error) {
    console.error("Risk API error:", error);
    return apiInternalError();
  }
}
