/**
 * Paddle 결제 설정
 *
 * Paddle Billing API를 사용한 구독 관리
 * - 한국 사용자 원화 결제 지원
 * - VAT/세금 자동 처리 (MoR)
 * - 구독 생명주기 관리
 */

// Paddle 환경 설정
export const PADDLE_CONFIG = {
  environment: (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
  clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '',

  // Server-side only
  apiKey: process.env.PADDLE_API_KEY || '',
  webhookSecret: process.env.PADDLE_WEBHOOK_SECRET || '',

  // API Base URL
  apiUrl: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com',
} as const;

// 플랜 설정
export const PLAN_CONFIG = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceId: null, // 무료 플랜
    credits: 50,
    price: 0,
    priceDisplay: '무료',
    features: [
      '월 50건 이력서 분석',
      'AI 자동 추출',
      '기본 검색',
      '블라인드 내보내기',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceId: process.env.PADDLE_PRODUCT_PRO || '',
    credits: 150,
    price: 49000,
    priceDisplay: '₩49,000/월',
    features: [
      '월 150건 이력서 분석',
      'AI 고급 분석',
      '동의어 검색',
      '버전 관리',
      '우선 지원',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceId: process.env.PADDLE_PRODUCT_ENTERPRISE || '',
    credits: 300,
    price: 99000,
    priceDisplay: '₩99,000/월',
    features: [
      '월 300건 이력서 분석',
      '모든 Pro 기능',
      'API 액세스',
      '전담 지원',
      '맞춤 통합',
    ],
  },
} as const;

export type PlanId = keyof typeof PLAN_CONFIG;

/**
 * Price ID로 플랜 찾기
 */
export function getPlanByPriceId(priceId: string): typeof PLAN_CONFIG[PlanId] | null {
  for (const plan of Object.values(PLAN_CONFIG)) {
    if (plan.priceId === priceId) {
      return plan;
    }
  }
  return null;
}

/**
 * 플랜 업그레이드 가능 여부 확인
 */
export function canUpgrade(currentPlan: PlanId, targetPlan: PlanId): boolean {
  const planOrder: PlanId[] = ['starter', 'pro', 'enterprise'];
  return planOrder.indexOf(targetPlan) > planOrder.indexOf(currentPlan);
}
