/**
 * 업로드 API 스트레스 테스트
 *
 * 사용법:
 * npx ts-node scripts/stress-test-upload.ts
 *
 * 환경변수:
 * - TEST_API_URL: API 서버 URL (기본: http://localhost:3000)
 * - TEST_AUTH_TOKEN: 인증 토큰
 * - TEST_CONCURRENT_USERS: 동시 사용자 수 (기본: 30)
 * - TEST_FILES_PER_USER: 사용자당 파일 수 (기본: 3)
 */

import * as fs from 'fs';
import * as path from 'path';

// 테스트 설정
const CONFIG = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3000',
  authToken: process.env.TEST_AUTH_TOKEN || '',
  concurrentUsers: parseInt(process.env.TEST_CONCURRENT_USERS || '30'),
  filesPerUser: parseInt(process.env.TEST_FILES_PER_USER || '3'),
  testFileDir: path.join(__dirname, 'test-files'),
};

// 테스트 결과 타입
interface TestResult {
  userId: number;
  fileIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  httpStatus?: number;
  error?: string;
  response?: unknown;
}

// 테스트 통계
interface TestStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  requestsPerSecond: number;
  errorsByType: Record<string, number>;
  statusCodes: Record<number, number>;
}

// 더미 PDF 파일 생성 (간단한 PDF 구조)
function createDummyPDF(filename: string, sizeKB: number = 100): Buffer {
  // PDF magic bytes + 최소 구조
  const header = '%PDF-1.4\n';
  const content = `1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test Resume: ${filename}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
306
%%EOF`;

  const baseContent = Buffer.from(header + content, 'utf-8');

  // 지정된 크기만큼 패딩 추가
  const targetSize = sizeKB * 1024;
  if (baseContent.length < targetSize) {
    const padding = Buffer.alloc(targetSize - baseContent.length, 0x20); // 공백으로 채움
    return Buffer.concat([baseContent.slice(0, -6), padding, baseContent.slice(-6)]);
  }

  return baseContent;
}

// FormData 생성 (Node.js 환경)
async function createFormData(file: Buffer, filename: string): Promise<FormData> {
  const formData = new FormData();
  // Buffer를 ArrayBuffer로 변환
  const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  formData.append('file', blob, filename);
  return formData;
}

// 단일 업로드 요청
async function uploadFile(
  userId: number,
  fileIndex: number,
  authToken: string
): Promise<TestResult> {
  const startTime = Date.now();
  const filename = `stress_test_user${userId}_file${fileIndex}_${Date.now()}.pdf`;

  try {
    // 랜덤 크기의 테스트 파일 생성 (50KB ~ 500KB)
    const fileSizeKB = Math.floor(Math.random() * 450) + 50;
    const fileBuffer = createDummyPDF(filename, fileSizeKB);
    const formData = await createFormData(fileBuffer, filename);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃

    const response = await fetch(`${CONFIG.apiUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const endTime = Date.now();
    const responseData = await response.json().catch(() => null);

    return {
      userId,
      fileIndex,
      startTime,
      endTime,
      duration: endTime - startTime,
      status: response.ok ? 'success' : 'error',
      httpStatus: response.status,
      error: response.ok ? undefined : (responseData?.error || `HTTP ${response.status}`),
      response: responseData,
    };
  } catch (error) {
    const endTime = Date.now();
    const isTimeout = error instanceof Error && error.name === 'AbortError';

    return {
      userId,
      fileIndex,
      startTime,
      endTime,
      duration: endTime - startTime,
      status: isTimeout ? 'timeout' : 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 단일 사용자 시뮬레이션 (순차적으로 여러 파일 업로드)
async function simulateUser(
  userId: number,
  authToken: string
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (let i = 0; i < CONFIG.filesPerUser; i++) {
    // 각 파일 사이에 랜덤 딜레이 (100ms ~ 1000ms)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 900 + 100));
    }

    const result = await uploadFile(userId, i, authToken);
    results.push(result);

    // 409 Conflict (중복) 발생 시 잠시 대기 후 재시도
    if (result.httpStatus === 409) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const retryResult = await uploadFile(userId, i, authToken);
      results.push(retryResult);
    }
  }

  return results;
}

// 동시 사용자 시뮬레이션
async function runStressTest(): Promise<TestResult[]> {
  console.log('\n=== 스트레스 테스트 시작 ===');
  console.log(`API URL: ${CONFIG.apiUrl}`);
  console.log(`동시 사용자: ${CONFIG.concurrentUsers}`);
  console.log(`사용자당 파일: ${CONFIG.filesPerUser}`);
  console.log(`총 예상 요청: ${CONFIG.concurrentUsers * CONFIG.filesPerUser}`);
  console.log('');

  if (!CONFIG.authToken) {
    console.error('ERROR: TEST_AUTH_TOKEN 환경변수가 필요합니다.');
    process.exit(1);
  }

  const startTime = Date.now();

  // 모든 사용자를 동시에 시뮬레이션
  const userPromises = Array.from({ length: CONFIG.concurrentUsers }, (_, i) =>
    simulateUser(i + 1, CONFIG.authToken)
  );

  const userResults = await Promise.all(userPromises);
  const allResults = userResults.flat();

  const totalTime = Date.now() - startTime;
  console.log(`\n테스트 완료: ${totalTime}ms`);

  return allResults;
}

// 통계 계산
function calculateStats(results: TestResult[]): TestStats {
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const successResults = results.filter(r => r.status === 'success');
  const errorResults = results.filter(r => r.status === 'error');
  const timeoutResults = results.filter(r => r.status === 'timeout');

  // 에러 유형별 집계
  const errorsByType: Record<string, number> = {};
  errorResults.forEach(r => {
    const errorType = r.error || 'Unknown';
    errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
  });

  // HTTP 상태 코드별 집계
  const statusCodes: Record<number, number> = {};
  results.forEach(r => {
    if (r.httpStatus) {
      statusCodes[r.httpStatus] = (statusCodes[r.httpStatus] || 0) + 1;
    }
  });

  // 백분위수 계산
  const percentile = (arr: number[], p: number) => {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)] || 0;
  };

  const totalTime = Math.max(...results.map(r => r.endTime)) - Math.min(...results.map(r => r.startTime));

  return {
    totalRequests: results.length,
    successCount: successResults.length,
    errorCount: errorResults.length,
    timeoutCount: timeoutResults.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    p50Duration: percentile(durations, 50),
    p95Duration: percentile(durations, 95),
    p99Duration: percentile(durations, 99),
    requestsPerSecond: results.length / (totalTime / 1000),
    errorsByType,
    statusCodes,
  };
}

// 결과 출력
function printResults(results: TestResult[], stats: TestStats): void {
  console.log('\n' + '='.repeat(60));
  console.log('스트레스 테스트 결과');
  console.log('='.repeat(60));

  console.log('\n📊 요청 통계:');
  console.log(`  총 요청 수: ${stats.totalRequests}`);
  console.log(`  성공: ${stats.successCount} (${(stats.successCount / stats.totalRequests * 100).toFixed(1)}%)`);
  console.log(`  실패: ${stats.errorCount} (${(stats.errorCount / stats.totalRequests * 100).toFixed(1)}%)`);
  console.log(`  타임아웃: ${stats.timeoutCount} (${(stats.timeoutCount / stats.totalRequests * 100).toFixed(1)}%)`);

  console.log('\n⏱️  응답 시간 (ms):');
  console.log(`  최소: ${stats.minDuration}`);
  console.log(`  최대: ${stats.maxDuration}`);
  console.log(`  평균: ${stats.avgDuration.toFixed(0)}`);
  console.log(`  P50: ${stats.p50Duration}`);
  console.log(`  P95: ${stats.p95Duration}`);
  console.log(`  P99: ${stats.p99Duration}`);

  console.log('\n🚀 처리량:');
  console.log(`  초당 요청: ${stats.requestsPerSecond.toFixed(2)} req/s`);

  console.log('\n📈 HTTP 상태 코드 분포:');
  Object.entries(stats.statusCodes)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([code, count]) => {
      const percent = (count / stats.totalRequests * 100).toFixed(1);
      console.log(`  ${code}: ${count} (${percent}%)`);
    });

  if (Object.keys(stats.errorsByType).length > 0) {
    console.log('\n❌ 에러 유형별 분포:');
    Object.entries(stats.errorsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
  }

  // 시간대별 분석
  console.log('\n📉 시간대별 분석:');
  const timeSlots = 5;
  const minTime = Math.min(...results.map(r => r.startTime));
  const maxTime = Math.max(...results.map(r => r.endTime));
  const slotDuration = (maxTime - minTime) / timeSlots;

  for (let i = 0; i < timeSlots; i++) {
    const slotStart = minTime + (i * slotDuration);
    const slotEnd = slotStart + slotDuration;
    const slotResults = results.filter(r => r.startTime >= slotStart && r.startTime < slotEnd);
    const slotSuccess = slotResults.filter(r => r.status === 'success').length;
    const slotErrors = slotResults.filter(r => r.status !== 'success').length;
    console.log(`  구간 ${i + 1}: 요청 ${slotResults.length}, 성공 ${slotSuccess}, 실패 ${slotErrors}`);
  }

  console.log('\n' + '='.repeat(60));
}

// 병목 지점 분석
function analyzeBottlenecks(results: TestResult[], stats: TestStats): void {
  console.log('\n🔍 병목 지점 분석 및 예상 문제점:');
  console.log('-'.repeat(60));

  // 1. 에러율 분석
  const errorRate = stats.errorCount / stats.totalRequests;
  if (errorRate > 0.1) {
    console.log('\n⚠️  [높은 에러율 감지]');
    console.log(`   에러율: ${(errorRate * 100).toFixed(1)}%`);
    console.log('   가능한 원인:');
    console.log('   - Supabase 연결 풀 고갈');
    console.log('   - Worker 서비스 과부하');
    console.log('   - Vercel Serverless 콜드 스타트');
  }

  // 2. 타임아웃 분석
  if (stats.timeoutCount > 0) {
    console.log('\n⚠️  [타임아웃 발생]');
    console.log(`   타임아웃 수: ${stats.timeoutCount}`);
    console.log('   가능한 원인:');
    console.log('   - Worker 파이프라인 처리 지연');
    console.log('   - Supabase Storage 업로드 지연');
    console.log('   - 네트워크 대역폭 포화');
  }

  // 3. 응답 시간 분석
  if (stats.p95Duration > 10000) {
    console.log('\n⚠️  [높은 P95 응답 시간]');
    console.log(`   P95: ${stats.p95Duration}ms`);
    console.log('   가능한 원인:');
    console.log('   - DB 쿼리 경합 (user 조회, job 생성)');
    console.log('   - Storage 동시 업로드 제한');
    console.log('   - Worker HTTP 연결 대기');
  }

  // 4. 409 Conflict 분석
  const conflictCount = stats.statusCodes[409] || 0;
  if (conflictCount > 0) {
    console.log('\n⚠️  [중복 업로드 감지 (409)]');
    console.log(`   발생 수: ${conflictCount}`);
    console.log('   원인: 같은 사용자가 30초 내 같은 파일명으로 재업로드');
    console.log('   대응: 정상적인 중복 방지 동작');
  }

  // 5. 402 Payment Required 분석
  const paymentCount = stats.statusCodes[402] || 0;
  if (paymentCount > 0) {
    console.log('\n⚠️  [크레딧 부족 (402)]');
    console.log(`   발생 수: ${paymentCount}`);
    console.log('   원인: 테스트 계정의 크레딧 소진');
  }

  // 6. 503 Service Unavailable 분석
  const unavailableCount = stats.statusCodes[503] || 0;
  if (unavailableCount > 0) {
    console.log('\n⚠️  [서비스 불가 (503)]');
    console.log(`   발생 수: ${unavailableCount}`);
    console.log('   원인: Worker 서비스 과부하 또는 다운');
  }

  // 7. 500 Internal Server Error 분석
  const internalErrorCount = stats.statusCodes[500] || 0;
  if (internalErrorCount > 0) {
    console.log('\n⚠️  [서버 내부 오류 (500)]');
    console.log(`   발생 수: ${internalErrorCount}`);
    console.log('   가능한 원인:');
    console.log('   - Supabase 연결 오류');
    console.log('   - 메모리 부족 (파일 버퍼 처리)');
    console.log('   - 동시성 관련 버그');
  }

  console.log('\n' + '-'.repeat(60));
}

// 메인 실행
async function main(): Promise<void> {
  try {
    const results = await runStressTest();
    const stats = calculateStats(results);

    printResults(results, stats);
    analyzeBottlenecks(results, stats);

    // 결과를 JSON 파일로 저장
    const outputPath = path.join(__dirname, `stress-test-results-${Date.now()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify({ results, stats }, null, 2));
    console.log(`\n📁 상세 결과 저장: ${outputPath}`);

  } catch (error) {
    console.error('테스트 실행 중 오류:', error);
    process.exit(1);
  }
}

main();
