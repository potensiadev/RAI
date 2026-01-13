/**
 * GET /api/refunds/history
 * 환불/보상 내역 조회
 *
 * PRD: prd_refund_policy_v0.4.md Section 8
 * QA: refund_policy_test_scenarios_v1.0.md (UI-011 ~ UI-020)
 *
 * 사용자의 모든 환불/보상 내역을 통합 조회
 * - 품질 환불 (credit_transactions)
 * - 구독 환불 (refund_requests)
 * - 장애 보상 (incident_compensations)
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  apiInternalError,
} from "@/lib/api-response";

interface RefundRecord {
  id: string;
  type: "quality" | "subscription" | "incident";
  status: "pending" | "processing" | "completed" | "failed";
  amount: number | null;
  creditsRefunded: number | null;
  reason: string;
  createdAt: string;
  processedAt: string | null;
  metadata?: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    const records: RefundRecord[] = [];

    // 1. 품질 환불 내역 (credit_transactions에서 refund 타입)
    const { data: qualityRefunds, error: qualityError } = await supabase
      .from("credit_transactions")
      .select("id, amount, description, metadata, created_at")
      .eq("user_id", user.id)
      .eq("type", "refund")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!qualityError && qualityRefunds) {
      type QualityRefund = {
        id: string;
        amount: number;
        description: string | null;
        metadata: unknown;
        created_at: string;
      };
      for (const refund of qualityRefunds as QualityRefund[]) {
        records.push({
          id: refund.id,
          type: "quality",
          status: "completed",
          amount: null,
          creditsRefunded: refund.amount,
          reason: refund.description || "품질 기준 미달 환불",
          createdAt: refund.created_at,
          processedAt: refund.created_at,
          metadata: refund.metadata as Record<string, unknown> | undefined,
        });
      }
    }

    // 2. 구독 환불 내역 (refund_requests)
    const { data: subscriptionRefunds, error: subscriptionError } = await supabase
      .from("refund_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!subscriptionError && subscriptionRefunds) {
      type SubscriptionRefund = {
        id: string;
        status: string;
        refund_amount: number | null;
        reason: string | null;
        created_at: string;
        processed_at: string | null;
        refund_type: string | null;
        paddle_refund_id: string | null;
      };
      for (const refund of subscriptionRefunds as SubscriptionRefund[]) {
        records.push({
          id: refund.id,
          type: "subscription",
          status: refund.status as RefundRecord["status"],
          amount: refund.refund_amount,
          creditsRefunded: null,
          reason: refund.reason || "구독 취소 환불",
          createdAt: refund.created_at,
          processedAt: refund.processed_at,
          metadata: {
            refundType: refund.refund_type,
            paddleRefundId: refund.paddle_refund_id,
          },
        });
      }
    }

    // 3. 장애 보상 내역 (incident_compensations)
    const { data: incidentCompensations, error: incidentError } = await supabase
      .from("incident_compensations")
      .select(`
        id,
        credits_granted,
        plan_at_incident,
        created_at,
        incident_id
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!incidentError && incidentCompensations) {
      type IncidentCompensation = {
        id: string;
        credits_granted: number;
        plan_at_incident: string | null;
        created_at: string;
        incident_id: string;
      };
      type IncidentInfo = {
        id: string;
        title: string;
        level: string;
      };

      const compensationList = incidentCompensations as IncidentCompensation[];

      // 장애 정보 조회를 위해 incident_ids 수집
      const incidentIds = [...new Set(compensationList.map((c) => c.incident_id))];

      // 장애 정보 일괄 조회
      const { data: incidents } = await supabase
        .from("incident_reports")
        .select("id, title, level")
        .in("id", incidentIds);

      const incidentMap = new Map((incidents as IncidentInfo[] | null)?.map((i) => [i.id, i]) || []);

      for (const compensation of compensationList) {
        const incident = incidentMap.get(compensation.incident_id);
        records.push({
          id: compensation.id,
          type: "incident",
          status: "completed",
          amount: null,
          creditsRefunded: compensation.credits_granted,
          reason: incident
            ? `서비스 장애 보상 (${incident.level}): ${incident.title}`
            : "서비스 장애 보상",
          createdAt: compensation.created_at,
          processedAt: compensation.created_at,
          metadata: {
            incidentId: compensation.incident_id,
            planAtIncident: compensation.plan_at_incident,
          },
        });
      }
    }

    // 날짜순 정렬
    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return apiSuccess({
      records: records.slice(0, 50), // 최대 50개
      total: records.length,
    });
  } catch (error) {
    console.error("[Refunds History] Error:", error);
    return apiInternalError();
  }
}
