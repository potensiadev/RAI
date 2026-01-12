/**
 * useSearch Hook
 * 하이브리드 검색 (React Query Mutation)
 * - 자동 재시도 (PRD P2)
 * - 오프라인 감지 (PRD P2)
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type SearchRequest,
  type SearchResponse,
  type CandidateSearchResult,
  type FeedbackType,
  type ApiResponse,
} from "@/types";
import { fetchWithRetry, NetworkError } from "@/lib/hooks/useNetworkStatus";

/**
 * 검색 API 호출 (자동 재시도 포함)
 */
async function searchCandidates(request: SearchRequest): Promise<SearchResponse> {
  try {
    const response = await fetchWithRetry("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      maxRetries: 3,
      retryDelay: 1000,
    });

    if (!response.ok) {
      const error: ApiResponse<null> = await response.json();
      throw new Error(error.error?.message || "검색에 실패했습니다.");
    }

    const data: ApiResponse<SearchResponse> = await response.json();

    if (!data.data) {
      throw new Error("검색 결과가 없습니다.");
    }

    return data.data;
  } catch (error) {
    // NetworkError 처리
    if (error instanceof NetworkError) {
      if (error.code === "OFFLINE") {
        throw new Error("오프라인 상태입니다. 네트워크 연결을 확인해주세요.");
      }
      throw new Error(`네트워크 오류: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 검색 피드백 저장 API 호출
 */
interface FeedbackRequest {
  candidateId: string;
  searchQuery: string;
  feedbackType: FeedbackType;
  resultPosition?: number;
  relevanceScore?: number;
}

async function submitFeedback(request: FeedbackRequest): Promise<{ id: string }> {
  try {
    const response = await fetchWithRetry("/api/search/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      maxRetries: 2,
      retryDelay: 500,
    });

    if (!response.ok) {
      const error: ApiResponse<null> = await response.json();
      throw new Error(error.error?.message || "피드백 저장에 실패했습니다.");
    }

    const data: ApiResponse<{ id: string }> = await response.json();

    if (!data.data) {
      throw new Error("피드백 저장에 실패했습니다.");
    }

    return data.data;
  } catch (error) {
    if (error instanceof NetworkError) {
      // 피드백은 중요도가 낮으므로 오프라인 시 무시
      console.warn("Feedback submission failed due to network:", error.message);
      return { id: "" };
    }
    throw error;
  }
}

/**
 * 검색 훅 (Mutation)
 */
export function useSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: searchCandidates,
    onSuccess: (data, variables) => {
      // 검색 결과를 캐시에 저장
      queryClient.setQueryData(
        ["searchResults", variables.query],
        data
      );
    },
  });
}

/**
 * 검색 피드백 훅 (Mutation)
 */
export function useSearchFeedback() {
  return useMutation({
    mutationFn: submitFeedback,
  });
}

/**
 * 검색 결과 타입 가드
 */
export function isSearchResult(
  item: CandidateSearchResult | unknown
): item is CandidateSearchResult {
  return (
    typeof item === "object" &&
    item !== null &&
    "matchScore" in item &&
    typeof (item as CandidateSearchResult).matchScore === "number"
  );
}
