import { MapCanvas } from "@/components/app/map-canvas";
import { PlaceVisual } from "@/components/app/place-visual";
import { Stars } from "@/components/app/rating";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
import { filterPreparedPlaces, sortPreparedPlaces } from "@/lib/domain/filters";
import { parsePlaceListQuery, type RawSearchParams } from "@/lib/domain/place-query";
import { loadUserLibrary } from "@/lib/services/library";
import { formatBudgetRange, formatDistanceKm, relativeTime } from "@/lib/utils/format";
import Link from "next/link";
import { MapPin } from "lucide-react";

export const metadata = { title: "Map" };

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requireUser();
  const raw = await searchParams;
  const query = parsePlaceListQuery(raw);
  const library = await loadUserLibrary(user.id, { originArea: query.city });

  const filtered = sortPreparedPlaces(
    filterPreparedPlaces(library.prepared, {
      city: query.city,
      cuisines: query.cuisines,
      categories: query.categories,
      maxSpend: query.maxSpend,
      minPublicRating: query.minPublicRating,
      minPersonalRating: query.minPersonalRating,
      visitState: query.visitState,
      favouritesOnly: query.favouritesOnly,
      wishlistOnly: query.wishlistOnly,
      openNow: query.openNow,
      tags: query.tags,
      search: query.search,
    }),
    query.city ? "distance" : "recommendation",
  );

  const withCoords = filtered.filter(
    (prepared) => prepared.place.latitude != null && prepared.place.longitude != null,
  );

  const cities = [...new Set(library.places.map((place) => place.city).filter(Boolean))].sort();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold">Map</h1>
          <p className="text-sm text-ink-muted">
            {withCoords.length} of {library.places.length} places have coordinates
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href="/map" className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-muted">
            All Cyprus
          </Link>
          {cities.map((city) => (
            <Link
              key={city}
              href={`/map?city=${encodeURIComponent(city as string)}`}
              className={
                query.city === city
                  ? "rounded-full border border-ink bg-ink px-3 py-1.5 text-xs font-medium text-canvas"
                  : "rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-muted"
              }
            >
              {city}
            </Link>
          ))}
        </div>
      </div>

      {library.places.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Nothing to plot yet"
          description="Save a place and it will appear on the map with its address and coordinates."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <MapCanvas
            points={withCoords.map((prepared) => ({
              id: prepared.place.id,
              name: prepared.place.name,
              category: prepared.place.category,
              latitude: prepared.place.latitude as number,
              longitude: prepared.place.longitude as number,
              area: prepared.place.area,
              city: prepared.place.city,
              publicRating: prepared.place.publicRating,
              personalRating: prepared.place.stats.personalRating,
              budgetText: formatBudgetRange(prepared.budget.min, prepared.budget.max, {
                approximate: prepared.budget.approximate,
              }),
              distanceKm: prepared.distanceKm,
              status: prepared.place.status,
            }))}
          />

          <Card className="divide-y divide-line lg:max-h-[560px] lg:overflow-y-auto">
            {filtered.slice(0, 40).map((prepared) => (
              <Link
                key={prepared.id}
                href={`/places/${prepared.place.id}`}
                className="flex items-center gap-3 p-3.5 transition hover:bg-surface-muted/60"
              >
                <PlaceVisual
                  name={prepared.place.name}
                  category={prepared.place.category}
                  cuisines={prepared.place.cuisines}
                  photoRef={prepared.place.photoRef}
                  size="thumb"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{prepared.place.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {[prepared.place.area ?? prepared.place.city, prepared.place.cuisines[0]]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {prepared.distanceKm != null ? (
                    <p className="text-xs text-ink-muted">
                      {formatDistanceKm(prepared.distanceKm)} away
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {prepared.place.stats.personalRating != null ? (
                    <Stars value={prepared.place.stats.personalRating} size="sm" />
                  ) : prepared.place.publicRating != null ? (
                    <Badge variant="rating" size="sm">
                      {prepared.place.publicRating.toFixed(1)}★
                    </Badge>
                  ) : null}
                  <span className="text-[11px] text-ink-muted">
                    {prepared.place.stats.visitCount > 0
                      ? relativeTime(prepared.place.stats.lastVisitedAt)
                      : "not visited"}
                  </span>
                </div>
              </Link>
            ))}
            {filtered.length === 0 ? (
              <p className="p-5 text-sm text-ink-muted">
                No places match those filters. Try another city.
              </p>
            ) : null}
          </Card>
        </div>
      )}

      <p className="text-xs text-ink-muted">
        The map uses OpenStreetMap tiles. Allow device location to see yourself on the map, or set
        a different Cyprus address, area, or coordinate pair as the distance starting point.
      </p>
    </div>
  );
}
