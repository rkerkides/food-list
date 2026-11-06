import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import * as React from "react";

export function Section({
  title,
  subtitle,
  action,
  children,
  className,
  id,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">{title}</h2>
          {subtitle ? <p className="text-sm text-ink-muted text-pretty">{subtitle}</p> : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium text-clay-700 transition hover:bg-clay-50"
          >
            {action.label}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
