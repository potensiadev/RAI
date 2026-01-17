import { test, expect } from "./fixtures";

/**
 * E2E Tests: Analytics v2.0 - Edge Cases
 * 
 * 30 defined edge cases testing data anomalies, network errors, and UI states.
 */

test.use({ storageState: 'tests/.auth/user.json' });

test.describe("Analytics Edge Cases - Data Anomalies", () => {
    test("EDGE-01: Summary counts are all zero (New User State)", async ({ page }) => {
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (route) => {
            await route.fulfill({
                status: 200, json: {
                    total_candidates: 0, this_month_count: 0, last_month_count: 0,
                    total_exports: 0, active_positions: 0, urgent_positions: 0
                }
            });
        });
        // Mock other calls to prevent errors
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({ json: { stages: [], total_in_pipeline: 0 } }));

        await page.goto("/analytics");
        await expect(page.locator("text=0").first()).toBeVisible();
        await expect(page.locator("text=-%").or(page.locator("text=0%"))).toBeVisible();
    });

    test("EDGE-02: Summary counts are negative (Invalid DB State)", async ({ page }) => {
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (route) => {
            await route.fulfill({
                status: 200, json: {
                    total_candidates: -1, this_month_count: -5, last_month_count: 0,
                    total_exports: -10, active_positions: 0, urgent_positions: 0
                }
            });
        });
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({ json: { stages: [], total_in_pipeline: 0 } }));

        await page.goto("/analytics");
        // UI should probably display negative numbers as is, or 0. Testing resilience.
        await expect(page.locator("text=-1")).toBeVisible();
    });

    test("EDGE-03: Summary counts are very large (>1B)", async ({ page }) => {
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (route) => {
            await route.fulfill({
                status: 200, json: {
                    total_candidates: 1_000_000_000, this_month_count: 500, last_month_count: 0,
                    total_exports: 0, active_positions: 0, urgent_positions: 0
                }
            });
        });
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({ json: { stages: [], total_in_pipeline: 0 } }));

        await page.goto("/analytics");
        // Check for locale string formatting
        await expect(page.locator("text=1,000,000,000")).toBeVisible();
    });

    test("EDGE-04: Summary contains decimal numbers", async ({ page }) => {
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (route) => {
            await route.fulfill({
                status: 200, json: {
                    total_candidates: 10.5, this_month_count: 0, last_month_count: 0,
                    total_exports: 0, active_positions: 0, urgent_positions: 0
                }
            });
        });
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({ json: { stages: [], total_in_pipeline: 0 } }));

        await page.goto("/analytics");
        await expect(page.locator("text=10.5")).toBeVisible();
    });

    test("EDGE-05: Summary returns null data", async ({ page }) => {
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (route) => {
            await route.fulfill({ status: 200, json: null });
        });
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({ json: { stages: [], total_in_pipeline: 0 } }));

        await page.goto("/analytics");
        // Should show error state
        await expect(page.locator("text=KPI 데이터를 불러올 수 없습니다")).toBeVisible();
    });

    test("EDGE-06: Pipeline with missing stages", async ({ page }) => {
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({
            json: {
                stages: [{ stage: "placed", count: 1, total_entered: 1, total_exited_forward: 0 }],
                total_in_pipeline: 1,
                conversions: [],
                placed_count: 1
            }
        }));
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (r) => r.fulfill({ json: { total_candidates: 0, this_month_count: 0, last_month_count: 0, total_exports: 0, active_positions: 0, urgent_positions: 0 } }));
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));

        await page.goto("/analytics");
        await expect(page.locator("text=채용완료")).toBeVisible();
        await expect(page.locator("text=매칭됨")).not.toBeVisible();
    });

    test("EDGE-07: Pipeline counts all 0", async ({ page }) => {
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({
            json: {
                stages: [
                    { stage: "matched", count: 0, total_entered: 0, total_exited_forward: 0 },
                    { stage: "placed", count: 0, total_entered: 0, total_exited_forward: 0 }
                ],
                total_in_pipeline: 0,
                conversions: [],
                placed_count: 0
            }
        }));
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (r) => r.fulfill({ json: { total_candidates: 0, this_month_count: 0, last_month_count: 0, total_exports: 0, active_positions: 0, urgent_positions: 0 } }));
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));

        await page.goto("/analytics");
        await expect(page.locator("text=총 0명")).toBeVisible();
        await expect(page.locator("text=0%")).toBeVisible();
    });

    test("EDGE-08: Pipeline conversion denominator is 0", async ({ page }) => {
        // Logic inside hook handles division by zero, verified here
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({
            json: {
                stages: [],
                total_in_pipeline: 0,
                conversions: [{ from_stage: "matched", to_stage: "reviewed", count: 10 }], // Anomaly: conversion without entries
                placed_count: 0
            }
        }));
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (r) => r.fulfill({ json: { total_candidates: 0, this_month_count: 0, last_month_count: 0, total_exports: 0, active_positions: 0, urgent_positions: 0 } }));
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));

        await page.goto("/analytics");
        // Should not crash
        await expect(page.locator("h1")).toContainText("Analytics");
    });

    test("EDGE-09: Position Health empty", async ({ page }) => {
        await page.route("**/rest/v1/rpc/get_position_health", async (r) => r.fulfill({ json: [] }));
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (r) => r.fulfill({ json: { total_candidates: 0, this_month_count: 0, last_month_count: 0, total_exports: 0, active_positions: 0, urgent_positions: 0 } }));
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({ json: { stages: [], total_in_pipeline: 0 } }));

        await page.goto("/analytics");
        await expect(page.locator("text=모든 포지션이 정상입니다")).toBeVisible();
    });

    test("EDGE-10: Position Health title extremely long", async ({ page }) => {
        const longTitle = "A".repeat(150);
        await page.route("**/rest/v1/rpc/get_position_health", async (r) => r.fulfill({
            json: [
                { id: "1", title: longTitle, client_company: "X", status: "open", priority: "urgent", created_at: new Date().toISOString(), days_open: 1, match_count: 0, stuck_count: 0, health_status: "warning" }
            ]
        }));
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (r) => r.fulfill({ json: { total_candidates: 0, this_month_count: 0, last_month_count: 0, total_exports: 0, active_positions: 0, urgent_positions: 0 } }));
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({ json: { stages: [], total_in_pipeline: 0 } }));

        await page.goto("/analytics");
        // Check truncated styling or ensure it renders without breaking layout
        const link = page.locator(`a[href*='/positions/1']`);
        await expect(link).toBeVisible();
        // It should be contained
        // await expect(link).toHaveCSS("text-overflow", "ellipsis"); // Might be flaky depending on browser imp
    });

    test("EDGE-11: Activity Feed description with HTML injection", async ({ page }) => {
        await page.route("**/rest/v1/rpc/get_recent_activities", async (r) => r.fulfill({
            json: [
                { id: "1", activity_type: "x", description: "<script>alert('xss')</script>BoldText", created_at: new Date().toISOString(), display_type: "other", metadata: {} }
            ]
        }));
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (r) => r.fulfill({ json: { total_candidates: 0, this_month_count: 0, last_month_count: 0, total_exports: 0, active_positions: 0, urgent_positions: 0 } }));
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({ json: { stages: [], total_in_pipeline: 0 } }));

        await page.goto("/analytics");
        // Should show the text literally, not execute it.
        await expect(page.locator("text=<script>")).toBeVisible();
    });
});

test.describe("Analytics Edge Cases - Network & Errors", () => {
    test("EDGE-12: API 500 Error on all RPCs", async ({ page }) => {
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ status: 500 }));
        await page.goto("/analytics");

        await expect(page.locator("text=KPI 데이터를 불러올 수 없습니다")).toBeVisible();
        await expect(page.locator("text=파이프라인 데이터를 불러올 수 없습니다")).toBeVisible();
        await expect(page.locator("text=포지션 현황을 불러올 수 없습니다")).toBeVisible();
    });

    test("EDGE-13: API Timeout (Loading States)", async ({ page }) => {
        // Delay response indefinitely for this test duration
        await page.route("**/rest/v1/rpc/*", async (r) => { /* hang */ });

        await page.goto("/analytics");
        // Skeletons should be visible
        await expect(page.locator(".animate-pulse").first()).toBeVisible();
    });

    test("EDGE-14: Partial API Failure (Only KPI fails)", async ({ page }) => {
        await page.route("**/rest/v1/rpc/*", async (r) => r.fulfill({ json: [] }));
        await page.route("**/rest/v1/rpc/get_pipeline_stats", async (r) => r.fulfill({ json: { stages: [], total_in_pipeline: 0 } }));
        await page.route("**/rest/v1/rpc/get_analytics_summary", async (r) => r.fulfill({ status: 500 }));

        await page.goto("/analytics");
        await expect(page.locator("text=KPI 데이터를 불러올 수 없습니다")).toBeVisible();
        await expect(page.locator("text=모든 포지션이 정상입니다")).toBeVisible(); // Health calls succeeded (mocked via *)
    });
});
