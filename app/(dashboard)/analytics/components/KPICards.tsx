"use client";

import {
    Users,
    FileText,
    ArrowUp,
    ArrowDown,
    Briefcase,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsSummary, useRefreshAnalyticsSummary } from "../hooks";
import { KPISkeleton } from "./skeletons";

interface KPICardsProps {
    className?: string;
}

export function KPICards({ className }: KPICardsProps) {
    const { data, isLoading, error, isFetching } = useAnalyticsSummary();
    const refreshSummary = useRefreshAnalyticsSummary();

    if (isLoading) {
        return <KPISkeleton />;
    }

    if (error || !data) {
        return (
            <div className={cn("p-6 rounded-2xl bg-red-50 border border-red-100 text-center", className)}>
                <p className="text-red-600">KPI 데이터를 불러올 수 없습니다</p>
                <button
                    onClick={refreshSummary}
                    className="mt-2 text-sm text-red-500 hover:text-red-700 flex items-center gap-1 mx-auto"
                >
                    <RefreshCw className="w-4 h-4" />
                    다시 시도
                </button>
            </div>
        );
    }

    const candidateChange =
        data.last_month_count > 0
            ? ((data.this_month_count - data.last_month_count) / data.last_month_count) * 100
            : 0;

    return (
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative", className)}>
            {/* Loading indicator overlay */}
            {isFetching && (
                <div className="absolute top-0 right-0 p-1">
                    <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
            )}

            {/* Placement Rate - placeholder, calculated from pipeline */}
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                    {data.active_positions > 0 ? "—" : "0%"}
                </p>
                <p className="text-sm text-gray-500 mt-1">채용 성공률</p>
            </div>

            {/* Active Positions */}
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-blue-50">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                    </div>
                    {data.urgent_positions > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-xs font-medium text-red-600">
                            <AlertTriangle className="w-3 h-3" />
                            {data.urgent_positions} 긴급
                        </span>
                    )}
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.active_positions}</p>
                <p className="text-sm text-gray-500 mt-1">진행중인 포지션</p>
            </div>

            {/* Total Candidates */}
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                        <Users className="w-5 h-5 text-primary" />
                    </div>
                    {data.this_month_count > 0 && (
                        <span
                            className={cn(
                                "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium",
                                candidateChange >= 0
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-red-50 text-red-600"
                            )}
                        >
                            {candidateChange >= 0 ? (
                                <ArrowUp className="w-3 h-3" />
                            ) : (
                                <ArrowDown className="w-3 h-3" />
                            )}
                            +{data.this_month_count}
                        </span>
                    )}
                </div>
                <p className="text-3xl font-bold text-gray-900">
                    {data.total_candidates.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">등록된 후보자</p>
            </div>

            {/* Blind Exports */}
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-violet-50">
                        <FileText className="w-5 h-5 text-violet-600" />
                    </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                    {data.total_exports.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">블라인드 내보내기</p>
            </div>
        </div>
    );
}
