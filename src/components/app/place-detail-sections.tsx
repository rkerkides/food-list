import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Stars } from "./rating";
import { DeleteVisitButton, LogVisitDialog } from "./log-visit-dialog";
import {
  OCCASION_LABELS,
  type FoodItem,
  type PlaceWithStats,
  type VisitWithItems,
} from "@/lib/domain/types";
import { isImportedHistory } from "@/lib/domain/visit-history";
import { formatDate, formatEur, formatRating, relativeTime } from "@/lib/utils/format";
import { CalendarDays, ChefHat, Repeat, Sparkles, Star, Utensils } from "lucide-react";
import Link from "next/link";

export function HighlightsGrid({
  items,
  visits,
}: {
  items: FoodItem[];
  visits: VisitWithItems[];
}) {
  const highlights = [...items]
    .filter((item) => (item.rating ?? 0) >= 4 || item.isHighlight)
    .sort(
      (a, b) =>
        Number(b.isHighlight) - Number(a.isHighlight) || (b.rating ?? 0) - (a.rating ?? 0),
    )
    .slice(0, 6);

  if (highlights.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-sm text-ink-muted">
        No dishes logged yet. Add them when you log a visit and they will appear here as your
        personal highlights.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {highlights.map((item) => {
        const visit = visits.find((entry) => entry.id === item.visitId);
        return (
          <div
            key={item.id}
            className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-ink-muted">
                  {item.category ? `${item.category} · ` : ""}
                  {visit && isImportedHistory(visit)
                    ? "From previous list"
                    : visit
                      ? relativeTime(visit.visitedAt)
                      : relativeTime(item.createdAt)}
                </p>
              </div>
              {item.isHighlight ? (
                <Badge variant="clay" size="sm">
                  <Sparkles className="size-3" />
                  Favourite
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Stars value={item.rating} size="sm" showValue />
              {item.price != null ? (
                <span className="ml-auto text-xs text-ink-muted">{formatEur(item.price)}</span>
              ) : null}
            </div>
            {item.comment ? (
              <p className="mt-2 text-sm text-ink-soft text-pretty">{item.comment}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function OrderSuggestions({
  items,
  hasVisited,
  placeName,
}: {
  items: FoodItem[];
  hasVisited: boolean;
  placeName: string;
}) {
  const ranked = [...items]
    .filter((item) => typeof item.rating === "number")
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 3);
  const avoid = items.filter((item) => (item.rating ?? 5) <= 2.5).slice(0, 2);

  if (!hasVisited) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-olive-50 text-olive-700">
            <ChefHat className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="font-medium">Not visited yet</p>
            <p className="text-sm text-ink-muted text-pretty">
              Once you order something at {placeName} and rate it, this is where we will tell you
              what to order again.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (ranked.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink-muted">
          You have visited {placeName} but have not rated any dishes yet. Add a dish rating next
          time and we will remember what to order.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <ChefHat className="size-4 text-clay-600" />
        <p className="text-sm font-semibold">Order this again</p>
      </div>
      <ul className="mt-3 space-y-2.5">
        {ranked.map((item, index) => (
          <li key={item.id} className="flex items-center gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-clay-50 text-xs font-semibold text-clay-700">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.name}</span>
              {item.comment ? (
                <span className="block truncate text-xs text-ink-muted">{item.comment}</span>
              ) : null}
            </span>
            <Stars value={item.rating} size="sm" />
          </li>
        ))}
      </ul>
      {avoid.length > 0 ? (
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
          Skipped last time: {avoid.map((item) => item.name).join(", ")}
        </p>
      ) : null}
    </Card>
  );
}

export function VisitTimeline({
  visits,
  place,
  canEdit = true,
  canDelete = true,
}: {
  visits: VisitWithItems[];
  place: PlaceWithStats;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  if (visits.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-3 p-5">
        <span className="grid size-10 place-items-center rounded-2xl bg-clay-50 text-clay-700">
          <CalendarDays className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">Not visited yet</p>
          <p className="text-sm text-ink-muted text-pretty">
            {place.savedReason
              ? `You saved it because: “${place.savedReason}”.`
              : "Log your first visit to start building a history here."}
          </p>
        </div>
        {canEdit ? <LogVisitDialog placeId={place.id} placeName={place.name} /> : null}
      </Card>
    );
  }

  const lastSpend = visits.find((visit) => visit.spendPerPerson != null)?.spendPerPerson ?? null;

  return (
    <div className="space-y-4">
      {visits.map((visit) => (
        <Card key={visit.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">
                  {isImportedHistory(visit) ? "Previously visited" : formatDate(visit.visitedAt)}
                </p>
                {isImportedHistory(visit) ? <Badge size="sm">Date not recorded</Badge> : null}
                {visit.occasion ? (
                  <Badge size="sm">{OCCASION_LABELS[visit.occasion]}</Badge>
                ) : null}
                {visit.wouldReturn ? (
                  <Badge variant="olive" size="sm">
                    <Repeat className="size-3" />
                    Would return
                  </Badge>
                ) : visit.wouldReturn === false ? (
                  <Badge size="sm">Not again</Badge>
                ) : null}
              </div>
              <p className="text-xs text-ink-muted">
                {visit.partySize ? `${visit.partySize} people · ` : ""}
                {visit.spendPerPerson != null
                  ? `${formatEur(visit.spendPerPerson)} per person`
                  : "Spend not recorded"}
                {visit.tags.length > 0 ? ` · ${visit.tags.join(", ")}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Stars value={visit.rating} showValue size="md" />
            </div>
          </div>

          {visit.thoughts ? (
            <p className="mt-3 text-sm text-ink-soft text-pretty">{visit.thoughts}</p>
          ) : null}

          {visit.items.length > 0 ? (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {visit.items.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-2.5">
                  <Utensils className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {item.name}
                      {item.isHighlight ? (
                        <Star className="size-3.5 fill-star text-star" />
                      ) : null}
                    </p>
                    {item.comment ? (
                      <p className="text-xs text-ink-muted text-pretty">{item.comment}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    {item.rating != null ? (
                      <span className="text-xs font-medium">{formatRating(item.rating)}★</span>
                    ) : null}
                    {item.price != null ? (
                      <p className="text-xs text-ink-muted">{formatEur(item.price)}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <Link
              href={`/places/${place.id}#visits`}
              className="text-xs text-ink-muted"
              aria-hidden="true"
              tabIndex={-1}
            >
              Visit {visits.indexOf(visit) + 1} of {visits.length}
            </Link>
            {canEdit ? <div className="flex items-center gap-1">
              <LogVisitDialog
                placeId={place.id}
                placeName={place.name}
                visit={visit}
                lastSpend={lastSpend}
                trigger={
                  <button
                    type="button"
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-surface-muted"
                  >
                    Edit
                  </button>
                }
              />
              {canDelete ? <DeleteVisitButton visitId={visit.id} placeId={place.id} /> : null}
            </div>
            : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
