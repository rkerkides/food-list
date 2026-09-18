"use client";

import type { ProviderInfo } from "@/lib/places";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Radio } from "lucide-react";

export function DemoBadge({ provider }: { provider: ProviderInfo }) {
  const isDemo = provider.mode === "demo";
  return (
    <Badge
      variant={isDemo ? "olive" : "default"}
      className="hidden sm:inline-flex"
      title={
        provider.fallbackReason ??
        (isDemo
          ? "Using the bundled Cyprus dataset. Add a Google Places API key to search live venues."
          : "Searching live places")
      }
    >
      {isDemo ? <FlaskConical className="size-3" /> : <Radio className="size-3" />}
      {provider.fallbackReason ? "Demo fallback" : isDemo ? "Demo data" : "Live places"}
    </Badge>
  );
}
