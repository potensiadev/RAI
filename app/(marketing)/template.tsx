"use client";

/**
 * Marketing Template
 * 
 * 페이지 전환 시 부드러운 트랜지션 효과를 제공하여
 * "버벅임"을 완화하고 고급스러운 느낌을 줍니다.
 */

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
}
