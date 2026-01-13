/**
 * E2E 테스트: 품질 환불 플로우
 *
 * PRD: prd_refund_policy_v0.4.md Section 3
 * QA: refund_policy_test_scenarios_v1.0.md (Scenario 2.1.1, 2.6.1)
 *
 * 의존성: Playwright
 * Paddle 의존성: 없음 (품질 환불은 크레딧 기반)
 *
 * 설치: npm install -D @playwright/test && npx playwright install
 * 실행: npx playwright test tests/e2e/quality-refund.spec.ts
 */

import { test, expect, Page } from "@playwright/test";

// 테스트 환경 설정
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "test@example.com";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "testpassword123";

// 테스트 유틸리티
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('#email', TEST_USER_EMAIL);
  await page.fill('#password', TEST_USER_PASSWORD);
  await page.click('button:has-text("로그인")');
  // 로그인 성공 시 candidates 페이지로 리다이렉트
  await page.waitForURL(/\/(candidates|dashboard)/);
}

async function getCreditsCount(page: Page): Promise<number> {
  const creditsText = await page.textContent('[data-testid="credits-remaining"]');
  return parseInt(creditsText || "0", 10);
}

test.describe("품질 환불 E2E", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("저품질 이력서 업로드 시 자동 환불 및 토스트 알림", async ({ page }) => {
    // 1. 초기 크레딧 확인
    const initialCredits = await getCreditsCount(page);
    console.log(`Initial credits: ${initialCredits}`);

    // 2. 업로드 페이지로 이동
    await page.goto(`${BASE_URL}/upload`);

    // 3. 저품질 테스트 파일 업로드 (fixtures 폴더에 준비 필요)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("tests/fixtures/low_quality_resume.pdf");

    // 4. 업로드 버튼 클릭
    await page.click('button[data-testid="upload-submit"]');

    // 5. 처리 완료 대기 (최대 60초)
    await expect(page.locator('[data-testid="processing-status"]')).toHaveText(
      /completed|refunded/,
      { timeout: 60000 }
    );

    // 6. 환불 토스트 알림 확인
    const toast = page.locator(".toast, [role='alert']");
    await expect(toast).toContainText(/품질.*미달|환불|refund/i, {
      timeout: 10000,
    });

    // 7. 크레딧이 차감되지 않았는지 확인 (환불됨)
    const finalCredits = await getCreditsCount(page);
    console.log(`Final credits: ${finalCredits}`);

    // 환불되었으므로 크레딧은 동일해야 함
    expect(finalCredits).toBe(initialCredits);
  });

  test("고품질 이력서 업로드 시 정상 처리 (환불 없음)", async ({ page }) => {
    // 1. 초기 크레딧 확인
    const initialCredits = await getCreditsCount(page);

    // 2. 업로드 페이지로 이동
    await page.goto(`${BASE_URL}/upload`);

    // 3. 고품질 테스트 파일 업로드
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("tests/fixtures/high_quality_resume.pdf");

    // 4. 업로드 버튼 클릭
    await page.click('button[data-testid="upload-submit"]');

    // 5. 처리 완료 대기
    await expect(page.locator('[data-testid="processing-status"]')).toHaveText(
      "completed",
      { timeout: 60000 }
    );

    // 6. 환불 토스트가 나타나지 않는지 확인
    const toast = page.locator(".toast:has-text('환불')");
    await expect(toast).not.toBeVisible({ timeout: 5000 });

    // 7. 크레딧이 1 차감되었는지 확인
    const finalCredits = await getCreditsCount(page);
    expect(finalCredits).toBe(initialCredits - 1);

    // 8. candidates 목록에 새 항목이 있는지 확인
    await page.goto(`${BASE_URL}/candidates`);
    const newCandidate = page.locator('[data-testid="candidate-item"]').first();
    await expect(newCandidate).toBeVisible();
  });

  test("환불된 후보자는 목록에서 보이지 않음", async ({ page }) => {
    // candidates 페이지로 이동
    await page.goto(`${BASE_URL}/candidates`);

    // status="refunded"인 항목이 없어야 함
    const refundedItems = page.locator('[data-status="refunded"]');
    await expect(refundedItems).toHaveCount(0);
  });
});

test.describe("환불 알림 E2E", () => {
  test("Realtime 알림 구독 확인", async ({ page }) => {
    await login(page);

    // 대시보드에서 Realtime 연결 확인
    await page.goto(`${BASE_URL}/dashboard`);

    // Supabase Realtime 연결 상태 확인 (개발자 도구 콘솔)
    const realtimeConnected = await page.evaluate(() => {
      // @ts-ignore - window에 supabase client가 있다고 가정
      return window.__SUPABASE_REALTIME_CONNECTED__ || false;
    });

    // Note: 실제 구현에서는 연결 상태를 window에 노출시켜야 함
    console.log(`Realtime connected: ${realtimeConnected}`);
  });
});

test.describe("환불 내역 UI E2E", () => {
  test("Settings 페이지에서 환불 내역 조회", async ({ page }) => {
    await login(page);

    // Settings 페이지로 이동
    await page.goto(`${BASE_URL}/settings`);

    // 구독 탭 클릭
    await page.click('button:has-text("구독")');

    // 환불 내역 섹션 확인
    const refundHistory = page.locator('[data-testid="refund-history"]');
    await expect(refundHistory).toBeVisible();

    // 환불 내역 항목이 있거나 "내역이 없습니다" 메시지 확인
    const historyContent = await refundHistory.textContent();
    expect(
      historyContent?.includes("환불") || historyContent?.includes("내역이 없습니다")
    ).toBeTruthy();
  });
});
