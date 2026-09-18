import { cn } from "@/lib/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-line bg-surface-muted text-ink-soft",
        outline: "border-line-strong bg-transparent text-ink-soft",
        clay: "border-clay-100 bg-clay-50 text-clay-800",
        olive: "border-olive-100 bg-olive-50 text-olive-800",
        ink: "border-transparent bg-ink text-canvas",
        rating: "border-transparent bg-star/15 text-ink",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export function Badge({
  className,
  variant,
  size,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
