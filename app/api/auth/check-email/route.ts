import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiBadRequest,
  apiInternalError,
} from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { logAuthFailure } from "@/lib/logger";

// Service Role 클라이언트 (RLS 우회)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * RFC 5322 준수 이메일 정규식 (간소화 버전)
 * - 로컬 파트: 알파벳, 숫자, 특수문자 허용
 * - 도메인: 최소 2단계 도메인 필수
 * - 연속 점(.) 불허, 시작/끝 점 불허
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export async function POST(request: NextRequest) {
  try {
    // Rate Limit 체크 (분당 5회 - 이메일 열거 공격 방지)
    const rateLimitResponse = await withRateLimit(request, "auth");
    if (rateLimitResponse) return rateLimitResponse;

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return apiBadRequest("이메일이 필요합니다.");
    }

    // 이메일 길이 제한 (DoS 방지)
    if (email.length > 254) {
      return apiBadRequest("이메일 주소가 너무 깁니다.");
    }

    // 이메일 형식 검증 (RFC 5322 준수)
    if (!EMAIL_REGEX.test(email)) {
      return apiBadRequest("올바른 이메일 형식이 아닙니다.");
    }

    // users 테이블에서 이메일 확인
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, signup_provider")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      logAuthFailure({
        endpoint: "/api/auth/check-email",
        reason: "database_error",
      });
      return apiInternalError("이메일 확인 중 오류가 발생했습니다.");
    }

    if (!data) {
      return apiSuccess({
        exists: false,
        provider: null,
      });
    }

    return apiSuccess({
      exists: true,
      provider: data.signup_provider || "email",
    });
  } catch {
    logAuthFailure({
      endpoint: "/api/auth/check-email",
      reason: "unexpected_error",
    });
    return apiInternalError();
  }
}
