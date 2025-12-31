/**
 * useCandidates Hook
 * 후보자 목록 조회 (React Query)
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CandidateListItem,
  type CandidateDetail,
  type ApiResponse,
} from "@/types";

interface UseCandidatesOptions {
  status?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

interface CandidatesResponse {
  candidates: CandidateListItem[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 후보자 목록 조회 API 호출
 */
async function fetchCandidates(options: UseCandidatesOptions = {}): Promise<CandidatesResponse> {
  const { status = "completed", page = 1, limit = 20 } = options;

  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });

  const response = await fetch(`/api/candidates?${params}`);

  if (!response.ok) {
    const error: ApiResponse<null> = await response.json();
    throw new Error(error.error?.message || "후보자 목록 조회에 실패했습니다.");
  }

  const data: ApiResponse<CandidateListItem[]> = await response.json();

  return {
    candidates: data.data || [],
    total: data.meta?.total || 0,
    page: data.meta?.page || 1,
    limit: data.meta?.limit || 20,
  };
}

/**
 * 후보자 상세 조회 API 호출
 */
async function fetchCandidate(id: string): Promise<CandidateDetail> {
  const response = await fetch(`/api/candidates/${id}`);

  if (!response.ok) {
    const error: ApiResponse<null> = await response.json();
    throw new Error(error.error?.message || "후보자 상세 조회에 실패했습니다.");
  }

  const data: ApiResponse<CandidateDetail> = await response.json();

  if (!data.data) {
    throw new Error("후보자를 찾을 수 없습니다.");
  }

  return data.data;
}

/**
 * 후보자 목록 조회 훅
 */
export function useCandidates(options: UseCandidatesOptions = {}) {
  const { enabled = true, ...queryOptions } = options;

  return useQuery({
    queryKey: ["candidates", queryOptions],
    queryFn: () => fetchCandidates(queryOptions),
    enabled,
    staleTime: 1000 * 60, // 1분
  });
}

/**
 * 후보자 상세 조회 훅
 */
export function useCandidate(id: string | null) {
  return useQuery({
    queryKey: ["candidate", id],
    queryFn: () => fetchCandidate(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5분
  });
}

/**
 * 후보자 목록 프리페칭
 */
export function usePrefetchCandidates() {
  const queryClient = useQueryClient();

  return (options: UseCandidatesOptions = {}) => {
    return queryClient.prefetchQuery({
      queryKey: ["candidates", options],
      queryFn: () => fetchCandidates(options),
    });
  };
}

/**
 * 후보자 목록 무효화 (갱신)
 */
export function useInvalidateCandidates() {
  const queryClient = useQueryClient();

  return () => {
    return queryClient.invalidateQueries({ queryKey: ["candidates"] });
  };
}
