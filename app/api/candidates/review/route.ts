
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiUnauthorized, apiInternalError } from "@/lib/api-response";
import { toCandidateListItem } from "@/types";

/**
 * GET /api/candidates/review
 * 검토가 필요한 후보자 목록 조회
 * - confidence_score < 0.95 (95% 미만)
 * - requires_review = true
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. 인증 확인
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return apiUnauthorized();
        }

        // 2. 쿼리 파라미터 파싱
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const offset = (page - 1) * limit;

        // 3. 검토 대상 조회 (신뢰도 오름차순 - 가장 낮은 것부터)
        const { data, error, count } = await supabase
            .from("candidates")
            .select("*", { count: "exact" })
            .eq("user_id", user.id)
            .eq("is_latest", true)
            .eq("requires_review", true)
            .order("confidence_score", { ascending: true })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error("[ReviewQueue] Data fetch error:", error);
            return apiInternalError();
        }

        // 4. 변환 및 반환
        const items = (data || []).map(toCandidateListItem);

        return apiSuccess(items, {
            total: count || 0,
            page,
            limit,
        });
    } catch (error) {
        console.error("[ReviewQueue] API error:", error);
        return apiInternalError();
    }
}
