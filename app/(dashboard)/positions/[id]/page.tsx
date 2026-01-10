"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Edit2,
  Trash2,
  Users,
  Building2,
  Calendar,
  MapPin,
  GraduationCap,
  Briefcase,
  Target,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { Position, PositionCandidate, MatchStage, PositionStatus } from "@/types/position";

const STAGE_CONFIG: Record<MatchStage, { label: string; color: string; bgColor: string }> = {
  matched: { label: "매칭됨", color: "text-slate-400", bgColor: "bg-slate-500/20" },
  reviewed: { label: "검토완료", color: "text-blue-400", bgColor: "bg-blue-500/20" },
  contacted: { label: "연락중", color: "text-cyan-400", bgColor: "bg-cyan-500/20" },
  interviewing: { label: "면접진행", color: "text-purple-400", bgColor: "bg-purple-500/20" },
  offered: { label: "오퍼", color: "text-amber-400", bgColor: "bg-amber-500/20" },
  placed: { label: "채용완료", color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
  rejected: { label: "불합격", color: "text-red-400", bgColor: "bg-red-500/20" },
  withdrawn: { label: "지원철회", color: "text-slate-500", bgColor: "bg-slate-600/20" },
};

const STAGE_ORDER: MatchStage[] = [
  "matched", "reviewed", "contacted", "interviewing", "offered", "placed"
];

const STATUS_CONFIG: Record<PositionStatus, { label: string; color: string }> = {
  open: { label: "진행중", color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30" },
  paused: { label: "일시중지", color: "text-yellow-400 bg-yellow-500/20 border-yellow-500/30" },
  closed: { label: "마감", color: "text-slate-400 bg-slate-500/20 border-slate-500/30" },
  filled: { label: "채용완료", color: "text-blue-400 bg-blue-500/20 border-blue-500/30" },
};

interface ScoreDistribution {
  excellent: number;
  good: number;
  fair: number;
  low: number;
}

export default function PositionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const positionId = params.id as string;

  const [position, setPosition] = useState<Position | null>(null);
  const [matches, setMatches] = useState<PositionCandidate[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<ScoreDistribution>({
    excellent: 0, good: 0, fair: 0, low: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStage, setSelectedStage] = useState<MatchStage | "all">("all");
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState<string | null>(null);

  // 포지션 상세 조회
  const fetchPosition = useCallback(async () => {
    try {
      const response = await fetch(`/api/positions/${positionId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("오류", "포지션을 찾을 수 없습니다.");
          router.push("/positions");
          return;
        }
        throw new Error("Failed to fetch position");
      }
      const data = await response.json();
      setPosition(data.data);
    } catch (error) {
      console.error("Fetch position error:", error);
      toast.error("오류", "포지션 정보를 불러오는데 실패했습니다.");
    }
  }, [positionId, router, toast]);

  // 매칭 결과 조회
  const fetchMatches = useCallback(async () => {
    try {
      const response = await fetch(`/api/positions/${positionId}/matches`);
      if (!response.ok) throw new Error("Failed to fetch matches");
      const data = await response.json();
      setMatches(data.data.matches || []);
      setScoreDistribution(data.data.scoreDistribution || { excellent: 0, good: 0, fair: 0, low: 0 });
    } catch (error) {
      console.error("Fetch matches error:", error);
    }
  }, [positionId]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchPosition(), fetchMatches()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchPosition, fetchMatches]);

  // 매칭 새로고침
  const handleRefreshMatches = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/positions/${positionId}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50, minScore: 30 }),
      });
      if (!response.ok) throw new Error("Failed to refresh matches");
      const data = await response.json();
      toast.success("성공", data.meta?.message || "매칭이 새로고침되었습니다.");
      await fetchMatches();
    } catch (error) {
      console.error("Refresh matches error:", error);
      toast.error("오류", "매칭 새로고침에 실패했습니다.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // 스테이지 변경
  const handleStageChange = async (candidateId: string, newStage: MatchStage) => {
    try {
      const response = await fetch(`/api/positions/${positionId}/matches/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!response.ok) throw new Error("Failed to update stage");

      // Optimistic update
      setMatches((prev) =>
        prev.map((m) =>
          m.candidateId === candidateId ? { ...m, stage: newStage } : m
        )
      );
      toast.success("성공", `상태가 "${STAGE_CONFIG[newStage].label}"로 변경되었습니다.`);
    } catch (error) {
      console.error("Update stage error:", error);
      toast.error("오류", "상태 변경에 실패했습니다.");
    }
  };

  // 메모 저장
  const handleSaveNote = async (candidateId: string) => {
    setSavingNote(candidateId);
    try {
      const response = await fetch(`/api/positions/${positionId}/matches/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteInput }),
      });
      if (!response.ok) throw new Error("Failed to save note");

      setMatches((prev) =>
        prev.map((m) =>
          m.candidateId === candidateId ? { ...m, notes: noteInput } : m
        )
      );
      setExpandedMatch(null);
      setNoteInput("");
      toast.success("성공", "메모가 저장되었습니다.");
    } catch (error) {
      console.error("Save note error:", error);
      toast.error("오류", "메모 저장에 실패했습니다.");
    } finally {
      setSavingNote(null);
    }
  };

  // 포지션 삭제
  const handleDelete = async () => {
    if (!confirm("정말 이 포지션을 삭제하시겠습니까? 모든 매칭 정보가 함께 삭제됩니다.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete position");

      toast.success("성공", "포지션이 삭제되었습니다.");
      router.push("/positions");
    } catch (error) {
      console.error("Delete position error:", error);
      toast.error("오류", "포지션 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 필터링된 매칭
  const filteredMatches = selectedStage === "all"
    ? matches
    : matches.filter((m) => m.stage === selectedStage);

  // 스테이지별 카운트
  const stageCounts = matches.reduce((acc, m) => {
    acc[m.stage] = (acc[m.stage] || 0) + 1;
    return acc;
  }, {} as Record<MatchStage, number>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!position) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-slate-400">포지션을 찾을 수 없습니다.</p>
        <Link href="/positions" className="text-primary hover:underline">
          포지션 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[position.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/positions"
            className="p-2 rounded-lg hover:bg-white/5 transition-colors mt-1"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{position.title}</h1>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium border",
                statusConfig.color
              )}>
                {statusConfig.label}
              </span>
            </div>
            {position.clientCompany && (
              <p className="text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                {position.clientCompany}
                {position.department && ` / ${position.department}`}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshMatches}
            disabled={isRefreshing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-colors",
              isRefreshing
                ? "bg-white/5 text-slate-500 cursor-not-allowed"
                : "bg-primary/20 text-primary hover:bg-primary/30"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            매칭 새로고침
          </button>
          <Link
            href={`/positions/${positionId}/edit`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            수정
          </Link>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            삭제
          </button>
        </div>
      </div>

      {/* Position Info */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Briefcase className="w-4 h-4" />
            경력
          </div>
          <p className="text-white font-medium">
            {position.minExpYears}년
            {position.maxExpYears && ` ~ ${position.maxExpYears}년`}
          </p>
        </div>
        {position.requiredEducationLevel && (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <GraduationCap className="w-4 h-4" />
              학력
            </div>
            <p className="text-white font-medium">{position.requiredEducationLevel}</p>
          </div>
        )}
        {position.locationCity && (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <MapPin className="w-4 h-4" />
              근무지
            </div>
            <p className="text-white font-medium">{position.locationCity}</p>
          </div>
        )}
        {position.deadline && (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Calendar className="w-4 h-4" />
              마감일
            </div>
            <p className="text-white font-medium">
              {new Date(position.deadline).toLocaleDateString("ko-KR")}
            </p>
          </div>
        )}
      </div>

      {/* Skills */}
      {position.requiredSkills && position.requiredSkills.length > 0 && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
            <Target className="w-4 h-4" />
            필수 스킬
          </div>
          <div className="flex flex-wrap gap-2">
            {position.requiredSkills.map((skill, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
          {position.preferredSkills && position.preferredSkills.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-slate-400 text-sm mt-4 mb-2">
                우대 스킬
              </div>
              <div className="flex flex-wrap gap-2">
                {position.preferredSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-lg bg-slate-700/50 text-slate-300 text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Score Distribution */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white font-medium">
            <Users className="w-5 h-5 text-primary" />
            매칭된 후보자 ({matches.length}명)
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-400">우수 ({scoreDistribution.excellent})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-slate-400">양호 ({scoreDistribution.good})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="text-slate-400">보통 ({scoreDistribution.fair})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-slate-400">낮음 ({scoreDistribution.low})</span>
            </span>
          </div>
        </div>

        {/* Stage Tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedStage("all")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              selectedStage === "all"
                ? "bg-primary text-white"
                : "bg-white/5 text-slate-400 hover:text-white"
            )}
          >
            전체 ({matches.length})
          </button>
          {STAGE_ORDER.map((stage) => (
            <button
              key={stage}
              onClick={() => setSelectedStage(stage)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                selectedStage === stage
                  ? cn(STAGE_CONFIG[stage].bgColor, STAGE_CONFIG[stage].color)
                  : "bg-white/5 text-slate-400 hover:text-white"
              )}
            >
              {STAGE_CONFIG[stage].label} ({stageCounts[stage] || 0})
            </button>
          ))}
        </div>

        {/* Matches List */}
        {filteredMatches.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            {matches.length === 0
              ? "아직 매칭된 후보자가 없습니다. 매칭 새로고침을 시도해보세요."
              : "해당 상태의 후보자가 없습니다."}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMatches.map((match) => {
              const stageConfig = STAGE_CONFIG[match.stage];
              const scoreColor =
                match.overallScore >= 80
                  ? "text-emerald-400"
                  : match.overallScore >= 60
                  ? "text-blue-400"
                  : match.overallScore >= 40
                  ? "text-yellow-400"
                  : "text-slate-400";

              return (
                <div
                  key={match.id}
                  className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    {/* Candidate Info */}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 flex items-center justify-center text-white font-semibold">
                        {match.candidate?.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <Link
                          href={`/candidates/${match.candidateId}`}
                          className="font-medium text-white hover:text-primary transition-colors flex items-center gap-1"
                        >
                          {match.candidate?.name || "이름 미확인"}
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        </Link>
                        <p className="text-sm text-slate-400">
                          {match.candidate?.lastPosition || "직책 미확인"}
                          {match.candidate?.lastCompany && ` @ ${match.candidate.lastCompany}`}
                        </p>
                      </div>
                    </div>

                    {/* Scores */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className={cn("text-2xl font-bold", scoreColor)}>
                          {match.overallScore}%
                        </p>
                        <p className="text-xs text-slate-500">종합점수</p>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <div className="text-center">
                          <p className="text-white">{match.skillScore}%</p>
                          <p className="text-xs text-slate-500">스킬</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white">{match.experienceScore}%</p>
                          <p className="text-xs text-slate-500">경력</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white">{match.semanticScore}%</p>
                          <p className="text-xs text-slate-500">적합도</p>
                        </div>
                      </div>

                      {/* Stage Dropdown */}
                      <div className="relative group">
                        <button
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                            stageConfig.bgColor,
                            stageConfig.color
                          )}
                        >
                          {stageConfig.label}
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 py-1 rounded-lg bg-slate-800 border border-white/10 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[140px]">
                          {STAGE_ORDER.map((stage) => (
                            <button
                              key={stage}
                              onClick={() => handleStageChange(match.candidateId, stage)}
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors",
                                stage === match.stage
                                  ? STAGE_CONFIG[stage].color
                                  : "text-slate-300"
                              )}
                            >
                              {STAGE_CONFIG[stage].label}
                            </button>
                          ))}
                          <div className="border-t border-white/10 my-1" />
                          <button
                            onClick={() => handleStageChange(match.candidateId, "rejected")}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            불합격
                          </button>
                          <button
                            onClick={() => handleStageChange(match.candidateId, "withdrawn")}
                            className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-white/5 transition-colors"
                          >
                            지원철회
                          </button>
                        </div>
                      </div>

                      {/* Note Button */}
                      <button
                        onClick={() => {
                          if (expandedMatch === match.id) {
                            setExpandedMatch(null);
                            setNoteInput("");
                          } else {
                            setExpandedMatch(match.id);
                            setNoteInput(match.notes || "");
                          }
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          match.notes
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-white/5 text-slate-400 hover:text-white"
                        )}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Matched Skills */}
                  {match.matchedSkills && match.matchedSkills.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500">매칭 스킬:</span>
                      {match.matchedSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs"
                        >
                          {skill}
                        </span>
                      ))}
                      {match.missingSkills && match.missingSkills.length > 0 && (
                        <>
                          <span className="text-xs text-slate-500 ml-2">부족:</span>
                          {match.missingSkills.slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-xs"
                            >
                              {skill}
                            </span>
                          ))}
                          {match.missingSkills.length > 3 && (
                            <span className="text-xs text-slate-500">
                              +{match.missingSkills.length - 3}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Note Input */}
                  {expandedMatch === match.id && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <textarea
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="메모를 입력하세요..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                                 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 resize-none"
                      />
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setExpandedMatch(null);
                            setNoteInput("");
                          }}
                          className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSaveNote(match.candidateId)}
                          disabled={savingNote === match.candidateId}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                        >
                          {savingNote === match.candidateId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          저장
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Existing Note Display */}
                  {match.notes && expandedMatch !== match.id && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/10 text-sm text-amber-200/80">
                      <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" />
                      {match.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
