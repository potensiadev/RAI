/**
 * Rate Limiter for Upload API
 *
 * 동시 업로드 제한을 위한 Rate Limiter
 * - 인메모리 기본 구현 (Vercel Serverless 환경)
 * - Redis/Upstash 확장 가능
 */

/**
 * Rate Limit 결과
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp (seconds)
  retryAfter?: number; // 재시도까지 남은 시간 (seconds)
}

/**
 * Rate Limiter 설정
 */
export interface RateLimiterConfig {
  /** 윈도우 크기 (밀리초) */
  windowMs: number;
  /** 윈도우당 최대 요청 수 */
  maxRequests: number;
  /** 키 접두사 (Redis 사용 시) */
  keyPrefix?: string;
}

/**
 * 인메모리 슬라이딩 윈도우 Rate Limiter
 *
 * 주의: Serverless 환경에서는 인스턴스 간 상태 공유가 안 됨
 * 프로덕션에서는 Redis/Upstash 사용 권장
 */
class InMemoryRateLimiter {
  private windows: Map<string, number[]> = new Map();
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;

    // 메모리 누수 방지: 오래된 항목 정리
    setInterval(() => this.cleanup(), config.windowMs);
  }

  /**
   * Rate Limit 체크
   */
  async limit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // 현재 윈도우의 타임스탬프 목록 가져오기
    let timestamps = this.windows.get(key) || [];

    // 윈도우 밖의 오래된 타임스탬프 제거
    timestamps = timestamps.filter(ts => ts > windowStart);

    // 현재 요청 수 확인
    const currentCount = timestamps.length;
    const remaining = Math.max(0, this.config.maxRequests - currentCount);
    const reset = Math.floor((now + this.config.windowMs) / 1000);

    if (currentCount >= this.config.maxRequests) {
      // Rate limit 초과
      const oldestTimestamp = timestamps[0] || now;
      const retryAfter = Math.ceil((oldestTimestamp + this.config.windowMs - now) / 1000);

      return {
        success: false,
        limit: this.config.maxRequests,
        remaining: 0,
        reset,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // 현재 요청 기록
    timestamps.push(now);
    this.windows.set(key, timestamps);

    return {
      success: true,
      limit: this.config.maxRequests,
      remaining: remaining - 1,
      reset,
    };
  }

  /**
   * 오래된 윈도우 정리
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, timestamps] of this.windows.entries()) {
      const validTimestamps = timestamps.filter(ts => ts > windowStart);
      if (validTimestamps.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, validTimestamps);
      }
    }
  }

  /**
   * 특정 키의 Rate Limit 초기화
   */
  reset(key: string): void {
    this.windows.delete(key);
  }
}

/**
 * 업로드 Rate Limiter (사용자별)
 * - 분당 10개 업로드 제한
 */
export const uploadRateLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000, // 1분
  maxRequests: parseInt(process.env.UPLOAD_RATE_LIMIT_PER_MINUTE || '10'),
  keyPrefix: 'upload',
});

/**
 * 글로벌 Rate Limiter (전체 시스템)
 * - 분당 100개 업로드 제한 (전체)
 */
export const globalUploadRateLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000, // 1분
  maxRequests: parseInt(process.env.GLOBAL_UPLOAD_RATE_LIMIT_PER_MINUTE || '100'),
  keyPrefix: 'global_upload',
});

/**
 * 버스트 Rate Limiter (짧은 시간 폭주 방지)
 * - 10초당 3개 업로드 제한
 */
export const burstRateLimiter = new InMemoryRateLimiter({
  windowMs: 10 * 1000, // 10초
  maxRequests: parseInt(process.env.UPLOAD_BURST_LIMIT || '3'),
  keyPrefix: 'burst',
});

/**
 * 복합 Rate Limit 체크
 * - 버스트 + 사용자별 + 글로벌 순서로 체크
 */
export async function checkUploadRateLimit(userId: string): Promise<RateLimitResult> {
  // 1. 버스트 체크 (10초당 3개)
  const burstResult = await burstRateLimiter.limit(userId);
  if (!burstResult.success) {
    return {
      ...burstResult,
      remaining: 0,
    };
  }

  // 2. 사용자별 체크 (분당 10개)
  const userResult = await uploadRateLimiter.limit(userId);
  if (!userResult.success) {
    return userResult;
  }

  // 3. 글로벌 체크 (분당 100개)
  const globalResult = await globalUploadRateLimiter.limit('global');
  if (!globalResult.success) {
    return {
      ...globalResult,
      // 글로벌 제한 시에도 사용자에게는 일반 메시지
    };
  }

  // 모든 체크 통과
  return {
    success: true,
    limit: userResult.limit,
    remaining: userResult.remaining,
    reset: userResult.reset,
  };
}

/**
 * Rate Limit 헤더 생성
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}
