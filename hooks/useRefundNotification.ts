"use client";

/**
 * useRefundNotification - Supabase Realtime 기반 환불 알림
 *
 * PRD: prd_refund_policy_v0.4.md Section 3.4
 * QA: refund_policy_test_scenarios_v1.0.md (EC-026 ~ EC-030)
 *
 * - 품질 환불 알림 수신
 * - 업로드 실패 환불 알림 수신
 * - Toast 알림 표시
 */

import { useEffect, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RefundEventType = "quality_refund" | "upload_refund";

export interface RefundNotification {
  type: RefundEventType;
  message: string;
  details: {
    candidateId?: string;
    confidence?: number;
    missingFields?: string[];
  };
  timestamp: string;
}

export interface UseRefundNotificationOptions {
  /** 알림 수신 시 콜백 */
  onNotification?: (notification: RefundNotification) => void;
  /** Toast 표시 여부 (기본: true) */
  showToast?: boolean;
}

/**
 * 환불 알림 Realtime Hook
 *
 * @param userId - 현재 사용자 ID
 * @param options - 옵션 설정
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { data: user } = useUser();
 *
 *   useRefundNotification(user?.id, {
 *     onNotification: (notification) => {
 *       toast.info(notification.message);
 *     },
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useRefundNotification(
  userId?: string,
  options?: UseRefundNotificationOptions
) {
  const queryClient = useQueryClient();
  const [lastNotification, setLastNotification] =
    useState<RefundNotification | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleNotification = useCallback(
    (payload: { payload: RefundNotification }) => {
      const notification = payload.payload;
      console.log("[RefundNotification] Received:", notification);

      setLastNotification(notification);

      // 콜백 호출
      options?.onNotification?.(notification);

      // 크레딧 캐시 무효화 (환불로 크레딧 복구됨)
      queryClient.invalidateQueries({ queryKey: ["credits"] });

      // 후보자 목록 캐시 무효화 (환불된 후보자 제거)
      if (notification.details.candidateId) {
        queryClient.invalidateQueries({ queryKey: ["candidates"] });
        queryClient.removeQueries({
          queryKey: ["candidate", notification.details.candidateId],
        });
      }
    },
    [queryClient, options]
  );

  useEffect(() => {
    if (!userId) {
      console.log("[RefundNotification] No userId, skipping subscription");
      return;
    }

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    const setupChannel = async () => {
      console.log(
        `[RefundNotification] Subscribing to refund notifications for user: ${userId.slice(0, 8)}`
      );

      channel = supabase.channel(`user:${userId}`);

      channel
        .on("broadcast", { event: "refund_notification" }, handleNotification)
        .subscribe((status) => {
          console.log(`[RefundNotification] Subscription status: ${status}`);
          setIsConnected(status === "SUBSCRIBED");
        });
    };

    setupChannel();

    return () => {
      if (channel) {
        console.log("[RefundNotification] Unsubscribing from refund notifications");
        supabase.removeChannel(channel);
      }
    };
  }, [userId, handleNotification]);

  return {
    /** 마지막으로 수신한 알림 */
    lastNotification,
    /** 연결 상태 */
    isConnected,
    /** 알림 초기화 */
    clearNotification: () => setLastNotification(null),
  };
}

/**
 * 환불 알림 메시지 생성
 */
export function getRefundNotificationMessage(notification: RefundNotification): string {
  switch (notification.type) {
    case "quality_refund":
      return "분석 품질이 기준에 미달하여 크레딧이 자동 환불되었습니다.";
    case "upload_refund":
      return "파일 처리 실패로 크레딧이 환불되었습니다.";
    default:
      return notification.message || "환불이 처리되었습니다.";
  }
}

/**
 * 환불 사유 상세 메시지 생성
 */
export function getRefundReasonDetail(notification: RefundNotification): string | null {
  if (notification.type !== "quality_refund") return null;

  const { confidence, missingFields } = notification.details;
  const parts: string[] = [];

  if (typeof confidence === "number") {
    parts.push(`신뢰도: ${Math.round(confidence * 100)}%`);
  }

  if (missingFields && missingFields.length > 0) {
    const fieldNames: Record<string, string> = {
      name: "이름",
      contact: "연락처",
      last_company: "최근 직장",
    };
    const missingNames = missingFields.map((f) => fieldNames[f] || f).join(", ");
    parts.push(`누락 정보: ${missingNames}`);
  }

  return parts.length > 0 ? parts.join(" / ") : null;
}

export default useRefundNotification;
