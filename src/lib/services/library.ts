import { ensureMigrations, getDb } from "@/lib/db";
import { createRepositories, type Repositories } from "@/lib/data/repositories";
import { buildUserPreferences } from "@/lib/domain/preferences";
import { preparePlaces, type PreparedPlace } from "@/lib/domain/place-view";
import type {
  FoodItem,
  Place,
  PlaceStats,
  PlaceWithStats,
  UserPreferences,
  Visit,
} from "@/lib/domain/types";

/**
 * The whole personal library, loaded in three queries and enriched in memory.
 *
 * A personal food list is small (tens to a few hundred places), so computing
 * stats and the taste profile in memory keeps the ranking engine a pure function
 * that is trivial to test and to reason about.
 */
export interface UserLibrary {
  places: PlaceWithStats[];
  visits: Visit[];
  items: FoodItem[];
  preferences: UserPreferences;
  prepared: PreparedPlace[];
}

export interface LoadLibraryOptions {
  originArea?: string | null;
  now?: Date;
  timeZone?: string;
  repos?: Repositories;
}

export async function loadUserLibrary(
  userId: string,
  options: LoadLibraryOptions = {},
): Promise<UserLibrary> {
  const repos = options.repos ?? (await defaultRepositories());
  const [places, visits, items] = await Promise.all([
    repos.places.listByUser(userId),
    repos.visits.listByUser(userId),
    repos.foodItems.listByUser(userId),
  ]);

  return buildLibrary(places, visits, items, options);
}

export function buildLibrary(
  places: Awaited<ReturnType<Repositories["places"]["listByUser"]>>,
  visits: Visit[],
  items: FoodItem[],
  options: Omit<LoadLibraryOptions, "repos"> = {},
): UserLibrary {
  const placesWithStats = withStats(places, visits, items);
  const preferences = buildUserPreferences(placesWithStats, visits, items);
  const prepared = preparePlaces(
    placesWithStats,
    { visits, items },
    preferences,
    { originArea: options.originArea ?? null, now: options.now, timeZone: options.timeZone },
  );
  return { places: placesWithStats, visits, items, preferences, prepared };
}

export function computePlaceStats(
  placeId: string,
  visits: Visit[],
  items: FoodItem[],
): PlaceStats {
  const placeVisits = visits
    .filter((visit) => visit.placeId === placeId)
    .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));
  const placeItems = items.filter((item) => item.placeId === placeId);

  const ratings = placeVisits
    .map((visit) => visit.rating)
    .filter((rating): rating is number => typeof rating === "number");
  const spends = placeVisits
    .map((visit) => visit.spendPerPerson)
    .filter((spend): spend is number => typeof spend === "number" && spend > 0)
    .sort((a, b) => a - b);
  const returnFlags = placeVisits
    .map((visit) => visit.wouldReturn)
    .filter((value): value is boolean => typeof value === "boolean");

  return {
    visitCount: placeVisits.length,
    lastVisitedAt: placeVisits[0]?.visitedAt ?? null,
    firstVisitedAt: placeVisits[placeVisits.length - 1]?.visitedAt ?? null,
    personalRating:
      ratings.length > 0 ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
    observedSpendMedian: spends.length > 0 ? median(spends) : null,
    observedSpendMin: spends[0] ?? null,
    observedSpendMax: spends[spends.length - 1] ?? null,
    highlightCount: placeItems.filter((item) => item.isHighlight).length,
    foodItemCount: placeItems.length,
    topFoodItems: [...placeItems]
      .sort(
        (a, b) =>
          Number(b.isHighlight) - Number(a.isHighlight) ||
          (b.rating ?? 0) - (a.rating ?? 0),
      )
      .slice(0, 5),
    wouldReturnRate:
      returnFlags.length > 0
        ? returnFlags.filter(Boolean).length / returnFlags.length
        : null,
  };
}

export function withStats(places: Place[], visits: Visit[], items: FoodItem[]): PlaceWithStats[] {
  return places.map((place) => ({
    ...place,
    stats: computePlaceStats(place.id, visits, items),
  }));
}

export async function defaultRepositories(): Promise<Repositories> {
  const db = getDb();
  await ensureMigrations(db);
  return createRepositories(db);
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
