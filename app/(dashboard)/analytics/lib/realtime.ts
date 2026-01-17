"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseAnalyticsRealtimeOptions {
    enabled?: boolean;
}

/**
 * Hook to subscribe to realtime updates for analytics data
 * Automatically invalidates relevant queries when changes occur
 */
export function useAnalyticsRealtime(options: UseAnalyticsRealtimeOptions = {}) {
    const { enabled = true } = options;
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const channelsRef = useRef<RealtimeChannel[]>([]);
    const supabase = createClient();

    useEffect(() => {
        if (!enabled) return;

        // Subscribe to position_candidates for stage changes
        const positionCandidatesChannel = supabase
            .channel("analytics-position-candidates")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "position_candidates",
                },
                (payload) => {
                    // Check if this is a placement (stage changed to 'placed')
                    if (
                        payload.eventType === "UPDATE" &&
                        payload.new?.stage === "placed" &&
                        payload.old?.stage !== "placed"
                    ) {
                        // Show toast notification - RT-4
                        toast({
                            title: "🎉 채용 완료!",
                            description: "새로운 채용이 기록되었습니다",
                            variant: "default",
                        });
                    }

                    // Invalidate pipeline stats - RT-1
                    queryClient.invalidateQueries({ queryKey: ["analytics", "pipeline"] });
                    // Invalidate position health
                    queryClient.invalidateQueries({ queryKey: ["analytics", "position-health"] });
                    // Invalidate activities
                    queryClient.invalidateQueries({ queryKey: ["analytics", "activities"] });
                }
            )
            .subscribe();

        channelsRef.current.push(positionCandidatesChannel);

        // Subscribe to candidates for new completions - RT-2
        const candidatesChannel = supabase
            .channel("analytics-candidates")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "candidates",
                    filter: "status=eq.completed",
                },
                () => {
                    // Invalidate summary stats
                    queryClient.invalidateQueries({ queryKey: ["analytics", "summary"] });
                    // Invalidate talent pool stats
                    queryClient.invalidateQueries({ queryKey: ["analytics", "talent-pool"] });
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "candidates",
                },
                (payload) => {
                    // If status changed to completed, update stats
                    if (payload.new?.status === "completed" && payload.old?.status !== "completed") {
                        queryClient.invalidateQueries({ queryKey: ["analytics", "summary"] });
                        queryClient.invalidateQueries({ queryKey: ["analytics", "talent-pool"] });
                    }
                }
            )
            .subscribe();

        channelsRef.current.push(candidatesChannel);

        // Subscribe to positions for new positions
        const positionsChannel = supabase
            .channel("analytics-positions")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "positions",
                },
                () => {
                    // Invalidate summary (active positions count)
                    queryClient.invalidateQueries({ queryKey: ["analytics", "summary"] });
                    // Invalidate position health
                    queryClient.invalidateQueries({ queryKey: ["analytics", "position-health"] });
                }
            )
            .subscribe();

        channelsRef.current.push(positionsChannel);

        // Cleanup on unmount - RT-5, MEM-3
        return () => {
            channelsRef.current.forEach((channel) => {
                supabase.removeChannel(channel);
            });
            channelsRef.current = [];
        };
    }, [enabled, queryClient, toast, supabase]);
}

/**
 * Manually trigger a full analytics refresh
 */
export function useRefreshAllAnalytics() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
    };
}
