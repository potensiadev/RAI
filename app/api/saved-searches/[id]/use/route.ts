/**
 * POST /api/saved-searches/[id]/use
 * 저장된 검색 사용 기록 (use_count 증가)
 *
 * Uses atomic increment via RPC to prevent race conditions
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
  apiForbidden,
} from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface IncrementResult {
  query: string | null;
  filters: Record<string, unknown> | null;
  new_use_count: number;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await withRateLimit(request, "default");
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user || !user.email) {
      return apiUnauthorized();
    }

    // 사용자 ID 조회
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("email", user.email)
      .single();

    const publicUserId = (userData as { id: string } | null)?.id;
    if (!publicUserId) {
      return apiUnauthorized("사용자 정보를 찾을 수 없습니다.");
    }

    // Atomic increment via RPC - prevents race conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("increment_saved_search_use_count", {
      search_id: id,
      requesting_user_id: publicUserId,
    });

    if (error) {
      // Handle specific error codes from RPC
      if (error.code === "P0002") {
        return apiNotFound("저장된 검색을 찾을 수 없습니다.");
      }
      if (error.code === "42501") {
        return apiForbidden("이 검색을 사용할 권한이 없습니다.");
      }
      console.error("Saved search increment RPC error:", error);
      return apiInternalError();
    }

    // RPC returns array, get first result
    const result = (Array.isArray(data) ? data[0] : data) as IncrementResult | null;

    if (!result) {
      return apiNotFound("저장된 검색을 찾을 수 없습니다.");
    }

    return apiSuccess({
      query: result.query,
      filters: result.filters || {},
    });
  } catch (error) {
    console.error("Saved search use API error:", error);
    return apiInternalError();
  }
}
