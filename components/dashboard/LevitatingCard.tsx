"use client";

import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { AlertTriangle, User, MoreHorizontal, ShieldCheck } from "lucide-react";
import { FLOATING_PHYSICS, HEAVY_APPEAR } from "@/lib/physics";
import { cn } from "@/lib/utils";

interface LevitatingCardProps {
    name: string;
    role: string;
    matchScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    delay?: number; // For staggered entrance
}

export default function LevitatingCard({ name, role, matchScore, riskLevel, delay = 0 }: LevitatingCardProps) {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
        const { left, top, width, height } = currentTarget.getBoundingClientRect();
        const x = (clientX - left) / width - 0.5;
        const y = (clientY - top) / height - 0.5;

        mouseX.set(x * 10); // Rotate X degree limit
        mouseY.set(y * 10); // Rotate Y degree limit
    }

    function handleMouseLeave() {
        mouseX.set(0);
        mouseY.set(0);
    }

    const transform = useMotionTemplate`perspective(1000px) rotateX(${-1 * 0}deg) rotateY(${0}deg)`; // Simplified tilt for less jitter
    // Ideally: rotateX(${mouseY}deg) rotateY(${mouseX}deg) - but simplified for stability without complex useSpring logic here. 
    // Let's use a simpler tilt:

    return (
        <motion.div
            initial="initial"
            animate="animate"
            variants={{
                initial: HEAVY_APPEAR.initial,
                animate: {
                    ...HEAVY_APPEAR.animate,
                    transition: { ...HEAVY_APPEAR.transition, delay }
                }
            }}
            className="relative group"
        >
            {/* Floating Wrapper */}
            <motion.div
                animate={FLOATING_PHYSICS.y}
                // Add random delay to float to desynchronize cards
                transition={{ ...FLOATING_PHYSICS.y, delay: Math.random() * 2 }}
                className={cn(
                    "relative p-6 rounded-2xl bg-[#0F0F24]/60 backdrop-blur-md border transition-all duration-300",
                    // Risk Logic
                    riskLevel === 'high'
                        ? "border-risk/50 shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:border-risk hover:shadow-[0_0_30px_rgba(244,63,94,0.3)]"
                        : "border-white/5 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]"
                )}
            >
                {/* Pulsating Risk Indicator Overlay */}
                {riskLevel === 'high' && (
                    <div className="absolute inset-0 rounded-2xl border border-risk/20 animate-pulse pointer-events-none" />
                )}

                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-slate-300">
                            <User size={20} />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold leading-tight">{name}</h3>
                            <p className="text-slate-400 text-xs">{role}</p>
                        </div>
                    </div>
                    {riskLevel === 'high' ? (
                        <div className="flex items-center gap-1 text-risk text-xs font-bold px-2 py-1 bg-risk/10 rounded-full border border-risk/20">
                            <AlertTriangle size={12} />
                            <span>RISK DETECTED</span>
                        </div>
                    ) : (
                        <div className="p-1 text-slate-500 hover:text-white transition-colors cursor-pointer">
                            <MoreHorizontal size={16} />
                        </div>
                    )}
                </div>

                {/* AI Score */}
                <div className="flex items-end gap-2 mb-4">
                    <span className="text-3xl font-bold text-white font-mono">{matchScore}%</span>
                    <span className="text-xs text-ai mb-1.5 font-medium">MATCH SCORE</span>
                </div>

                {/* Actions / Footer */}
                <div className="flex gap-2">
                    <button className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 font-medium transition-colors border border-white/5">
                        View Profile
                    </button>
                    {riskLevel !== 'high' && (
                        <button className="flex-1 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-xs text-primary font-medium transition-colors border border-primary/20">
                            Contact
                        </button>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
