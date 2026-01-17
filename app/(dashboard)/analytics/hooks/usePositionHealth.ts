"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { PositionStatus, PositionPriority } from "@/types";

export interface PositionHealth {
    id: string;
    title: string;
    client_company: string | null;
    status: PositionStatus;
    priority: PositionPriority;
    created_at: string;
    deadline: string | null;
    days_open: number;
    match_count: number;
    stuck_count: number;
    health_status: "critical" | "warning" | "good";
}

const ANALYTICS_STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function usePositionHealth(limit: number = 10) {
    const supabase = createClient();

    return useQuery<PositionHealth[]>({
        queryKey: ["analytics", "position-health", limit],
        queryFn: async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase.rpc as any)("get_position_health", {
                p_limit: limit,
            });

            if (error) {
                throw new Error(error.message);
            }

            return (data as PositionHealth[]) || [];
        },
        staleTime: ANALYTICS_STALE_TIME,
        gcTime: 10 * 60 * 1000,
        refetchInterval: ANALYTICS_STALE_TIME,
        refetchOnWindowFocus: false,
    });
}

export function useRefreshPositionHealth() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: ["analytics", "position-health"] });
    };
}
