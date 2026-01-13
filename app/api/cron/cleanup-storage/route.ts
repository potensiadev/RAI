/**
 * Storage Cleanup Cron Endpoint
 *
 * PRD: prd_refund_policy_v0.4.md Section 2.4
 * QA: refund_policy_test_scenarios_v1.0.md (EC-051 ~ EC-060)
 *
 * Vercel Cron으로 매일 03:00 UTC 실행
 * Schedule: "0 3 * * *"
 */

import { NextRequest, NextResponse } from "next/server";
import { runFullCleanup } from "@/lib/refund/cleanup";

/**
 * Cron Job 인증 확인
 * Vercel Cron은 CRON_SECRET 헤더로 인증
 */
function validateCronRequest(request: NextRequest): boolean {
  // Vercel Cron 인증
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // CRON_SECRET이 설정되어 있으면 검증
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // 개발 환경에서는 localhost 허용
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // CRON_SECRET이 없으면 Vercel의 기본 cron 인증 헤더 확인
  // Vercel Cron은 자동으로 인증 헤더를 추가함
  return request.headers.has("x-vercel-cron");
}

export async function GET(request: NextRequest) {
  // 인증 확인
  if (!validateCronRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    console.log("[Cron] Starting cleanup job...");

    const results = await runFullCleanup();

    const response = {
      success: results.orphanedFiles.success && results.oldRecords.success,
      timestamp: new Date().toISOString(),
      orphanedFiles: {
        processed: results.orphanedFiles.processed,
        cleaned: results.orphanedFiles.cleaned,
        failed: results.orphanedFiles.failed,
      },
      oldRecords: {
        processed: results.oldRecords.processed,
        cleaned: results.oldRecords.cleaned,
        failed: results.oldRecords.failed,
      },
    };

    console.log("[Cron] Cleanup job completed:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Cleanup job failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// POST도 지원 (수동 실행용)
export async function POST(request: NextRequest) {
  return GET(request);
}
