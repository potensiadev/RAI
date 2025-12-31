// 1. Floating Effect (For Cards, Backgrounds) - Slow, underwater feel
export const FLOATING_PHYSICS = {
    y: { duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
} as const;

// 2. Magnetic Response (For Buttons, Inputs) - Snappy and sticky
export const MAGNETIC_SPRING = { type: "spring", stiffness: 150, damping: 15, mass: 0.1 } as const;

// 3. Heavy Appearance (For Modals, Page Load) - Expensive feel
export const HEAVY_APPEAR = {
    initial: { opacity: 0, y: 20, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { type: "spring", stiffness: 80, damping: 20 }
} as const;
