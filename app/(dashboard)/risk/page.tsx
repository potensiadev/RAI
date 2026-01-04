"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronRight,
  Eye,
  Clock,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskCandidate {
  id: string;
  name: string;
  last_position: string | null;
  last_company: string | null;
  confidence_score: number;
  warnings: string[];
  requires_review: boolean;
  created_at: string;
}

type RiskLevel = "critical" | "warning" | "review" | "safe";

export default function RiskPage() {
  const [candidates, setCandidates] = useState<RiskCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<RiskLevel | "all">("all");

  const supabase = createClient();

  useEffect(() => {
    fetchRiskCandidates();
  }, []);

  const fetchRiskCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, name, last_position, last_company, confidence_score, warnings, requires_review, created_at")
        .eq("status", "completed")
        .eq("is_latest", true)
        .order("confidence_score", { ascending: true });

      if (error) throw error;
      setCandidates(data || []);
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskLevel = (candidate: RiskCandidate): RiskLevel => {
    const score = candidate.confidence_score || 0;
    if (score < 0.6) return "critical";
    if (score < 0.8) return "warning";
    if (candidate.requires_review || (candidate.warnings?.length || 0) > 0) return "review";
    return "safe";
  };

  const getRiskConfig = (level: RiskLevel) => {
    switch (level) {
      case "critical":
        return {
          icon: AlertCircle,
          color: "text-red-400",
          bgColor: "bg-red-500/20",
          borderColor: "border-red-500/30",
          label: "위험",
        };
      case "warning":
        return {
          icon: AlertTriangle,
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/20",
          borderColor: "border-yellow-500/30",
          label: "주의",
        };
      case "review":
        return {
          icon: Eye,
          color: "text-blue-400",
          bgColor: "bg-blue-500/20",
          borderColor: "border-blue-500/30",
          label: "검토 필요",
        };
      default:
        return {
          icon: CheckCircle,
          color: "text-emerald-400",
          bgColor: "bg-emerald-500/20",
          borderColor: "border-emerald-500/30",
          label: "안전",
        };
    }
  };

  const filteredCandidates = filterLevel === "all"
    ? candidates
    : candidates.filter((c) => getRiskLevel(c) === filterLevel);

  const riskCounts = {
    critical: candidates.filter((c) => getRiskLevel(c) === "critical").length,
    warning: candidates.filter((c) => getRiskLevel(c) === "warning").length,
    review: candidates.filter((c) => getRiskLevel(c) === "review").length,
    safe: candidates.filter((c) => getRiskLevel(c) === "safe").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Risk Management</h1>
        <p className="text-slate-400 mt-1">
          신뢰도가 낮거나 검토가 필요한 후보자를 관리하세요
        </p>
      </div>

      {/* Risk Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {(["critical", "warning", "review", "safe"] as RiskLevel[]).map((level) => {
          const config = getRiskConfig(level);
          const count = riskCounts[level];
          const isActive = filterLevel === level;

          return (
            <button
              key={level}
              onClick={() => setFilterLevel(isActive ? "all" : level)}
              className={cn(
                "p-4 rounded-xl border transition-all text-left",
                isActive
                  ? `${config.bgColor} ${config.borderColor}`
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", config.bgColor)}>
                  <config.icon className={cn("w-5 h-5", config.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-sm text-slate-400">{config.label}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Risk List */}
      <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-medium text-white">
            {filterLevel === "all" ? "전체 후보자" : getRiskConfig(filterLevel).label}
            <span className="ml-2 text-slate-400">({filteredCandidates.length})</span>
          </h3>
          {filterLevel !== "all" && (
            <button
              onClick={() => setFilterLevel("all")}
              className="text-sm text-primary hover:underline"
            >
              전체 보기
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            해당하는 후보자가 없습니다
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredCandidates.map((candidate) => {
              const level = getRiskLevel(candidate);
              const config = getRiskConfig(level);

              return (
                <Link
                  key={candidate.id}
                  href={`/candidates/${candidate.id}`}
                  className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg", config.bgColor)}>
                      <config.icon className={cn("w-5 h-5", config.color)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white group-hover:text-primary transition-colors">
                          {candidate.name || "이름 미확인"}
                        </h3>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs",
                          config.bgColor, config.color
                        )}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                        {candidate.last_position && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {candidate.last_position}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(candidate.created_at).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-slate-400">신뢰도</p>
                      <p className={cn("font-medium", config.color)}>
                        {Math.round((candidate.confidence_score || 0) * 100)}%
                      </p>
                    </div>
                    {(candidate.warnings?.length || 0) > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-slate-400">경고</p>
                        <p className="font-medium text-yellow-400">
                          {candidate.warnings.length}건
                        </p>
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
