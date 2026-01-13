/**
 * GET /api/candidates/[id]/versions
 * 후보자 버전 히스토리 조회
 *
 * 실제 DB에서 parent_id 체인을 따라 모든 버전을 조회합니다.
 * Mock 데이터 제거 - 실제 버전 히스토리 반환
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
} from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface CandidateVersion {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  isLatest: boolean;
  changesSummary?: string;
}

// DB row type for candidate version fields
interface CandidateRow {
  id: string;
  version: number;
  parent_id: string | null;
  user_id: string;
  name: string;
  is_latest: boolean;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate Limit 체크
    const rateLimitResponse = await withRateLimit(request, "default");
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !user.email) {
      return apiUnauthorized();
    }

    // 사용자 ID 조회
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("email", user.email)
      .single();

    const publicUserId = (userData as { id: string } | null)?.id;
    if (!publicUserId) {
      return apiUnauthorized("사용자 정보를 찾을 수 없습니다.");
    }

    // 현재 후보자 조회 (소유권 확인)
    const { data: currentCandidateData, error: candidateError } = await supabase
      .from("candidates")
      .select("id, version, parent_id, user_id, name, is_latest, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", publicUserId)
      .single();

    const currentCandidate = currentCandidateData as CandidateRow | null;

    if (candidateError || !currentCandidate) {
      if (candidateError?.code === "PGRST116") {
        return apiNotFound("후보자를 찾을 수 없습니다.");
      }
      console.error("Candidate fetch error:", candidateError);
      return apiInternalError();
    }

    // 모든 버전 수집 (현재 + parent 체인)
    const versions: CandidateVersion[] = [];

    // 현재 버전 추가
    versions.push({
      id: currentCandidate.id,
      version: currentCandidate.version,
      createdAt: currentCandidate.created_at,
      updatedAt: currentCandidate.updated_at,
      name: currentCandidate.name,
      isLatest: currentCandidate.is_latest,
    });

    // parent_id 체인을 따라 이전 버전들 조회
    let parentId = currentCandidate.parent_id;
    const visitedIds = new Set<string>([currentCandidate.id]);

    while (parentId && !visitedIds.has(parentId)) {
      visitedIds.add(parentId);

      const { data: parentCandidateData, error: parentError } = await supabase
        .from("candidates")
        .select("id, version, parent_id, name, is_latest, created_at, updated_at")
        .eq("id", parentId)
        .eq("user_id", publicUserId)
        .single();

      const parentCandidate = parentCandidateData as CandidateRow | null;

      if (parentError || !parentCandidate) {
        // 더 이상 parent가 없으면 종료
        break;
      }

      versions.push({
        id: parentCandidate.id,
        version: parentCandidate.version,
        createdAt: parentCandidate.created_at,
        updatedAt: parentCandidate.updated_at,
        name: parentCandidate.name,
        isLatest: parentCandidate.is_latest,
      });

      parentId = parentCandidate.parent_id;
    }

    // 버전 번호로 정렬 (최신순)
    versions.sort((a, b) => b.version - a.version);

    return apiSuccess({
      candidateId: id,
      currentVersion: currentCandidate.version,
      totalVersions: versions.length,
      versions,
    });
  } catch (error) {
    console.error("Candidate versions API error:", error);
    return apiInternalError();
  }
}
