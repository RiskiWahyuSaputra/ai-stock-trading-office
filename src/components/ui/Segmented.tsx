"use client";

import { cn } from "@/lib/utils";

/** Small segmented control used for market / timeframe / mode pickers. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 text-xs font-medium text-muted">{label}</legend>
      <div className="flex rounded-lg border border-line-strong bg-bg p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            title={o.hint}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
              value === o.value ? "bg-panel-2 text-accent" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
