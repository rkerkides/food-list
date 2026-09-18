"use client";

import { cn } from "@/lib/utils/cn";
import { Star } from "lucide-react";
import * as React from "react";

export function Stars({
  value,
  size = "md",
  className,
  showValue = false,
  count,
}: {
  value: number | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
  showValue?: boolean;
  count?: number | null;
}) {
  const dimension = size === "sm" ? "size-3" : size === "lg" ? "size-5" : "size-4";
  if (value === null || value === undefined) {
    return (
      <span className={cn("text-xs text-ink-muted", className)}>
        {count != null ? `${count} reviews` : "No rating yet"}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`${value} out of 5`}>
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((step) => {
          const fill = Math.max(0, Math.min(1, value - step + 1));
          return (
            <span key={step} className="relative inline-block">
              <Star className={cn(dimension, "text-line-strong")} strokeWidth={1.5} />
              {fill > 0 ? (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <Star className={cn(dimension, "fill-star text-star")} strokeWidth={1.5} />
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      {showValue ? (
        <span className="text-sm font-semibold text-ink">{value.toFixed(1)}</span>
      ) : null}
      {count != null ? <span className="text-xs text-ink-muted">({count})</span> : null}
    </span>
  );
}

export function RatingInput({
  name,
  defaultValue,
  label = "Your rating",
}: {
  name: string;
  defaultValue?: number | null;
  label?: string;
}) {
  const [value, setValue] = React.useState<number | null>(defaultValue ?? null);

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</span>
      <input type="hidden" name={name} value={value ?? ""} />
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((step) => (
          <button
            key={step}
            type="button"
            aria-label={`${step} star${step === 1 ? "" : "s"}`}
            aria-pressed={value === step}
            onClick={() => setValue(value === step ? null : step)}
            className="rounded-full p-0.5 transition hover:scale-110"
          >
            <Star
              className={cn(
                "size-6",
                value !== null && step <= value
                  ? "fill-star text-star"
                  : "text-line-strong",
              )}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function RatingBars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={cn(
            "h-1.5 w-4 rounded-full",
            step <= Math.round(rating) ? "bg-star" : "bg-line",
          )}
        />
      ))}
    </span>
  );
}
