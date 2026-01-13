/**
 * Admin API: Individual Incident Management
 *
 * PRD: prd_refund_policy_v0.4.md Section 7
 *
 * GET /api/admin/incidents/[id] - 장애 상세 조회
 * PATCH /api/admin/incidents/[id] - 장애 정보 수정
 * POST /api/admin/incidents/[id]/resolve - 장애 종료
 * POST /api/admin/incidents/[id]/compensate - 보상 처리
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
  apiNotFound,
} from "@/lib/api-response";

// 관리자 이메일 목록
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 관리자 권한 확인
 */
async function verifyAdmin(): Promise<{
  authorized: boolean;
  email?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    return { authorized: false, error: "Unauthorized" };
  }

  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(user.email)) {
    return { authorized: false, error: "Admin access required" };
  }

  return { authorized: true, email: user.email };
}

/**
 * GET /api/admin/incidents/[id]
 * 장애 상세 조회 (보상 내역 포함)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authorized) {
      return authResult.error === "Unauthorized"
        ? apiUnauthorized()
        : apiForbidden(authResult.error);
    }

    const { id } = await params;

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 장애 정보 조회
    const { data: incident, error: incidentError } = await supabaseAdmin
      .from("incident_reports")
      .select("*")
      .eq("id", id)
      .single();

    if (incidentError || !incident) {
      return apiNotFound("장애를 찾을 수 없습니다.");
    }

    // 보상 내역 조회
    const { data: compensations } = await supabaseAdmin
      .from("incident_compensations")
      .select("id, user_id, credits_granted, plan_at_incident, created_at")
      .eq("incident_id", id);

    return apiSuccess({
      incident,
      compensations: compensations || [],
      compensationCount: compensations?.length || 0,
      totalCreditsGranted: compensations?.reduce((sum, c) => sum + c.credits_granted, 0) || 0,
    });
  } catch (error) {
    console.error("[Admin Incident] Error:", error);
    return apiInternalError();
  }
}

/**
 * PATCH /api/admin/incidents/[id]
 * 장애 정보 수정
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authorized) {
      return authResult.error === "Unauthorized"
        ? apiUnauthorized()
        : apiForbidden(authResult.error);
    }

    const { id } = await params;
    const body = await request.json();

    // 허용된 필드만 업데이트
    const allowedFields = [
      "title",
      "description",
      "level",
      "affected_services",
      "compensation_rate",
    ];

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return apiBadRequest("업데이트할 필드가 없습니다.");
    }

    updateData.updated_at = new Date().toISOString();

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from("incident_reports")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Admin Incident] Update error:", error);
      return apiInternalError("업데이트에 실패했습니다.");
    }

    return apiSuccess({
      incident: data,
      message: "장애 정보가 업데이트되었습니다.",
    });
  } catch (error) {
    console.error("[Admin Incident] Error:", error);
    return apiInternalError();
  }
}

/**
 * POST /api/admin/incidents/[id]
 * 장애 종료 또는 보상 처리
 *
 * action=resolve: 장애 종료
 * action=compensate: 보상 처리
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authorized) {
      return authResult.error === "Unauthorized"
        ? apiUnauthorized()
        : apiForbidden(authResult.error);
    }

    const { id } = await params;
    const body = await request.json();
    const action = body.action as string;

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (action === "resolve") {
      // 장애 종료 처리
      const { data, error } = await supabaseAdmin.rpc("resolve_incident", {
        p_incident_id: id,
        p_resolved_by: authResult.email,
      });

      if (error) {
        console.error("[Admin Incident] Resolve error:", error);
        return apiInternalError("장애 종료 처리에 실패했습니다.");
      }

      const result = data as { success: boolean; error?: string; duration_hours?: number };

      if (!result.success) {
        return apiBadRequest(result.error || "처리에 실패했습니다.");
      }

      console.log(`[Admin Incident] Resolved: ${id} by ${authResult.email}`);

      return apiSuccess({
        message: "장애가 종료되었습니다.",
        durationHours: result.duration_hours,
      });
    }

    if (action === "compensate") {
      // 보상 처리
      const { data, error } = await supabaseAdmin.rpc("process_incident_compensation", {
        p_incident_id: id,
      });

      if (error) {
        console.error("[Admin Incident] Compensation error:", error);
        return apiInternalError("보상 처리에 실패했습니다.");
      }

      const result = data as {
        success: boolean;
        error?: string;
        idempotent?: boolean;
        processed_count?: number;
        skipped_count?: number;
      };

      if (!result.success) {
        return apiBadRequest(result.error || "처리에 실패했습니다.");
      }

      console.log(
        `[Admin Incident] Compensation processed: ${id}, count=${result.processed_count}`
      );

      return apiSuccess({
        message: result.idempotent
          ? "이미 보상이 처리되었습니다."
          : `${result.processed_count}명에게 보상이 지급되었습니다.`,
        processedCount: result.processed_count,
        skippedCount: result.skipped_count,
        idempotent: result.idempotent,
      });
    }

    return apiBadRequest("action은 resolve 또는 compensate여야 합니다.");
  } catch (error) {
    console.error("[Admin Incident] Error:", error);
    return apiInternalError();
  }
}
