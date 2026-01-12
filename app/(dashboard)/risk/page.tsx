"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronRight,
  Eye,
  Clock,
  User,
  CheckSquare,
  Square,
  Trash2,
  CheckCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const [riskCounts, setRiskCounts] = useState({
    critical: 0,
    warning: 0,
    review: 0,
    safe: 0,
  });

  // Bulk Actions State (PRD P2)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchRiskCandidates();
  }, []);

  // Defense in Depth: API Route로 이동하여 명시적 user_id 필터링
  const fetchRiskCandidates = async () => {
    try {
      const response = await fetch("/api/risk");
      if (!response.ok) throw new Error("Failed to fetch risk candidates");

      const data = await response.json();
      if (data.success) {
        setCandidates(data.data.candidates || []);
        setRiskCounts(data.data.counts);
      }
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

  // riskCounts는 이제 API에서 받아옴 (useState로 관리)

  // ─────────────────────────────────────────────────
  // Bulk Selection Handlers (PRD P2)
  // ─────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCandidates.map((c) => c.id)));
    }
  }, [filteredCandidates, selectedIds.size]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = filteredCandidates.length > 0 && selectedIds.size === filteredCandidates.length;
  const hasSelection = selectedIds.size > 0;

  // ─────────────────────────────────────────────────
  // Bulk Action Handlers
  // ─────────────────────────────────────────────────

  const handleBulkMarkReviewed = useCallback(async () => {
    if (!hasSelection) return;

    setIsBulkActionLoading(true);
    const selectedCount = selectedIds.size;

    try {
      // 선택된 후보자들의 requires_review를 false로 업데이트
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/candidates/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requires_review: false }),
        })
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter((r) => r.status === "fulfilled").length;

      if (successCount === selectedCount) {
        toast.success("검토 완료", `${successCount}명의 후보자가 검토 완료로 표시되었습니다.`);
      } else {
        toast.warning("부분 성공", `${successCount}/${selectedCount}명의 후보자가 처리되었습니다.`);
      }

      // 목록 새로고침
      await fetchRiskCandidates();
      clearSelection();
    } catch (error) {
      console.error("Bulk mark reviewed error:", error);
      toast.error("처리 실패", "일괄 처리 중 오류가 발생했습니다.");
    } finally {
      setIsBulkActionLoading(false);
    }
  }, [selectedIds, hasSelection, toast, clearSelection]);

  const executeBulkDelete = useCallback(async () => {
    setIsBulkActionLoading(true);
    setShowDeleteConfirm(false);
    const selectedCount = selectedIds.size;

    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/candidates/${id}`, {
          method: "DELETE",
        })
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter((r) => r.status === "fulfilled").length;

      if (successCount === selectedCount) {
        toast.success("삭제 완료", `${successCount}명의 후보자가 삭제되었습니다.`);
      } else {
        toast.warning("부분 성공", `${successCount}/${selectedCount}명의 후보자가 삭제되었습니다.`);
      }

      // 목록 새로고침
      await fetchRiskCandidates();
      clearSelection();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("삭제 실패", "일괄 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsBulkActionLoading(false);
    }
  }, [selectedIds, toast, clearSelection]);

  const handleBulkDelete = useCallback(() => {
    if (!hasSelection) return;
    setShowDeleteConfirm(true);
  }, [hasSelection]);

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
          <div className="flex items-center gap-4">
            {/* Select All Checkbox */}
            {filteredCandidates.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title={isAllSelected ? "전체 선택 해제" : "전체 선택"}
              >
                {isAllSelected ? (
                  <CheckSquare className="w-5 h-5 text-primary" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
              </button>
            )}
            <h3 className="font-medium text-white">
              {filterLevel === "all" ? "전체 후보자" : getRiskConfig(filterLevel).label}
              <span className="ml-2 text-slate-400">({filteredCandidates.length})</span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Action Buttons - PRD P2 */}
            {hasSelection && (
              <>
                <span className="text-sm text-slate-400 mr-2">
                  {selectedIds.size}개 선택됨
                </span>
                <button
                  onClick={handleBulkMarkReviewed}
                  disabled={isBulkActionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30
                           text-emerald-400 text-sm font-medium transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  title="선택한 후보자들을 검토 완료로 표시"
                >
                  {isBulkActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  검토 완료
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkActionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-red-500/10 hover:bg-red-500/20 border border-red-500/30
                           text-red-400 text-sm font-medium transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  title="선택한 후보자들을 삭제"
                >
                  {isBulkActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  삭제
                </button>
                <button
                  onClick={clearSelection}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400
                           hover:text-white transition-colors"
                  title="선택 해제"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
            {filterLevel !== "all" && !hasSelection && (
              <button
                onClick={() => setFilterLevel("all")}
                className="text-sm text-primary hover:underline"
              >
                전체 보기
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredCandidates.length === 0 ? (
          <EmptyState
            variant="risk-items"
            cta={filterLevel !== "all" ? {
              label: "전체 보기",
              onClick: () => setFilterLevel("all"),
            } : undefined}
          />
        ) : (
          <div className="divide-y divide-white/5">
            {filteredCandidates.map((candidate) => {
              const level = getRiskLevel(candidate);
              const config = getRiskConfig(level);
              const isSelected = selectedIds.has(candidate.id);

              return (
                <div
                  key={candidate.id}
                  className={cn(
                    "flex items-center p-4 hover:bg-white/5 transition-colors group",
                    isSelected && "bg-primary/5"
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => toggleSelect(candidate.id, e)}
                    className="p-1 mr-3 rounded hover:bg-white/10 transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-primary" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400 group-hover:text-slate-300" />
                    )}
                  </button>

                  {/* Candidate Info */}
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="flex-1 flex items-center justify-between"
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 일괄 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="후보자 일괄 삭제"
        description={`선택한 ${selectedIds.size}명의 후보자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={executeBulkDelete}
        isLoading={isBulkActionLoading}
      />
    </div>
  );
}
