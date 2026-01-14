"use client";

import { motion } from "framer-motion";
import { FileText, MoreHorizontal, AlertCircle, CheckCircle, Clock } from "lucide-react";
import type { CandidateSearchResult } from "@/types";
import { cn } from "@/lib/utils";

interface CandidateCardProps {
    candidate: CandidateSearchResult;
}

export default function CandidateCard({ candidate }: CandidateCardProps) {
    // Mock status color logic
    const getStatusColor = (score: number) => {
        if (score >= 90) return "text-emerald-600 bg-emerald-50 border-emerald-100";
        if (score >= 70) return "text-amber-600 bg-amber-50 border-amber-100";
        return "text-rose-600 bg-rose-50 border-rose-100";
    };

    const statusStyle = getStatusColor(candidate.matchScore || 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2, transition: { duration: 0.2, ease: "easeOut" } }}
            className="group relative flex flex-col p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-colors cursor-pointer"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-sm">
                        {candidate.name.substring(0, 1)}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 leading-tight group-hover:text-primary transition-colors">
                            {candidate.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">{candidate.company} · {candidate.role}</p>
                    </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-50 transition-colors">
                    <MoreHorizontal size={18} />
                </button>
            </div>

            <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Match Score</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold border", statusStyle)}>
                        {candidate.matchScore}%
                    </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${candidate.matchScore}%` }}
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {candidate.skills.slice(0, 3).map((skill) => (
                    <span
                        key={skill}
                        className="px-2 py-1 rounded-md bg-gray-50 text-gray-600 text-xs font-medium border border-gray-100"
                    >
                        {skill}
                    </span>
                ))}
                {candidate.skills.length > 3 && (
                    <span className="px-2 py-1 rounded-md bg-gray-50 text-gray-400 text-xs font-medium border border-gray-100">
                        +{candidate.skills.length - 3}
                    </span>
                )}
            </div>

            <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                    <FileText size={14} />
                    <span>PDF</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>2d ago</span>
                </div>
            </div>
        </motion.div>
    );
}
