"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, Sparkles, CheckCircle, Image, Search } from "lucide-react";
import { useEffect } from "react";

export type ProcessingPhase =
    | "idle"
    | "uploading"
    | "routing"      // Phase 1: Router Agent
    | "analyzing"    // Phase 2: Cross-Check (GPT + Gemini)
    | "extracting"   // Phase 3: Visual/Privacy Agent
    | "embedding"    // Phase 4: Vector Embedding
    | "complete";

interface ProcessingVisualizationProps {
    phase: ProcessingPhase;
    fileName?: string;
    onComplete?: () => void;
}

const PHASES = [
    { id: "routing", label: "문서 확인", icon: FileText },
    { id: "analyzing", label: "AI 분석", icon: Sparkles },
    { id: "extracting", label: "정보 추출", icon: Image },
    { id: "embedding", label: "검색 최적화", icon: Search },
    { id: "complete", label: "완료", icon: CheckCircle },
];

export default function ProcessingVisualization({
    phase,
    fileName,
    onComplete,
}: ProcessingVisualizationProps) {
    // 완료 콜백
    useEffect(() => {
        if (phase === "complete") {
            const timer = setTimeout(() => onComplete?.(), 1500);
            return () => clearTimeout(timer);
        }
    }, [phase, onComplete]);

    if (phase === "idle") return null;

    const currentPhaseIndex = PHASES.findIndex(p => p.id === phase);
    const progressPercent = currentPhaseIndex >= 0
        ? Math.round(((currentPhaseIndex + 1) / PHASES.length) * 100)
        : 0;

    // 현재 단계별 설명 메시지
    const getStatusMessage = () => {
        switch (phase) {
            case "routing": return "이력서 형식을 확인하고 있어요...";
            case "analyzing": return "AI가 이력서를 분석하고 있어요...";
            case "extracting": return "핵심 정보를 추출하고 있어요...";
            case "embedding": return "검색을 위해 최적화하고 있어요...";
            case "complete": return "분석이 완료되었습니다!";
            default: return "처리 중...";
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
        >
            {/* Header with Status Message */}
            <div className="text-center mb-6">
                <motion.div
                    animate={{ scale: phase !== "complete" ? [1, 1.05, 1] : 1 }}
                    transition={{ duration: 1.5, repeat: phase !== "complete" ? Infinity : 0 }}
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-3"
                >
                    {phase === "complete" ? (
                        <CheckCircle size={24} />
                    ) : (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                            <Sparkles size={24} />
                        </motion.div>
                    )}
                </motion.div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {phase === "complete" ? "분석 완료!" : "이력서를 분석하고 있어요"}
                </h3>
                <p className="text-sm text-gray-500">{getStatusMessage()}</p>
                {fileName && (
                    <p className="text-xs text-gray-400 mt-1 truncate max-w-[280px] mx-auto">{fileName}</p>
                )}
            </div>

            {/* Unified Progress Bar */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-600">진행률</span>
                    <span className="text-xs text-gray-500">{progressPercent}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full bg-primary rounded-full"
                    />
                </div>
            </div>

            {/* Phase Steps */}
            <div className="flex items-center justify-between">
                {PHASES.map((p, index) => {
                    const isComplete = index < currentPhaseIndex;
                    const isCurrent = p.id === phase;
                    const Icon = p.icon;

                    return (
                        <div key={p.id} className="flex flex-col items-center flex-1 relative">
                            {/* Connection Line */}
                            {index > 0 && (
                                <div className="absolute top-4 -left-1/2 w-full h-0.5 bg-gray-100">
                                    <motion.div
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: isComplete ? 1 : 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="h-full bg-primary origin-left"
                                    />
                                </div>
                            )}

                            {/* Icon */}
                            <motion.div
                                animate={{
                                    scale: isCurrent ? [1, 1.1, 1] : 1,
                                }}
                                transition={{ duration: 0.5, repeat: isCurrent ? Infinity : 0 }}
                                className={`
                                    relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center mb-2
                                    ${isComplete ? "bg-primary border-primary text-white" : ""}
                                    ${isCurrent ? "bg-primary/10 border-primary text-primary" : ""}
                                    ${!isComplete && !isCurrent ? "bg-white border-gray-200 text-gray-300" : ""}
                                `}
                            >
                                {isComplete ? (
                                    <CheckCircle size={14} />
                                ) : (
                                    <Icon size={14} />
                                )}
                            </motion.div>

                            {/* Label */}
                            <span className={`text-xs font-medium ${isCurrent ? "text-primary" : isComplete ? "text-gray-700" : "text-gray-400"}`}>
                                {p.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Helper Message */}
            <p className="text-center text-xs text-gray-400 mt-6">
                분석이 완료되면 자동으로 후보자에 추가됩니다
            </p>
        </motion.div>
    );
}
