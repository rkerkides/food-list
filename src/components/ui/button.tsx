import { Slot } from "@/components/ui/slot";
import { cn } from "@/lib/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-clay-600 text-white shadow-[0_10px_24px_-14px_var(--color-clay-700)] hover:bg-clay-700",
        secondary: "bg-ink text-canvas hover:bg-ink-soft",
        outline: "border border-line-strong bg-surface text-ink hover:bg-surface-muted",
        ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink",
        subtle: "bg-clay-50 text-clay-800 hover:bg-clay-100",
        olive: "bg-olive-700 text-white hover:bg-olive-800",
        danger: "bg-red-50 text-red-700 hover:bg-red-100",
      },
      size: {
        sm: "h-9 px-3.5 text-sm [&_svg]:size-4",
        md: "h-11 px-5 text-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
        icon: "size-10 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
