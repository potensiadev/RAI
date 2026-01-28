"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, MoreHorizontal, CheckCircle, FolderPlus, Loader2, Clock } from "lucide-react";
import type { CandidateSearchResult } from "@/types";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface CandidateCardProps {
    candidate: CandidateSearchResult;
}

export default function CandidateCard({ candidate }: CandidateCardProps) {
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Mock status color logic
    const getStatusColor = (score: number) => {
        if (score >= 90) return "text-emerald-600 bg-emerald-50 border-emerald-100";
        if (score >= 70) return "text-amber-600 bg-amber-50 border-amber-100";
        return "text-rose-600 bg-rose-50 border-rose-100";
    };

    const statusStyle = getStatusColor(candidate.matchScore || 0);

    const handleOpenSaveDialog = async () => {
        setIsSaveDialogOpen(true);
        setIsLoadingProjects(true);
        try {
            const res = await fetch("/api/projects");
            if (res.ok) {
                const data = await res.json();
                setProjects(data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch projects", error);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    const handleSaveToProject = async () => {
        if (!selectedProjectId) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/projects/${selectedProjectId}/candidates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ candidateId: candidate.id })
            });

            if (res.ok) {
                setIsSaveDialogOpen(false);
                // Optional: Show toast success
            }
        } catch (error) {
            console.error("Failed to save candidate", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
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

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-50 transition-colors outline-none">
                                <MoreHorizontal size={18} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={handleOpenSaveDialog}>
                                <FolderPlus size={16} className="mr-2" />
                                Save to Project
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <FileText size={16} className="mr-2" />
                                View Details
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-medium">Match Score</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold border", statusStyle)}>
                            {candidate.matchScore}%
                        </span>
                    </div>

                    {/* AHA Moment: Matching Reasoning - Point 2.1 */}
                    {candidate.matchReason && (
                        <div className="px-3 py-2 rounded-lg bg-emerald-50/50 border border-emerald-100/50 text-[11px] text-emerald-700 leading-relaxed italic">
                            {candidate.matchReason}
                        </div>
                    )}

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

                    {/* Skill Truncation Warning - Point 1.2 */}
                    {candidate.totalSkillsCount && candidate.totalSkillsCount > candidate.skills.length && (
                        <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-100 animate-pulse ml-auto" title="전체 스킬 중 일부만 표시 중">
                            {candidate.totalSkillsCount - candidate.skills.length} MORE OMITTED
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

            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save to Project</DialogTitle>
                        <DialogDescription>
                            Select a project to save <b>{candidate.name}</b> to.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {isLoadingProjects ? (
                            <div className="flex items-center justify-center py-4 text-gray-500">
                                <Loader2 className="animate-spin mr-2" size={16} /> Loading projects...
                            </div>
                        ) : projects.length === 0 ? (
                            <div className="text-center py-4 text-gray-500">
                                No projects found. Create one first.
                            </div>
                        ) : (
                            <Select onValueChange={setSelectedProjectId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a project..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveToProject} disabled={isSaving || !selectedProjectId}>
                            {isSaving ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
