/**
 * GET /api/user/credits
 * 현재 사용자의 크레딧 정보 조회
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type ApiResponse, getRemainingCredits, type PlanType } from "@/types";

interface CreditsResponse {
  credits: number;           // 추가 구매 크레딧
  creditsUsedThisMonth: number;
  plan: PlanType;
  planBaseCredits: number;   // 플랜 기본 크레딧
  remainingCredits: number;  // 남은 총 크레딧
}

// 플랜별 기본 크레딧
const PLAN_BASE_CREDITS: Record<PlanType, number> = {
  starter: 50,
  pro: 150,
  enterprise: 300,
};

export async function GET() {
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

    // 사용자 정보 조회
    const { data, error } = await supabase
      .from("users")
      .select("credits, credits_used_this_month, plan")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("User credits fetch error:", error);
      return NextResponse.json<ApiResponse<null>>(
        { error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    // Type assertion for Supabase response
    const userData = data as {
      plan: string;
      credits: number;
      credits_used_this_month: number;
    };

    const plan = (userData.plan as PlanType) || "starter";
    const planBaseCredits = PLAN_BASE_CREDITS[plan];
    const additionalCredits = userData.credits ?? 0;
    const usedThisMonth = userData.credits_used_this_month ?? 0;

    // 남은 크레딧 계산
    const remainingFromPlan = Math.max(0, planBaseCredits - usedThisMonth);
    const remainingCredits = remainingFromPlan + additionalCredits;

    const response: CreditsResponse = {
      credits: additionalCredits,
      creditsUsedThisMonth: usedThisMonth,
      plan,
      planBaseCredits,
      remainingCredits,
    };

    return NextResponse.json<ApiResponse<CreditsResponse>>({
      data: response,
    });
  } catch (error) {
    console.error("Credits API error:", error);
    return NextResponse.json<ApiResponse<null>>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
