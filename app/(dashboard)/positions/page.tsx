"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  Filter,
  Briefcase,
  Loader2,
  Plus,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  Calendar,
  Building2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PositionStatus, PositionPriority } from "@/types/position";

interface Position {
  id: string;
  title: string;
  client_company: string | null;
  department: string | null;
  required_skills: string[];
  min_exp_years: number;
  max_exp_years: number | null;
  status: PositionStatus;
  priority: PositionPriority;
  deadline: string | null;
  created_at: string;
  match_count?: number;
}

const STATUS_CONFIG: Record<PositionStatus, { label: string; icon: typeof CheckCircle2; color: string }> = {
  open: { label: "진행중", icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30" },
  paused: { label: "일시중지", icon: PauseCircle, color: "text-yellow-400 bg-yellow-500/20 border-yellow-500/30" },
  closed: { label: "마감", icon: AlertCircle, color: "text-slate-400 bg-slate-500/20 border-slate-500/30" },
  filled: { label: "채용완료", icon: CheckCircle2, color: "text-blue-400 bg-blue-500/20 border-blue-500/30" },
};

const PRIORITY_CONFIG: Record<PositionPriority, { label: string; color: string }> = {
  urgent: { label: "긴급", color: "text-red-400 bg-red-500/20" },
  high: { label: "높음", color: "text-orange-400 bg-orange-500/20" },
  normal: { label: "보통", color: "text-slate-400 bg-slate-500/20" },
  low: { label: "낮음", color: "text-slate-500 bg-slate-600/20" },
};

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [filteredPositions, setFilteredPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PositionStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"recent" | "deadline" | "priority">("recent");

  const supabase = createClient();

  // positions 조회 함수
  const fetchPositions = async (userId: string) => {
    const { data, error } = await supabase
      .from("positions")
      .select("id, title, client_company, department, required_skills, min_exp_years, max_exp_years, status, priority, deadline, created_at, position_candidates(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Positions] Query error:", error);
      throw error;
    }

    // match_count 추가
    return (data || []).map((p: Record<string, unknown>) => ({
      ...p,
      match_count: ((p.position_candidates as { count: number }[])?.[0]?.count) || 0,
    })) as Position[];
  };

  // 페이지 로드 시 사용자 ID 가져오고 positions 조회
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        const data = await fetchPositions(user.id);
        setPositions(data);
      } catch (error) {
        console.error("[Positions] Failed to load:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // 필터링 및 정렬
  useEffect(() => {
    let result = [...positions];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.client_company?.toLowerCase().includes(query) ||
          p.required_skills?.some((s) => s.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case "deadline":
        result.sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
        break;
      case "priority":
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        break;
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setFilteredPositions(result);
  }, [positions, searchQuery, statusFilter, sortBy]);

  // 통계 계산
  const stats = {
    total: positions.length,
    open: positions.filter((p) => p.status === "open").length,
    urgent: positions.filter((p) => p.priority === "urgent" && p.status === "open").length,
    deadlineSoon: positions.filter((p) => {
      if (!p.deadline || p.status !== "open") return false;
      const daysLeft = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 7;
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Positions</h1>
          <p className="text-slate-400 mt-1">
            채용 포지션을 관리하고 후보자를 매칭하세요
          </p>
        </div>
        <Link
          href="/positions/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90
                   text-white font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          새 포지션
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-sm text-slate-400">전체 포지션</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.open}</p>
              <p className="text-sm text-slate-400">진행중</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.urgent}</p>
              <p className="text-sm text-slate-400">긴급</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.deadlineSoon}</p>
              <p className="text-sm text-slate-400">7일 내 마감</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="포지션명, 회사명, 스킬로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                     text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                     focus:outline-none focus:border-primary/50 cursor-pointer"
          >
            <option value="all">전체 상태</option>
            <option value="open">진행중</option>
            <option value="paused">일시중지</option>
            <option value="closed">마감</option>
            <option value="filled">채용완료</option>
          </select>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                       focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="recent">최근 등록순</option>
              <option value="deadline">마감일순</option>
              <option value="priority">우선순위순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Position Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredPositions.length === 0 ? (
        <div className="text-center py-20">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">
            {searchQuery || statusFilter !== "all" ? "검색 결과가 없습니다" : "등록된 포지션이 없습니다"}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Link
              href="/positions/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              첫 포지션 등록하기
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPositions.map((position) => {
            const statusConfig = STATUS_CONFIG[position.status];
            const priorityConfig = PRIORITY_CONFIG[position.priority];
            const StatusIcon = statusConfig.icon;

            // 마감일 계산
            let deadlineText = "";
            let deadlineUrgent = false;
            if (position.deadline) {
              const daysLeft = Math.ceil(
                (new Date(position.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              if (daysLeft < 0) {
                deadlineText = "마감됨";
              } else if (daysLeft === 0) {
                deadlineText = "오늘 마감";
                deadlineUrgent = true;
              } else if (daysLeft <= 7) {
                deadlineText = `D-${daysLeft}`;
                deadlineUrgent = true;
              } else {
                deadlineText = new Date(position.deadline).toLocaleDateString("ko-KR");
              }
            }

            return (
              <Link
                key={position.id}
                href={`/positions/${position.id}`}
                className="group p-5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80
                         border border-white/10 hover:border-primary/30
                         transition-all duration-300 hover:shadow-lg hover:shadow-primary/10
                         hover:-translate-y-1"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-primary transition-colors truncate">
                      {position.title}
                    </h3>
                    {position.client_company && (
                      <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {position.client_company}
                        {position.department && ` / ${position.department}`}
                      </p>
                    )}
                  </div>
                  {/* Priority Badge */}
                  {position.priority !== "normal" && (
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      priorityConfig.color
                    )}>
                      {priorityConfig.label}
                    </span>
                  )}
                </div>

                {/* Experience */}
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                  <span>
                    경력 {position.min_exp_years}년
                    {position.max_exp_years && ` ~ ${position.max_exp_years}년`}
                  </span>
                </div>

                {/* Skills */}
                {position.required_skills && position.required_skills.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    {position.required_skills.slice(0, 4).map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-slate-700/50 text-xs text-slate-300"
                      >
                        {skill}
                      </span>
                    ))}
                    {position.required_skills.length > 4 && (
                      <span className="text-xs text-slate-500">
                        +{position.required_skills.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  {/* Status & Deadline */}
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                      statusConfig.color
                    )}>
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig.label}
                    </span>
                    {deadlineText && (
                      <span className={cn(
                        "flex items-center gap-1 text-xs",
                        deadlineUrgent ? "text-orange-400" : "text-slate-500"
                      )}>
                        <Calendar className="w-3 h-3" />
                        {deadlineText}
                      </span>
                    )}
                  </div>

                  {/* Match Count */}
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Users className="w-3.5 h-3.5" />
                    <span>{position.match_count || 0}명 매칭</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
