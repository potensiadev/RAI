import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimit,
  getClientIP,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS,
} from "@/lib/rate-limit";

// Mock NextRequest
function createMockRequest(headers: Record<string, string> = {}): {
  headers: { get: (key: string) => string | null };
} {
  return {
    headers: {
      get: (key: string) => headers[key] || null,
    },
  };
}

// ─────────────────────────────────────────────────
// getClientIP 테스트
//
// 보안 강화 버전:
// 우선순위: x-vercel-forwarded-for → cf-connecting-ip → x-real-ip → x-forwarded-for (마지막 공개 IP)
// 사설 IP (10.x, 172.16-31.x, 192.168.x, 127.x 등)는 무시
// ─────────────────────────────────────────────────

describe("getClientIP", () => {
  it("x-vercel-forwarded-for 헤더에서 IP 추출 (최우선)", () => {
    const request = createMockRequest({
      "x-vercel-forwarded-for": "192.0.2.1, 10.0.0.1",
    });
    // @ts-expect-error 테스트용 모의 객체
    const ip = getClientIP(request);
    expect(ip).toBe("192.0.2.1");
  });

  it("x-forwarded-for 헤더에서 마지막 공개 IP 추출", () => {
    const request = createMockRequest({
      "x-forwarded-for": "10.0.0.1, 192.0.2.1",
    });
    // @ts-expect-error 테스트용 모의 객체
    const ip = getClientIP(request);
    // 마지막 공개 IP인 192.0.2.1 반환 (10.0.0.1은 사설 IP)
    expect(ip).toBe("192.0.2.1");
  });

  it("cf-connecting-ip 헤더에서 IP 추출 (Cloudflare)", () => {
    const request = createMockRequest({
      "cf-connecting-ip": "203.0.113.1",
    });
    // @ts-expect-error 테스트용 모의 객체
    const ip = getClientIP(request);
    expect(ip).toBe("203.0.113.1");
  });

  it("x-real-ip 헤더에서 공개 IP 추출", () => {
    const request = createMockRequest({
      "x-real-ip": "198.51.100.1",
    });
    // @ts-expect-error 테스트용 모의 객체
    const ip = getClientIP(request);
    expect(ip).toBe("198.51.100.1");
  });

  it("x-real-ip가 사설 IP인 경우 unknown 반환", () => {
    const request = createMockRequest({
      "x-real-ip": "172.16.0.1",
    });
    // @ts-expect-error 테스트용 모의 객체
    const ip = getClientIP(request);
    // 172.16.0.1은 사설 IP (172.16.0.0/12)이므로 무시됨
    expect(ip).toBe("unknown");
  });

  it("헤더 없으면 unknown 반환", () => {
    const request = createMockRequest({});
    // @ts-expect-error 테스트용 모의 객체
    const ip = getClientIP(request);
    expect(ip).toBe("unknown");
  });

  it("cf-connecting-ip가 x-forwarded-for보다 우선", () => {
    const request = createMockRequest({
      "x-forwarded-for": "192.0.2.1",
      "cf-connecting-ip": "203.0.113.1",
      "x-real-ip": "198.51.100.1",
    });
    // @ts-expect-error 테스트용 모의 객체
    const ip = getClientIP(request);
    // x-vercel-forwarded-for 없으므로 cf-connecting-ip 사용
    expect(ip).toBe("203.0.113.1");
  });

  it("x-vercel-forwarded-for가 최우선", () => {
    const request = createMockRequest({
      "x-vercel-forwarded-for": "192.0.2.100",
      "x-forwarded-for": "192.0.2.1",
      "cf-connecting-ip": "203.0.113.1",
      "x-real-ip": "198.51.100.1",
    });
    // @ts-expect-error 테스트용 모의 객체
    const ip = getClientIP(request);
    expect(ip).toBe("192.0.2.100");
  });

  it("사설 IP가 포함된 x-forwarded-for에서 공개 IP만 추출", () => {
    const request = createMockRequest({
      "x-forwarded-for": "10.0.0.1, 192.168.1.1, 203.0.113.50",
    });
    // @ts-expect-error 테스트용 모의 객체
    const ip = getClientIP(request);
    // 마지막부터 순회하여 첫 공개 IP 반환
    expect(ip).toBe("203.0.113.50");
  });
});

// ─────────────────────────────────────────────────
// checkRateLimit 테스트
// ─────────────────────────────────────────────────

describe("checkRateLimit", () => {
  beforeEach(() => {
    // 캐시 초기화를 위해 새 식별자 사용
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("첫 요청은 성공", () => {
    const identifier = `test-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(identifier, { limit: 10, windowMs: 60000 });

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.limit).toBe(10);
  });

  it("제한 내 요청은 모두 성공", () => {
    const identifier = `test-${Date.now()}-${Math.random()}`;
    const config = { limit: 5, windowMs: 60000 };

    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(identifier, config);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it("제한 초과 시 실패", () => {
    const identifier = `test-${Date.now()}-${Math.random()}`;
    const config = { limit: 3, windowMs: 60000 };

    // 3번 성공
    for (let i = 0; i < 3; i++) {
      checkRateLimit(identifier, config);
    }

    // 4번째 실패
    const result = checkRateLimit(identifier, config);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("윈도우 만료 후 리셋", () => {
    const identifier = `test-${Date.now()}-${Math.random()}`;
    const config = { limit: 2, windowMs: 1000 }; // 1초

    // 2번 사용
    checkRateLimit(identifier, config);
    checkRateLimit(identifier, config);

    // 3번째 실패
    let result = checkRateLimit(identifier, config);
    expect(result.success).toBe(false);

    // 1초 후
    vi.advanceTimersByTime(1001);

    // 리셋되어 성공
    result = checkRateLimit(identifier, config);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("다른 식별자는 독립적", () => {
    const id1 = `test-${Date.now()}-1`;
    const id2 = `test-${Date.now()}-2`;
    const config = { limit: 2, windowMs: 60000 };

    // id1: 2번 사용
    checkRateLimit(id1, config);
    checkRateLimit(id1, config);

    // id1: 실패
    expect(checkRateLimit(id1, config).success).toBe(false);

    // id2: 성공 (독립적)
    expect(checkRateLimit(id2, config).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────
// getRateLimitHeaders 테스트
// ─────────────────────────────────────────────────

describe("getRateLimitHeaders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("성공 시 헤더 생성", () => {
    const result = {
      success: true,
      limit: 10,
      remaining: 5,
      reset: Date.now() + 60000,
    };

    const headers = getRateLimitHeaders(result);

    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("5");
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
    expect(headers["Retry-After"]).toBe("");
  });

  it("실패 시 Retry-After 포함", () => {
    const now = Date.now();
    const result = {
      success: false,
      limit: 10,
      remaining: 0,
      reset: now + 30000, // 30초 후
    };

    vi.setSystemTime(now);
    const headers = getRateLimitHeaders(result);

    expect(headers["Retry-After"]).toBe("30");
  });
});

// ─────────────────────────────────────────────────
// RATE_LIMIT_CONFIGS 테스트
//
// 현재 설정값:
// - upload: 50/분 (IP 기반, 사무실 공용 IP 대응)
// - search: 30/분
// - auth: 5/분 (브루트포스 방지)
// - export: 20/시간
// - default: 60/분
// ─────────────────────────────────────────────────

describe("RATE_LIMIT_CONFIGS", () => {
  it("업로드 설정 (IP 기반 분당 50회)", () => {
    expect(RATE_LIMIT_CONFIGS.upload.limit).toBe(50);
    expect(RATE_LIMIT_CONFIGS.upload.windowMs).toBe(60000);
  });

  it("검색 설정 (분당 30회)", () => {
    expect(RATE_LIMIT_CONFIGS.search.limit).toBe(30);
    expect(RATE_LIMIT_CONFIGS.search.windowMs).toBe(60000);
  });

  it("인증 설정 (브루트포스 방지, 분당 5회)", () => {
    expect(RATE_LIMIT_CONFIGS.auth.limit).toBe(5);
    expect(RATE_LIMIT_CONFIGS.auth.windowMs).toBe(60000);
  });

  it("내보내기 설정 (시간당 20회)", () => {
    expect(RATE_LIMIT_CONFIGS.export.limit).toBe(20);
    expect(RATE_LIMIT_CONFIGS.export.windowMs).toBe(3600000); // 1시간
  });

  it("기본 설정 (분당 60회)", () => {
    expect(RATE_LIMIT_CONFIGS.default.limit).toBe(60);
    expect(RATE_LIMIT_CONFIGS.default.windowMs).toBe(60000);
  });
});
