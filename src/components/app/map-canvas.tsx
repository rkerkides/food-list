"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, type PlaceCategory } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { Star, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export interface MapPoint {
  id: string;
  name: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  area: string | null;
  city: string | null;
  publicRating: number | null;
  personalRating: number | null;
  budgetText: string | null;
  distanceKm: number | null;
  status: string;
}

const BOUNDS = { minLon: 32.15, maxLon: 34.7, minLat: 34.5, maxLat: 35.75 };
const WIDTH = 1000;
const HEIGHT = 660;

/**
 * Schematic map of Cyprus drawn from a projected coastline, so the map works
 * offline and without a tile provider (and therefore without leaking usage to a
 * third party). The projection helper below is the seam a Leaflet or Mapbox
 * implementation would replace.
 */
const CYPRUS_OUTLINE: [number, number][] = [
  [34.59, 35.69],
  [34.5, 35.6],
  [34.44, 35.51],
  [34.36, 35.4],
  [34.28, 35.29],
  [34.22, 35.19],
  [34.17, 35.11],
  [34.11, 35.04],
  [34.08, 34.96],
  [33.97, 34.93],
  [33.87, 34.9],
  [33.76, 34.87],
  [33.66, 34.86],
  [33.57, 34.88],
  [33.47, 34.84],
  [33.36, 34.8],
  [33.26, 34.78],
  [33.16, 34.75],
  [33.06, 34.72],
  [32.98, 34.7],
  [32.93, 34.62],
  [32.87, 34.56],
  [32.8, 34.62],
  [32.71, 34.65],
  [32.6, 34.68],
  [32.5, 34.7],
  [32.44, 34.74],
  [32.4, 34.72],
  [32.31, 34.79],
  [32.27, 34.88],
  [32.33, 34.96],
  [32.32, 35.05],
  [32.41, 35.09],
  [32.48, 35.05],
  [32.56, 35.14],
  [32.66, 35.21],
  [32.76, 35.29],
  [32.83, 35.35],
  [32.89, 35.41],
  [33.0, 35.39],
  [33.14, 35.34],
  [33.25, 35.3],
  [33.33, 35.28],
  [33.43, 35.22],
  [33.56, 35.2],
  [33.72, 35.24],
  [33.85, 35.18],
  [33.95, 35.12],
  [34.01, 35.16],
  [34.07, 35.21],
  [34.2, 35.31],
  [34.35, 35.43],
  [34.46, 35.56],
];

const DISTRICT_LABELS: { name: string; lon: number; lat: number }[] = [
  { name: "Nicosia", lon: 33.36, lat: 35.17 },
  { name: "Limassol", lon: 33.02, lat: 34.72 },
  { name: "Larnaca", lon: 33.62, lat: 34.87 },
  { name: "Paphos", lon: 32.45, lat: 34.78 },
  { name: "Famagusta", lon: 33.94, lat: 35.12 },
];

export function project(longitude: number, latitude: number): { x: number; y: number } {
  const x = ((longitude - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * WIDTH;
  const y =
    HEIGHT - ((latitude - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * HEIGHT;
  return { x, y };
}

export function MapCanvas({
  points,
  className,
  height = "h-[420px] sm:h-[560px]",
  initialSelectedId,
}: {
  points: MapPoint[];
  className?: string;
  height?: string;
  initialSelectedId?: string;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialSelectedId ?? points[0]?.id ?? null,
  );
  const selected = points.find((point) => point.id === selectedId) ?? null;

  const path = React.useMemo(
    () =>
      CYPRUS_OUTLINE.map(([lon, lat], index) => {
        const { x, y } = project(lon, lat);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ") + " Z",
    [],
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-gradient-to-b from-sky-50 via-canvas to-olive-50",
        className,
      )}
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={cn("w-full", height)} role="img" aria-label="Map of Cyprus with your saved places">
        <defs>
          <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-olive-100)" />
            <stop offset="100%" stopColor="var(--color-olive-200)" />
          </linearGradient>
        </defs>

        <g opacity="0.5" stroke="var(--color-line)" strokeWidth="0.7">
          {Array.from({ length: 11 }).map((_, index) => (
            <line
              key={`v${index}`}
              x1={(index * WIDTH) / 10}
              y1={0}
              x2={(index * WIDTH) / 10}
              y2={HEIGHT}
            />
          ))}
          {Array.from({ length: 8 }).map((_, index) => (
            <line
              key={`h${index}`}
              x1={0}
              y1={(index * HEIGHT) / 7}
              x2={WIDTH}
              y2={(index * HEIGHT) / 7}
            />
          ))}
        </g>

        <path
          d={path}
          fill="url(#land)"
          stroke="var(--color-olive-500)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {DISTRICT_LABELS.map((district) => {
          const { x, y } = project(district.lon, district.lat);
          return (
            <text
              key={district.name}
              x={x}
              y={y}
              textAnchor="middle"
              className="fill-ink-muted"
              style={{ fontSize: 15, letterSpacing: 0.4, fontFamily: "var(--font-sans)" }}
            >
              {district.name}
            </text>
          );
        })}

        {points.map((point) => {
          const { x, y } = project(point.longitude, point.latitude);
          const isSelected = point.id === selectedId;
          return (
            <g
              key={point.id}
              transform={`translate(${x}, ${y})`}
              className="cursor-pointer"
              onClick={() => setSelectedId(point.id)}
            >
              <circle
                r={isSelected ? 16 : 12}
                fill={isSelected ? "var(--color-clay-600)" : "var(--color-clay-500)"}
                opacity={isSelected ? 0.3 : 0.18}
              />
              <circle
                r={isSelected ? 8 : 6}
                fill={isSelected ? "var(--color-clay-700)" : "var(--color-clay-600)"}
                stroke="white"
                strokeWidth={2}
              />
              <title>{`${point.name} — ${point.area ?? point.city ?? "Cyprus"}`}</title>
            </g>
          );
        })}
      </svg>

      {points.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center bg-canvas/70 px-6 text-center">
          <p className="max-w-xs text-sm text-ink-muted">
            No saved places match these filters yet.
          </p>
        </div>
      ) : null}

      {selected ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-80">
          <div className="pointer-events-auto rounded-2xl border border-line bg-surface/95 p-3.5 shadow-[var(--shadow-float)] backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold">{selected.name}</p>
                <p className="truncate text-xs text-ink-muted">
                  {[CATEGORY_LABELS[selected.category], selected.area ?? selected.city]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setSelectedId(null)}
                className="rounded-full p-1 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              {selected.personalRating != null ? (
                <span className="inline-flex items-center gap-1 font-medium">
                  <Star className="size-3 fill-star text-star" />
                  {selected.personalRating.toFixed(1)} yours
                </span>
              ) : selected.publicRating != null ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3 fill-star text-star" />
                  {selected.publicRating.toFixed(1)}
                </span>
              ) : null}
              {selected.budgetText ? <span>{selected.budgetText}</span> : null}
              {selected.distanceKm != null ? (
                <span>{selected.distanceKm.toFixed(1)} km</span>
              ) : null}
              <Badge variant="default" size="sm">
                {selected.status === "wishlist"
                  ? "Want to try"
                  : selected.status === "favourite"
                    ? "Favourite"
                    : "Saved"}
              </Badge>
            </div>
            <Button asChild size="sm" className="mt-3 w-full">
              <Link href={`/places/${selected.id}`}>Open place</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <p className="absolute right-3 top-3 rounded-full bg-canvas/80 px-2.5 py-1 text-[10px] font-medium text-ink-muted backdrop-blur">
        Schematic map · Cyprus
      </p>
    </div>
  );
}
