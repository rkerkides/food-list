import { PlaceCard } from "@/components/app/place-card";
import { AddPlaceDialogButton } from "@/components/app/add-place-dialog-button";
import { ActiveFilterChips, PlaceFilters } from "@/components/app/place-filters";
import { PlaceToolbar } from "@/components/app/place-toolbar";
import { MapCanvas } from "@/components/app/map-canvas";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { deriveFilterOptions, filterPreparedPlaces, sortPreparedPlaces } from "@/lib/domain/filters";
import { parsePlaceListQuery, type RawSearchParams } from "@/lib/domain/place-query";
import { scoreCandidate } from "@/lib/domain/scoring";
import { loadUserLibrary } from "@/lib/services/library";
import { describeProvider } from "@/lib/places";
import { formatBudgetRange } from "@/lib/utils/format";
import { Search } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Places" };

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const query = parsePlaceListQuery(params);
  const provider = describeProvider();
  const originArea = query.city ?? null;
  const library = await loadUserLibrary(user.id, { originArea });
  const options = deriveFilterOptions(library.prepared);

  const filtered = filterPreparedPlaces(library.prepared, {
    search: query.search,
    city: query.city,
    areas: query.areas,
    cuisines: query.cuisines,
    categories: query.categories,
    statuses: query.statuses,
    tags: query.tags,
    maxSpend: query.maxSpend,
    minPublicRating: query.minPublicRating,
    minPersonalRating: query.minPersonalRating,
    visitState: query.visitState,
    favouritesOnly: query.favouritesOnly,
    wishlistOnly: query.wishlistOnly,
    openNow: query.openNow,
    maxDistanceKm: query.maxDistanceKm,
  });

  const scores = Object.fromEntries(
    filtered.map((prepared) => [
      prepared.id,
      scoreCandidate({
        prepared,
        query: {
          area: originArea,
          cuisines: query.cuisines,
          categories: query.categories,
          maxSpend: query.maxSpend,
          maxDistanceKm: query.maxDistanceKm,
          visitState: query.visitState,
          minPublicRating: query.minPublicRating,
          minPersonalRating: query.minPersonalRating,
        },
        preferences: library.preferences,
      }).score,
    ]),
  );

  const sorted = sortPreparedPlaces(filtered, query.sort, scores);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold">Places</h1>
          <p className="text-sm text-ink-muted">
            {library.places.length} saved across Cyprus
            {query.city ? ` · filtered to ${query.city}` : ""}
          </p>
        </div>
        <div className="lg:hidden">
          <AddPlaceDialogButton label="Add place" provider={provider} />
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <PlaceFilters options={options} total={library.places.length} shown={sorted.length} />

        <div className="min-w-0 flex-1 space-y-4">
          <PlaceToolbar count={sorted.length} />
          <ActiveFilterChips options={options} />

          {library.places.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Your list is empty"
              description="Add the first place you have been meaning to try — search by name, dish or area and we will fill in the details."
              action={<AddPlaceDialogButton provider={provider} />}
            />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No places match those filters"
              description="Try removing a filter, widening the budget, or searching for something else."
              action={
                <Button asChild variant="outline">
                  <Link href="/places">Clear filters</Link>
                </Button>
              }
            />
          ) : query.view === "map" ? (
            <MapCanvas
              points={sorted.map((prepared) => ({
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
              className="mt-1"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((prepared) => (
                <PlaceCard
                  key={prepared.id}
                  data={{
                    place: prepared.place,
                    distanceKm: prepared.distanceKm,
                    budget: {
                      min: prepared.budget.min,
                      max: prepared.budget.max,
                      approximate: prepared.budget.approximate,
                    },
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
