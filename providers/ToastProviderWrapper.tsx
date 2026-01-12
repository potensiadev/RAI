"use client";

import { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import NetworkStatusIndicator from "@/components/ui/network-status";

export function ToastProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <NetworkStatusIndicator />
      {children}
    </ToastProvider>
  );
}
