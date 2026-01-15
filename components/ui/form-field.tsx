"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

// ─────────────────────────────────────────────────
// Validation Error Message Component
// ─────────────────────────────────────────────────

interface ValidationErrorProps {
  message?: string;
  show?: boolean;
  className?: string;
}

export function ValidationError({ message, show = true, className }: ValidationErrorProps) {
  if (!message || !show) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 mt-2 text-sm animate-in fade-in slide-in-from-top-1 duration-200",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
      <span className="text-rose-600 leading-tight">{message}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Form Field Wrapper Component
// ─────────────────────────────────────────────────

interface FormFieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  error,
  required,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-gray-400 mt-1.5">{hint}</p>
      )}
      <ValidationError message={error} />
    </div>
  );
}

// ─────────────────────────────────────────────────
// Validated Input Component
// ─────────────────────────────────────────────────

export interface ValidatedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  onValidate?: (value: string) => string | undefined;
}

export const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ className, error, onValidate, onChange, onBlur, ...props }, ref) => {
    const [localError, setLocalError] = React.useState<string | undefined>();
    const [touched, setTouched] = React.useState(false);

    const displayError = error || (touched ? localError : undefined);
    const hasError = !!displayError;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      if (touched && onValidate) {
        setLocalError(onValidate(e.target.value));
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);
      onBlur?.(e);
      if (onValidate) {
        setLocalError(onValidate(e.target.value));
      }
    };

    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            "flex h-12 w-full rounded-xl border bg-gray-50 px-4 py-3 text-base text-gray-900",
            "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-gray-400 transition-all duration-200 shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            hasError
              ? "border-rose-300 bg-rose-50/30 focus-visible:ring-rose-200 focus-visible:border-rose-400"
              : "border-gray-200",
            className
          )}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${props.id}-error` : undefined}
          {...props}
        />
        <ValidationError message={displayError} />
      </div>
    );
  }
);
ValidatedInput.displayName = "ValidatedInput";

// ─────────────────────────────────────────────────
// Common Validators
// ─────────────────────────────────────────────────

export const validators = {
  required: (message = "필수 입력 항목입니다") => (value: string) =>
    value.trim() ? undefined : message,

  email: (message = "올바른 이메일 주소를 입력해주세요") => (value: string) => {
    if (!value.trim()) return undefined;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? undefined : message;
  },

  minLength: (min: number, message?: string) => (value: string) => {
    if (!value.trim()) return undefined;
    return value.length >= min
      ? undefined
      : message || `최소 ${min}자 이상 입력해주세요`;
  },

  maxLength: (max: number, message?: string) => (value: string) => {
    return value.length <= max
      ? undefined
      : message || `최대 ${max}자까지 입력 가능합니다`;
  },

  pattern: (regex: RegExp, message: string) => (value: string) => {
    if (!value.trim()) return undefined;
    return regex.test(value) ? undefined : message;
  },

  compose: (...validators: Array<(value: string) => string | undefined>) => (value: string) => {
    for (const validate of validators) {
      const error = validate(value);
      if (error) return error;
    }
    return undefined;
  },
};
