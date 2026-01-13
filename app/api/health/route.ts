/**
 * Health Check API
 * GET /api/health
 * 
 * 시스템 상태 확인:
 * - Circuit Breaker 상태
 * - 메트릭 요약
 * - OpenAI 연결 상태
 */

import { NextResponse } from "next/server";
import { getCircuitStatus } from "@/lib/openai/circuit-breaker";
import { getMetricsSummary } from "@/lib/observability/metrics";

export async function GET() {
    const circuitStatus = getCircuitStatus();
    const metrics = getMetricsSummary(300000); // 5분 윈도우

    // 전체 상태 판정
    const isHealthy = circuitStatus.isHealthy && metrics.embedding.errorRate < 10;

    const response = {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        components: {
            circuit_breaker: {
                status: circuitStatus.state,
                failures: circuitStatus.failures,
                healthy: circuitStatus.isHealthy,
            },
            embedding_service: {
                healthy: metrics.embedding.errorRate < 10,
                error_rate_percent: metrics.embedding.errorRate,
                avg_duration_ms: metrics.embedding.duration.avg,
                request_count_5m: metrics.embedding.duration.count,
            },
            search_service: {
                healthy: true,
                mode_distribution: metrics.search.modeDistribution,
                fallback_count_5m: metrics.search.fallbackCount,
                avg_duration_ms: metrics.search.duration.avg,
            },
        },
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
    };

    return NextResponse.json(response, {
        status: isHealthy ? 200 : 503,
        headers: {
            'Cache-Control': 'no-cache',
        },
    });
}
