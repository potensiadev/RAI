/**
 * POST /api/subscriptions/cancel
 * 구독 취소 및 환불 요청
 *
 * PRD: prd_refund_policy_v0.4.md Section 5, 6
 * QA: refund_policy_test_scenarios_v1.0.md (EC-061 ~ EC-070)
 *
 * 환불 정책 (Paddle 호환):
 * - 결제 후 14일 이내: 무조건 전액 환불 (서비스 이용 여부 무관)
 * - 결제 후 14일 경과: 환불 불가 (서비스는 주기 종료까지 유지)
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  apiSuccess,
  apiUnauthorized,
  apiInternalError,
  apiBadRequest,
  apiForbidden,
} from "@/lib/api-response";
import {
  cancelSubscription,
  createRefund,
  getSubscription,
  getSubscriptionTransactions,
  calculateProRataRefund,
  convertToSmallestUnit,
} from "@/lib/paddle/refund";
import { PLAN_CONFIG, PlanId } from "@/lib/paddle/config";

interface CancelRequest {
  reason?: string;
  immediate?: boolean; // true면 즉시 취소 + 환불
}

interface UserData {
  id: string;
  plan: string;
  paddle_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  billing_cycle_start: string | null;
  credits_used_this_month: number;
  last_payment_amount: number | null;
  last_payment_date: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ─────────────────────────────────────────────────
    // 1. 인증 확인
    // ─────────────────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return apiUnauthorized();
    }

    // ─────────────────────────────────────────────────
    // 2. 사용자 정보 조회
    // ─────────────────────────────────────────────────
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select(
        "id, plan, paddle_subscription_id, subscription_status, current_period_end, billing_cycle_start, credits_used_this_month, last_payment_amount, last_payment_date"
      )
      .eq("email", user.email)
      .single();

    if (userError || !userData) {
      return apiUnauthorized("사용자 정보를 찾을 수 없습니다.");
    }

    const userRow = userData as UserData;

    // ─────────────────────────────────────────────────
    // 3. 구독 상태 검증
    // ─────────────────────────────────────────────────
    if (!userRow.paddle_subscription_id) {
      return apiBadRequest("활성 구독이 없습니다.");
    }

    if (userRow.subscription_status === "canceled") {
      return apiBadRequest("이미 취소된 구독입니다.");
    }

    if (userRow.plan === "starter") {
      return apiBadRequest("무료 플랜은 취소할 수 없습니다.");
    }

    // ─────────────────────────────────────────────────
    // 4. 요청 바디 파싱
    // ─────────────────────────────────────────────────
    const body = (await request.json()) as CancelRequest;
    const { reason, immediate } = body;

    // ─────────────────────────────────────────────────
    // 5. 환불 금액 계산
    // ─────────────────────────────────────────────────
    const planConfig = PLAN_CONFIG[userRow.plan as PlanId];
    const paymentAmount = userRow.last_payment_amount || planConfig?.price || 0;
    const subscriptionStartDate = userRow.billing_cycle_start
      ? new Date(userRow.billing_cycle_start)
      : new Date();
    const currentPeriodEnd = userRow.current_period_end
      ? new Date(userRow.current_period_end)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const refundCalculation = calculateProRataRefund({
      paymentAmount,
      subscriptionStartDate,
      currentPeriodEnd,
      usedCredits: userRow.credits_used_this_month || 0,
      totalCredits: planConfig?.credits || 150,
      plan: userRow.plan as "pro" | "enterprise",
    });

    // 14일 경과 시 환불 불가
    if (refundCalculation.rejectionReason) {
      // Paddle에서 구독 취소만 진행 (환불 없이)
      if (immediate) {
        const cancelResult = await cancelSubscription(
          userRow.paddle_subscription_id,
          "next_billing_period"
        );

        if (!cancelResult.success) {
          console.error("[Cancel] Paddle cancel failed:", cancelResult.error);
          return apiInternalError("구독 취소에 실패했습니다.");
        }
      }

      return apiSuccess({
        canceled: true,
        refund: null,
        message:
          "결제일로부터 14일이 경과하여 환불이 불가합니다. 구독은 결제 주기 종료 시 취소됩니다.",
        calculation: refundCalculation,
      });
    }

    // ─────────────────────────────────────────────────
    // 6. Admin 클라이언트로 환불 요청 생성
    // ─────────────────────────────────────────────────
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // RPC로 환불 요청 생성
    const { data: refundRequestResult, error: rpcError } = await supabaseAdmin.rpc(
      "create_subscription_refund_request",
      {
        p_user_id: userRow.id,
        p_refund_type: refundCalculation.isFullRefundEligible ? "full" : "prorata",
        p_original_amount: paymentAmount,
        p_refund_amount: refundCalculation.refundAmount,
        p_subscription_id: userRow.paddle_subscription_id,
        p_plan: userRow.plan,
        p_calculation_details: refundCalculation,
        p_reason: reason || "user_requested_cancellation",
      }
    );

    if (rpcError) {
      console.error("[Cancel] RPC error:", rpcError);
      return apiInternalError("환불 요청 생성에 실패했습니다.");
    }

    const rpcResult = refundRequestResult as {
      success: boolean;
      request_id?: string;
      idempotent?: boolean;
      error?: string;
    };

    if (!rpcResult.success) {
      console.error("[Cancel] RPC returned failure:", rpcResult.error);
      return apiInternalError("환불 요청 생성에 실패했습니다.");
    }

    // ─────────────────────────────────────────────────
    // 7. Paddle API 호출 (환불 + 구독 취소)
    // ─────────────────────────────────────────────────
    if (immediate && refundCalculation.refundAmount > 0) {
      // 최근 Transaction ID 조회
      const transactionsResult = await getSubscriptionTransactions(
        userRow.paddle_subscription_id,
        1
      );

      if (transactionsResult.success && transactionsResult.data?.[0]) {
        const latestTransaction = transactionsResult.data[0];

        // Paddle 환불 요청
        const refundResult = await createRefund({
          transactionId: latestTransaction.id,
          reason: reason || "User requested cancellation",
          items: [
            {
              itemId: latestTransaction.id,
              type: refundCalculation.isFullRefundEligible ? "full" : "partial",
              amount: refundCalculation.isFullRefundEligible
                ? undefined
                : convertToSmallestUnit(refundCalculation.refundAmount, "KRW"),
            },
          ],
        });

        // 환불 요청 상태 업데이트
        await supabaseAdmin.rpc("update_refund_request_status", {
          p_request_id: rpcResult.request_id,
          p_status: refundResult.success ? "completed" : "failed",
          p_paddle_refund_id: refundResult.data?.id,
          p_paddle_response: refundResult.data || { error: refundResult.error },
        });

        if (!refundResult.success) {
          console.error("[Cancel] Paddle refund failed:", refundResult.error);
          // 환불 실패해도 구독 취소는 진행
        }
      }

      // Paddle 구독 취소
      const cancelResult = await cancelSubscription(
        userRow.paddle_subscription_id,
        "immediately"
      );

      if (!cancelResult.success) {
        console.error("[Cancel] Paddle cancel failed:", cancelResult.error);
      }

      // 사용자 상태 업데이트
      await supabaseAdmin
        .from("users")
        .update({
          subscription_status: "canceled",
          cancel_at_period_end: true,
        })
        .eq("id", userRow.id);
    } else {
      // 기간 종료 시 취소 (환불 없이)
      const cancelResult = await cancelSubscription(
        userRow.paddle_subscription_id,
        "next_billing_period"
      );

      if (!cancelResult.success) {
        console.error("[Cancel] Paddle cancel failed:", cancelResult.error);
        return apiInternalError("구독 취소에 실패했습니다.");
      }

      // 사용자 상태 업데이트
      await supabaseAdmin
        .from("users")
        .update({
          cancel_at_period_end: true,
        })
        .eq("id", userRow.id);
    }

    // ─────────────────────────────────────────────────
    // 8. 응답 반환
    // ─────────────────────────────────────────────────
    return apiSuccess({
      canceled: true,
      refund: immediate
        ? {
            requestId: rpcResult.request_id,
            amount: refundCalculation.refundAmount,
            type: refundCalculation.isFullRefundEligible ? "full" : "prorata",
            idempotent: rpcResult.idempotent,
          }
        : null,
      message: immediate
        ? refundCalculation.refundAmount > 0
          ? `환불이 요청되었습니다. ${refundCalculation.refundAmount.toLocaleString()}원이 환불됩니다.`
          : "구독이 취소되었습니다."
        : `구독이 ${currentPeriodEnd.toLocaleDateString()}에 종료됩니다. 그때까지 서비스를 이용하실 수 있습니다.`,
      calculation: refundCalculation,
      serviceEndDate: currentPeriodEnd.toISOString(),
    });
  } catch (error) {
    console.error("[Cancel] Error:", error);
    return apiInternalError();
  }
}

/**
 * GET /api/subscriptions/cancel
 * 환불 예상 금액 미리보기 (실제 취소 없이)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return apiUnauthorized();
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select(
        "id, plan, paddle_subscription_id, subscription_status, current_period_end, billing_cycle_start, credits_used_this_month, last_payment_amount"
      )
      .eq("email", user.email)
      .single();

    if (userError || !userData) {
      return apiUnauthorized("사용자 정보를 찾을 수 없습니다.");
    }

    const userRow = userData as UserData;

    if (!userRow.paddle_subscription_id || userRow.plan === "starter") {
      return apiForbidden("활성 유료 구독이 없습니다.");
    }

    // 환불 금액 계산
    const planConfig = PLAN_CONFIG[userRow.plan as PlanId];
    const paymentAmount = userRow.last_payment_amount || planConfig?.price || 0;
    const subscriptionStartDate = userRow.billing_cycle_start
      ? new Date(userRow.billing_cycle_start)
      : new Date();
    const currentPeriodEnd = userRow.current_period_end
      ? new Date(userRow.current_period_end)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const refundCalculation = calculateProRataRefund({
      paymentAmount,
      subscriptionStartDate,
      currentPeriodEnd,
      usedCredits: userRow.credits_used_this_month || 0,
      totalCredits: planConfig?.credits || 150,
      plan: userRow.plan as "pro" | "enterprise",
    });

    return apiSuccess({
      canRefund: !refundCalculation.rejectionReason,
      refundAmount: refundCalculation.refundAmount,
      refundType: refundCalculation.isFullRefundEligible ? "full" : "prorata",
      calculation: refundCalculation,
      serviceEndDate: currentPeriodEnd.toISOString(),
      message: refundCalculation.rejectionReason
        ? "결제일로부터 14일이 경과하여 환불이 불가합니다."
        : refundCalculation.isFullRefundEligible
          ? "14일 이내 취소로 전액 환불됩니다."
          : `${refundCalculation.refundAmount.toLocaleString()}원이 환불됩니다.`,
    });
  } catch (error) {
    console.error("[Cancel Preview] Error:", error);
    return apiInternalError();
  }
}
