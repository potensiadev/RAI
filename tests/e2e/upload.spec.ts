import { test, expect } from '@playwright/test';

/**
 * E2E Test: Resume Upload Flow
 * 
 * 이력서 업로드 → AI 분석 → 후보자 생성 전체 플로우 검증
 */

test.describe('Resume Upload Flow', () => {
    test.beforeEach(async ({ page }) => {
        // 인증은 auth.setup.ts에서 처리됨 (storageState 사용)
        await page.goto('/candidates');
        await page.waitForLoadState('networkidle');
    });

    test('should upload PDF resume and complete analysis', async ({ page }) => {
        // 1. 대시보드에서 업로드 버튼 확인
        await expect(page.locator('[data-testid="upload-button"]')).toBeVisible();

        // 2. 파일 업로드
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles('./tests/fixtures/sample-resume.pdf');

        // 3. 업로드 진행 상태 확인
        await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();

        // 4. 분석 완료 대기 (최대 60초)
        await expect(page.locator('[data-testid="processing-status"]'))
            .toHaveText('완료', { timeout: 60000 });

        // 5. 후보자 목록에서 새 후보자 확인
        await page.goto('/candidates');
        const candidateList = page.locator('[data-testid="candidate-list"]');
        await expect(candidateList.locator('[data-testid="candidate-item"]').first()).toBeVisible();
    });

    test('should reject invalid file type', async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles('./tests/fixtures/invalid-file.exe');

        // 에러 메시지 확인
        await expect(page.locator('[data-testid="upload-error"]'))
            .toContainText('지원하지 않는 파일 형식');
    });

    test('should show credit insufficient error when credits exhausted', async ({ page }) => {
        // 크레딧 0 상태에서 업로드 시도
        // (테스트용 mock API 또는 테스트 계정 사용)
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles('./tests/fixtures/sample-resume.pdf');

        await expect(page.locator('[data-testid="upload-error"]'))
            .toContainText('크레딧이 부족합니다');
    });
});
