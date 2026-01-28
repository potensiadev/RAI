"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { NAV_LINKS } from "@/lib/marketing-data";
import { cn } from "@/lib/utils";

export default function MarketingNavbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [hidden, setHidden] = useState(false);
    const { scrollY } = useScroll();
    const lastScrollY = useRef(0);
    const pathname = usePathname();

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = lastScrollY.current;

        // Background check
        if (latest > 20) {
            setScrolled(true);
        } else {
            setScrolled(false);
        }

        // Hide/Show logic (Smart Navbar)
        if (latest > previous && latest > 150 && !mobileMenuOpen) {
            setHidden(true); // Scrolling down -> Hide
        } else {
            setHidden(false); // Scrolling up -> Show
        }

        lastScrollY.current = latest;
    });

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setMobileMenuOpen(false);
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <>
            <motion.nav
                variants={{
                    visible: { y: 0, opacity: 1 },
                    hidden: { y: "-100%", opacity: 0 },
                }}
                animate={hidden ? "hidden" : "visible"}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                    scrolled || mobileMenuOpen
                        ? "bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)]"
                        : "bg-transparent"
                )}
            >
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    {/* Brand */}
                    <Link href="/" className="flex items-center group">
                        <span className="text-xl font-bold tracking-tight text-gray-900 group-hover:text-primary transition-colors">서치드</span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-8">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-primary",
                                    pathname === link.href ? "text-primary" : "text-gray-600"
                                )}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Auth Buttons */}
                    <div className="hidden md:flex items-center gap-4">
                        <Link
                            href="/login"
                            className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                        >
                            로그인
                        </Link>
                        <Link
                            href="/signup"
                            className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-blue-600 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                        >
                            시작하기
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
                    >
                        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </motion.nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="md:hidden overflow-hidden bg-white border-b border-gray-100 fixed top-20 left-0 right-0 z-40 shadow-lg"
                    >
                        <div className="p-6 space-y-4">
                            {NAV_LINKS.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                        "block py-2 text-base font-medium transition-colors",
                                        pathname === link.href ? "text-primary" : "text-gray-900"
                                    )}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <div className="pt-4 border-t border-gray-100 space-y-3">
                                <Link
                                    href="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block w-full py-3 text-center text-gray-600 font-medium hover:text-gray-900"
                                >
                                    로그인
                                </Link>
                                <Link
                                    href="/signup"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block w-full py-3 rounded-xl bg-primary text-white text-center font-medium hover:bg-primary/90"
                                >
                                    시작하기
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
