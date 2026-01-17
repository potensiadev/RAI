/**
 * Hooks Barrel Export
 */

// Candidates
export {
  useCandidates,
  useCandidate,
  usePrefetchCandidates,
  useInvalidateCandidates,
} from "./useCandidates";

// Search
export {
  useSearch,
  useSearchFeedback,
  isSearchResult,
} from "./useSearch";

// Credits
export {
  useCredits,
  useInvalidateCredits,
  useHasInsufficientCredits,
} from "./useCredits";

// Network & Error Recovery (PRD P2)
export {
  useNetworkStatus,
  fetchWithRetry,
  NetworkError,
} from "@/lib/hooks/useNetworkStatus";

// Refund Notifications (PRD Refund Policy v0.4)
export {
  useRefundNotification,
  getRefundNotificationMessage,
  getRefundReasonDetail,
} from "./useRefundNotification";
export type { RefundNotification, RefundEventType } from "./useRefundNotification";

// UI Components
export { useToast } from "@/components/ui/toast";
