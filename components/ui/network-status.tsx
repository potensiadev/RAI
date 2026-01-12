"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";

interface NetworkStatusIndicatorProps {
  onReconnect?: () => void;
}

/**
 * 네트워크 상태 표시 컴포넌트 (PRD P2)
 * - 오프라인 시 경고 배너 표시
 * - 재연결 시 성공 메시지 표시
 */
export default function NetworkStatusIndicator({
  onReconnect,
}: NetworkStatusIndicatorProps) {
  const { isOnline, wasOffline } = useNetworkStatus(onReconnect);
  const [showReconnected, setShowReconnected] = useState(false);

  // 재연결 시 성공 메시지 표시
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  return (
    <AnimatePresence>
      {/* 오프라인 배너 */}
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-red-500/95 backdrop-blur-sm
                     py-3 px-4 flex items-center justify-center gap-3 shadow-lg"
        >
          <WifiOff className="w-5 h-5 text-white" />
          <span className="text-white font-medium">
            오프라인 상태입니다. 일부 기능이 제한됩니다.
          </span>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 px-3 py-1 rounded-lg
                     bg-white/20 hover:bg-white/30 text-white text-sm
                     transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
        </motion.div>
      )}

      {/* 재연결 성공 배너 */}
      {showReconnected && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-emerald-500/95 backdrop-blur-sm
                     py-3 px-4 flex items-center justify-center gap-3 shadow-lg"
        >
          <Wifi className="w-5 h-5 text-white" />
          <span className="text-white font-medium">
            네트워크에 다시 연결되었습니다!
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 네트워크 상태 Badge (헤더용)
 * 작은 인디케이터로 온라인/오프라인 상태 표시
 */
export function NetworkStatusBadge() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg
                 bg-red-500/20 border border-red-500/30 text-red-400"
      title="오프라인 상태"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">오프라인</span>
    </div>
  );
}
