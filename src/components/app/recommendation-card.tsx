import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlaceVisual } from "./place-visual";
import { LogVisitDialog } from "./log-visit-dialog";
import type { Recommendation } from "@/lib/domain/types";
import { formatBudgetRange, formatDistanceKm } from "@/lib/utils/format";
import { Check, ChevronDown, Clock, Info, TrendingUp } from "lucide-react";
import Link from "next/link";

export function RecommendationCard({
  recommendation,
  rank,
}: {
  recommendation: Recommendation;
  rank: number;
}) {
  const { place, reasons, matchPercent, breakdown, distanceKm, isOpenNow, items } = recommendation;
  const budgetText = formatBudgetRange(place.expectedSpendMin, place.expectedSpendMax, {
    approximate: place.budgetSource !== "manual",
  });
  const headline = reasons.filter((reason) => reason.sentiment === "positive").slice(0, 3);
  const context = reasons.filter((reason) => reason.sentiment === "neutral").slice(0, 2);

  return (
    <article className="overflow-hidden rounded-[calc(var(--radius-card)+4px)] border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-col sm:flex-row">
        <PlaceVisual
          name={place.name}
          category={place.category}
          photoRef={place.photoRef}
          className="sm:h-auto sm:w-44 sm:shrink-0"
        />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-clay-600 text-[11px] font-semibold text-white">
                  {rank}
                </span>
                <h3 className="truncate font-display text-xl font-semibold">{place.name}</h3>
              </div>
              <p className="mt-1 truncate text-sm text-ink-muted">
                {[
                  place.cuisines.slice(0, 2).join(" · "),
                  [place.area, place.city].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-clay-50 px-3 py-1 text-sm font-semibold text-clay-800">
              <TrendingUp className="size-3.5" />
              {matchPercent}% match
            </span>
          </div>

          <ul className="mt-3 space-y-1.5">
            {headline.map((reason) => (
              <li key={reason.label} className="flex gap-2 text-sm text-ink-soft">
                <Check className="mt-0.5 size-3.5 shrink-0 text-olive-600" />
                <span className="text-pretty">{reason.label}</span>
              </li>
            ))}
            {context.map((reason) => (
              <li key={reason.label} className="flex gap-2 text-sm text-ink-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span className="text-pretty">{reason.label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
            {distanceKm != null ? <span>{formatDistanceKm(distanceKm)}</span> : null}
            <span>{budgetText}</span>
            {isOpenNow === true ? (
              <Badge variant="olive" size="sm">
                Open now
              </Badge>
            ) : isOpenNow === false ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                Closed now
              </span>
            ) : null}
            {items.length > 0 ? (
              <span className="truncate">
                You liked: {items.slice(0, 2).map((item) => item.name).join(", ")}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href={`/places/${place.id}`}>Open place</Link>
            </Button>
            <LogVisitDialog
              placeId={place.id}
              placeName={place.name}
              trigger={
                <Button variant="outline" size="sm">
                  Log visit
                </Button>
              }
            />
            <details className="group relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-surface-muted">
                Why this?
                <ChevronDown className="size-3.5 transition group-open:rotate-180" />
              </summary>
              <div className="mt-2 w-full min-w-64 rounded-xl border border-line bg-canvas p-3 text-xs">
                <p className="mb-2 font-medium text-ink">How this score was built</p>
                <ul className="space-y-1">
                  {breakdown
                    .slice()
                    .sort((a, b) => b.weighted - a.weighted)
                    .map((part) => (
                      <li key={part.key} className="flex items-center gap-2">
                        <span className="w-40 shrink-0 text-ink-muted">{part.label}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                          <span
                            className="block h-full rounded-full bg-clay-500"
                            style={{ width: `${Math.round(part.value * 100)}%` }}
                          />
                        </span>
                        <span className="w-14 text-right text-ink-soft">
                          {Math.round(part.value * 100)}% × {part.weight.toFixed(2)}
                        </span>
                      </li>
                    ))}
                </ul>
                <p className="mt-2 text-ink-muted">
                  No hidden model — every factor above is a 0–100% match against this weight.
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </article>
  );
}
