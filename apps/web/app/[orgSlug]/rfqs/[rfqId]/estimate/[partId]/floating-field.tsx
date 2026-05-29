"use client";

import { cn } from "@uptool/ui";
import { ChevronDown, X } from "lucide-react";
import type * as React from "react";

// Floating-label fields shared by Materials (and, later, Operations):
// small label notched into the top border, value below, optional prefix/suffix
// inside the box. Required + empty renders a red ring and red label.

interface BaseProps {
  label: string;
  required?: boolean;
  className?: string;
}

interface FloatingFieldProps extends BaseProps {
  value: string;
  onChange?: (value: string) => void;
  prefix?: string;
  suffix?: string;
  onClear?: () => void;
  readOnly?: boolean;
  align?: "left" | "right";
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
}

export function FloatingField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  onClear,
  readOnly,
  required,
  align = "left",
  inputMode,
  placeholder,
  className,
}: FloatingFieldProps) {
  const invalid = !!required && value.trim() === "";

  return (
    <div
      className={cn(
        "relative rounded-md border bg-gray-50 px-2.5 pb-1.5 pt-3.5",
        invalid ? "border-red-400 ring-1 ring-red-300" : "border-gray-200",
        className,
      )}
    >
      <FieldLabel invalid={invalid}>{label}</FieldLabel>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-gray-500">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-label={label}
          className={cn(
            "w-full min-w-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400",
            align === "right" && "text-right",
            readOnly && "text-gray-500",
          )}
        />
        {suffix && <span className="whitespace-nowrap text-sm text-gray-500">{suffix}</span>}
        {onClear && value && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label}`}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

interface FloatingSelectProps<T extends string> extends BaseProps {
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange?: (value: T) => void;
  onClear?: () => void;
}

export function FloatingSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  onClear,
  required,
  className,
}: FloatingSelectProps<T>) {
  const invalid = !!required && value.trim() === "";

  return (
    <div
      className={cn(
        "relative rounded-md border bg-gray-50 px-2.5 pb-1.5 pt-3.5",
        invalid ? "border-red-400 ring-1 ring-red-300" : "border-gray-200",
        className,
      )}
    >
      <FieldLabel invalid={invalid}>{label}</FieldLabel>
      <div className="flex items-center gap-1">
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value as T)}
          aria-label={label}
          className="w-full min-w-0 cursor-pointer appearance-none bg-transparent text-sm text-gray-900 outline-none"
        >
          {onClear && <option value="" />}
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        {onClear && value && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label}`}
            className="flex-none text-gray-400 transition-colors hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown className="h-3.5 w-3.5 flex-none text-gray-500" />
      </div>
    </div>
  );
}

function FieldLabel({ invalid, children }: { invalid: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute -top-2 left-2 bg-gray-50 px-1 text-[10px] font-medium",
        invalid ? "text-red-500" : "text-gray-500",
      )}
    >
      {children}
    </span>
  );
}
