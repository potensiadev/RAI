
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Folder, Clock, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Project {
    id: string;
    name: string;
    description: string;
    updated_at: string;
    project_candidates: { count: number }[];
}

export default function ProjectsPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectDesc, setNewProjectDesc] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch("/api/projects");
            if (res.ok) {
                const data = await res.json();
                setProjects(data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch projects", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;

        setIsCreating(true);
        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newProjectName,
                    description: newProjectDesc
                })
            });

            if (res.ok) {
                setNewProjectName("");
                setNewProjectDesc("");
                setIsDialogOpen(false);
                fetchProjects(); // Refresh list
            }
        } catch (error) {
            console.error("Failed to create project", error);
        } finally {
            setIsCreating(false);
        }
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Projects</h1>
                    <p className="text-gray-500 mt-2">Manage your recruiting pipelines and talent pools.</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-indigo-500/20 transition-all">
                            <Plus size={18} />
                            New Project
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Project</DialogTitle>
                            <DialogDescription>
                                Create a folder to organize candidates for a specific role or client.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Project Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Samsung Frontend 2024"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="desc">Description (Optional)</Label>
                                <Textarea
                                    id="desc"
                                    placeholder="Internal notes about this requisition..."
                                    value={newProjectDesc}
                                    onChange={(e) => setNewProjectDesc(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateProject} disabled={isCreating}>
                                {isCreating ? "Creating..." : "Create Project"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                        <Folder className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">No projects yet</h3>
                    <p className="text-gray-500 max-w-sm text-center mt-2 mb-6">
                        Create your first project to start saving and organizing top candidates.
                    </p>
                    <Button onClick={() => setIsDialogOpen(true)} variant="outline">Create Project</Button>
                </div>
            ) : (
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {projects.map((project) => (
                        <motion.div
                            key={project.id}
                            variants={item}
                            whileHover={{ y: -4, transition: { duration: 0.2 } }}
                            onClick={() => router.push(`/projects/${project.id}`)}
                            className="group bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md cursor-pointer transition-all relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <Folder size={20} />
                                </div>
                                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600">
                                    <MoreHorizontal size={18} />
                                </Button>
                            </div>

                            <h3 className="font-semibold text-lg text-gray-900 mb-2 truncate pr-2">
                                {project.name}
                            </h3>
                            <p className="text-sm text-gray-500 line-clamp-2 mb-6 h-10">
                                {project.description || "No description"}
                            </p>

                            <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-50 pt-4">
                                <div className="flex items-center gap-1.5">
                                    <Clock size={14} />
                                    <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                                </div>
                                <div className="font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                                    {/* Handle count safely */}
                                    {project.project_candidates?.[0]?.count || 0} Candidates
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
}
