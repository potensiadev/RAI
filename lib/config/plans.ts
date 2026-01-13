/**
 * 플랜 크레딧 설정
 * 환경변수로 오버라이드 가능
 */

export type PlanType = 'starter' | 'pro';

export interface PlanConfig {
  name: string;
  displayName: string;
  price: string;
  credits: number;
  monthlyExportLimit: number;
  crossCheckMode: 'phase_1' | 'phase_2';
}

// 환경변수에서 크레딧 값 읽기 (기본값 제공)
const getEnvCredits = (plan: string, defaultValue: number): number => {
  const envKey = `PLAN_CREDITS_${plan.toUpperCase()}`;
  const envValue = process.env[envKey];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return defaultValue;
};

/**
 * 플랜별 크레딧 설정
 * 환경변수로 오버라이드 가능:
 * - PLAN_CREDITS_STARTER
 * - PLAN_CREDITS_PRO
 */
export const PLAN_CREDITS: Record<PlanType, number> = {
  starter: getEnvCredits('starter', 50),
  pro: getEnvCredits('pro', 150),
};

/**
 * 플랜별 월간 내보내기 제한
 * 환경변수로 오버라이드 가능:
 * - PLAN_EXPORT_LIMIT_STARTER
 * - PLAN_EXPORT_LIMIT_PRO
 */
const getEnvExportLimit = (plan: string, defaultValue: number): number => {
  const envKey = `PLAN_EXPORT_LIMIT_${plan.toUpperCase()}`;
  const envValue = process.env[envKey];
  if (envValue === 'unlimited' || envValue === 'Infinity') {
    return Infinity;
  }
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return defaultValue;
};

export const PLAN_EXPORT_LIMITS: Record<PlanType, number> = {
  starter: getEnvExportLimit('starter', 30),
  pro: getEnvExportLimit('pro', Infinity),
};

/**
 * 전체 플랜 설정
 */
export const PLANS: Record<PlanType, PlanConfig> = {
  starter: {
    name: 'starter',
    displayName: 'Starter',
    price: '₩79,000/월',
    credits: PLAN_CREDITS.starter,
    monthlyExportLimit: PLAN_EXPORT_LIMITS.starter,
    crossCheckMode: 'phase_1', // 2-Way (GPT + Gemini)
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    price: '₩149,000/월',
    credits: PLAN_CREDITS.pro,
    monthlyExportLimit: PLAN_EXPORT_LIMITS.pro,
    crossCheckMode: 'phase_2', // 3-Way (GPT + Gemini + Claude)
  },
};

/**
 * 플랜 크레딧 조회 헬퍼
 * 알 수 없는 플랜은 starter 크레딧 반환
 */
export function getPlanCredits(plan: string): number {
  return PLAN_CREDITS[plan as PlanType] ?? PLAN_CREDITS.starter;
}

/**
 * 플랜 내보내기 제한 조회 헬퍼
 */
export function getPlanExportLimit(plan: string): number {
  return PLAN_EXPORT_LIMITS[plan as PlanType] ?? PLAN_EXPORT_LIMITS.starter;
}

