/**
 * Saved Search Use Count 동시성 테스트
 *
 * PRD Acceptance Criteria:
 * - 100 concurrent requests
 * - 결과 일관성 99.99% 이상
 *
 * 사용법:
 * npx ts-node scripts/test-concurrent-use-count.ts
 *
 * 환경변수:
 * - TEST_API_URL: API 서버 URL (기본: http://localhost:3000)
 * - TEST_AUTH_TOKEN: 인증 토큰 (필수)
 * - CONCURRENT_REQUESTS: 동시 요청 수 (기본: 100)
 */

// 테스트 설정
const CONFIG = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3000',
  authToken: process.env.TEST_AUTH_TOKEN || '',
  concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS || '100'),
};

interface TestResult {
  requestId: number;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  httpStatus?: number;
  newUseCount?: number;
  error?: string;
}

interface TestStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  expectedUseCount: number;
  actualUseCount: number;
  isConsistent: boolean;
  consistencyRate: number;
}

// 테스트용 Saved Search 생성
async function createTestSavedSearch(authToken: string): Promise<string> {
  console.log('📝 테스트용 Saved Search 생성 중...');

  const response = await fetch(`${CONFIG.apiUrl}/api/saved-searches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `concurrency_test_${Date.now()}`,
      query: 'React Developer',
      filters: { skills: ['React', 'TypeScript'] },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Saved Search 생성 실패: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const searchId = data.data?.id;

  if (!searchId) {
    throw new Error('Saved Search ID를 찾을 수 없습니다.');
  }

  console.log(`✅ Saved Search 생성됨: ${searchId}`);
  return searchId;
}

// 현재 use_count 조회
async function getCurrentUseCount(authToken: string, searchId: string): Promise<number> {
  const response = await fetch(`${CONFIG.apiUrl}/api/saved-searches/${searchId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Saved Search 조회 실패: ${response.status}`);
  }

  const data = await response.json();
  return data.data?.use_count || 0;
}

// 단일 use 요청
async function sendUseRequest(
  requestId: number,
  searchId: string,
  authToken: string
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    const response = await fetch(`${CONFIG.apiUrl}/api/saved-searches/${searchId}/use`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const endTime = Date.now();
    const responseData = await response.json().catch(() => null);

    return {
      requestId,
      startTime,
      endTime,
      duration: endTime - startTime,
      status: response.ok ? 'success' : 'error',
      httpStatus: response.status,
      newUseCount: responseData?.data?.new_use_count,
      error: response.ok ? undefined : (responseData?.error || `HTTP ${response.status}`),
    };
  } catch (error) {
    const endTime = Date.now();
    const isTimeout = error instanceof Error && error.name === 'AbortError';

    return {
      requestId,
      startTime,
      endTime,
      duration: endTime - startTime,
      status: isTimeout ? 'timeout' : 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 동시 요청 실행
async function runConcurrencyTest(searchId: string, authToken: string): Promise<TestResult[]> {
  console.log(`\n🚀 ${CONFIG.concurrentRequests}개 동시 요청 시작...`);
  console.log('   (모든 요청이 동시에 발사됩니다)\n');

  const startTime = Date.now();

  // 모든 요청을 동시에 발사
  const promises = Array.from({ length: CONFIG.concurrentRequests }, (_, i) =>
    sendUseRequest(i + 1, searchId, authToken)
  );

  const results = await Promise.all(promises);

  const totalTime = Date.now() - startTime;
  console.log(`⏱️  전체 실행 시간: ${totalTime}ms\n`);

  return results;
}

// 백분위수 계산
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
}

// 통계 계산
function calculateStats(
  results: TestResult[],
  initialUseCount: number,
  finalUseCount: number
): TestStats {
  const durations = results.map(r => r.duration);
  const successResults = results.filter(r => r.status === 'success');
  const errorResults = results.filter(r => r.status !== 'success');

  const expectedUseCount = initialUseCount + CONFIG.concurrentRequests;
  const isConsistent = finalUseCount === expectedUseCount;
  const consistencyRate = (successResults.length / CONFIG.concurrentRequests) * 100;

  return {
    totalRequests: results.length,
    successCount: successResults.length,
    errorCount: errorResults.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    p50Duration: percentile(durations, 50),
    p95Duration: percentile(durations, 95),
    p99Duration: percentile(durations, 99),
    expectedUseCount,
    actualUseCount: finalUseCount,
    isConsistent,
    consistencyRate,
  };
}

// 결과 출력
function printResults(stats: TestStats, initialUseCount: number): void {
  console.log('═'.repeat(60));
  console.log('             동시성 테스트 결과 (Saved Search Use Count)');
  console.log('═'.repeat(60));

  console.log('\n📊 요청 통계:');
  console.log(`   총 요청 수: ${stats.totalRequests}`);
  console.log(`   성공: ${stats.successCount} (${(stats.successCount / stats.totalRequests * 100).toFixed(1)}%)`);
  console.log(`   실패: ${stats.errorCount} (${(stats.errorCount / stats.totalRequests * 100).toFixed(1)}%)`);

  console.log('\n⏱️  응답 시간 (ms):');
  console.log(`   최소: ${stats.minDuration}`);
  console.log(`   최대: ${stats.maxDuration}`);
  console.log(`   평균: ${stats.avgDuration.toFixed(0)}`);
  console.log(`   P50: ${stats.p50Duration}`);
  console.log(`   P95: ${stats.p95Duration}`);
  console.log(`   P99: ${stats.p99Duration}`);

  console.log('\n🔢 Use Count 검증:');
  console.log(`   초기 값: ${initialUseCount}`);
  console.log(`   예상 값: ${stats.expectedUseCount} (초기 + ${CONFIG.concurrentRequests})`);
  console.log(`   실제 값: ${stats.actualUseCount}`);

  console.log('\n' + '─'.repeat(60));

  if (stats.isConsistent && stats.errorCount === 0) {
    console.log('✅ 테스트 통과!');
    console.log(`   Race Condition 없음 - Atomic increment 정상 동작`);
    console.log(`   일관성: 100% (${stats.actualUseCount}/${stats.expectedUseCount})`);
  } else if (stats.isConsistent) {
    console.log('⚠️  테스트 부분 통과');
    console.log(`   Use Count는 정확하지만 ${stats.errorCount}개 요청 실패`);
    console.log(`   일관성: ${stats.consistencyRate.toFixed(2)}%`);
  } else {
    console.log('❌ 테스트 실패!');
    console.log(`   Race Condition 감지됨!`);
    console.log(`   누락된 증가: ${stats.expectedUseCount - stats.actualUseCount}`);
    console.log(`   일관성: ${((stats.actualUseCount - initialUseCount) / CONFIG.concurrentRequests * 100).toFixed(2)}%`);
  }

  console.log('─'.repeat(60));

  // PRD 기준 평가
  console.log('\n📋 PRD Acceptance Criteria 평가:');
  console.log(`   - [${CONFIG.concurrentRequests >= 100 ? '✓' : '✗'}] 100 concurrent requests`);
  console.log(`   - [${stats.consistencyRate >= 99.99 ? '✓' : '✗'}] 결과 일관성 99.99% 이상 (실제: ${stats.consistencyRate.toFixed(2)}%)`);

  console.log('\n' + '═'.repeat(60));
}

// 테스트용 Saved Search 삭제
async function deleteTestSavedSearch(authToken: string, searchId: string): Promise<void> {
  try {
    await fetch(`${CONFIG.apiUrl}/api/saved-searches/${searchId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    console.log('\n🗑️  테스트용 Saved Search 삭제됨');
  } catch {
    console.log('\n⚠️  테스트용 Saved Search 삭제 실패 (수동 삭제 필요)');
  }
}

// 메인 실행
async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log('        Saved Search Use Count 동시성 테스트');
  console.log('═'.repeat(60));
  console.log(`\n🔧 설정:`);
  console.log(`   API URL: ${CONFIG.apiUrl}`);
  console.log(`   동시 요청 수: ${CONFIG.concurrentRequests}`);

  if (!CONFIG.authToken) {
    console.error('\n❌ ERROR: TEST_AUTH_TOKEN 환경변수가 필요합니다.');
    console.log('\n사용법:');
    console.log('  TEST_AUTH_TOKEN=your_token npx ts-node scripts/test-concurrent-use-count.ts');
    process.exit(1);
  }

  let searchId: string | null = null;

  try {
    // 1. 테스트용 Saved Search 생성
    searchId = await createTestSavedSearch(CONFIG.authToken);

    // 2. 초기 use_count 확인
    const initialUseCount = await getCurrentUseCount(CONFIG.authToken, searchId);
    console.log(`📊 초기 use_count: ${initialUseCount}`);

    // 3. 동시 요청 실행
    const results = await runConcurrencyTest(searchId, CONFIG.authToken);

    // 4. 최종 use_count 확인
    const finalUseCount = await getCurrentUseCount(CONFIG.authToken, searchId);

    // 5. 결과 분석
    const stats = calculateStats(results, initialUseCount, finalUseCount);
    printResults(stats, initialUseCount);

    // 6. 에러 상세 (있는 경우)
    const errors = results.filter(r => r.status !== 'success');
    if (errors.length > 0) {
      console.log('\n❌ 실패한 요청 상세:');
      errors.slice(0, 10).forEach(e => {
        console.log(`   Request #${e.requestId}: ${e.error || `HTTP ${e.httpStatus}`}`);
      });
      if (errors.length > 10) {
        console.log(`   ... 외 ${errors.length - 10}개`);
      }
    }

  } catch (error) {
    console.error('\n❌ 테스트 실행 중 오류:', error);
    process.exit(1);
  } finally {
    // 7. 정리 (테스트용 Saved Search 삭제)
    if (searchId) {
      await deleteTestSavedSearch(CONFIG.authToken, searchId);
    }
  }
}

main();
