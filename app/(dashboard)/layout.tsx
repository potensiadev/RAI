import type { Metadata } from "next";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "HR Screener - Dashboard",
  description: "AI-powered recruitment asset intelligence",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen bg-gray-50/50">
      {/* Content Layer */}
      <div className="relative z-10 flex w-full">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 md:p-12 max-w-[1600px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
