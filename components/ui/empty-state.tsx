"use client";

import { ReactNode } from "react";
import Link from "next/link";
import {
  Search,
  Bookmark,
  ShieldCheck,
  FileText,
  Users,
  Plus,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type EmptyStateVariant =
  | "search-results"
  | "saved-searches"
  | "risk-items"
  | "candidates"
  | "positions"
  | "generic";

interface CTAButton {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  description?: string;
  cta?: CTAButton;
  className?: string;
  children?: ReactNode;
}

// ─────────────────────────────────────────────────
// Variant Configs
// ─────────────────────────────────────────────────

const variantConfigs: Record<
  EmptyStateVariant,
  {
    icon: typeof Search;
    defaultTitle: string;
    defaultDescription: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  "search-results": {
    icon: Search,
    defaultTitle: "검색 결과가 없습니다",
    defaultDescription: "다른 조건으로 검색해보세요. 필터를 조정하거나 검색어를 변경하면 더 많은 결과를 찾을 수 있습니다.",
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
  },
  "saved-searches": {
    icon: Bookmark,
    defaultTitle: "저장된 검색이 없습니다",
    defaultDescription: "자주 사용하는 검색 조건을 저장해보세요. 검색 후 저장 버튼을 클릭하면 빠르게 재사용할 수 있습니다.",
    iconBg: "bg-neon-cyan/20",
    iconColor: "text-neon-cyan",
  },
  "risk-items": {
    icon: ShieldCheck,
    defaultTitle: "리스크 항목이 없습니다",
    defaultDescription: "모든 데이터가 정상입니다. 검토가 필요한 후보자가 발견되면 여기에 표시됩니다.",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  candidates: {
    icon: Users,
    defaultTitle: "후보자가 없습니다",
    defaultDescription: "이력서를 업로드하여 후보자 풀을 구축해보세요.",
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
  },
  positions: {
    icon: FileText,
    defaultTitle: "포지션이 없습니다",
    defaultDescription: "새 포지션을 등록하여 후보자 매칭을 시작해보세요.",
    iconBg: "bg-neon-purple/20",
    iconColor: "text-neon-purple",
  },
  generic: {
    icon: AlertCircle,
    defaultTitle: "데이터가 없습니다",
    defaultDescription: "표시할 데이터가 없습니다.",
    iconBg: "bg-slate-500/20",
    iconColor: "text-slate-400",
  },
};

// ─────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────

export function EmptyState({
  variant,
  title,
  description,
  cta,
  className = "",
  children,
}: EmptyStateProps) {
  const config = variantConfigs[variant];
  const Icon = config.icon;

  const displayTitle = title || config.defaultTitle;
  const displayDescription = description || config.defaultDescription;

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
      {/* Icon */}
      <div className={`w-16 h-16 rounded-2xl ${config.iconBg} flex items-center justify-center mb-6`}>
        <Icon className={`w-8 h-8 ${config.iconColor}`} />
      </div>

      {/* Text */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
        {displayTitle}
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
        {displayDescription}
      </p>

      {/* CTA Button */}
      {cta && (
        cta.href ? (
          <Link
            href={cta.href}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                     bg-primary text-white text-sm font-medium
                     hover:bg-primary/90 transition-colors"
          >
            {variant === "candidates" || variant === "positions" ? (
              <Plus className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {cta.label}
          </Link>
        ) : (
          <button
            onClick={cta.onClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                     bg-primary text-white text-sm font-medium
                     hover:bg-primary/90 transition-colors"
          >
            {variant === "candidates" || variant === "positions" ? (
              <Plus className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {cta.label}
          </button>
        )
      )}

      {/* Custom content */}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Skeleton Components
// ─────────────────────────────────────────────────

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl bg-white/5 border border-white/10 p-4 animate-pulse"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-white/10" />
            <div className="flex-1">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
            <div className="w-16 h-8 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex gap-4 animate-pulse">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-white/10 rounded"
            style={{ width: `${100 / cols}%` }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="px-4 py-4 border-b border-white/5 last:border-b-0 flex gap-4 animate-pulse"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-4 bg-white/10 rounded"
              style={{ width: `${100 / cols}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 animate-pulse"
        >
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="flex-1">
            <div className="h-4 bg-white/10 rounded w-2/3 mb-1" />
            <div className="h-3 bg-white/10 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-white/5 border border-white/10 animate-pulse"
        >
          <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
          <div className="h-6 bg-white/10 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}
