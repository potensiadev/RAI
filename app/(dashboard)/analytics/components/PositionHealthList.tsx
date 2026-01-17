"use client";

import Link from "next/link";
import { CheckCircle2, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePositionHealth, useRefreshPositionHealth } from "../hooks";
import { PositionHealthSkeleton } from "./skeletons";

interface PositionHealthListProps {
    className?: string;
}

export function PositionHealthList({ className }: PositionHealthListProps) {
    const { data, isLoading, error, isFetching } = usePositionHealth(5);
    const refreshHealth = useRefreshPositionHealth();

    if (isLoading) {
        return <PositionHealthSkeleton />;
    }

    if (error) {
        return (
            <div className={cn("p-6 rounded-2xl bg-red-50 border border-red-100 text-center", className)}>
                <p className="text-red-600">포지션 현황을 불러올 수 없습니다</p>
                <button
                    onClick={refreshHealth}
                    className="mt-2 text-sm text-red-500 hover:text-red-700 flex items-center gap-1 mx-auto"
                >
                    <RefreshCw className="w-4 h-4" />
                    다시 시도
                </button>
            </div>
        );
    }

    const positions = data || [];

    return (
        <div className={cn("p-6 rounded-2xl bg-white border border-gray-100 shadow-sm relative", className)}>
            {/* Loading indicator */}
            {isFetching && (
                <div className="absolute top-4 right-4">
                    <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">포지션 현황</h3>
                    <p className="text-sm text-gray-500 mt-0.5">주의가 필요한 포지션</p>
                </div>
            </div>

            {positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <CheckCircle2 className="w-10 h-10 mb-2 text-emerald-400" />
                    <p className="text-sm">모든 포지션이 정상입니다</p>
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        {positions.map((position) => (
                            <div
                                key={position.id}
                                className={cn(
                                    "p-3 rounded-xl border transition-colors",
                                    position.health_status === "critical"
                                        ? "border-red-200 bg-red-50/50"
                                        : position.health_status === "warning"
                                            ? "border-amber-200 bg-amber-50/50"
                                            : "border-gray-100 bg-gray-50/50"
                                )}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {position.health_status === "critical" && (
                                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                            )}
                                            {position.health_status === "warning" && (
                                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                            )}
                                            {position.health_status === "good" && (
                                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            )}
                                            {/* Clickable position title - NAV-1 */}
                                            <Link
                                                href={`/positions/${position.id}`}
                                                className="font-medium text-gray-900 truncate hover:underline hover:text-primary transition-colors group inline-flex items-center gap-1"
                                            >
                                                {position.title}
                                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                            </Link>
                                        </div>
                                        {position.client_company && (
                                            <p className="text-xs text-gray-500 mt-0.5 ml-4">
                                                {position.client_company}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="text-gray-500">{position.days_open}일</span>
                                        <span
                                            className={cn(
                                                "px-2 py-0.5 rounded-full",
                                                position.match_count === 0
                                                    ? "bg-gray-100 text-gray-600"
                                                    : "bg-blue-100 text-blue-600"
                                            )}
                                        >
                                            {position.match_count}명
                                        </span>
                                    </div>
                                </div>
                                {position.stuck_count > 0 && (
                                    <p className="text-xs text-amber-600 mt-2 ml-4">
                                        {position.stuck_count}명이 7일 이상 정체 중
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* View All link - NAV-4 */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        <Link
                            href="/positions?status=open&sort=health"
                            className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1 justify-center"
                        >
                            전체 포지션 보기
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}
