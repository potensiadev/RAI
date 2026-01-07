/**
 * 플랜 크레딧 설정
 * 환경변수로 오버라이드 가능
 */

export type PlanType = 'starter' | 'pro' | 'enterprise';

export interface PlanConfig {
  name: string;
  displayName: string;
  price: string;
  credits: number;
  monthlyExportLimit: number;
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
 * - PLAN_CREDITS_ENTERPRISE
 */
export const PLAN_CREDITS: Record<PlanType, number> = {
  starter: getEnvCredits('starter', 50),
  pro: getEnvCredits('pro', 150),
  enterprise: getEnvCredits('enterprise', 300),
};

/**
 * 플랜별 월간 내보내기 제한
 * 환경변수로 오버라이드 가능:
 * - PLAN_EXPORT_LIMIT_STARTER
 * - PLAN_EXPORT_LIMIT_PRO
 * - PLAN_EXPORT_LIMIT_ENTERPRISE
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
  enterprise: getEnvExportLimit('enterprise', Infinity),
};

/**
 * 전체 플랜 설정
 */
export const PLANS: Record<PlanType, PlanConfig> = {
  starter: {
    name: 'starter',
    displayName: 'Starter',
    price: '무료',
    credits: PLAN_CREDITS.starter,
    monthlyExportLimit: PLAN_EXPORT_LIMITS.starter,
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    price: '₩49,000/월',
    credits: PLAN_CREDITS.pro,
    monthlyExportLimit: PLAN_EXPORT_LIMITS.pro,
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    price: '문의',
    credits: PLAN_CREDITS.enterprise,
    monthlyExportLimit: PLAN_EXPORT_LIMITS.enterprise,
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
