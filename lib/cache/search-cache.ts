/**
 * Search Result Caching with Upstash Redis (REST API)
 *
 * 헤드헌터 검색 경험 최적화를 위한 캐싱 전략:
 * - 인기 검색어: 10분 캐시 + 5분 stale-while-revalidate
 * - 일반 검색: 5분 캐시 + 1분 stale-while-revalidate
 * - 필터 조합: 3분 캐시 + 1분 stale-while-revalidate
 *
 * Upstash REST SDK 사용 - Serverless/Edge 환경 최적화
 */

import { Redis } from '@upstash/redis';
import type { SearchResponse, SearchFilters } from '@/types';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface CacheConfig {
  ttl: number;                    // 캐시 유효 시간 (초)
  staleWhileRevalidate: number;   // stale 허용 시간 (초)
}

interface CachedData {
  data: SearchResponse;
  timestamp: number;
  query: string;
  filters?: SearchFilters;
}

interface CacheResult {
  data: SearchResponse;
  fromCache: boolean;
  cacheAge?: number;      // 캐시 나이 (ms)
  isStale?: boolean;      // stale 여부
}

// ─────────────────────────────────────────────────
// Upstash Redis Client (Lazy Initialization)
// ─────────────────────────────────────────────────

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // 환경변수 미설정 시 캐싱 비활성화 (정상 동작)
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({
      url,
      token,
    });
  }

  return redisClient;
}

// ─────────────────────────────────────────────────
// Cache Strategies
// ─────────────────────────────────────────────────

const CACHE_STRATEGIES: Record<string, CacheConfig> = {
  // 인기 검색어: 오래 캐시, 백그라운드 갱신
  popular: {
    ttl: 600,                    // 10분
    staleWhileRevalidate: 300    // 5분 stale 허용
  },
  // 일반 검색: 적절한 캐시
  normal: {
    ttl: 300,                    // 5분
    staleWhileRevalidate: 60     // 1분 stale 허용
  },
  // 필터 조합: 짧은 캐시 (조합이 많으므로)
  filtered: {
    ttl: 180,                    // 3분
    staleWhileRevalidate: 60     // 1분 stale 허용
  },
};

// 인기 검색어 목록 (실제로는 검색 로그 분석으로 동적 생성 권장)
const POPULAR_QUERIES = new Set([
  // Frontend
  'react', 'vue', 'angular', 'frontend', 'front-end', '프론트엔드',
  'javascript', 'typescript', 'next.js', 'nextjs',

  // Backend
  'backend', 'back-end', '백엔드', 'node', 'nodejs', 'node.js',
  'java', 'spring', 'python', 'django', 'fastapi',
  'go', 'golang', 'rust',

  // Fullstack & DevOps
  'fullstack', 'full-stack', '풀스택',
  'devops', 'sre', 'kubernetes', 'k8s', 'docker', 'aws',

  // Mobile
  'ios', 'android', 'mobile', '모바일', 'flutter', 'react native',

  // Data & AI
  'data', 'ml', 'machine learning', 'ai', '데이터', 'data engineer',
  'pytorch', 'tensorflow',

  // General
  '개발자', 'developer', 'engineer', 'senior', 'junior', 'lead',
]);

// ─────────────────────────────────────────────────
// Cache Key Generation
// ─────────────────────────────────────────────────

/**
 * 검색 캐시 키 생성
 * 쿼리와 필터를 정규화하여 일관된 키 생성
 */
export function generateCacheKey(
  userId: string,
  query: string,
  filters?: SearchFilters
): string {
  // 쿼리 정규화
  const normalizedQuery = query.toLowerCase().trim();

  // 필터 정규화 (undefined 값 제거, 키 정렬)
  const normalizedFilters = filters ? normalizeFilters(filters) : null;

  // 키 생성
  const keyParts = [
    'search',
    userId.slice(0, 8),  // user prefix (프라이버시)
    normalizedQuery || '_all',
    normalizedFilters ? hashFilters(normalizedFilters) : '_nofilter'
  ];

  return keyParts.join(':');
}

/**
 * 필터 정규화 - undefined/null 값 제거
 */
function normalizeFilters(filters: SearchFilters): SearchFilters | null {
  const normalized: SearchFilters = {};
  let hasValue = false;

  if (filters.expYearsMin !== undefined && filters.expYearsMin !== null) {
    normalized.expYearsMin = filters.expYearsMin;
    hasValue = true;
  }
  if (filters.expYearsMax !== undefined && filters.expYearsMax !== null) {
    normalized.expYearsMax = filters.expYearsMax;
    hasValue = true;
  }
  if (filters.skills && filters.skills.length > 0) {
    normalized.skills = [...filters.skills].sort();
    hasValue = true;
  }
  if (filters.location) {
    normalized.location = filters.location.toLowerCase().trim();
    hasValue = true;
  }
  if (filters.companies && filters.companies.length > 0) {
    normalized.companies = [...filters.companies].sort();
    hasValue = true;
  }
  if (filters.excludeCompanies && filters.excludeCompanies.length > 0) {
    normalized.excludeCompanies = [...filters.excludeCompanies].sort();
    hasValue = true;
  }
  if (filters.educationLevel) {
    normalized.educationLevel = filters.educationLevel;
    hasValue = true;
  }

  return hasValue ? normalized : null;
}

/**
 * 필터를 짧은 해시로 변환
 */
function hashFilters(filters: SearchFilters): string {
  const str = JSON.stringify(filters);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ─────────────────────────────────────────────────
// Cache Strategy Selection
// ─────────────────────────────────────────────────

/**
 * 검색 패턴에 따른 캐시 전략 선택
 */
export function getCacheStrategy(
  query: string,
  hasFilters: boolean
): CacheConfig {
  const normalizedQuery = query.toLowerCase().trim();

  // 인기 검색어 체크
  if (normalizedQuery && POPULAR_QUERIES.has(normalizedQuery)) {
    return CACHE_STRATEGIES.popular;
  }

  // 필터가 있으면 짧은 캐시
  if (hasFilters) {
    return CACHE_STRATEGIES.filtered;
  }

  return CACHE_STRATEGIES.normal;
}

// ─────────────────────────────────────────────────
// Lock Utilities (Cache Stampede Prevention)
// ─────────────────────────────────────────────────

/**
 * 분산 락 획득 (SETNX 패턴)
 * Cache stampede 방지를 위해 동시 요청 중 하나만 DB 조회
 */
async function acquireLock(key: string, ttlSeconds: number = 5): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) return true; // Redis 없으면 락 불필요

    const lockKey = `lock:${key}`;
    const result = await client.set(lockKey, '1', { nx: true, ex: ttlSeconds });
    return result === 'OK';
  } catch (error) {
    console.error('[SearchCache] Lock acquire error:', error);
    return true; // 락 실패 시 진행 허용 (가용성 우선)
  }
}

/**
 * 분산 락 해제
 */
async function releaseLock(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    const lockKey = `lock:${key}`;
    await client.del(lockKey);
  } catch (error) {
    console.error('[SearchCache] Lock release error:', error);
    // 락 해제 실패는 TTL로 자동 해제되므로 무시
  }
}

/**
 * 지연 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────
// Cache Operations
// ─────────────────────────────────────────────────

/**
 * 캐시에서 검색 결과 조회 (SWR 패턴)
 */
export async function getSearchFromCache(
  key: string,
  strategy: CacheConfig
): Promise<CacheResult | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;

    const cached = await client.get<CachedData>(key);
    if (!cached) return null;

    const now = Date.now();
    const age = now - cached.timestamp;
    const ttlMs = strategy.ttl * 1000;
    const staleMs = strategy.staleWhileRevalidate * 1000;

    // 완전 만료 체크
    const isExpired = age > (ttlMs + staleMs);
    if (isExpired) {
      // 만료된 캐시 삭제
      await client.del(key);
      return null;
    }

    // Stale 체크
    const isStale = age > ttlMs;

    return {
      data: cached.data,
      fromCache: true,
      cacheAge: age,
      isStale,
    };
  } catch (error) {
    console.error('[SearchCache] Get error:', error);
    return null;
  }
}

/**
 * 검색 결과를 캐시에 저장
 */
export async function setSearchCache(
  key: string,
  data: SearchResponse,
  query: string,
  filters: SearchFilters | undefined,
  strategy: CacheConfig
): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    const cacheData: CachedData = {
      data,
      timestamp: Date.now(),
      query,
      filters,
    };

    // TTL + stale 시간만큼 저장
    const totalTtl = strategy.ttl + strategy.staleWhileRevalidate;

    await client.setex(key, totalTtl, cacheData);
  } catch (error) {
    console.error('[SearchCache] Set error:', error);
    // 캐시 실패는 무시 (검색은 정상 동작)
  }
}

/**
 * 특정 사용자의 검색 캐시 무효화
 * (후보자 데이터 변경 시 호출)
 */
export async function invalidateUserSearchCache(userId: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    const pattern = `search:${userId.slice(0, 8)}:*`;

    // Upstash scan으로 키 검색 (cursor는 string 타입)
    let cursor = "0";
    const keysToDelete: string[] = [];

    do {
      const result = await client.scan(cursor, { match: pattern, count: 100 });
      cursor = String(result[0]);
      keysToDelete.push(...result[1]);
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      // 배치 삭제
      await Promise.all(keysToDelete.map(key => client.del(key)));
      console.log(`[SearchCache] Invalidated ${keysToDelete.length} cache entries for user ${userId.slice(0, 8)}`);
    }
  } catch (error) {
    console.error('[SearchCache] Invalidation error:', error);
  }
}

/**
 * Stale-While-Revalidate 패턴 구현 (Cache Stampede 방지)
 * - 캐시가 stale이면 백그라운드에서 갱신
 * - 동시 요청 시 SETNX 락으로 하나의 요청만 DB 조회
 */
export async function getSearchWithSWR(
  key: string,
  fetchFn: () => Promise<SearchResponse>,
  query: string,
  filters: SearchFilters | undefined,
  strategy: CacheConfig
): Promise<CacheResult> {
  // 1. 캐시 확인
  const cached = await getSearchFromCache(key, strategy);

  if (cached) {
    // 2. Stale이면 백그라운드 갱신 (사용자는 기다리지 않음)
    if (cached.isStale) {
      revalidateInBackground(key, fetchFn, query, filters, strategy);
    }
    return cached;
  }

  // 3. 캐시 미스 - 락 획득 시도 (Cache Stampede 방지)
  const lockAcquired = await acquireLock(key);

  if (!lockAcquired) {
    // 다른 요청이 처리 중 - 잠시 대기 후 캐시 재확인
    await delay(100);
    const retryCache = await getSearchFromCache(key, strategy);
    if (retryCache) {
      return retryCache;
    }

    // 여전히 캐시 없음 - 한 번 더 대기 후 재확인
    await delay(150);
    const finalRetry = await getSearchFromCache(key, strategy);
    if (finalRetry) {
      return finalRetry;
    }

    // 최종 fallback: 락 없이 진행 (가용성 우선)
    console.warn('[SearchCache] Lock wait timeout, proceeding without lock');
  }

  try {
    // 4. Double-check: 대기 중 다른 요청이 캐시를 채웠을 수 있음
    if (lockAcquired) {
      const doubleCheck = await getSearchFromCache(key, strategy);
      if (doubleCheck) {
        return doubleCheck;
      }
    }

    // 5. DB 조회
    const data = await fetchFn();

    // 6. 결과 캐싱
    await setSearchCache(key, data, query, filters, strategy);

    return {
      data,
      fromCache: false,
    };
  } finally {
    // 7. 락 해제 (획득한 경우에만)
    if (lockAcquired) {
      await releaseLock(key);
    }
  }
}

/**
 * 백그라운드에서 캐시 갱신 (Fire-and-forget)
 */
function revalidateInBackground(
  key: string,
  fetchFn: () => Promise<SearchResponse>,
  query: string,
  filters: SearchFilters | undefined,
  strategy: CacheConfig
): void {
  // Promise를 await 하지 않음 (백그라운드 실행)
  fetchFn()
    .then(data => {
      setSearchCache(key, data, query, filters, strategy);
      console.log(`[SearchCache] Background revalidation completed for: ${key}`);
    })
    .catch(error => {
      console.error('[SearchCache] Background revalidation failed:', error);
    });
}

// ─────────────────────────────────────────────────
// Prefetch for Popular Queries
// ─────────────────────────────────────────────────

/**
 * 인기 검색어 프리페치 (선택적)
 * 서버 시작 시 또는 주기적으로 호출
 */
export function getPopularQueries(): string[] {
  return Array.from(POPULAR_QUERIES).slice(0, 20);
}

/**
 * 캐시 통계 조회 (모니터링용)
 */
export async function getCacheStats(userId: string): Promise<{
  totalKeys: number;
  oldestCache?: number;
}> {
  try {
    const client = getRedisClient();
    if (!client) return { totalKeys: 0 };

    const pattern = `search:${userId.slice(0, 8)}:*`;

    let cursor = "0";
    let totalKeys = 0;

    do {
      const result = await client.scan(cursor, { match: pattern, count: 100 });
      cursor = String(result[0]);
      totalKeys += result[1].length;
    } while (cursor !== "0");

    return { totalKeys };
  } catch (error) {
    console.error('[SearchCache] Stats error:', error);
    return { totalKeys: 0 };
  }
}

/**
 * Redis 연결 상태 확인
 */
export async function isCacheEnabled(): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) return false;

    // Upstash ping
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
