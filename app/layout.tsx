import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import { ToastProviderWrapper } from "@/providers/ToastProviderWrapper";
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
    <html lang="en">
      <body
        className={cn(
          inter.variable,
          jetbrainsMono.variable,
          "antialiased bg-background text-foreground min-h-screen font-sans"
        )}
      >
        <QueryProvider>
          <ToastProviderWrapper>
            {children}
          </ToastProviderWrapper>
        </QueryProvider>
      </body>
    </html>
  );
}
