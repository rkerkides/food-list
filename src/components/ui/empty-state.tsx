import { cn } from "@/lib/utils/cn";
import type { LucideIcon } from "lucide-react";
import * as React from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-clay-50 text-clay-700">
        <Icon className="size-5" />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mx-auto max-w-sm text-sm text-ink-muted text-pretty">{description}</p>
      </div>
      {action}
    </div>
  );
}
