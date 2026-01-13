/**
 * 환불 정책 설정
 *
 * PRD: prd_refund_policy_v0.4.md
 * QA: refund_policy_test_scenarios_v1.0.md (EC-076 ~ EC-080)
 *
 * - 정책 변경 시 이 파일만 수정
 * - 코드 배포 없이 환경 변수로 오버라이드 가능
 */

/**
 * 환경 변수에서 숫자를 안전하게 파싱
 * EC-080: 환경 변수가 숫자가 아닌 경우 기본값 사용
 */
function safeParseFloat(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const REFUND_CONFIG = {
  // 품질 환불 조건
  quality: {
    /**
     * 신뢰도 임계값 (기본: 0.3)
     * EC-005: confidence = 0.3은 환불 안 됨 (0.3 >= 0.3)
     * EC-004: confidence = 0.29999는 환불 대상 (0.29999 < 0.3)
     */
    confidenceThreshold: safeParseFloat(
      process.env.REFUND_CONFIDENCE_THRESHOLD,
      0.3
    ),

    /**
     * 3-Way 불일치 임계값 (기본: 0.5)
     * Pro 플랜 전용: 3개 LLM 모두 불일치 시 환불 대상
     * - confidence < 0.5 AND analysisMode = 'phase_2' → 환불 대상
     * - 필드 누락 여부와 무관하게 적용
     */
    threeWayDisagreeThreshold: safeParseFloat(
      process.env.REFUND_3WAY_DISAGREE_THRESHOLD,
      0.5
    ),

    /**
     * 필수 누락 필드 수 (기본: 2)
     * 3개 필드 중 최소 2개 누락 시 환불
     */
    requiredMissingFields: safeParseInt(
      process.env.REFUND_REQUIRED_MISSING_FIELDS,
      2
    ),

    /**
     * 핵심 필드 목록
     * - name: 이름
     * - contact: phone 또는 email (둘 다 없으면 누락)
     * - last_company: 최근 회사 (careers 대체)
     */
    criticalFields: ["name", "contact", "last_company"] as const,
  },

  // 구독 환불 조건 (Paddle 호환 - 14일 무조건 전액환불)
  subscription: {
    /**
     * 전액 환불 가능 기간 (일)
     * Paddle 정책: 최소 14일 필수
     */
    fullRefundDays: 14,

    /**
     * 14일 경과 후 환불 정책
     * Paddle 호환: 14일 이후 환불 불가 (서비스는 주기 종료까지 유지)
     */
    allowRefundAfterPeriod: false,
  },

  // 데이터 보존 정책
  retention: {
    /** Soft Delete 보존 기간 (일) */
    softDeleteDays: 90,
  },

  // Idempotency 키 prefix
  idempotency: {
    qualityRefund: "quality_refund_",
  },
} as const;

export type CriticalField = (typeof REFUND_CONFIG.quality.criticalFields)[number];

/**
 * 분석 모드 타입
 */
export type AnalysisMode = "phase_1" | "phase_2";

/**
 * 품질 환불 조건 체크
 *
 * EC-001 ~ EC-025: 모든 경계값과 필드 조합 테스트
 *
 * 환불 조건:
 * 1. (confidence < 0.3) AND (누락 필드 ≥ 2개) - 기존 조건
 * 2. (confidence < 0.5) AND (analysisMode = 'phase_2') - 3-Way 불일치 조건 (Pro 플랜)
 *
 * @param confidenceScore - 분석 신뢰도 점수 (0-1)
 * @param quickData - Worker에서 전달된 빠른 추출 데이터
 * @param analysisMode - 분석 모드 ('phase_1' = 2-Way, 'phase_2' = 3-Way)
 * @returns 환불 대상 여부와 누락된 필드 목록
 */
export function checkQualityRefundCondition(
  confidenceScore: number | null | undefined,
  quickData: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    last_company?: string | null;
  } | null | undefined,
  analysisMode?: AnalysisMode
): {
  eligible: boolean;
  missingFields: string[];
  confidence: number;
  reason?: string;
} {
  const { quality } = REFUND_CONFIG;
  const missingFields: string[] = [];

  // EC-001, EC-002: null/undefined는 0으로 처리
  const confidence = confidenceScore ?? 0;

  // ─────────────────────────────────────────────────────────────
  // 조건 2: 3-Way 불일치 (Pro 플랜 전용)
  // confidence < 0.5 AND phase_2 → 환불 대상 (필드 누락 여부 무관)
  // ─────────────────────────────────────────────────────────────
  if (
    analysisMode === "phase_2" &&
    confidence < quality.threeWayDisagreeThreshold
  ) {
    // 필드 누락 체크는 정보 제공용으로만 수행
    const data = quickData || {};
    if (!data.name || data.name.trim() === "") missingFields.push("name");
    const hasPhone = data.phone && data.phone.trim() !== "";
    const hasEmail = data.email && data.email.trim() !== "";
    if (!hasPhone && !hasEmail) missingFields.push("contact");
    if (!data.last_company || data.last_company.trim() === "") missingFields.push("last_company");

    return {
      eligible: true,
      missingFields,
      confidence,
      reason: "three_way_disagree",
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 조건 1: 기존 로직 (2-Way 또는 높은 신뢰도)
  // confidence < 0.3 AND 누락 필드 ≥ 2개 → 환불 대상
  // ─────────────────────────────────────────────────────────────

  // EC-005, EC-006: 경계값 체크 (>= threshold면 환불 안 됨)
  if (confidence >= quality.confidenceThreshold) {
    return { eligible: false, missingFields: [], confidence };
  }

  // quick_data가 없으면 모든 필드 누락
  // EC-019, EC-020: quick_data 전체 null 또는 없음
  const data = quickData || {};

  // name 체크 (EC-011, EC-012: 빈 문자열도 누락으로 처리)
  if (!data.name || data.name.trim() === "") {
    missingFields.push("name");
  }

  // contact 체크 (phone 또는 email 중 하나라도 있으면 OK)
  // EC-013, EC-014, EC-024, EC-025
  const hasPhone = data.phone && data.phone.trim() !== "";
  const hasEmail = data.email && data.email.trim() !== "";
  if (!hasPhone && !hasEmail) {
    missingFields.push("contact");
  }

  // last_company 체크 (EC-017: 빈 문자열도 누락으로 처리)
  if (!data.last_company || data.last_company.trim() === "") {
    missingFields.push("last_company");
  }

  const isEligible = missingFields.length >= quality.requiredMissingFields;

  return {
    eligible: isEligible,
    missingFields,
    confidence,
    reason: isEligible ? "missing_fields" : undefined,
  };
}

/**
 * 14일 이내 전액 환불 대상 여부 체크 (Paddle 호환)
 *
 * Paddle 정책: 결제 후 14일 이내 무조건 전액 환불
 * - 크레딧 사용량과 무관
 * - 서비스 이용 여부와 무관
 */
export function isFullRefundEligible(
  subscriptionStartDate: Date,
  _usedCredits?: number // 하위 호환성을 위해 유지하지만 사용하지 않음
): boolean {
  const { fullRefundDays } = REFUND_CONFIG.subscription;
  const now = new Date();
  const daysSinceStart = Math.floor(
    (now.getTime() - subscriptionStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceStart <= fullRefundDays;
}

/**
 * 환불 금액 계산 (Paddle 호환)
 *
 * Paddle 정책: 14일 이내 전액 환불, 14일 이후 환불 불가
 * Pro-rata 환불은 더 이상 사용하지 않음
 *
 * @deprecated Pro-rata 계산은 제거됨. isFullRefundEligible() 사용 권장
 */
export function calculateRefund(input: {
  paymentAmount: number;
  subscriptionStartDate: Date;
}): { refundAmount: number; eligible: boolean; reason?: string } {
  const { paymentAmount, subscriptionStartDate } = input;

  // 14일 이내인지 체크
  if (isFullRefundEligible(subscriptionStartDate)) {
    return {
      refundAmount: paymentAmount,
      eligible: true,
    };
  }

  // 14일 경과 후 환불 불가
  return {
    refundAmount: 0,
    eligible: false,
    reason: "refund_period_expired",
  };
}
