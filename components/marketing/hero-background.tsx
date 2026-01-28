"use client";

import { motion } from "framer-motion";

export const AuroraBackground = ({
    className,
    children,
    showRadialGradient = true,
    ...props
}: {
    className?: string;
    children?: React.ReactNode;
    showRadialGradient?: boolean;
} & React.HTMLProps<HTMLDivElement>) => {
    return (
        <div
            className={`relative flex flex-col items-center justify-center bg-white text-slate-950 transition-bg ${className}`}
            {...props}
        >
            <div className="absolute inset-0 overflow-hidden">
                <div
                    className={`
            [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)]
            [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)]
            [--aurora:repeating-linear-gradient(100deg,#3b82f6_10%,#a5b4fc_15%,#9333ea_20%,#c084fc_25%,#60a5fa_30%)]
            [background-image:var(--white-gradient),var(--aurora)]
            [background-size:300%,_200%]
            [background-position:50%_50%,50%_50%]
            filter blur-[10px] invert-0
            after:content-[""] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)] 
            after:[background-size:200%,_100%] 
            after:animate-aurora after:[background-attachment:fixed] after:mix-blend-difference
            pointer-events-none
            absolute -inset-[10px] opacity-20 will-change-transform
            [mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]
          `}
                ></div>
            </div>
            {showRadialGradient && (
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-white via-transparent to-transparent z-0 pointer-events-none" />
            )}
            <div className="relative z-10 w-full">{children}</div>
        </div>
    );
};

// Simple background blobs for lighter effect
export const BlobBackground = () => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
        >
            {/* Blobs */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>

            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

            {/* Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
        </motion.div>
    );
};
