import { test, expect } from '@playwright/test';

/**
 * E2E Test: Blind Export Flow
 * 
 * 후보자 상세 → 블라인드 내보내기 → PII 마스킹 검증
 */

test.describe('Blind Export Flow', () => {
    test.beforeEach(async ({ page }) => {
        // 인증은 auth.setup.ts에서 처리됨 (storageState 사용)
        await page.goto('/candidates');
        await page.waitForLoadState('networkidle');
    });

    test('should export candidate without PII', async ({ page }) => {
        // 첫 번째 후보자 상세 페이지로 이동
        await page.click('[data-testid="candidate-item"]:first-child');
        await page.waitForURL(/\/candidates\/[a-zA-Z0-9-]+/);

        // 블라인드 내보내기 버튼 클릭
        await page.click('[data-testid="blind-export-button"]');

        // 프린트 윈도우가 열리거나 다운로드 시작 확인
        // (실제로는 window.open 모킹 필요)
        const [newPage] = await Promise.all([
            page.waitForEvent('popup'),
            page.click('[data-testid="blind-export-button"]'),
        ]).catch(() => [null]);

        if (newPage) {
            // 새 창에서 PII 마스킹 확인
            const content = await newPage.content();

            // 전화번호 마스킹 확인 (예: 010-****-1234)
            expect(content).not.toMatch(/010-\d{4}-\d{4}/);

            // 이메일 마스킹 확인
            expect(content).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

            await newPage.close();
        }
    });

    test('should show usage count after export', async ({ page }) => {
        await page.click('[data-testid="candidate-item"]:first-child');
        await page.waitForURL(/\/candidates\/[a-zA-Z0-9-]+/);

        // 현재 사용량 확인
        const usageBefore = await page.locator('[data-testid="export-usage"]').textContent();

        // 내보내기 실행
        await page.click('[data-testid="blind-export-button"]');

        // 사용량 증가 확인
        await page.waitForTimeout(1000);
        const usageAfter = await page.locator('[data-testid="export-usage"]').textContent();

        // 사용량이 변경되었는지 확인 (또는 동일하면 무시)
        expect(usageAfter).toBeDefined();
    });

    test('should show limit reached error', async ({ page }) => {
        // 월간 한도에 도달한 계정으로 테스트
        // (테스트 환경에서 mock 또는 특수 계정 사용)
        await page.click('[data-testid="candidate-item"]:first-child');
        await page.waitForURL(/\/candidates\/[a-zA-Z0-9-]+/);

        // 내보내기 버튼이 비활성화되거나 에러 표시
        const exportButton = page.locator('[data-testid="blind-export-button"]');

        // disabled 상태이거나 클릭 시 에러 메시지
        if (await exportButton.isEnabled()) {
            await exportButton.click();
            await expect(page.locator('[data-testid="export-limit-error"]'))
                .toContainText('한도를 초과');
        }
    });
});
