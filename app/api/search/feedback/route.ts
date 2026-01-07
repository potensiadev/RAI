/**
 * POST /api/search/feedback
 * 검색 피드백 저장 (👍/👎)
 * - 검색 품질 개선용 데이터 수집
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type FeedbackType } from "@/types";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
} from "@/lib/api-response";

interface FeedbackRequest {
  candidateId: string;
  searchQuery: string;
  feedbackType: FeedbackType;
  resultPosition?: number;
  relevanceScore?: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiUnauthorized();
    }

    // 요청 바디 파싱
    const body: FeedbackRequest = await request.json();
    const {
      candidateId,
      searchQuery,
      feedbackType,
      resultPosition = 0,
      relevanceScore = 0,
    } = body;

    // 필수 필드 검증
    if (!candidateId || !searchQuery || !feedbackType) {
      return apiBadRequest("필수 필드가 누락되었습니다.");
    }

    // 유효한 피드백 타입 검증
    const validFeedbackTypes: FeedbackType[] = [
      "relevant",
      "not_relevant",
      "clicked",
      "contacted",
    ];
    if (!validFeedbackTypes.includes(feedbackType)) {
      return apiBadRequest("유효하지 않은 피드백 타입입니다.");
    }

    // 피드백 저장
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("search_feedback")
      .insert({
        user_id: user.id,
        candidate_id: candidateId,
        search_query: searchQuery,
        feedback_type: feedbackType,
        result_position: resultPosition,
        relevance_score: relevanceScore,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Feedback insert error:", error);
      return apiInternalError();
    }

    return apiSuccess({ id: (data as { id: string }).id });
  } catch (error) {
    console.error("Feedback API error:", error);
    return apiInternalError();
  }
}
