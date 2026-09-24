import Link from "next/link";
import { AddPlaceDialogButton } from "@/components/app/add-place-dialog-button";
import { PlaceCard } from "@/components/app/place-card";
import { PlaceVisual } from "@/components/app/place-visual";
import { RatingBars, Stars } from "@/components/app/rating";
import { Section } from "@/components/app/section";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
import { loadDashboard } from "@/lib/services/dashboard";
import { OCCASION_LABELS } from "@/lib/domain/types";
import { formatDate, formatRating, relativeTime } from "@/lib/utils/format";
import { describeProvider } from "@/lib/places";
import {
  CalendarClock,
  CalendarDays,
  Compass,
  MapPin,
  Sparkles,
  Star,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";

const QUICK_CHIPS = [
  { label: "Quick lunch", href: "/decide?occasion=quick_lunch&vibe=quick", icon: UtensilsCrossed },
  { label: "Coffee & cake", href: "/decide?category=cafe,dessert&openNow=1", icon: Sparkles },
  { label: "Date night", href: "/decide?occasion=date_night&vibe=nicer", icon: Star },
  { label: "Under €20", href: "/decide?maxSpend=20", icon: TrendingUp },
  { label: "Surprise me", href: "/decide?surprise=1", icon: Compass },
];

export default async function HomePage() {
  const user = await requireUser();
  const provider = describeProvider();
  const data = await loadDashboard(user.id);
  const { counts, topPick } = data;
  const firstName = user.name.split(" ")[0];
  const greeting = greetingFor(new Date());

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="surface-highlight relative overflow-hidden rounded-[calc(var(--radius-card)+8px)] border border-line p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="pointer-events-none absolute -right-14 -top-20 size-56 rounded-full bg-clay-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-52 rounded-full bg-olive-200/25 blur-3xl" />
        <div className="relative space-y-5">
          <div className="space-y-1.5">
            <p className="text-sm text-ink-muted">
              {greeting}, {firstName}
            </p>
            <h1 className="font-display text-3xl leading-tight font-semibold text-balance sm:text-5xl">
              Where should we eat?
            </h1>
            {counts.places > 0 ? (
              <p className="text-sm text-ink-muted">
                {counts.places} places saved · {counts.visits} visits · {counts.dishes} dishes
                remembered
              </p>
            ) : null}
          </div>

          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {QUICK_CHIPS.map((chip) => {
              const Icon = chip.icon;
              return (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink-soft shadow-sm transition hover:-translate-y-0.5 hover:text-ink"
                >
                  <Icon className="size-3.5 text-clay-600" />
                  {chip.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {provider.mode === "demo" ? (
        <Alert variant="info" title="Running on demo data">
          Search uses a bundled Cyprus dataset of fictional venues. Run `npm run places:sync` to
          import real Cyprus venues without an API key, or configure Google Places.
        </Alert>
      ) : null}

      {counts.places === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Start with one place you have been meaning to try"
          description="Search for a restaurant, cafe or bakery in Cyprus. We will fill in available address, hours and contact details, then you can add your own ratings and budget notes."
          action={<AddPlaceDialogButton />}
        />
      ) : null}

      {topPick ? (
        <section className="overflow-hidden rounded-[calc(var(--radius-card)+4px)] border border-clay-100 bg-gradient-to-br from-clay-50 via-canvas to-olive-50 p-4 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="clay">
              <Sparkles className="size-3" />
              Strong option for you
            </Badge>
            <span className="text-xs font-medium text-clay-800">
              {topPick.matchPercent}% match
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <PlaceVisual
              name={topPick.place.name}
              category={topPick.place.category}
              cuisines={topPick.place.cuisines}
              photoRef={topPick.place.photoRef}
              className="sm:hidden"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <PlaceVisual
                  name={topPick.place.name}
                  category={topPick.place.category}
                  cuisines={topPick.place.cuisines}
                  photoRef={topPick.place.photoRef}
                  size="thumb"
                  className="hidden shrink-0 sm:block"
                />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-2xl font-semibold">
                    {topPick.place.name}
                  </h2>
                  <p className="truncate text-sm text-ink-soft">
                    {[topPick.place.cuisines.slice(0, 2).join(" · "), topPick.place.area]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <ul className="space-y-1 text-sm text-ink-soft">
                {topPick.reasons.slice(0, 3).map((reason) => (
                  <li key={reason.label} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-clay-500" />
                    <span className="text-pretty">{reason.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/places/${topPick.place.id}`}>Open place</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/decide">
                <Compass className="size-4" />
                Decide with filters
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {data.recentlySaved.length > 0 ? (
        <Section
          title="Recently saved"
          subtitle="Added to your list, not tried yet"
          action={{ label: "All places", href: "/places?visitState=unvisited" }}
        >
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
            {data.recentlySaved.slice(0, 6).map((place) => (
              <PlaceCard
                key={place.id}
                data={{ place }}
                className="w-[75vw] shrink-0 snap-start sm:w-auto"
              />
            ))}
          </div>
        </Section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        {data.wantToTry.length > 0 ? (
          <Section
            title="Want to try"
            subtitle="Your highest-interest unvisited places"
            action={{ label: "Wishlist", href: "/places?wishlist=1" }}
          >
            <Card className="divide-y divide-line">
              {data.wantToTry.map((place) => (
                <Link
                  key={place.id}
                  href={`/places/${place.id}`}
                  className="flex items-center gap-3 p-3.5 transition hover:bg-surface-muted/60"
                >
                  <PlaceVisual
                    name={place.name}
                    category={place.category}
                    cuisines={place.cuisines}
                    photoRef={place.photoRef}
                    size="thumb"
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{place.name}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {[place.cuisines[0], place.area ?? place.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right text-xs text-ink-muted">
                    {place.publicRating ? (
                      <span className="inline-flex items-center gap-1 font-medium text-ink">
                        <Star className="size-3 fill-star text-star" />
                        {formatRating(place.publicRating)}
                      </span>
                    ) : null}
                    <p className="mt-0.5">saved {relativeTime(place.savedAt)}</p>
                  </div>
                </Link>
              ))}
            </Card>
          </Section>
        ) : null}

        <Section
          title="Recent visits"
          subtitle="What you have been eating lately"
          action={{ label: "Places", href: "/places?visitState=visited&sort=recently_visited" }}
        >
          {data.recentVisits.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No visits logged yet"
              description="Once you log a visit you can record what you ate, what it cost and whether you would go back."
            />
          ) : (
            <Card className="divide-y divide-line">
              {data.recentVisits.map((visit) => (
                <div key={visit.id} className="flex gap-3 p-3.5">
                  <div className="mt-0.5 flex flex-col items-center gap-1">
                    <span className="grid size-9 place-items-center rounded-full bg-clay-50 text-clay-700">
                      <UtensilsCrossed className="size-4" />
                    </span>
                    <span className="h-full w-px bg-line" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/places/${visit.placeId}`}
                        className="truncate font-medium hover:underline"
                      >
                        {data.library.places.find((place) => place.id === visit.placeId)?.name ??
                          "Place"}
                      </Link>
                      {visit.rating != null ? <RatingBars rating={visit.rating} /> : null}
                    </div>
                    <p className="text-xs text-ink-muted">
                      {formatDate(visit.visitedAt)}
                      {visit.occasion ? ` · ${OCCASION_LABELS[visit.occasion]}` : ""}
                      {visit.spendPerPerson ? ` · €${visit.spendPerPerson}/person` : ""}
                    </p>
                    {visit.thoughts ? (
                      <p className="line-clamp-2 text-sm text-ink-soft text-pretty">
                        {visit.thoughts}
                      </p>
                    ) : null}
                    {visit.items.length > 0 ? (
                      <p className="flex flex-wrap gap-1.5 pt-0.5">
                        {visit.items.slice(0, 3).map((item) => (
                          <Badge key={item.id} variant="olive" size="sm">
                            {item.name}
                            {item.rating ? ` ${item.rating}★` : ""}
                          </Badge>
                        ))}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </Section>
      </div>

      {data.rediscover.length > 0 ? (
        <Section
          title="Rediscover"
          subtitle="Places you liked, but have not been back to in a while"
          action={{ label: "Longest since visit", href: "/places?sort=longest_since_visit" }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.rediscover.map((place) => (
              <Link
                key={place.id}
                href={`/places/${place.id}`}
                className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="size-3.5 text-clay-600" />
                  <span className="truncate text-xs font-medium text-ink-muted">
                    {place.area ?? place.city}
                  </span>
                </div>
                <p className="font-display text-lg leading-tight font-semibold">{place.name}</p>
                <Stars value={place.stats.personalRating} size="sm" showValue />
                <p className="mt-auto inline-flex items-center gap-1.5 text-xs text-ink-muted">
                  <CalendarClock className="size-3.5" />
                  last visit {relativeTime(place.stats.lastVisitedAt)}
                </p>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {data.highlights.length > 0 ? (
        <Section
          title="Food highlights"
          subtitle="The dishes worth going back for"
          action={{ label: "Your taste", href: "/profile" }}
        >
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
            {data.highlights.slice(0, 6).map(({ item, place }) => (
              <Link
                key={item.id}
                href={`/places/${place.id}`}
                className="flex w-[70vw] shrink-0 snap-start items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3.5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 sm:w-auto"
              >
                <PlaceVisual
                  name={place.name}
                  category={place.category}
                  cuisines={place.cuisines}
                  photoRef={place.photoRef}
                  size="thumb"
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-xs text-ink-muted">{place.name}</p>
                  {item.rating ? (
                    <Stars value={item.rating} size="sm" className="mt-0.5" />
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function greetingFor(date: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Nicosia" })
      .format(date)
      .slice(0, 2),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
