"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface AnalyticsSummary {
    total_candidates: number;
    this_month_count: number;
    last_month_count: number;
    total_exports: number;
    active_positions: number;
    urgent_positions: number;
}

const ANALYTICS_STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useAnalyticsSummary() {
    const supabase = createClient();

    return useQuery<AnalyticsSummary>({
        queryKey: ["analytics", "summary"],
        queryFn: async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase.rpc as any)("get_analytics_summary");

            if (error) {
                throw new Error(error.message);
            }

            return data as AnalyticsSummary;
        },
        staleTime: ANALYTICS_STALE_TIME,
        gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
        refetchInterval: ANALYTICS_STALE_TIME,
        refetchOnWindowFocus: false,
    });
}

// Hook to invalidate and refetch analytics summary
export function useRefreshAnalyticsSummary() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: ["analytics", "summary"] });
    };
}
