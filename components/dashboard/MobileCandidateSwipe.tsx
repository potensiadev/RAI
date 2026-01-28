"use client";

import { useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Heart, X, Info, Briefcase, MapPin, Sparkles } from "lucide-react";
import type { CandidateSearchResult } from "@/types";
import { cn } from "@/lib/utils";

interface MobileCandidateSwipeProps {
    candidates: CandidateSearchResult[];
    onSwipeLeft?: (candidate: CandidateSearchResult) => void;
    onSwipeRight?: (candidate: CandidateSearchResult) => void;
}

export default function MobileCandidateSwipe({
    candidates,
    onSwipeLeft,
    onSwipeRight,
}: MobileCandidateSwipeProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-25, 25]);
    const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
    const heartOpacity = useTransform(x, [50, 150], [0, 1]);
    const xOpacity = useTransform(x, [-50, -150], [0, 1]);

    const currentCandidate = candidates[currentIndex];

    const handleDragEnd = (event: any, info: any) => {
        if (info.offset.x > 100) {
            // Swipe Right (Like)
            onSwipeRight?.(currentCandidate);
            nextCard();
        } else if (info.offset.x < -100) {
            // Swipe Left (Pass)
            onSwipeLeft?.(currentCandidate);
            nextCard();
        }
    };

    const nextCard = () => {
        if (currentIndex < candidates.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        } else {
            // Reset or show finished state
            setCurrentIndex(0);
        }
    };

    if (!currentCandidate) return null;

    return (
        <div className="relative w-full h-[600px] flex items-center justify-center perspective-1000">
            <AnimatePresence>
                <motion.div
                    key={currentCandidate.id}
                    style={{ x, rotate, opacity }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={handleDragEnd}
                    className="absolute w-full max-w-[340px] aspect-[3/4] bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden cursor-grab active:cursor-grabbing"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ x: x.get() > 0 ? 500 : -500, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    {/* Swipe Indicators */}
                    <motion.div style={{ opacity: heartOpacity }} className="absolute top-8 right-8 z-20 pointer-events-none">
                        <div className="bg-emerald-500/20 backdrop-blur-md border-2 border-emerald-500 rounded-full p-4">
                            <Heart className="text-emerald-500 fill-emerald-500" size={32} />
                        </div>
                    </motion.div>

                    <motion.div style={{ opacity: xOpacity }} className="absolute top-8 left-8 z-20 pointer-events-none">
                        <div className="bg-red-500/20 backdrop-blur-md border-2 border-red-500 rounded-full p-4">
                            <X className="text-red-500" size={32} />
                        </div>
                    </motion.div>

                    {/* Card Content */}
                    <div className="h-full flex flex-col">
                        {/* Visual Top Area */}
                        <div className="h-2/5 bg-gradient-to-br from-primary/10 to-primary/5 p-8 flex flex-col items-center justify-center relative">
                            <div className="w-24 h-24 rounded-2xl bg-white shadow-lg flex items-center justify-center text-4xl font-bold text-primary mb-4">
                                {currentCandidate.name[0]}
                            </div>
                            <div className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm border border-white text-[10px] font-bold text-primary flex items-center gap-1">
                                <Sparkles size={10} />
                                AI RECOMMENDED
                            </div>
                        </div>

                        {/* Info Area */}
                        <div className="flex-1 p-6 space-y-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{currentCandidate.name}</h2>
                                <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                    <Briefcase size={14} />
                                    <span>{currentCandidate.role}</span>
                                    <span>@</span>
                                    <span className="font-medium text-gray-700">{currentCandidate.company}</span>
                                </div>
                            </div>

                            {/* Match Reason (AHA Moment) */}
                            {currentCandidate.matchReason && (
                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 leading-relaxed italic">
                                    {currentCandidate.matchReason}
                                </div>
                            )}

                            {/* Skills */}
                            <div className="flex flex-wrap gap-1.5 pt-2">
                                {currentCandidate.skills.slice(0, 4).map(skill => (
                                    <span key={skill} className="px-2 py-1 rounded-md bg-gray-50 text-gray-600 text-[10px] font-medium border border-gray-200">
                                        {skill}
                                    </span>
                                ))}
                                {currentCandidate.skills.length > 4 && (
                                    <span className="text-[10px] text-gray-400 self-center ml-1">
                                        +{currentCandidate.skills.length - 4}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Bottom Footer */}
                        <div className="p-6 pt-0 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                    {currentCandidate.matchScore}
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                    Match Score
                                </div>
                            </div>
                            <button className="p-3 rounded-full bg-gray-50 text-gray-400 hover:text-primary transition-colors">
                                <Info size={20} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Swipe Guide Text */}
            <div className="absolute bottom-[-40px] flex items-center gap-8 text-[10px] font-bold text-gray-300 tracking-[0.2em] uppercase">
                <div className="flex items-center gap-2">
                    <motion.div animate={{ x: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 2 }}>
                        <X size={12} />
                    </motion.div>
                    SWIPE LEFT TO PASS
                </div>
                <div className="flex items-center gap-2 text-emerald-300">
                    SWIPE RIGHT TO LIKE
                    <motion.div animate={{ x: [5, -5, 5] }} transition={{ repeat: Infinity, duration: 2 }}>
                        <Heart size={12} className="fill-emerald-300" />
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
