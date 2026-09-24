import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type PlaceWithStats } from "@/lib/domain/types";
import { formatBudgetRange, formatCount, formatDistanceKm, formatRating } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { PlaceVisual } from "./place-visual";
import { Stars } from "./rating";

export interface PlaceCardData {
  place: PlaceWithStats;
  distanceKm?: number | null;
  budget?: { min: number | null; max: number | null; approximate?: boolean } | null;
  matchPercent?: number | null;
  reasons?: string[];
}

export function PlaceCard({
  data,
  className,
  compact = false,
}: {
  data: PlaceCardData;
  className?: string;
  compact?: boolean;
}) {
  const { place, distanceKm, budget, matchPercent, reasons } = data;
  const budgetText = budget
    ? formatBudgetRange(budget.min, budget.max, { approximate: budget.approximate })
    : formatBudgetRange(place.expectedSpendMin, place.expectedSpendMax, {
        approximate: place.budgetSource !== "manual" && place.budgetSource !== "provider_price_range",
      });

  return (
    <Link
      href={`/places/${place.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--shadow-float)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500",
        className,
      )}
    >
      <div className="relative overflow-hidden">
        <PlaceVisual
          name={place.name}
          category={place.category}
          cuisines={place.cuisines}
          photoRef={place.photoRef}
          size={compact ? "card" : "card"}
          className={cn("transition duration-500 group-hover:scale-[1.025]", compact ? "aspect-[16/9]" : undefined)}
        />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {place.status === "wishlist" || place.status === "favourite" ? (
            <Badge variant={place.status === "favourite" ? "clay" : "ink"} size="sm">
              {STATUS_LABELS[place.status]}
            </Badge>
          ) : (
            <span />
          )}
          {matchPercent ? (
            <span className="rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-canvas backdrop-blur">
              {matchPercent}% match
            </span>
          ) : distanceKm != null ? (
            <span className="rounded-full bg-canvas/85 px-2.5 py-1 text-[11px] font-medium text-ink-soft backdrop-blur">
              {formatDistanceKm(distanceKm)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="space-y-1">
          <h3 className="font-display text-[17px] leading-snug font-semibold text-ink">
            {place.name}
          </h3>
          <p className="line-clamp-1 text-sm text-ink-muted">
            {[place.cuisines.slice(0, 2).join(" · "), place.area ?? place.city]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {reasons?.length ? (
          <ul className="space-y-1 text-xs text-ink-soft">
            {reasons.slice(0, 3).map((reason) => (
              <li key={reason} className="flex gap-1.5">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-clay-400" />
                <span className="text-pretty">{reason}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-sm">
          <span className="inline-flex items-center gap-1 font-medium text-ink">
            {place.stats.personalRating != null ? (
              <>
                <Star className="size-3.5 fill-star text-star" />
                {formatRating(place.stats.personalRating)}
                <span className="text-xs font-normal text-ink-muted">yours</span>
              </>
            ) : place.publicRating != null ? (
              <>
                <Star className="size-3.5 fill-star text-star" />
                {formatRating(place.publicRating)}
                <span className="text-xs font-normal text-ink-muted">
                  ({formatCount(place.publicRatingCount)})
                </span>
              </>
            ) : (
              <span className="text-xs text-ink-muted">No rating yet</span>
            )}
          </span>
          <span className="text-xs font-medium text-ink-soft">{budgetText}</span>
        </div>

        {place.stats.visitCount > 0 ? (
          <div className="flex items-center gap-2 border-t border-line pt-2 text-xs text-ink-muted">
            <Stars value={place.stats.personalRating} size="sm" />
            <span>
              {place.stats.visitCount} {place.stats.visitCount === 1 ? "visit" : "visits"}
            </span>
            {place.stats.topFoodItems[0] ? (
              <span className="ml-auto inline-flex items-center gap-1 text-ink-soft">
                <MapPin className="size-3" />
                {place.stats.topFoodItems[0].name}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
