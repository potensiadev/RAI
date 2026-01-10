/**
 * PATCH /api/positions/[id]/matches/[candidateId] - 매칭 상태/메모 수정
 * DELETE /api/positions/[id]/matches/[candidateId] - 매칭에서 제외
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  apiNotFound,
  apiInternalError,
} from "@/lib/api-response";
import { type UpdateMatchStageRequest, type MatchStage } from "@/types";

interface RouteParams {
  params: Promise<{ id: string; candidateId: string }>;
}

const VALID_STAGES: MatchStage[] = [
  "matched",
  "reviewed",
  "contacted",
  "interviewing",
  "offered",
  "placed",
  "rejected",
  "withdrawn",
];

/**
 * PATCH /api/positions/[id]/matches/[candidateId] - 매칭 상태/메모 수정
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await withRateLimit(request, "default");
    if (rateLimitResponse) return rateLimitResponse;

    const { id: positionId, candidateId } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiUnauthorized();
    }

    // 포지션 소유권 확인
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: position, error: positionError } = await (supabase as any)
      .from("positions")
      .select("id")
      .eq("id", positionId)
      .eq("user_id", user.id)
      .single();

    if (positionError || !position) {
      return apiNotFound("포지션을 찾을 수 없습니다.");
    }

    // 매칭 확인
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: matchError } = await (supabase as any)
      .from("position_candidates")
      .select("*")
      .eq("position_id", positionId)
      .eq("candidate_id", candidateId)
      .single();

    if (matchError || !existing) {
      return apiNotFound("매칭된 후보자를 찾을 수 없습니다.");
    }

    // 요청 파싱
    const body: UpdateMatchStageRequest = await request.json();

    // 유효성 검증
    if (body.stage !== undefined && !VALID_STAGES.includes(body.stage)) {
      return apiBadRequest(
        `유효하지 않은 상태입니다. 가능한 값: ${VALID_STAGES.join(", ")}`
      );
    }

    if (body.rejectionReason && body.stage !== "rejected") {
      return apiBadRequest("제외 사유는 'rejected' 상태에서만 입력할 수 있습니다.");
    }

    if (body.notes && body.notes.length > 1000) {
      return apiBadRequest("메모는 1000자 이하로 입력해주세요.");
    }

    // 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {};

    if (body.stage !== undefined) {
      updateData.stage = body.stage;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }
    if (body.rejectionReason !== undefined) {
      updateData.rejection_reason = body.rejectionReason;
    }

    if (Object.keys(updateData).length === 0) {
      return apiBadRequest("수정할 내용이 없습니다.");
    }

    // 업데이트 실행 (트리거가 stage_updated_at과 활동 로그 처리)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: updateError } = await (supabase as any)
      .from("position_candidates")
      .update(updateData)
      .eq("position_id", positionId)
      .eq("candidate_id", candidateId)
      .select()
      .single();

    if (updateError) {
      console.error("Update match error:", updateError);
      return apiInternalError();
    }

    return apiSuccess(
      {
        id: updated.id,
        stage: updated.stage,
        notes: updated.notes,
        rejectionReason: updated.rejection_reason,
        stageUpdatedAt: updated.stage_updated_at,
      },
      { message: "매칭 정보가 수정되었습니다." }
    );
  } catch (error) {
    console.error("Update match error:", error);
    return apiInternalError();
  }
}

/**
 * DELETE /api/positions/[id]/matches/[candidateId] - 매칭에서 제외
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await withRateLimit(request, "default");
    if (rateLimitResponse) return rateLimitResponse;

    const { id: positionId, candidateId } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiUnauthorized();
    }

    // 포지션 소유권 확인
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: position, error: positionError } = await (supabase as any)
      .from("positions")
      .select("id")
      .eq("id", positionId)
      .eq("user_id", user.id)
      .single();

    if (positionError || !position) {
      return apiNotFound("포지션을 찾을 수 없습니다.");
    }

    // 매칭 삭제
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from("position_candidates")
      .delete()
      .eq("position_id", positionId)
      .eq("candidate_id", candidateId);

    if (deleteError) {
      console.error("Delete match error:", deleteError);
      return apiInternalError();
    }

    // 활동 로그 기록
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("position_activities").insert({
      position_id: positionId,
      candidate_id: candidateId,
      activity_type: "stage_changed",
      description: "후보자가 매칭 목록에서 제거되었습니다.",
      created_by: user.id,
    });

    return apiSuccess(null, { message: "후보자가 매칭 목록에서 제거되었습니다." });
  } catch (error) {
    console.error("Delete match error:", error);
    return apiInternalError();
  }
}
