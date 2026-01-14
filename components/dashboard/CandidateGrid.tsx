"use client";

import { motion } from "framer-motion";
import CandidateCard from "./CandidateCard";
import type { CandidateSearchResult } from "@/types";
import { Inbox } from "lucide-react";

interface CandidateGridProps {
    searchResults: CandidateSearchResult[];
    isSearching: boolean;
    searchQuery?: string;
}

export default function CandidateGrid({ searchResults, isSearching, searchQuery }: CandidateGridProps) {
    if (searchResults.length === 0 && !isSearching) {
        if (searchQuery) {
            return (
                <div className="w-full h-[400px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                    <Inbox size={48} className="mb-4 opacity-50" />
                    <p className="font-medium text-gray-900">No candidates found</p>
                    <p className="text-sm">Try adjusting your search terms</p>
                </div>
            )
        }
        return (
            <div className="w-full h-[400px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                <Inbox size={48} className="mb-4 opacity-50" />
                <p className="font-medium text-gray-900">No candidates yet</p>
                <p className="text-sm">Upload resumes to get started</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {searchResults.map((candidate) => (
                <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
        </div>
    );
}
