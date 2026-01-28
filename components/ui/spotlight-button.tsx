"use client";

import React, { useRef, useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface SpotlightButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    wrapperClassName?: string;
}

export default function SpotlightButton({ children, className, wrapperClassName, ...props }: SpotlightButtonProps) {
    const divRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current || isFocused) return;

        const div = divRef.current;
        const rect = div.getBoundingClientRect();

        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleFocus = () => {
        setIsFocused(true);
        setOpacity(1);
    };

    const handleBlur = () => {
        setIsFocused(false);
        setOpacity(0);
    };

    const handleMouseEnter = () => {
        setOpacity(1);
    };

    const handleMouseLeave = () => {
        setOpacity(0);
    };

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative inline-flex overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 ${wrapperClassName}`}
        >
            <span
                className="absolute inset-[-100%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#393BB2_50%,#E2E8F0_100%)] opacity-0 transition-opacity duration-300 pointer-events-none"
                style={{ opacity: isFocused ? 1 : 0 }}
            />

            {/* Spotlight Effect */}
            <span
                className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(150px circle at ${position.x}px ${position.y}px, rgba(37, 99, 235, 0.4), transparent 80%)`,
                }}
            />

            <button
                className={`relative inline-flex h-full w-full items-center justify-center rounded-full bg-slate-950 px-8 py-4 text-lg font-medium text-white backdrop-blur-3xl transition-all hover:bg-slate-900 ${className}`}
                {...props}
            >
                {children}
                <ArrowRight className="ml-2 h-5 w-5" />
            </button>
        </div>
    );
}
