"use client";

import type { ProviderInfo } from "@/lib/places";
import { Badge } from "@/components/ui/badge";
import { Database, FlaskConical, Radio } from "lucide-react";

export function DemoBadge({ provider }: { provider: ProviderInfo }) {
  const isDemo = provider.mode === "demo";
  const isLocal = provider.mode === "local";
  return (
    <Badge
      variant={isDemo || isLocal ? "olive" : "default"}
      className="hidden sm:inline-flex"
      title={
        provider.fallbackReason ??
        (isDemo
          ? "Using the bundled fictional Cyprus dataset."
          : isLocal
            ? "Searching the locally imported OpenStreetMap Cyprus catalog."
            : "Searching live places")
      }
    >
      {isDemo ? (
        <FlaskConical className="size-3" />
      ) : isLocal ? (
        <Database className="size-3" />
      ) : (
        <Radio className="size-3" />
      )}
      {provider.fallbackReason
        ? "Demo fallback"
        : isDemo
          ? "Demo data"
          : isLocal
            ? "Local OSM"
            : "Live places"}
    </Badge>
  );
}
