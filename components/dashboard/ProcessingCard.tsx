"use client";

/**
 * ProcessingCard - 처리 중인 후보자 카드
 * 
 * UX Improvement:
 * - 토스 스타일의 친절한 UX Writing 적용 ("~하고 있어요")
 * - 3초마다 변경되는 롤링 메시지로 진행 상황 구체화
 * - "멈춘 게 아니다"라는 확신을 주는 마이크로 인터랙션
 * - **이탈 가능 안내**: 바쁜 사용자를 위한 백그라운드 처리 안내 추가
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Loader2, FileText, CheckCircle2, Info } from "lucide-react";
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
  failed: ["분석에 실패했습니다. 다시 시도해주세요."],
  rejected: ["분석할 수 없는 파일입니다."],
};

export default function ProcessingCard({ candidate }: ProcessingCardProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [showTip, setShowTip] = useState(false);

  // 상태에 따른 진행률 설정
  const getProgress = (status: CandidateStatus) => {
    switch (status) {
      case "processing": return 15;
      case "parsed": return 45;
      case "analyzed": return 85;
      case "completed": return 100;
      default: return 0;
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
    : "이력서 분석 중...";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative p-6 rounded-2xl bg-white border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden min-h-[180px] flex flex-col justify-between"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            {candidate.status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
            ) : (
              <FileText className="w-5 h-5 text-blue-500" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">
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
        <span className="text-blue-500 font-bold text-sm">
          {getProgress(candidate.status)}%
        </span>
      </div>

      {/* Progress & Message Area */}
      <div className="space-y-3 mt-4">
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
              {candidate.status !== 'completed' && candidate.status !== 'failed' && (
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
          {candidate.status !== 'completed' && (
            <motion.div
              className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          )}
        </div>

        {/* Background Processing Tip (Friendly UX) */}
        <AnimatePresence>
          {showTip && candidate.status !== 'completed' && candidate.status !== 'failed' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-slate-50 rounded-lg p-2.5 flex items-start gap-2 text-xs text-slate-500 mt-2"
            >
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
              <p className="leading-relaxed">
                <span className="font-semibold text-slate-600">Tip.</span> 다른 페이지로 이동하셔도 돼요. 분석은 계속 진행됩니다.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
