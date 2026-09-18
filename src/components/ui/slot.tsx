"use client";

import * as React from "react";

/**
 * Minimal `asChild` implementation so buttons can render as links without
 * pulling in another dependency.
 */
export function Slot({
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  if (!React.isValidElement(children)) return null;
  const child = children as React.ReactElement<Record<string, unknown>>;
  const childProps = child.props as { className?: string };
  return React.cloneElement(child, {
    ...props,
    className: [props.className, childProps.className].filter(Boolean).join(" "),
  });
}
