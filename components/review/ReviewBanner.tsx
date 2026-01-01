"use client";

import { AlertTriangle, CheckCircle, AlertCircle, Info } from "lucide-react";
import type { ConfidenceLevel } from "@/types";

interface ReviewBannerProps {
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  requiresReview: boolean;
  warnings?: string[];
  analysisMode?: "phase_1" | "phase_2";
  onDismiss?: () => void;
}

const LEVEL_CONFIG = {
  high: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    icon: CheckCircle,
    title: "AI 분석 신뢰도 높음",
    description: "2-Way Cross-Check 결과 일치율이 높습니다. 선택적으로 검토하세요.",
  },
  medium: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    icon: AlertTriangle,
    title: "AI 분석 검토 권장",
    description: "일부 필드에서 불일치가 감지되었습니다. 하이라이트된 필드를 확인해 주세요.",
  },
  low: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    icon: AlertCircle,
    title: "AI 분석 검토 필수",
    description: "분석 결과의 신뢰도가 낮습니다. 모든 필드를 신중하게 검토해 주세요.",
  },
} as const;

export default function ReviewBanner({
  confidenceScore,
  confidenceLevel,
  requiresReview,
  warnings = [],
  analysisMode = "phase_1",
}: ReviewBannerProps) {
  const config = LEVEL_CONFIG[confidenceLevel];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.bg} ${config.border} p-4`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <Icon className={`w-5 h-5 ${config.text}`} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className={`font-semibold ${config.text}`}>
              {config.title}
            </h3>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
              {analysisMode === "phase_2" ? "3-Way" : "2-Way"} Cross-Check
            </span>
          </div>

          <p className="text-sm text-slate-400 mt-1">
            {config.description}
          </p>

          {/* Confidence Score Bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  confidenceLevel === "high"
                    ? "bg-emerald-500"
                    : confidenceLevel === "medium"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${confidenceScore}%` }}
              />
            </div>
            <span className={`text-sm font-mono font-medium ${config.text}`}>
              {confidenceScore}%
            </span>
          </div>
        </div>

        {/* Review Badge */}
        {requiresReview && (
          <div className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30">
            <span className="text-xs font-medium text-orange-400">
              검토 필요
            </span>
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              경고 사항
            </span>
          </div>
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li
                key={index}
                className="text-sm text-slate-400 flex items-start gap-2"
              >
                <span className="text-slate-600">•</span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
