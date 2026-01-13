/**
 * Paddle Billing API - Refund Operations
 *
 * PRD: prd_refund_policy_v0.4.md Section 5, 6
 * QA: refund_policy_test_scenarios_v1.0.md (EC-061 ~ EC-070)
 *
 * Paddle Billing API를 사용한 환불 처리
 * https://developer.paddle.com/api-reference/adjustments/create-adjustment
 */

import { PADDLE_CONFIG } from "./config";

interface PaddleApiError {
  error: {
    type: string;
    code: string;
    detail: string;
  };
}

interface PaddleAdjustment {
  id: string;
  status: "pending" | "approved" | "rejected" | "reversed";
  action: "refund" | "credit" | "chargeback";
  transaction_id: string;
  subscription_id?: string;
  customer_id: string;
  reason: string;
  credit_applied_to_balance: boolean;
  currency_code: string;
  payout_totals?: {
    subtotal: string;
    tax: string;
    total: string;
    fee: string;
    earnings: string;
  };
  totals: {
    subtotal: string;
    tax: string;
    total: string;
  };
  items: Array<{
    item_id: string;
    type: string;
    amount: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface CreateRefundParams {
  transactionId: string;
  reason: string;
  items?: Array<{
    itemId: string;
    type: "full" | "partial" | "proration";
    amount?: string; // Partial 환불 시 금액 (단위: 센트)
  }>;
}

interface RefundResult {
  success: boolean;
  data?: PaddleAdjustment;
  error?: string;
  errorCode?: string;
}

/**
 * Paddle API 요청 헬퍼
 */
async function paddleApiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>
): Promise<{ success: boolean; data?: T; error?: string; errorCode?: string }> {
  const url = `${PADDLE_CONFIG.apiUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PADDLE_CONFIG.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json();

    if (!response.ok) {
      const errorResponse = json as PaddleApiError;
      console.error("[Paddle API] Error:", errorResponse);
      return {
        success: false,
        error: errorResponse.error?.detail || "API request failed",
        errorCode: errorResponse.error?.code,
      };
    }

    return {
      success: true,
      data: json.data as T,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Paddle API] Request failed:", errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * 환불 생성 (Adjustment API)
 *
 * Paddle Billing에서 환불은 "Adjustment"로 처리됨
 * https://developer.paddle.com/api-reference/adjustments/create-adjustment
 */
export async function createRefund(params: CreateRefundParams): Promise<RefundResult> {
  const { transactionId, reason, items } = params;

  console.log(`[Paddle Refund] Creating refund for transaction: ${transactionId}`);

  // 기본: 전체 환불
  const defaultItems = [
    {
      item_id: transactionId,
      type: "full" as const,
    },
  ];

  // items가 있으면 변환, 없으면 기본값 사용
  const adjustmentItems = items
    ? items.map((item) => ({
        item_id: item.itemId,
        type: item.type,
        amount: item.amount,
      }))
    : defaultItems;

  const result = await paddleApiRequest<PaddleAdjustment>("/adjustments", "POST", {
    action: "refund",
    transaction_id: transactionId,
    reason,
    items: adjustmentItems,
  });

  if (result.success && result.data) {
    console.log(`[Paddle Refund] Refund created: ${result.data.id}, status: ${result.data.status}`);
  }

  return result;
}

/**
 * 부분 환불 금액 계산 (원 → 센트 변환)
 *
 * Paddle API는 가장 작은 화폐 단위(센트)를 사용
 * KRW는 이미 최소 단위이므로 변환 불필요
 */
export function convertToSmallestUnit(amount: number, currency: string): string {
  if (currency === "KRW") {
    return amount.toString();
  }
  // USD, EUR 등은 센트로 변환 (× 100)
  return Math.round(amount * 100).toString();
}

/**
 * 구독 취소 요청
 */
export async function cancelSubscription(
  subscriptionId: string,
  effectiveFrom: "immediately" | "next_billing_period" = "next_billing_period"
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Paddle] Canceling subscription: ${subscriptionId}, effective: ${effectiveFrom}`);

  const result = await paddleApiRequest<{ id: string; status: string }>(
    `/subscriptions/${subscriptionId}/cancel`,
    "POST",
    {
      effective_from: effectiveFrom,
    }
  );

  if (result.success) {
    console.log(`[Paddle] Subscription canceled: ${subscriptionId}`);
  }

  return result;
}

/**
 * 구독 정보 조회
 */
export interface SubscriptionInfo {
  id: string;
  status: string;
  customer_id: string;
  current_billing_period: {
    starts_at: string;
    ends_at: string;
  };
  billing_cycle: {
    frequency: number;
    interval: "day" | "week" | "month" | "year";
  };
  items: Array<{
    price: {
      id: string;
      unit_price: {
        amount: string;
        currency_code: string;
      };
    };
  }>;
  scheduled_change?: {
    action: "cancel" | "pause" | "resume";
    effective_at: string;
  } | null;
  started_at: string;
  first_billed_at: string;
  next_billed_at?: string;
}

export async function getSubscription(
  subscriptionId: string
): Promise<{ success: boolean; data?: SubscriptionInfo; error?: string }> {
  return paddleApiRequest<SubscriptionInfo>(`/subscriptions/${subscriptionId}`, "GET");
}

/**
 * Transaction 정보 조회 (환불 금액 확인용)
 */
export interface TransactionInfo {
  id: string;
  status: string;
  subscription_id?: string;
  customer_id: string;
  currency_code: string;
  details: {
    totals: {
      subtotal: string;
      tax: string;
      total: string;
      grand_total: string;
    };
  };
  billed_at?: string;
  created_at: string;
}

export async function getTransaction(
  transactionId: string
): Promise<{ success: boolean; data?: TransactionInfo; error?: string }> {
  return paddleApiRequest<TransactionInfo>(`/transactions/${transactionId}`, "GET");
}

/**
 * 특정 구독의 최근 결제 Transaction 조회
 */
export async function getSubscriptionTransactions(
  subscriptionId: string,
  limit: number = 1
): Promise<{ success: boolean; data?: TransactionInfo[]; error?: string }> {
  const result = await paddleApiRequest<TransactionInfo[]>(
    `/transactions?subscription_id=${subscriptionId}&per_page=${limit}&order_by=created_at[DESC]`,
    "GET"
  );

  return result;
}

/**
 * 환불 계산 결과 (Paddle 호환 - 14일 무조건 전액환불)
 */
export interface RefundCalculation {
  refundAmount: number;
  originalAmount: number;
  daysSinceStart: number;
  isFullRefundEligible: boolean;
  rejectionReason?: string;
}

/**
 * 환불 금액 계산 (Paddle 호환)
 *
 * Paddle 정책:
 * - 결제 후 14일 이내: 무조건 전액 환불 (서비스 이용 여부 무관)
 * - 결제 후 14일 경과: 환불 불가 (서비스는 주기 종료까지 유지)
 */
export function calculateProRataRefund(params: {
  paymentAmount: number;
  subscriptionStartDate: Date;
  currentPeriodEnd?: Date; // 하위 호환성 (사용하지 않음)
  usedCredits?: number;    // 하위 호환성 (사용하지 않음)
  totalCredits?: number;   // 하위 호환성 (사용하지 않음)
  plan?: "pro" | "enterprise"; // 하위 호환성 (사용하지 않음)
}): RefundCalculation {
  const { paymentAmount, subscriptionStartDate } = params;

  const now = new Date();
  const FULL_REFUND_DAYS = 14;

  // 구독 시작일로부터 경과 일수 계산
  const daysSinceStart = Math.ceil(
    (now.getTime() - subscriptionStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 14일 이내: 전액 환불
  if (daysSinceStart <= FULL_REFUND_DAYS) {
    return {
      refundAmount: paymentAmount,
      originalAmount: paymentAmount,
      daysSinceStart,
      isFullRefundEligible: true,
    };
  }

  // 14일 경과: 환불 불가
  return {
    refundAmount: 0,
    originalAmount: paymentAmount,
    daysSinceStart,
    isFullRefundEligible: false,
    rejectionReason: "refund_period_expired_14_days",
  };
}
