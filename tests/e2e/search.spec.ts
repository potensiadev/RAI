import { test, expect } from '@playwright/test';

/**
 * E2E Test: Search Flow
 * 
 * 검색 → 필터 적용 → 결과 확인 플로우 검증
 */

test.describe('Search Flow', () => {
    test.beforeEach(async ({ page }) => {
        // 인증은 auth.setup.ts에서 처리됨 (storageState 사용)
        await page.goto('/candidates');
        // 페이지 로드 대기
        await page.waitForLoadState('networkidle');
    });

    test('TC-01: should parse mixed language query correctly', async ({ page }) => {
        // 한영 혼합 쿼리 테스트
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('React개발자');
        await page.keyboard.press('Enter');

        // 파싱된 키워드 확인 (UI에 표시되는 경우)
        await expect(page.locator('[data-testid="parsed-keywords"]'))
            .toContainText('React');
        await expect(page.locator('[data-testid="parsed-keywords"]'))
            .toContainText('개발자');
    });

    test('TC-02: should match nodejs to Node.js', async ({ page }) => {
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('nodejs');
        await page.keyboard.press('Enter');

        // 결과에서 Node.js 스킬 보유자 확인
        await expect(page.locator('[data-testid="candidate-skills"]').first())
            .toContainText(/Node\.js|NodeJS/i);
    });

    test('should apply experience year filter', async ({ page }) => {
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('React');
        await page.keyboard.press('Enter');

        // 경력 필터 적용
        await page.click('[data-testid="filter-exp-years"]');
        await page.click('[data-testid="exp-5-10"]');

        // 결과의 경력이 5-10년 범위인지 확인
        const expYears = await page.locator('[data-testid="candidate-exp-years"]').first().textContent();
        const years = parseInt(expYears || '0');
        expect(years).toBeGreaterThanOrEqual(5);
        expect(years).toBeLessThanOrEqual(10);
    });

    test('should handle empty search results gracefully', async ({ page }) => {
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('xyznonexistentskill12345');
        await page.keyboard.press('Enter');

        // 빈 결과 메시지 확인
        await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
        await expect(page.locator('[data-testid="empty-state"]'))
            .toContainText('검색 결과가 없습니다');
    });

    test('TC-04: should block SQL injection attempts', async ({ page }) => {
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill("'; DROP TABLE candidates; --");
        await page.keyboard.press('Enter');

        // 정상 응답 (빈 결과 또는 일반 결과)
        // 에러가 발생하지 않아야 함
        await expect(page.locator('[data-testid="search-error"]')).not.toBeVisible();
    });

    test('TC-05: should support pagination', async ({ page }) => {
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('개발자');
        await page.keyboard.press('Enter');

        // 페이지네이션 버튼 확인
        const nextButton = page.locator('[data-testid="pagination-next"]');
        if (await nextButton.isVisible()) {
            await nextButton.click();

            // 페이지 변경 확인
            await expect(page.locator('[data-testid="pagination-current"]'))
                .toHaveText('2');
        }
    });
});
