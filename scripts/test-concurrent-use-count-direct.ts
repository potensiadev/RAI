/**
 * Saved Search Use Count 동시성 테스트 (Supabase 직접 연결)
 *
 * PRD Acceptance Criteria:
 * - 100 concurrent requests
 * - 결과 일관성 99.99% 이상
 *
 * 사용법:
 * npx ts-node scripts/test-concurrent-use-count-direct.ts
 *
 * 환경변수 (.env.local에서 자동 로드):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - CONCURRENT_REQUESTS (기본: 100)
 * - TEST_USER_EMAIL (테스트할 사용자 이메일)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 로드
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CONFIG = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS || '100'),
  testUserEmail: process.env.TEST_USER_EMAIL || '',
};

interface TestResult {
  requestId: number;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'success' | 'error';
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

// Supabase 클라이언트 생성
function createSupabaseClient(): SupabaseClient {
  return createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// 테스트 사용자 ID 조회
async function getTestUserId(supabase: SupabaseClient): Promise<string> {
  // 테스트 이메일이 제공되면 해당 사용자 찾기
  if (CONFIG.testUserEmail) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', CONFIG.testUserEmail)
      .single();

    if (error || !data) {
      throw new Error(`사용자를 찾을 수 없습니다: ${CONFIG.testUserEmail}`);
    }
    return data.id;
  }

  // 아니면 첫 번째 사용자 사용
  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error('테스트할 사용자가 없습니다.');
  }

  console.log(`📧 테스트 사용자: ${data.email}`);
  return data.id;
}

// 테스트용 Saved Search 생성
async function createTestSavedSearch(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  console.log('📝 테스트용 Saved Search 생성 중...');

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      user_id: userId,
      name: `concurrency_test_${Date.now()}`,
      query: 'React Developer',
      filters: { skills: ['React', 'TypeScript'] },
      use_count: 0,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Saved Search 생성 실패: ${error?.message}`);
  }

  console.log(`✅ Saved Search 생성됨: ${data.id}`);
  return data.id;
}

// 현재 use_count 조회
async function getCurrentUseCount(
  supabase: SupabaseClient,
  searchId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('use_count')
    .eq('id', searchId)
    .single();

  if (error) {
    throw new Error(`use_count 조회 실패: ${error.message}`);
  }

  return data?.use_count || 0;
}

// RPC 호출 (단일 요청)
async function callIncrementRpc(
  supabase: SupabaseClient,
  requestId: number,
  searchId: string,
  userId: string
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc(
      'increment_saved_search_use_count',
      {
        search_id: searchId,
        requesting_user_id: userId,
      }
    );

    const endTime = Date.now();

    if (error) {
      return {
        requestId,
        startTime,
        endTime,
        duration: endTime - startTime,
        status: 'error',
        error: error.message,
      };
    }

    const result = Array.isArray(data) ? data[0] : data;

    return {
      requestId,
      startTime,
      endTime,
      duration: endTime - startTime,
      status: 'success',
      newUseCount: result?.new_use_count,
    };
  } catch (err) {
    const endTime = Date.now();
    return {
      requestId,
      startTime,
      endTime,
      duration: endTime - startTime,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// 동시 요청 실행
async function runConcurrencyTest(
  searchId: string,
  userId: string
): Promise<TestResult[]> {
  console.log(`\n🚀 ${CONFIG.concurrentRequests}개 동시 요청 시작...`);
  console.log('   (모든 요청이 동시에 발사됩니다)\n');

  const startTime = Date.now();

  // 각 요청에 대해 별도의 Supabase 클라이언트 생성 (실제 동시성 시뮬레이션)
  const promises = Array.from({ length: CONFIG.concurrentRequests }, (_, i) => {
    const supabase = createSupabaseClient();
    return callIncrementRpc(supabase, i + 1, searchId, userId);
  });

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
  const durations = results.map((r) => r.duration);
  const successResults = results.filter((r) => r.status === 'success');
  const errorResults = results.filter((r) => r.status !== 'success');

  const expectedUseCount = initialUseCount + CONFIG.concurrentRequests;
  const actualIncrement = finalUseCount - initialUseCount;
  const isConsistent = finalUseCount === expectedUseCount;
  const consistencyRate = (actualIncrement / CONFIG.concurrentRequests) * 100;

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
  console.log('       동시성 테스트 결과 (Saved Search Use Count)');
  console.log('       [Supabase RPC 직접 호출]');
  console.log('═'.repeat(60));

  console.log('\n📊 요청 통계:');
  console.log(`   총 요청 수: ${stats.totalRequests}`);
  console.log(
    `   성공: ${stats.successCount} (${((stats.successCount / stats.totalRequests) * 100).toFixed(1)}%)`
  );
  console.log(
    `   실패: ${stats.errorCount} (${((stats.errorCount / stats.totalRequests) * 100).toFixed(1)}%)`
  );

  console.log('\n⏱️  응답 시간 (ms):');
  console.log(`   최소: ${stats.minDuration}`);
  console.log(`   최대: ${stats.maxDuration}`);
  console.log(`   평균: ${stats.avgDuration.toFixed(0)}`);
  console.log(`   P50: ${stats.p50Duration}`);
  console.log(`   P95: ${stats.p95Duration}`);
  console.log(`   P99: ${stats.p99Duration}`);

  console.log('\n🔢 Use Count 검증:');
  console.log(`   초기 값: ${initialUseCount}`);
  console.log(
    `   예상 값: ${stats.expectedUseCount} (초기 + ${CONFIG.concurrentRequests})`
  );
  console.log(`   실제 값: ${stats.actualUseCount}`);
  console.log(`   증가량: ${stats.actualUseCount - initialUseCount}`);

  console.log('\n' + '─'.repeat(60));

  if (stats.isConsistent && stats.errorCount === 0) {
    console.log('✅ 테스트 통과!');
    console.log('   Race Condition 없음 - Atomic increment 정상 동작');
    console.log(
      `   일관성: 100% (${stats.actualUseCount - initialUseCount}/${CONFIG.concurrentRequests})`
    );
  } else if (stats.actualUseCount - initialUseCount === stats.successCount) {
    console.log('⚠️  테스트 부분 통과');
    console.log(`   성공한 요청만큼 정확히 증가함`);
    console.log(`   실패한 요청: ${stats.errorCount}개`);
    console.log(`   일관성: ${stats.consistencyRate.toFixed(2)}%`);
  } else {
    console.log('❌ 테스트 실패!');
    console.log('   Race Condition 감지됨!');
    console.log(`   누락된 증가: ${stats.expectedUseCount - stats.actualUseCount}`);
    console.log(`   일관성: ${stats.consistencyRate.toFixed(2)}%`);
  }

  console.log('─'.repeat(60));

  // PRD 기준 평가
  console.log('\n📋 PRD Acceptance Criteria 평가:');
  console.log(
    `   [${CONFIG.concurrentRequests >= 100 ? '✓' : '✗'}] 100 concurrent requests`
  );
  console.log(
    `   [${stats.consistencyRate >= 99.99 ? '✓' : '✗'}] 결과 일관성 99.99% 이상 (실제: ${stats.consistencyRate.toFixed(2)}%)`
  );

  const passed =
    CONFIG.concurrentRequests >= 100 && stats.consistencyRate >= 99.99;
  console.log(`\n   최종 결과: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n' + '═'.repeat(60));
}

// 테스트용 Saved Search 삭제
async function deleteTestSavedSearch(
  supabase: SupabaseClient,
  searchId: string
): Promise<void> {
  try {
    await supabase.from('saved_searches').delete().eq('id', searchId);
    console.log('\n🗑️  테스트용 Saved Search 삭제됨');
  } catch {
    console.log('\n⚠️  테스트용 Saved Search 삭제 실패 (수동 삭제 필요)');
  }
}

// 메인 실행
async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log('      Saved Search Use Count 동시성 테스트');
  console.log('      [Supabase RPC 직접 호출 버전]');
  console.log('═'.repeat(60));

  console.log(`\n🔧 설정:`);
  console.log(`   Supabase URL: ${CONFIG.supabaseUrl ? '✓ 설정됨' : '❌ 미설정'}`);
  console.log(
    `   Service Role Key: ${CONFIG.supabaseServiceKey ? '✓ 설정됨' : '❌ 미설정'}`
  );
  console.log(`   동시 요청 수: ${CONFIG.concurrentRequests}`);

  if (!CONFIG.supabaseUrl || !CONFIG.supabaseServiceKey) {
    console.error('\n❌ ERROR: Supabase 환경변수가 필요합니다.');
    console.log('\n.env.local 파일에 다음 값들이 설정되어 있는지 확인하세요:');
    console.log('  - NEXT_PUBLIC_SUPABASE_URL');
    console.log('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createSupabaseClient();
  let searchId: string | null = null;

  try {
    // 1. 테스트 사용자 ID 조회
    const userId = await getTestUserId(supabase);
    console.log(`👤 테스트 사용자 ID: ${userId}`);

    // 2. 테스트용 Saved Search 생성
    searchId = await createTestSavedSearch(supabase, userId);

    // 3. 초기 use_count 확인
    const initialUseCount = await getCurrentUseCount(supabase, searchId);
    console.log(`📊 초기 use_count: ${initialUseCount}`);

    // 4. 동시 요청 실행
    const results = await runConcurrencyTest(searchId, userId);

    // 5. 최종 use_count 확인
    const finalUseCount = await getCurrentUseCount(supabase, searchId);

    // 6. 결과 분석
    const stats = calculateStats(results, initialUseCount, finalUseCount);
    printResults(stats, initialUseCount);

    // 7. 에러 상세 (있는 경우)
    const errors = results.filter((r) => r.status !== 'success');
    if (errors.length > 0) {
      console.log('\n❌ 실패한 요청 상세:');
      errors.slice(0, 10).forEach((e) => {
        console.log(`   Request #${e.requestId}: ${e.error}`);
      });
      if (errors.length > 10) {
        console.log(`   ... 외 ${errors.length - 10}개`);
      }
    }

    // 8. use_count 시퀀스 분석
    const successResults = results
      .filter((r) => r.status === 'success' && r.newUseCount !== undefined)
      .sort((a, b) => (a.newUseCount || 0) - (b.newUseCount || 0));

    if (successResults.length > 0) {
      console.log('\n📈 Use Count 시퀀스 분석:');
      const useCounts = successResults.map((r) => r.newUseCount!);
      const minCount = Math.min(...useCounts);
      const maxCount = Math.max(...useCounts);
      console.log(`   범위: ${minCount} ~ ${maxCount}`);

      // 누락된 시퀀스 확인
      const expectedSequence = new Set(
        Array.from({ length: maxCount - minCount + 1 }, (_, i) => minCount + i)
      );
      const actualSequence = new Set(useCounts);
      const missing = [...expectedSequence].filter((n) => !actualSequence.has(n));

      if (missing.length === 0) {
        console.log('   시퀀스: ✓ 연속 (누락 없음)');
      } else {
        console.log(`   시퀀스: ✗ 누락됨 (${missing.join(', ')})`);
      }

      // 중복 확인
      const duplicates = useCounts.filter(
        (n, i) => useCounts.indexOf(n) !== i
      );
      if (duplicates.length === 0) {
        console.log('   중복: ✓ 없음');
      } else {
        console.log(`   중복: ✗ ${duplicates.length}개 발생`);
      }
    }
  } catch (error) {
    console.error('\n❌ 테스트 실행 중 오류:', error);
    process.exit(1);
  } finally {
    // 9. 정리 (테스트용 Saved Search 삭제)
    if (searchId) {
      await deleteTestSavedSearch(supabase, searchId);
    }
  }
}

main();
