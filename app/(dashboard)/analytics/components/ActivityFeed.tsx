"use client";

import {
    Users,
    Briefcase,
    TrendingUp,
    UserCheck,
    Activity,
    RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecentActivities, useRefreshRecentActivities } from "../hooks";
import { ActivitySkeleton } from "./skeletons";

interface ActivityFeedProps {
    className?: string;
}

function formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function ActivityFeed({ className }: ActivityFeedProps) {
    const { data, isLoading, error, isFetching } = useRecentActivities(10);
    const refreshActivities = useRefreshRecentActivities();

    if (isLoading) {
        return <ActivitySkeleton />;
    }

    if (error) {
        return (
            <div className={cn("p-6 rounded-2xl bg-red-50 border border-red-100 text-center", className)}>
                <p className="text-red-600">활동 내역을 불러올 수 없습니다</p>
                <button
                    onClick={refreshActivities}
                    className="mt-2 text-sm text-red-500 hover:text-red-700 flex items-center gap-1 mx-auto"
                >
                    <RefreshCw className="w-4 h-4" />
                    다시 시도
                </button>
            </div>
        );
    }

    const activities = data || [];

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
                    <h3 className="text-lg font-semibold text-gray-900">최근 활동</h3>
                    <p className="text-sm text-gray-500 mt-0.5">채용 활동 타임라인</p>
                </div>
                <Activity className="w-5 h-5 text-gray-400" />
            </div>

            {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <Activity className="w-10 h-10 mb-2" />
                    <p className="text-sm">아직 활동 기록이 없습니다</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {activities.map((activity, index) => (
                        <div key={activity.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center",
                                        activity.display_type === "placement"
                                            ? "bg-emerald-100"
                                            : activity.display_type === "position_created"
                                                ? "bg-purple-100"
                                                : "bg-gray-100"
                                    )}
                                >
                                    {activity.display_type === "placement" && (
                                        <UserCheck className="w-4 h-4 text-emerald-600" />
                                    )}
                                    {activity.display_type === "position_created" && (
                                        <Briefcase className="w-4 h-4 text-purple-600" />
                                    )}
                                    {activity.display_type === "stage_change" && (
                                        <TrendingUp className="w-4 h-4 text-gray-600" />
                                    )}
                                    {activity.display_type === "other" && (
                                        <Users className="w-4 h-4 text-gray-600" />
                                    )}
                                </div>
                                {index < activities.length - 1 && (
                                    <div className="w-px h-full bg-gray-200 my-1" />
                                )}
                            </div>
                            <div className="flex-1 pb-4">
                                <p className="text-sm text-gray-900">{activity.description}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {formatTimeAgo(activity.created_at)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
