"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, AlertTriangle, Info } from "lucide-react";

interface EditableFieldProps {
  label: string;
  value: string | number | null | undefined;
  fieldKey: string;
  type?: "text" | "number" | "textarea";
  placeholder?: string;
  confidence?: number;
  hasWarning?: boolean;
  warningMessage?: string;
  isEditing?: boolean;
  onEdit?: (key: string, value: string | number) => void;
  onSave?: (key: string, value: string | number) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export default function EditableField({
  label,
  value,
  fieldKey,
  type = "text",
  placeholder = "입력되지 않음",
  confidence,
  hasWarning = false,
  warningMessage,
  onSave,
  disabled = false,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() ?? "");
  const [originalValue] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    const newValue = type === "number" ? Number(editValue) : editValue;
    onSave?.(fieldKey, newValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(originalValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const displayValue = value?.toString() || "";
  const isEmpty = !displayValue;
  const isModified = editValue !== originalValue;

  // Confidence color
  const getConfidenceColor = (conf?: number) => {
    if (!conf) return "text-slate-500";
    if (conf >= 0.95) return "text-emerald-400";
    if (conf >= 0.8) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="group relative">
      {/* Label Row */}
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </label>

        {/* Confidence Badge */}
        {confidence !== undefined && (
          <span
            className={`text-xs font-mono ${getConfidenceColor(confidence)}`}
            title={`AI 신뢰도: ${Math.round(confidence * 100)}%`}
          >
            {Math.round(confidence * 100)}%
          </span>
        )}

        {/* Warning Badge */}
        {hasWarning && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30">
            <AlertTriangle className="w-3 h-3 text-yellow-500" />
            <span className="text-xs text-yellow-500">확인 필요</span>
          </div>
        )}

        {/* Modified Badge */}
        {isModified && !isEditing && (
          <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
            수정됨
          </span>
        )}
      </div>

      {/* Value/Input */}
      <div className="relative">
        {isEditing ? (
          <div className="flex items-center gap-2">
            {type === "textarea" ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600
                         text-white text-sm focus:outline-none focus:border-neon-cyan
                         min-h-[80px] resize-y"
                placeholder={placeholder}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600
                         text-white text-sm focus:outline-none focus:border-neon-cyan"
                placeholder={placeholder}
              />
            )}

            {/* Action Buttons */}
            <button
              onClick={handleSave}
              className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30
                       text-emerald-400 transition-colors"
              title="저장 (Enter)"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30
                       text-red-400 transition-colors"
              title="취소 (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            className={`flex items-center justify-between px-3 py-2 rounded-lg
                       bg-slate-800/50 border transition-colors cursor-pointer
                       ${hasWarning
                         ? "border-yellow-500/30 hover:border-yellow-500/50"
                         : "border-slate-700 hover:border-slate-600"
                       }
                       ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => !disabled && setIsEditing(true)}
          >
            <span
              className={`text-sm ${
                isEmpty ? "text-slate-500 italic" : "text-white"
              }`}
            >
              {isEmpty ? placeholder : displayValue}
            </span>

            {!disabled && (
              <Pencil className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        )}
      </div>

      {/* Warning Message */}
      {warningMessage && (
        <div className="flex items-start gap-1.5 mt-1.5">
          <Info className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-500/80">{warningMessage}</p>
        </div>
      )}
    </div>
  );
}
