import { cn } from "@/lib/utils/cn";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import * as React from "react";

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: "info" | "success" | "error";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = variant === "error" ? AlertCircle : variant === "success" ? CheckCircle2 : Info;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        variant === "error" && "border-red-200 bg-red-50 text-red-800",
        variant === "success" && "border-olive-200 bg-olive-50 text-olive-800",
        variant === "info" && "border-line bg-surface-muted text-ink-soft",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        {title ? <span className="font-semibold">{title}</span> : null}
        {children ? <span className="text-pretty">{children}</span> : null}
      </div>
    </div>
  );
}
