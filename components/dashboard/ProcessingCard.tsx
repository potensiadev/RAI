"use client";

/**
 * ProcessingCard - 처리 중인 후보자 카드
 *
 * UX Improvement:
 * - 토스 스타일의 친절한 UX Writing 적용 ("~하고 있어요")
 * - 3초마다 변경되는 롤링 메시지로 진행 상황 구체화
 * - "멈춘 게 아니다"라는 확신을 주는 마이크로 인터랙션
 * - **이탈 가능 안내**: 바쁜 사용자를 위한 백그라운드 처리 안내 추가
 * - **실패 상태 UI**: 분석 실패 시 사용자 친화적 에러 메시지 + 재시도 버튼
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Loader2, FileText, CheckCircle2, Info, XCircle, RotateCcw } from "lucide-react";
import type { CandidateStatus, QuickExtractedData } from "@/types";

interface ProcessingCardProps {
  candidate: {
    id: string;
    status: CandidateStatus;
    name?: string;
    last_company?: string;
    last_position?: string;
    quick_extracted?: QuickExtractedData;
    created_at: string;
  };
  /** 분석 실패 시 원본 에러 메시지 */
  errorMessage?: string;
  /** 재시도 콜백 */
  onRetry?: (candidateId: string) => Promise<void>;
}

// 단계별 롤링 메시지 정의
const LOADING_MESSAGES = {
  processing: [
    "이력서를 꼼꼼히 읽고 있어요",
    "파일 형식을 확인하고 있어요",
    "잠시만 기다려주세요",
  ],
  parsed: [
    "경력 사항을 정리하고 있어요",
    "주요 성과를 찾고 있어요",
    "어떤 역량이 있는지 파악 중이에요",
  ],
  analyzed: [
    "매칭 점수를 계산하고 있어요",
    "거의 다 되었습니다",
    "마무리 정리 중이에요",
  ],
  completed: ["분석이 완료되었습니다!"],
  failed: ["분석에 실패했습니다"],
  rejected: ["분석할 수 없는 파일입니다."],
};

// 에러 메시지 → 사용자 친화적 메시지 매핑
const ERROR_MESSAGES: Record<string, string> = {
  "Worker connection failed": "서버 연결에 실패했어요. 잠시 후 다시 시도해주세요.",
  STALE_QUEUED: "처리 대기 시간이 초과되었어요.",
  PROCESSING_TIMEOUT: "분석 시간이 초과되었어요.",
  "Magic byte validation failed": "파일 형식을 확인할 수 없어요.",
  "ZIP structure validation failed": "파일 구조가 올바르지 않아요.",
  "Invalid file structure": "파일 내부 구조가 올바르지 않아요.",
};

/**
 * 원본 에러 메시지를 사용자 친화적 메시지로 변환
 */
function getFriendlyErrorMessage(errorMessage?: string): string {
  if (!errorMessage) {
    return "분석 중 오류가 발생했어요. 다시 시도해주세요.";
  }

  // 매핑된 에러 키워드 확인
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorMessage.includes(key)) {
      return message;
    }
  }

  // 기본 메시지
  return "분석 중 오류가 발생했어요. 다시 시도해주세요.";
}

export default function ProcessingCard({
  candidate,
  errorMessage,
  onRetry,
}: ProcessingCardProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const isFailed = candidate.status === "failed";

  // 상태에 따른 진행률 설정
  const getProgress = (status: CandidateStatus) => {
    switch (status) {
      case "processing":
        return 15;
      case "parsed":
        return 45;
      case "analyzed":
        return 85;
      case "completed":
        return 100;
      case "failed":
        return 0;
      default:
        return 0;
    }
  };

  // 재시도 핸들러
  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry(candidate.id);
    } finally {
      setIsRetrying(false);
    }
  };

  // 롤링 메시지 로직
  useEffect(() => {
    const messages = LOADING_MESSAGES[candidate.status as keyof typeof LOADING_MESSAGES] || LOADING_MESSAGES.processing;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000); // 3초마다 메시지 변경

    return () => clearInterval(interval);
  }, [candidate.status]);

  // 팁 메시지 표시 지연 (3초 후 표시)
  useEffect(() => {
    if (candidate.status !== 'completed' && candidate.status !== 'failed') {
      const timer = setTimeout(() => {
        setShowTip(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [candidate.status]);

  const currentMessages = LOADING_MESSAGES[candidate.status as keyof typeof LOADING_MESSAGES] || LOADING_MESSAGES.processing;
  const currentMessage = currentMessages[messageIndex];

  // 파일명 추출 (fallback)
  const fileName = candidate.quick_extracted?.name
    ? `${candidate.quick_extracted.name}님의 이력서`
    : isFailed
      ? "이력서 분석 실패"
      : "이력서 분석 중...";

  // 사용자 친화적 에러 메시지
  const friendlyError = getFriendlyErrorMessage(errorMessage);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative p-6 rounded-2xl bg-white border shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden min-h-[180px] flex flex-col justify-between ${
        isFailed ? "border-red-200" : "border-gray-100"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isFailed
                ? "bg-red-50"
                : candidate.status === "completed"
                  ? "bg-blue-50"
                  : "bg-blue-50"
            }`}
          >
            {isFailed ? (
              <XCircle className="w-5 h-5 text-red-500" />
            ) : candidate.status === "completed" ? (
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
            ) : (
              <FileText className="w-5 h-5 text-blue-500" />
            )}
          </div>
          <div>
            <h3
              className={`font-bold text-lg leading-tight ${
                isFailed ? "text-red-700" : "text-gray-900"
              }`}
            >
              {fileName}
            </h3>
            <p className="text-gray-400 text-xs mt-1">
              {new Date(candidate.created_at).toLocaleString("ko-KR", {
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        {!isFailed && (
          <span className="text-blue-500 font-bold text-sm">
            {getProgress(candidate.status)}%
          </span>
        )}
        {isFailed && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
            분석 실패
          </span>
        )}
      </div>

      {/* Progress & Message Area */}
      <div className="space-y-3 mt-4">
        {/* Failed State: Error Message + Retry Button */}
        {isFailed ? (
          <>
            {/* Error Message Box */}
            <div className="bg-red-50 rounded-lg p-3 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
              <p className="text-sm text-red-600 leading-relaxed">
                {friendlyError}
              </p>
            </div>

            {/* Retry Button */}
            {onRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                         bg-red-500 hover:bg-red-600 disabled:bg-red-300
                         text-white font-medium text-sm transition-colors"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    재시도 중...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    다시 분석하기
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <>
            {/* Dynamic Message with AnimatePresence */}
            <div className="h-6 overflow-hidden relative">
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentMessage}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-gray-600 font-medium text-sm absolute w-full"
                >
                  {candidate.status !== "completed" && (
                    <Loader2 className="w-3.5 h-3.5 inline-block mr-2 animate-spin text-blue-500 mb-0.5" />
                  )}
                  {currentMessage}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${getProgress(candidate.status)}%` }}
                transition={{ duration: 1, ease: "easeInOut" }}
                className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
              />
              {/* Shimmer Effect */}
              {candidate.status !== "completed" && (
                <motion.div
                  className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              )}
            </div>

            {/* Background Processing Tip (Friendly UX) */}
            <AnimatePresence>
              {showTip && candidate.status !== "completed" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-50 rounded-lg p-2.5 flex items-start gap-2 text-xs text-slate-500 mt-2"
                >
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                  <p className="leading-relaxed">
                    <span className="font-semibold text-slate-600">Tip.</span>{" "}
                    다른 페이지로 이동하셔도 돼요. 분석은 계속 진행됩니다.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.div>
  );
}
