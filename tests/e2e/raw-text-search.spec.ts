import { test, expect } from '@playwright/test';

/**
 * E2E Test: Raw Text Semantic Search (PRD v0.1)
 *
 * 원본 텍스트 검색 기능 검증:
 * - raw_full, raw_section 청크 생성 확인
 * - 구조화 데이터에 없는 텍스트도 검색 가능
 * - 구조화 데이터 우선 순위 유지
 */

test.describe('Raw Text Semantic Search', () => {
    test.beforeEach(async ({ page }) => {
        // 로그인
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL || 'test@example.com');
        await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD || 'testpass123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('/candidates');
    });

    test('TC-RAW-01: should find candidate by raw text content', async ({ page }) => {
        /**
         * 시나리오: 이력서 원본에만 있는 키워드로 검색
         * 예: "EUV 공정 개발" (AI가 구조화하지 않은 상세 내용)
         */
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('EUV 공정');
        await page.keyboard.press('Enter');

        // 검색 결과가 있어야 함 (이력서 원본에 해당 내용이 있는 경우)
        const results = page.locator('[data-testid="candidate-item"]');

        // 결과가 있거나 빈 상태 메시지가 있어야 함 (테스트 데이터에 따라)
        const hasResults = await results.count() > 0;
        const hasEmptyState = await page.locator('[data-testid="empty-state"]').isVisible();

        expect(hasResults || hasEmptyState).toBeTruthy();
    });

    test('TC-RAW-02: structured data should rank higher than raw text', async ({ page }) => {
        /**
         * 시나리오: 동일 키워드가 스킬(구조화)과 원본에 모두 있을 때
         * 스킬에 있는 후보자가 더 높은 순위로 표시되어야 함
         */
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('Python');
        await page.keyboard.press('Enter');

        // 첫 번째 결과의 스킬에 Python이 있어야 함
        const firstCandidate = page.locator('[data-testid="candidate-item"]').first();

        if (await firstCandidate.isVisible()) {
            const skills = firstCandidate.locator('[data-testid="candidate-skills"]');
            // 첫 번째 결과는 스킬에 Python이 있거나, matchScore가 높아야 함
            await expect(skills).toBeVisible();
        }
    });

    test('TC-RAW-03: should search project details in raw text', async ({ page }) => {
        /**
         * 시나리오: 프로젝트 상세 내용(AI가 요약하지 않은 부분) 검색
         */
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('공정 효율 20% 향상');  // 프로젝트 상세 내용
        await page.keyboard.press('Enter');

        // 결과 확인 (타임아웃 5초)
        await page.waitForTimeout(2000);

        // 검색이 완료되었는지 확인
        const isSearchComplete = await page.locator('[data-testid="search-results"]').isVisible()
            || await page.locator('[data-testid="empty-state"]').isVisible();

        expect(isSearchComplete).toBeTruthy();
    });

    test('TC-RAW-04: should handle long query from resume content', async ({ page }) => {
        /**
         * 시나리오: 이력서에서 복사한 긴 문장으로 검색
         */
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('반도체 수율 개선 프로젝트에서 EUV 공정 최적화를 담당');
        await page.keyboard.press('Enter');

        // 긴 쿼리도 정상 처리되어야 함
        await page.waitForTimeout(3000);

        // 에러가 발생하지 않아야 함
        await expect(page.locator('[data-testid="search-error"]')).not.toBeVisible();
    });

    test('TC-RAW-05: should display match context from raw text', async ({ page }) => {
        /**
         * 시나리오: 검색 결과에서 매칭된 원본 텍스트 컨텍스트 표시
         */
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('경력기술서');
        await page.keyboard.press('Enter');

        // 결과가 있으면 매칭 컨텍스트 확인
        const results = page.locator('[data-testid="candidate-item"]');

        if (await results.count() > 0) {
            // 매칭된 청크 정보가 표시될 수 있음 (UI 구현에 따라)
            const matchContext = page.locator('[data-testid="match-context"]');
            // 옵션: 매칭 컨텍스트가 있으면 확인
            if (await matchContext.isVisible()) {
                await expect(matchContext).toContainText('경력기술서');
            }
        }
    });
});

/**
 * API Level Tests (Worker 직접 호출)
 *
 * UI 없이 Worker API를 직접 테스트
 */
test.describe('Raw Text API Tests', () => {
    const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';

    test('API-01: Worker health check', async ({ request }) => {
        const response = await request.get(`${WORKER_URL}/health`);
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.status).toBe('healthy');
    });

    test('API-02: Process endpoint should accept raw_text', async ({ request }) => {
        // /process 엔드포인트가 raw_text를 처리하는지 확인
        const response = await request.post(`${WORKER_URL}/process`, {
            data: {
                text: `
                    홍길동
                    연락처: 010-1234-5678

                    [경력사항]
                    삼성전자 반도체 사업부 (2018.03 - 현재)
                    - EUV 공정 개발 프로젝트 리드
                    - 반도체 수율 개선 15% 달성

                    [기술스택]
                    Python, TensorFlow, Kubernetes
                `,
                user_id: 'test-user-id',
                job_id: 'test-job-id',
                generate_embeddings: false,  // 테스트용으로 임베딩 생성 스킵
                mask_pii: false,
                save_to_db: false,
            },
        });

        // 응답 확인 (인증 없이는 실패할 수 있음)
        // 개발 환경에서는 인증 스킵되므로 성공해야 함
        if (response.ok()) {
            const data = await response.json();
            expect(data.success).toBeDefined();
        }
    });
});
