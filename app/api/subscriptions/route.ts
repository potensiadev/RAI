/**
 * GET /api/subscriptions
 * 현재 사용자의 구독 정보 조회
 *
 * POST /api/subscriptions
 * 구독 업그레이드 요청 (Paddle Checkout URL 생성)
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  apiInternalError,
  apiBadRequest,
} from "@/lib/api-response";
import { PLAN_CONFIG, PlanId } from "@/lib/paddle/config";

interface SubscriptionData {
  plan: PlanId;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !user.email) {
      return apiUnauthorized();
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, plan, paddle_customer_id, paddle_subscription_id, subscription_status, current_period_end, cancel_at_period_end")
      .eq("email", user.email)
      .single();

    if (userError || !userData) {
      return apiUnauthorized("사용자 정보를 찾을 수 없습니다.");
    }

    const userRow = userData as {
      id: string;
      plan: string;
      paddle_customer_id: string | null;
      paddle_subscription_id: string | null;
      subscription_status: string | null;
      current_period_end: string | null;
      cancel_at_period_end: boolean | null;
    };

    const subscription: SubscriptionData = {
      plan: (userRow.plan as PlanId) || 'starter',
      status: (userRow.subscription_status as SubscriptionData['status']) || 'none',
      paddleCustomerId: userRow.paddle_customer_id,
      paddleSubscriptionId: userRow.paddle_subscription_id,
      currentPeriodEnd: userRow.current_period_end,
      cancelAtPeriodEnd: userRow.cancel_at_period_end || false,
    };

    // 플랜 정보 추가
    const planConfig = PLAN_CONFIG[subscription.plan] || PLAN_CONFIG.starter;

    return apiSuccess({
      subscription,
      planDetails: {
        name: planConfig.name,
        credits: planConfig.credits,
        price: planConfig.price,
        priceDisplay: planConfig.priceDisplay,
        features: planConfig.features,
      },
      availablePlans: Object.entries(PLAN_CONFIG).map(([id, config]) => ({
        id,
        name: config.name,
        priceDisplay: config.priceDisplay,
        credits: config.credits,
        features: config.features,
        isCurrent: id === subscription.plan,
      })),
    });
  } catch (error) {
    console.error("Subscription fetch error:", error);
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !user.email) {
      return apiUnauthorized();
    }

    const body = await request.json();
    const { planId } = body as { planId?: PlanId };

    if (!planId || !PLAN_CONFIG[planId]) {
      return apiBadRequest("유효하지 않은 플랜입니다.");
    }

    const targetPlan = PLAN_CONFIG[planId];

    // 무료 플랜은 checkout 필요 없음
    if (!targetPlan.priceId) {
      return apiBadRequest("무료 플랜으로의 다운그레이드는 현재 지원되지 않습니다.");
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, paddle_customer_id")
      .eq("email", user.email)
      .single();

    if (userError || !userData) {
      return apiUnauthorized("사용자 정보를 찾을 수 없습니다.");
    }

    const userRow = userData as { id: string; paddle_customer_id: string | null };

    // Checkout 정보 반환 (클라이언트에서 Paddle.js로 열기)
    return apiSuccess({
      priceId: targetPlan.priceId,
      customerId: userRow.paddle_customer_id,
      email: user.email,
      planName: targetPlan.name,
    });
  } catch (error) {
    console.error("Subscription upgrade error:", error);
    return apiInternalError();
  }
}
