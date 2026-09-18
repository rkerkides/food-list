"use client";

import { Select } from "@/components/ui/input";
import { SORT_LABELS, type PlaceSort } from "@/lib/domain/filters";
import { LayoutGrid, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export function PlaceToolbar({ count }: { count: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "map" ? "map" : "grid";
  const sort = (searchParams.get("sort") ?? "recommendation") as PlaceSort;

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    router.push(`/places?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-muted">
        {count} {count === 1 ? "place" : "places"}
      </p>

      <div className="flex items-center gap-2">
        <div className="flex rounded-full border border-line bg-surface p-0.5">
          <Link
            href={`/places?${withParam(searchParams.toString(), "view", null)}`}
            aria-label="Grid view"
            className={cn(
              "grid size-8 place-items-center rounded-full transition",
              view === "grid" ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink",
            )}
          >
            <LayoutGrid className="size-4" />
          </Link>
          <Link
            href={`/places?${withParam(searchParams.toString(), "view", "map")}`}
            aria-label="Map view"
            className={cn(
              "grid size-8 place-items-center rounded-full transition",
              view === "map" ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink",
            )}
          >
            <MapIcon className="size-4" />
          </Link>
        </div>

        <Select
          value={sort}
          onChange={(event) =>
            setParam("sort", event.target.value === "recommendation" ? null : event.target.value)
          }
          className="h-9 w-auto min-w-36 text-xs"
          aria-label="Sort places"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function withParam(queryString: string, key: string, value: string | null): string {
  const params = new URLSearchParams(queryString);
  if (value === null) params.delete(key);
  else params.set(key, value);
  return params.toString();
}
