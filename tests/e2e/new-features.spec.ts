import { test, expect } from "@playwright/test";

test.describe("New Features: Projects, Highlighting, Export", () => {

    // Mock Data
    const MOCK_PROJECTS = [
        {
            id: "proj-1",
            name: "Q1 Hiring",
            description: "Candidates for Q1",
            candidate_count: 5,
            created_at: new Date().toISOString(),
        },
    ];

    const MOCK_CANDIDATE = {
        id: "cand-1",
        name: "John Doe",
        role: "Frontend Engineer",
        company: "Tech Corp",
        skills: ["React", "TypeScript", "Node.js"],
        matchScore: 95,
    };

    test.beforeEach(async ({ page }) => {
        // 1. Perform Real Login
        await page.goto("/login");
        await page.fill('input[name="email"]', "test@rai.com");
        await page.fill('input[name="password"]', "password123");
        await page.click('button[type="submit"]'); // Adjust selector if needed

        // Wait for redirect to dashboard or consent
        // Since we seeded consent, it should go to /candidates (default) or dashboard
        await page.waitForURL("**/candidates");

        // 2. Setup API Mocks for Data (Projects, etc.)
        // Even if logged in, we Mock the *Data* to keep tests deterministic
        // and distinct from actual DB state for the *Features*

        // Mock Projects List API
        await page.route("**/api/projects", async (route) => {
            if (route.request().method() === "GET") {
                await route.fulfill({ json: { data: MOCK_PROJECTS } });
            } else if (route.request().method() === "POST") {
                const body = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        data: {
                            id: "proj-new",
                            ...body,
                            created_at: new Date().toISOString()
                        }
                    }
                });
            } else {
                await route.continue();
            }
        });

        // Mock Single Project API
        await page.route("**/api/projects/proj-1", async (route) => {
            await route.fulfill({
                json: {
                    data: {
                        ...MOCK_PROJECTS[0],
                        candidates: [MOCK_CANDIDATE]
                    }
                }
            });
        });

        // Mock Candidate Detail
        await page.route(`**/api/candidates/${MOCK_CANDIDATE.id}`, async (route) => {
            await route.fulfill({
                json: {
                    data: {
                        ...MOCK_CANDIDATE,
                        careers: [],
                        education: [],
                        projects: [],
                        warnings: [],
                    }
                }
            });
        });

        // Mock PDF Export
        await page.route(`**/api/candidates/${MOCK_CANDIDATE.id}/export`, async (route) => {
            await route.fulfill({
                json: {
                    data: {
                        html: "<html><body>Mock Blind Resume</body></html>",
                        fileName: "resume.html"
                    },
                    limit: 30,
                    used: 5
                }
            });
        });
    });

    test("Project Folders: List and Create", async ({ page }) => {
        // Go to projects page
        await page.goto("/projects");

        // Verify list renders
        await expect(page.getByText("Q1 Hiring")).toBeVisible();
        await expect(page.getByText("5 candidates")).toBeVisible();

        // Test Create Flow
        await page.getByRole("button", { name: "새 프로젝트" }).click();
        await page.getByPlaceholder("프로젝트 이름을 입력하세요").fill("New Alpha Team");
        await page.getByPlaceholder("설명을 입력하세요").fill("Hiring purpose");
        await page.getByRole("button", { name: "만들기" }).click();

        // Verify Optimistic UI or Result
        // Since we mocked the POST to return success, UI should reflect or toast should appear
        // Note: The UI might reload data, triggering the GET mock again. 
        // Ideally we'd update the GET mock to include the new one, but for this test we check the API call or toast.
        await expect(page.getByText("프로젝트가 생성되었습니다")).toBeVisible();
    });

    test("Project Detail: View Candidates", async ({ page }) => {
        await page.goto("/projects/proj-1");

        // Verify Project Info
        await expect(page.getByRole("heading", { name: "Q1 Hiring" })).toBeVisible();

        // Verify Candidate Card
        await expect(page.getByText("John Doe")).toBeVisible();
        await expect(page.getByText("Frontend Engineer")).toBeVisible();
    });

    test("Evidence Highlighting: Skill Click Interaction", async ({ page }) => {
        // Navigate to candidate detail
        await page.goto(`/candidates/${MOCK_CANDIDATE.id}`);

        // Verify candidate loaded
        await expect(page.getByRole("heading", { name: "John Doe" })).toBeVisible();

        // Click a skill to trigger highlight
        const skillTag = page.getByText("React").first();
        await skillTag.click(); // This should trigger onKeywordSelect -> setHighlightKeyword -> Show Split View

        // Verify Split View opens
        // We look for the "Split View" toggle button to be in "active" state or the container to exist
        // Currently relying on visual indicator logic in code:
        // "bg-primary text-white" class on the toggle button indicates active state
        const toggleBtn = page.getByTitle("분할 보기 끄기"); // Title changes when active
        await expect(toggleBtn).toBeVisible();

        // Verify Highlight State (Mocked by PDFViewer receiving props)
        // Since PDF loading is mocked/async, we might just check if the UI state updated
        // to show the split container.
        const splitContainer = page.locator(".flex.h-\\[calc\\(100vh-200px\\)\\]");
        await expect(splitContainer).toBeVisible();
    });

    test("Blind Export: Trigger and Limit Check", async ({ page }) => {
        await page.goto(`/candidates/${MOCK_CANDIDATE.id}`);

        // Click Export Button
        const exportBtn = page.getByTitle(/블라인드 내보내기/);
        await expect(exportBtn).toBeVisible();
        await exportBtn.click();

        // We mocked the response, so we expect a success toast or window open.
        // Window open is hard to test in Playwright without handling the event.
        // We can verify the API call was made.

        // Instead, let's look for the toast success message or ensure no error alert appears.
        // The handleBlindExport function does standard alert on error, but window.open on success.

        // Wait a bit for the async action
        await page.waitForTimeout(500);

        // If usage limit is displayed, verified
        await expect(page.getByText("(5/30)")).toBeVisible();
    });

});
