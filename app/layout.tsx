import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Sidebar from "@/components/layout/Sidebar";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAI - Recruitment Asset Intelligence",
  description: "Advanced HR Screener for top-tier headhunters",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={cn(
          inter.variable,
          jetbrainsMono.variable,
          "antialiased bg-deep-space text-foreground min-h-screen font-sans"
        )}
      >
        <Sidebar />
        <main className="ml-64 relative z-10 p-8 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
