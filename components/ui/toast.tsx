"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string, action?: ToastAction) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
}

// ─────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ─────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  const success = useCallback((title: string, description?: string) => {
    return addToast({ type: "success", title, description });
  }, [addToast]);

  const error = useCallback((title: string, description?: string, action?: ToastAction) => {
    return addToast({ type: "error", title, description, action });
  }, [addToast]);

  const warning = useCallback((title: string, description?: string) => {
    return addToast({ type: "warning", title, description });
  }, [addToast]);

  const info = useCallback((title: string, description?: string) => {
    return addToast({ type: "info", title, description });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────────
// Toast Container
// ─────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-md pointer-events-none p-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Toast Item
// ─────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

const styleMap = {
  success: "text-emerald-600",
  error: "text-rose-600",
  warning: "text-amber-600",
  info: "text-blue-600",
};

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const Icon = iconMap[toast.type];
  const iconColor = styleMap[toast.type];

  return (
    <div
      className="pointer-events-auto w-full bg-white/95 backdrop-blur-md border border-gray-100/50 
                 rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] 
                 animate-in slide-in-from-top-full duration-500 ease-out"
    >
      <div className="flex gap-4">
        <div className={`mt-0.5 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 space-y-1">
          <p className="font-semibold text-gray-900 leading-tight">
            {toast.title}
          </p>
          {toast.description && (
            <p className="text-sm text-gray-500 leading-relaxed">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        <button
          onClick={() => onRemove(toast.id)}
          className="text-gray-400 hover:text-gray-600 transition-colors -mt-1 -mr-1 p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export type { Toast, ToastAction, ToastType };
