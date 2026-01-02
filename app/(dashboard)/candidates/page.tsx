"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  Filter,
  Users,
  Loader2,
  ChevronRight,
  Building2,
  Calendar,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  name: string;
  last_position: string | null;
  last_company: string | null;
  exp_years: number;
  skills: string[];
  confidence_score: number;
  created_at: string;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "confidence" | "exp">("recent");

  const supabase = createClient();

  useEffect(() => {
    fetchCandidates();
  }, []);

  useEffect(() => {
    filterAndSort();
  }, [candidates, searchQuery, sortBy]);

  const fetchCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, name, last_position, last_company, exp_years, skills, confidence_score, created_at")
        .eq("status", "completed")
        .eq("is_latest", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCandidates(data || []);
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSort = () => {
    let result = [...candidates];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(query) ||
          c.last_position?.toLowerCase().includes(query) ||
          c.last_company?.toLowerCase().includes(query) ||
          c.skills?.some((s) => s.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case "confidence":
        result.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
        break;
      case "exp":
        result.sort((a, b) => (b.exp_years || 0) - (a.exp_years || 0));
        break;
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setFilteredCandidates(result);
  };

  const getConfidenceColor = (score: number) => {
    const percent = score * 100;
    if (percent >= 95) return "text-emerald-400";
    if (percent >= 80) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Candidates</h1>
        <p className="text-slate-400 mt-1">
          등록된 모든 후보자를 확인하고 관리하세요
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="이름, 직책, 회사, 스킬로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                     text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                     focus:outline-none focus:border-primary/50 cursor-pointer"
          >
            <option value="recent">최근 등록순</option>
            <option value="confidence">신뢰도순</option>
            <option value="exp">경력순</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{candidates.length}</p>
              <p className="text-sm text-slate-400">전체 후보자</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Star className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {candidates.filter((c) => (c.confidence_score || 0) >= 0.95).length}
              </p>
              <p className="text-sm text-slate-400">높은 신뢰도</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {candidates.filter((c) => {
                  const date = new Date(c.created_at);
                  const now = new Date();
                  return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
                }).length}
              </p>
              <p className="text-sm text-slate-400">최근 7일</p>
            </div>
          </div>
        </div>
      </div>

      {/* Candidate List */}
      <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            {searchQuery ? "검색 결과가 없습니다" : "등록된 후보자가 없습니다"}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredCandidates.map((candidate) => (
              <Link
                key={candidate.id}
                href={`/candidates/${candidate.id}`}
                className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 flex items-center justify-center text-white font-semibold">
                    {candidate.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h3 className="font-medium text-white group-hover:text-primary transition-colors">
                      {candidate.name || "이름 미확인"}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      {candidate.last_position && (
                        <span>{candidate.last_position}</span>
                      )}
                      {candidate.last_company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {candidate.last_company}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-slate-400">경력</p>
                    <p className="font-medium text-white">{candidate.exp_years || 0}년</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">신뢰도</p>
                    <p className={cn("font-medium", getConfidenceColor(candidate.confidence_score || 0))}>
                      {Math.round((candidate.confidence_score || 0) * 100)}%
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
