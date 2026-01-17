"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface ExpDistribution {
    entry: number;
    junior: number;
    middle: number;
    senior: number;
    lead: number;
}

export interface SkillData {
    name: string;
    skill_count: number;
}

export interface CompanyData {
    name: string;
    company_count: number;
}

export interface MonthlyData {
    month_key: string;
    month_label: string;
    count: number;
}

export interface TalentPoolStats {
    exp_distribution: ExpDistribution;
    top_skills: SkillData[] | null;
    top_companies: CompanyData[] | null;
    monthly_candidates: MonthlyData[] | null;
    monthly_placements: MonthlyData[] | null;
}

const ANALYTICS_STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useTalentPoolStats() {
    const supabase = createClient();

    return useQuery<TalentPoolStats>({
        queryKey: ["analytics", "talent-pool"],
        queryFn: async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase.rpc as any)("get_talent_pool_stats");

            if (error) {
                throw new Error(error.message);
            }

            return data as TalentPoolStats;
        },
        staleTime: ANALYTICS_STALE_TIME,
        gcTime: 10 * 60 * 1000,
        refetchInterval: ANALYTICS_STALE_TIME,
        refetchOnWindowFocus: false,
    });
}

export function useRefreshTalentPoolStats() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: ["analytics", "talent-pool"] });
    };
}
