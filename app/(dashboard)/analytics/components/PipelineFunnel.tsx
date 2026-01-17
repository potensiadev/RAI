"use client";

import { Target, RefreshCw, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePipelineStats, useRefreshPipelineStats } from "../hooks";
import { PipelineSkeleton } from "./skeletons";
import type { MatchStage } from "@/types";

const STAGE_CONFIG: Record<MatchStage, { label: string; color: string; bgColor: string }> = {
    matched: { label: "매칭됨", color: "text-gray-600", bgColor: "bg-gray-100" },
    reviewed: { label: "검토완료", color: "text-blue-600", bgColor: "bg-blue-100" },
    contacted: { label: "연락함", color: "text-indigo-600", bgColor: "bg-indigo-100" },
    interviewing: { label: "인터뷰중", color: "text-purple-600", bgColor: "bg-purple-100" },
    offered: { label: "오퍼제안", color: "text-amber-600", bgColor: "bg-amber-100" },
    placed: { label: "채용완료", color: "text-emerald-600", bgColor: "bg-emerald-100" },
    rejected: { label: "제외됨", color: "text-red-600", bgColor: "bg-red-100" },
    withdrawn: { label: "철회됨", color: "text-gray-400", bgColor: "bg-gray-50" },
};

interface PipelineFunnelProps {
    className?: string;
}

export function PipelineFunnel({ className }: PipelineFunnelProps) {
    const { data, isLoading, error, isFetching } = usePipelineStats();
    const refreshPipeline = useRefreshPipelineStats();

    if (isLoading) {
        return <PipelineSkeleton />;
    }

    if (error || !data) {
        return (
            <div className={cn("p-6 rounded-2xl bg-red-50 border border-red-100 text-center", className)}>
                <p className="text-red-600">파이프라인 데이터를 불러올 수 없습니다</p>
                <button
                    onClick={refreshPipeline}
                    className="mt-2 text-sm text-red-500 hover:text-red-700 flex items-center gap-1 mx-auto"
                >
                    <RefreshCw className="w-4 h-4" />
                    다시 시도
                </button>
            </div>
        );
    }

    const placementRate =
        data.total_in_pipeline > 0 ? (data.placed_count / data.total_in_pipeline) * 100 : 0;

    return (
        <div className={cn("p-6 rounded-2xl bg-white border border-gray-100 shadow-sm relative", className)}>
            {/* Loading indicator */}
            {isFetching && (
                <div className="absolute top-4 right-4">
                    <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">채용 파이프라인</h3>
                    <p className="text-sm text-gray-500 mt-0.5">전체 포지션의 후보자 진행 현황</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50">
                    <Target className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">총 {data.total_in_pipeline.toLocaleString()}명</span>
                </div>
            </div>

            {/* Funnel Visualization */}
            <div className="space-y-3">
                <div className="flex items-end gap-1">
                    {data.stages.map((stage, index) => {
                        const heightPercent =
                            data.total_in_pipeline > 0
                                ? Math.max(30, (stage.count / data.total_in_pipeline) * 100)
                                : 30;
                        const config = STAGE_CONFIG[stage.stage as MatchStage];
                        const conversionRate =
                            index < data.conversionRates.length ? data.conversionRates[index] : null;
                        const showConversion =
                            data.total_in_pipeline > 0 &&
                            conversionRate !== null &&
                            index < data.stages.length - 1;

                        return (
                            <div key={stage.stage} className="flex-1 flex flex-col items-center group">
                                {/* Count */}
                                <span className="text-2xl font-bold text-gray-900 mb-2">{stage.count}</span>

                                {/* Bar with optional conversion indicator */}
                                <div className="w-full flex items-end">
                                    <div
                                        className={cn(
                                            "flex-1 rounded-t-lg transition-all duration-500",
                                            config?.bgColor || "bg-gray-100"
                                        )}
                                        style={{ height: `${heightPercent}px`, minHeight: "40px" }}
                                    />
                                    {/* Conversion Rate with Tooltip */}
                                    {showConversion && conversionRate && (
                                        <div className="flex items-center justify-center w-6 -mx-3 z-10 relative">
                                            <div className="flex flex-col items-center group/tooltip">
                                                <span className="text-[10px] font-semibold text-gray-500 bg-white px-1 rounded cursor-help">
                                                    {conversionRate.rate.toFixed(0)}%
                                                </span>
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-2 hidden group-hover/tooltip:block z-20">
                                                    <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
                                                        <div className="flex items-center gap-1 mb-1">
                                                            <Info className="w-3 h-3" />
                                                            <span className="font-medium">실제 전환</span>
                                                        </div>
                                                        <p>
                                                            {conversionRate.movedCount}명 / {conversionRate.totalFromStage}명이 진행
                                                        </p>
                                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
                                                            <div className="border-4 border-transparent border-t-gray-900" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Label */}
                                <span className={cn("text-xs font-medium mt-2 text-center", config?.color || "text-gray-600")}>
                                    {config?.label || stage.stage}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Conversion Summary */}
            <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">전체 전환율 (매칭 → 채용완료)</span>
                    <span className="font-semibold text-emerald-600">{placementRate.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
}
