"use client";

import { motion, useSpring, useTransform, MotionValue } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { MAGNETIC_SPRING } from "@/lib/physics";

function RollingDigit({ value }: { value: number }) {
    let spring = useSpring(value, { stiffness: 100, damping: 20 });

    useEffect(() => {
        spring.set(value);
    }, [value, spring]);

    const y = useTransform(spring, (latest) => {
        const height = 24; // Height of one digit
        const placeValue = latest % 10;
        const offset = (10 + placeValue) % 10;
        return -(offset * height);
    });

    // Use a string of digits 0-9 for the column
    return (
        <div className="h-6 overflow-hidden relative w-[1ch]">
            <motion.div style={{ y }} className="flex flex-col items-center">
                {[...Array(10)].map((_, i) => (
                    <span key={i} className="h-6 flex items-center justify-center">
                        {i}
                    </span>
                ))}
            </motion.div>
        </div>
    );
}

// simplified RollingNumber for now - pure number spring
function SimpleRollingNumber({ value }: { value: number }) {
    const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
    const display = useTransform(spring, (current) => Math.round(current));

    return (
        <motion.span>{display}</motion.span>
    );
}

export default function CreditCounter({ className }: { className?: string }) {
    const [credits, setCredits] = useState(1250);

    // Demo effect: decrease credits occasionally
    useEffect(() => {
        const interval = setInterval(() => {
            setCredits((prev) => Math.max(0, prev - Math.floor(Math.random() * 50)));
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={cn("flex flex-col gap-1", className)}>
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Credits
            </span>
            <div className="flex items-center gap-2 font-mono text-xl text-primary font-bold">
                <SimpleRollingNumber value={credits} />
                <span className="text-xs text-slate-500 font-normal">AVAL</span>
            </div>
        </div>
    );
}
