import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
  apiRateLimitExceeded,
} from "@/lib/api-response";
import { withRateLimit, getClientIP } from "@/lib/rate-limit";
import { PLAN_CONFIG } from "@/lib/file-validation";
import { type PlanType } from "@/types/auth";
import { type PlanType } from "@/types/auth";
import crypto from "crypto";
import { generateBlindResumeHTML } from "@/lib/pdf/blind-export-generator";

/**
 * IP 주소 익명화 (개인정보 보호)
 * 전체 IP 대신 해시값의 일부만 저장
 */
function anonymizeIP(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  const hash = crypto.createHash("sha256").update(ip).digest("hex");
  return hash.substring(0, 16); // 처음 16자만 저장 (추적용 충분)
}

/**
 * Blind Export API
 *
 * 후보자 이력서를 블라인드 처리하여 내보내기
 * - 연락처 정보 마스킹
 * - 월별 내보내기 횟수 제한 (Starter: 30회)
 * - 내보내기 기록 저장
 */

// 중앙화된 플랜 설정 사용
const PLAN_LIMITS = PLAN_CONFIG.EXPORT_LIMITS;

// 내보내기에 필요한 후보자 컬럼
const EXPORT_CANDIDATE_COLUMNS = `
  id, user_id, name, last_position, last_company, exp_years, skills,
  photo_url, summary, confidence_score, birth_year, gender,
  phone_masked, email_masked, address_masked,
  phone_encrypted, email_encrypted, address_encrypted,
  phone_hash, email_hash,
  education_level, education_school, education_major, location_city,
  careers, projects, education, strengths,
  portfolio_thumbnail_url, portfolio_url, github_url, linkedin_url,
  created_at
`;

interface ExportRequest {
  format?: "pdf" | "docx";
  includePhoto?: boolean;
  includePortfolio?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate Limit 체크 (시간당 20회)
    const rateLimitResponse = await withRateLimit(request, "export");
    if (rateLimitResponse) return rateLimitResponse;

    const { id: candidateId } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiUnauthorized();
    }

    // 요청 파싱
    const body: ExportRequest = await request.json().catch(() => ({}));
    const format = body.format || "pdf";

    // 사용자 플랜 조회
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return apiNotFound("사용자를 찾을 수 없습니다.");
    }

    const plan = ((userData as { plan: string }).plan || "starter") as PlanType;
    const monthlyLimit = PLAN_LIMITS[plan] ?? 30;

    // 월별 내보내기 횟수 체크
    if (monthlyLimit !== Infinity) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: countResult } = await (supabase as any).rpc(
        "get_monthly_blind_export_count",
        { p_user_id: user.id }
      );

      const currentCount = (countResult as unknown as number) || 0;
      if (currentCount >= monthlyLimit) {
        return apiRateLimitExceeded(`월 내보내기 한도(${monthlyLimit}회)를 초과했습니다.`);
      }
    }

    // 후보자 데이터 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: candidate, error: candidateError } = await (supabase as any)
      .from("candidates")
      .select(EXPORT_CANDIDATE_COLUMNS)
      .eq("id", candidateId)
      .eq("user_id", user.id)
      .single();

    if (candidateError || !candidate) {
      return apiNotFound("후보자를 찾을 수 없습니다.");
    }

    // 블라인드 데이터 생성 (연락처 마스킹)
    const blindData = {
      ...candidate,
      // 연락처 완전 마스킹
      phone_masked: "[연락처 비공개]",
      email_masked: "[이메일 비공개]",
      address_masked: "[주소 비공개]",
      // 암호화 필드 제거
      phone_encrypted: null,
      email_encrypted: null,
      address_encrypted: null,
      phone_hash: null,
      email_hash: null,
    };

    const maskedFields = ["phone", "email", "address"];

    // 내보내기 기록 저장
    const fileName = `${blindData.name || "이력서"}_블라인드_${new Date().toISOString().split("T")[0]}.${format}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("blind_exports").insert({
      user_id: user.id,
      candidate_id: candidateId,
      format,
      file_name: fileName,
      masked_fields: maskedFields,
      // 개인정보 보호: IP 주소 익명화, User-Agent 제거
      ip_address: anonymizeIP(getClientIP(request)),
      user_agent: null, // User-Agent는 개인 식별 가능 정보이므로 저장하지 않음
    });

    // HTML 템플릿 생성 (클라이언트에서 PDF로 변환)
    const htmlContent = generateBlindResumeHTML(blindData, {
      includePhoto: body.includePhoto ?? false,
      includePortfolio: body.includePortfolio ?? false,
    });

    return apiSuccess({
      html: htmlContent,
      fileName,
      format,
      candidate: {
        id: blindData.id,
        name: blindData.name,
        // 마스킹된 정보만 포함
        phone: "[연락처 비공개]",
        email: "[이메일 비공개]",
        summary: blindData.summary,
        expYears: blindData.exp_years,
        skills: blindData.skills,
        careers: blindData.careers,
        education: blindData.education,
        projects: blindData.projects,
        strengths: blindData.strengths,
      },
    });
  } catch (error) {
    console.error("Blind export error:", error);
    return apiInternalError();
  }
}

// 월별 내보내기 횟수 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate Limit 체크 (시간당 20회)
    const rateLimitResponse = await withRateLimit(request, "export");
    if (rateLimitResponse) return rateLimitResponse;

    await params; // params 사용 표시
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiUnauthorized();
    }

    // 사용자 플랜 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (supabase as any)
      .from("users")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = (((userData as { plan?: string } | null)?.plan) || "starter") as PlanType;
    const monthlyLimit = PLAN_LIMITS[plan] ?? 30;

    // 월별 사용량 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: countResult } = await (supabase as any).rpc(
      "get_monthly_blind_export_count",
      { p_user_id: user.id }
    );

    const used = (countResult as unknown as number) || 0;

    return apiSuccess({
      plan,
      limit: monthlyLimit === Infinity ? "unlimited" : monthlyLimit,
      used,
      remaining: monthlyLimit === Infinity ? "unlimited" : monthlyLimit - used,
    });
  } catch (error) {
    console.error("Export status error:", error);
    return apiInternalError();
  }
}

