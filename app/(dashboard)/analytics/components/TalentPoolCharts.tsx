"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTalentPoolStats, useRefreshTalentPoolStats } from "../hooks";
import { ChartSkeleton } from "./skeletons";

interface TalentPoolChartsProps {
    className?: string;
}

export function TalentPoolCharts({ className }: TalentPoolChartsProps) {
    const { data, isLoading, error, isFetching } = useTalentPoolStats();
    const refreshStats = useRefreshTalentPoolStats();

    if (isLoading) {
        return <ChartSkeleton />;
    }

    if (error || !data) {
        return (
            <div className={cn("p-6 rounded-2xl bg-red-50 border border-red-100 text-center", className)}>
                <p className="text-red-600">차트 데이터를 불러올 수 없습니다</p>
                <button
                    onClick={refreshStats}
                    className="mt-2 text-sm text-red-500 hover:text-red-700 flex items-center gap-1 mx-auto"
                >
                    <RefreshCw className="w-4 h-4" />
                    다시 시도
                </button>
            </div>
        );
    }

    const monthlyCandidates = data.monthly_candidates || [];
    const monthlyPlacements = data.monthly_placements || [];

    // Create a map for placements by month
    const placementsByMonth = new Map(
        monthlyPlacements.map((p) => [p.month_key, p.count])
    );

    // Calculate max values for scaling
    const maxCandidates = Math.max(...monthlyCandidates.map((m) => m.count), 1);
    const maxPlacements = Math.max(...monthlyPlacements.map((m) => m.count), 1);

    // Calculate this month and last month stats
    const thisMonthData = monthlyCandidates[monthlyCandidates.length - 1];
    const lastMonthData = monthlyCandidates[monthlyCandidates.length - 2];
    const thisMonthCount = thisMonthData?.count || 0;
    const lastMonthCount = lastMonthData?.count || 0;

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
                    <h3 className="text-lg font-semibold text-gray-900">월별 추이</h3>
                    <p className="text-sm text-gray-500 mt-0.5">최근 6개월 신규 등록 현황</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        <span className="text-xs text-gray-600">신규 후보자</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs text-gray-600">채용 완료</span>
                    </div>
                </div>
            </div>

            <div className="flex items-end justify-between gap-4 h-40">
                {monthlyCandidates.map((month) => {
                    const candidateHeight = (month.count / maxCandidates) * 100;
                    const placementCount = placementsByMonth.get(month.month_key) || 0;
                    const placementHeight = maxPlacements > 0 ? (placementCount / maxPlacements) * 100 : 0;

                    return (
                        <div key={month.month_key} className="flex-1 flex flex-col items-center gap-2">
                            <div className="flex-1 w-full flex items-end justify-center gap-1">
                                {/* Candidates bar */}
                                <div
                                    className="w-5 bg-primary/80 rounded-t transition-all duration-500 hover:bg-primary"
                                    style={{ height: `${Math.max(candidateHeight, 4)}%` }}
                                    title={`${month.count}명`}
                                />
                                {/* Placements bar */}
                                <div
                                    className="w-5 bg-emerald-500/80 rounded-t transition-all duration-500 hover:bg-emerald-500"
                                    style={{ height: `${Math.max(placementHeight, 4)}%` }}
                                    title={`${placementCount}명`}
                                />
                            </div>
                            <span className="text-xs text-gray-500">{month.month_label}</span>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div>
                    <p className="text-sm text-gray-500">이번 달 신규 등록</p>
                    <p className="text-xl font-bold text-gray-900">{thisMonthCount}명</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">전월 대비</p>
                    <p
                        className={cn(
                            "text-xl font-bold",
                            thisMonthCount >= lastMonthCount ? "text-emerald-600" : "text-red-600"
                        )}
                    >
                        {thisMonthCount >= lastMonthCount ? "+" : ""}
                        {thisMonthCount - lastMonthCount}명
                    </p>
                </div>
            </div>
        </div>
    );
}
