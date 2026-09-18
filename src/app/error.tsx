"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-ink-muted text-pretty">
          {error.message || "An unexpected error occurred while loading this screen."}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
