"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface RecentActivity {
    id: string;
    activity_type: string;
    description: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
    display_type: "placement" | "position_created" | "stage_change" | "other";
}

const ANALYTICS_STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useRecentActivities(limit: number = 10) {
    const supabase = createClient();

    return useQuery<RecentActivity[]>({
        queryKey: ["analytics", "activities", limit],
        queryFn: async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase.rpc as any)("get_recent_activities", {
                p_limit: limit,
            });

            if (error) {
                throw new Error(error.message);
            }

            return (data as RecentActivity[]) || [];
        },
        staleTime: ANALYTICS_STALE_TIME,
        gcTime: 10 * 60 * 1000,
        refetchInterval: ANALYTICS_STALE_TIME,
        refetchOnWindowFocus: false,
    });
}

export function useRefreshRecentActivities() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: ["analytics", "activities"] });
    };
}
