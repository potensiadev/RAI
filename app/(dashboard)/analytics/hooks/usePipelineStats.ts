"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MatchStage } from "@/types";

export interface PipelineStage {
    stage: MatchStage;
    count: number;
    total_entered: number;
    total_exited_forward: number;
}

export interface StageConversion {
    from_stage: MatchStage;
    to_stage: MatchStage;
    count: number;
}

export interface PipelineStats {
    stages: PipelineStage[];
    total_in_pipeline: number;
    placed_count: number;
    conversions: StageConversion[] | null;
}

// Calculate true conversion rates from historical data
export interface ConversionRate {
    from: MatchStage;
    to: MatchStage;
    rate: number;
    movedCount: number;
    totalFromStage: number;
}

const ANALYTICS_STALE_TIME = 5 * 60 * 1000; // 5 minutes

const STAGE_ORDER: MatchStage[] = [
    "matched",
    "reviewed",
    "contacted",
    "interviewing",
    "offered",
    "placed",
];

export function usePipelineStats() {
    const supabase = createClient();

    return useQuery<PipelineStats & { conversionRates: ConversionRate[] }>({
        queryKey: ["analytics", "pipeline"],
        queryFn: async () => {
            const { data, error } = await supabase.rpc("get_pipeline_stats");

            if (error) {
                throw new Error(error.message);
            }

            const rawData = data as PipelineStats;

            // Calculate true conversion rates from historical transitions
            const conversionRates: ConversionRate[] = [];

            if (rawData.conversions && rawData.conversions.length > 0) {
                // Build a map of transitions
                const transitionMap = new Map<string, number>();
                for (const conv of rawData.conversions) {
                    const key = `${conv.from_stage}->${conv.to_stage}`;
                    transitionMap.set(key, conv.count);
                }

                // Calculate entries into each stage
                const entriesMap = new Map<MatchStage, number>();
                for (const conv of rawData.conversions) {
                    const current = entriesMap.get(conv.to_stage) || 0;
                    entriesMap.set(conv.to_stage, current + conv.count);
                }

                // For each consecutive stage pair, calculate conversion rate
                for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
                    const fromStage = STAGE_ORDER[i];
                    const toStage = STAGE_ORDER[i + 1];
                    const key = `${fromStage}->${toStage}`;
                    const movedCount = transitionMap.get(key) || 0;
                    const totalFromStage = entriesMap.get(fromStage) ||
                        (i === 0 ? rawData.total_in_pipeline : 0);

                    conversionRates.push({
                        from: fromStage,
                        to: toStage,
                        rate: totalFromStage > 0 ? (movedCount / totalFromStage) * 100 : 0,
                        movedCount,
                        totalFromStage,
                    });
                }
            }

            return {
                ...rawData,
                conversionRates,
            };
        },
        staleTime: ANALYTICS_STALE_TIME,
        gcTime: 10 * 60 * 1000,
        refetchInterval: ANALYTICS_STALE_TIME,
        refetchOnWindowFocus: false,
    });
}

export function useRefreshPipelineStats() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: ["analytics", "pipeline"] });
    };
}
