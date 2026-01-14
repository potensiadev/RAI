"use client";

import { useEffect } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 스크롤 완전 차단
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="h-screen overflow-hidden flex items-center justify-center bg-gray-50">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-primary/5" />
      <div className="relative z-10 w-full max-w-md px-4">
        {children}
      </div>
    </div>
  );
}
