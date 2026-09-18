import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlaceVisual } from "@/components/app/place-visual";
import { MapCanvas } from "@/components/app/map-canvas";
import { PlaceActions } from "@/components/app/place-actions";
import { EditPlaceDialog } from "@/components/app/edit-place-dialog";
import { LogVisitDialog } from "@/components/app/log-visit-dialog";
import {
  HighlightsGrid,
  OrderSuggestions,
  VisitTimeline,
} from "@/components/app/place-detail-sections";
import { Stars } from "@/components/app/rating";
import { requireUser } from "@/lib/auth/session";
import { loadPlaceDetail } from "@/lib/services/dashboard";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/domain/types";
import { DAY_LABELS, formatDayHours, localDayAndMinutes } from "@/lib/domain/opening-hours";
import { formatBudgetRange, formatCount, formatDate, formatRating, relativeTime } from "@/lib/utils/format";
import {
  ArrowLeft,
  CalendarCheck,
  Clock,
  ExternalLink,
  Info,
  MapPin,
  Phone,
  Receipt,
  Sparkles,
  Star,
  Tags,
} from "lucide-react";

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const data = await loadPlaceDetail(user.id, id);
  if (!data) notFound();

  const { place, visits, items, budget, isOpenNow, preferenceAverage } = data;
  const visited = visits.length > 0;
  const todayIndex = localDayAndMinutes(new Date(), "Asia/Nicosia").day;
  const lastSpend =
    visits.find((visit) => visit.spendPerPerson != null)?.spendPerPerson ?? null;

  const mapLink =
    place.latitude != null && place.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
      : place.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`
        : null;

  return (
    <div className="space-y-6">
      <Link
        href="/places"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All places
      </Link>

      <PlaceVisual
        name={place.name}
        category={place.category}
        photoRef={place.photoRef}
        size="hero"
        className="rounded-[calc(var(--radius-card)+4px)] border border-line"
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-7">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{CATEGORY_LABELS[place.category]}</Badge>
              {place.status !== "saved" ? (
                <Badge variant={place.status === "favourite" ? "clay" : "olive"}>
                  {STATUS_LABELS[place.status]}
                </Badge>
              ) : null}
              {place.area || place.city ? (
                <Badge variant="outline">
                  <MapPin className="size-3" />
                  {[place.area, place.city].filter(Boolean).join(", ")}
                </Badge>
              ) : null}
              {isOpenNow === true ? (
                <Badge variant="olive">Open now</Badge>
              ) : isOpenNow === false ? (
                <Badge variant="default">Closed now</Badge>
              ) : null}
            </div>

            <h1 className="font-display text-3xl leading-tight font-semibold text-balance sm:text-4xl">
              {place.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {place.cuisines.length > 0 ? (
                <span className="text-ink-soft">{place.cuisines.join(" · ")}</span>
              ) : null}
              {place.publicRating != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-4 fill-star text-star" />
                  <span className="font-semibold">{formatRating(place.publicRating)}</span>
                  <span className="text-ink-muted">
                    ({formatCount(place.publicRatingCount)} public reviews)
                  </span>
                </span>
              ) : (
                <span className="text-ink-muted">No public rating</span>
              )}
              <span className="font-medium text-ink">
                {formatBudgetRange(budget.min, budget.max, { approximate: budget.approximate })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <LogVisitDialog
                placeId={place.id}
                placeName={place.name}
                lastSpend={lastSpend}
                trigger={
                  <Button size="lg">
                    <CalendarCheck className="size-4" />
                    {visited ? "Log another visit" : "Log first visit"}
                  </Button>
                }
              />
              <EditPlaceDialog place={place} />
              {mapLink ? (
                <Button asChild variant="outline">
                  <a href={mapLink} target="_blank" rel="noreferrer">
                    <MapPin className="size-4" />
                    Directions
                  </a>
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Mine
                </span>
                {place.stats.personalRating != null ? (
                  <Stars value={place.stats.personalRating} showValue />
                ) : (
                  <span className="text-ink-muted">not rated yet</span>
                )}
              </span>
              <span className="hidden h-4 w-px bg-line sm:block" />
              <span className="text-ink-soft">
                {visited
                  ? `${place.stats.visitCount} ${place.stats.visitCount === 1 ? "visit" : "visits"} · last ${relativeTime(place.stats.lastVisitedAt)}`
                  : "Never visited"}
              </span>
              {place.stats.foodItemCount > 0 ? (
                <>
                  <span className="hidden h-4 w-px bg-line sm:block" />
                  <span className="text-ink-soft">
                    {place.stats.foodItemCount} dishes remembered
                  </span>
                </>
              ) : null}
              {preferenceAverage != null ? (
                <>
                  <span className="hidden h-4 w-px bg-line sm:block" />
                  <span className="inline-flex items-center gap-1.5 text-ink-soft">
                    <Sparkles className="size-3.5 text-clay-600" />
                    You rate similar places {formatRating(preferenceAverage)}
                  </span>
                </>
              ) : null}
            </div>
          </header>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold">My highlights</h2>
            <HighlightsGrid items={items} visits={visits} />
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold">What should I order?</h2>
            <OrderSuggestions items={items} hasVisited={visited} placeName={place.name} />
          </section>

          <section id="visits" className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold">Visit history</h2>
              {visited ? (
                <span className="text-sm text-ink-muted">
                  {visits.length} recorded {visits.length === 1 ? "visit" : "visits"}
                </span>
              ) : null}
            </div>
            <VisitTimeline visits={visits} place={place} />
          </section>
        </div>

        <aside className="w-full space-y-4 lg:w-80 lg:shrink-0">
          <Card className="space-y-4 p-5">
            <div className="space-y-3 text-sm">
              {place.address ? (
                <p className="flex gap-2.5 text-ink-soft">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                  <span>
                    {place.address}
                    {mapLink ? (
                      <>
                        {" "}
                        <a
                          href={mapLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-clay-700 hover:underline"
                        >
                          Map
                          <ExternalLink className="size-3" />
                        </a>
                      </>
                    ) : null}
                  </span>
                </p>
              ) : null}

              {place.phone ? (
                <p className="flex items-center gap-2.5 text-ink-soft">
                  <Phone className="size-4 shrink-0 text-ink-muted" />
                  <a href={`tel:${place.phone.replace(/\s/g, "")}`} className="hover:underline">
                    {place.phone}
                  </a>
                </p>
              ) : null}

              {place.website ? (
                <p className="flex items-center gap-2.5 text-ink-soft">
                  <ExternalLink className="size-4 shrink-0 text-ink-muted" />
                  <a
                    href={place.website}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate hover:underline"
                  >
                    {place.website.replace(/^https?:\/\//, "")}
                  </a>
                </p>
              ) : null}

              <p className="flex items-center gap-2.5 text-ink-soft">
                <Receipt className="size-4 shrink-0 text-ink-muted" />
                <span>
                  {formatBudgetRange(budget.min, budget.max, { approximate: budget.approximate })}
                  <span className="block text-xs text-ink-muted">{budget.label}</span>
                </span>
              </p>

              {place.priceLevel ? (
                <p className="flex items-center gap-2.5 text-ink-soft">
                  <Info className="size-4 shrink-0 text-ink-muted" />
                  <span>
                    Provider price level: {"€".repeat(place.priceLevel)}
                    <span className="block text-xs text-ink-muted">
                      {budget.source === "manual"
                        ? "Overridden by your own budget"
                        : "Only a rough signal"}
                    </span>
                  </span>
                </p>
              ) : null}
            </div>

            {place.openingHours ? (
              <div className="space-y-1.5 border-t border-line pt-4">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                  <Clock className="size-3.5" />
                  Opening hours
                </p>
                <ul className="space-y-0.5 text-sm">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <li
                      key={day}
                      className={
                        day === todayIndex
                          ? "flex justify-between gap-3 font-medium text-ink"
                          : "flex justify-between gap-3 text-ink-muted"
                      }
                    >
                      <span>{DAY_LABELS[day].slice(0, 3)}</span>
                      <span>{formatDayHours(place.openingHours?.[day] ?? [])}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-3 p-5">
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Your notes
            </p>
            {place.savedReason ? (
              <p className="text-sm text-ink-soft">
                <span className="font-medium text-ink">Why I saved it: </span>
                {place.savedReason}
              </p>
            ) : null}
            {place.note ? <p className="text-sm text-ink-soft text-pretty">{place.note}</p> : null}
            {place.tags.length > 0 ? (
              <p className="flex flex-wrap items-center gap-1.5 pt-1">
                <Tags className="size-3.5 text-ink-muted" />
                {place.tags.map((tag) => (
                  <Badge key={tag} variant="default" size="sm">
                    {tag}
                  </Badge>
                ))}
              </p>
            ) : null}
            {!place.savedReason && !place.note && place.tags.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing yet. Use Edit to add why you saved it or a note for next time.
              </p>
            ) : null}
            <p className="text-xs text-ink-muted">Saved {formatDate(place.savedAt)}</p>
          </Card>

          <Card className="space-y-3 p-5">
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Your numbers
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Visits" value={String(place.stats.visitCount)} />
              <Stat
                label="Avg rating"
                value={place.stats.personalRating ? formatRating(place.stats.personalRating) : "—"}
              />
              <Stat
                label="Median spend"
                value={
                  place.stats.observedSpendMedian
                    ? formatBudgetRange(place.stats.observedSpendMedian, null, {
                        approximate: true,
                        perPersonSuffix: false,
                      })
                    : "—"
                }
              />
              <Stat
                label="Would return"
                value={
                  place.stats.wouldReturnRate != null
                    ? `${Math.round(place.stats.wouldReturnRate * 100)}%`
                    : "—"
                }
              />
            </dl>
            {place.expectedSpendMin != null && place.budgetSource === "manual" ? (
              <p className="text-xs text-ink-muted">
                Your expected spend overrides the provider estimate.
              </p>
            ) : null}
          </Card>

          {place.latitude != null && place.longitude != null ? (
            <MapCanvas
              points={[
                {
                  id: place.id,
                  name: place.name,
                  category: place.category,
                  latitude: place.latitude,
                  longitude: place.longitude,
                  area: place.area,
                  city: place.city,
                  publicRating: place.publicRating,
                  personalRating: place.stats.personalRating,
                  budgetText: null,
                  distanceKm: null,
                  status: place.status,
                },
              ]}
              height="h-56"
              initialSelectedId={place.id}
            />
          ) : (
            <Card className="p-5">
              <p className="text-sm text-ink-muted">
                No coordinates saved for this place, so it is not shown on the map. You can add an
                address in Edit and refresh from the provider.
              </p>
            </Card>
          )}

          <Card className="space-y-4 p-5">
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Manage
            </p>
            <PlaceActions place={place} />
            <p className="text-xs text-ink-muted">
              Source: {place.provider === "google" ? "Google Places" : place.provider === "demo" ? "Demo dataset" : "Manual entry"}
              {place.externalFetchedAt
                ? ` · details refreshed ${relativeTime(place.externalFetchedAt)}`
                : ""}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted px-3 py-2">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}
