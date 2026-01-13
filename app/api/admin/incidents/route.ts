/**
 * Admin API: Incident Management
 *
 * PRD: prd_refund_policy_v0.4.md Section 7
 *
 * GET /api/admin/incidents - 장애 목록 조회
 * POST /api/admin/incidents - 장애 등록
 *
 * 주의: 이 API는 관리자 전용입니다.
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

// 관리자 이메일 목록 (환경 변수로 관리)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);

type IncidentLevel = "P1" | "P2" | "P3";

interface CreateIncidentRequest {
  level: IncidentLevel;
  title: string;
  description?: string;
  started_at: string;
  affected_services?: string[];
}

/**
 * 관리자 권한 확인
 */
async function verifyAdmin(request: NextRequest): Promise<{
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

  // 관리자 이메일 확인
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(user.email)) {
    return { authorized: false, error: "Admin access required" };
  }

  return { authorized: true, email: user.email };
}

/**
 * GET /api/admin/incidents
 * 장애 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request);
    if (!authResult.authorized) {
      return authResult.error === "Unauthorized"
        ? apiUnauthorized()
        : apiForbidden(authResult.error);
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    let query = supabaseAdmin
      .from("incident_reports")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Admin Incidents] Fetch error:", error);
      return apiInternalError();
    }

    return apiSuccess({
      incidents: data,
      count: data?.length || 0,
    });
  } catch (error) {
    console.error("[Admin Incidents] Error:", error);
    return apiInternalError();
  }
}

/**
 * POST /api/admin/incidents
 * 장애 등록
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request);
    if (!authResult.authorized) {
      return authResult.error === "Unauthorized"
        ? apiUnauthorized()
        : apiForbidden(authResult.error);
    }

    const body = (await request.json()) as CreateIncidentRequest;

    // 필수 필드 검증
    if (!body.level || !body.title || !body.started_at) {
      return apiBadRequest("level, title, started_at은 필수입니다.");
    }

    // 등급 검증
    if (!["P1", "P2", "P3"].includes(body.level)) {
      return apiBadRequest("level은 P1, P2, P3 중 하나여야 합니다.");
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 장애 등록
    const { data, error } = await supabaseAdmin
      .from("incident_reports")
      .insert({
        level: body.level,
        title: body.title,
        description: body.description,
        started_at: body.started_at,
        affected_services: body.affected_services || [],
        created_by: authResult.email,
        status: "ongoing",
      })
      .select()
      .single();

    if (error) {
      console.error("[Admin Incidents] Create error:", error);
      return apiInternalError("장애 등록에 실패했습니다.");
    }

    console.log(`[Admin Incidents] Created: ${data.id} by ${authResult.email}`);

    return apiSuccess({
      incident: data,
      message: "장애가 등록되었습니다.",
    });
  } catch (error) {
    console.error("[Admin Incidents] Error:", error);
    return apiInternalError();
  }
}
