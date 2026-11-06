import { resolveBudget, type BudgetEstimate } from "./budget";
import { distanceFromOrigin, type Coordinates } from "./geo";
import { isOpenAt } from "./opening-hours";
import { placeAffinityScore } from "./preferences";
import type { FoodItem, PlaceWithStats, UserPreferences, Visit } from "./types";

/**
 * A place enriched with everything the UI and the ranking engine need, computed
 * once per request. Pure: no database access happens here.
 */
export interface PreparedPlace {
  id: string;
  place: PlaceWithStats;
  visits: Visit[];
  items: FoodItem[];
  budget: BudgetEstimate;
  distanceKm: number | null;
  isOpenNow: boolean | null;
  affinity: number;
}

export interface PrepareOptions {
  originArea?: string | null;
  originCoordinates?: Coordinates | null;
  now?: Date;
  timeZone?: string;
}

export function preparePlace(
  place: PlaceWithStats,
  history: { visits: Visit[]; items: FoodItem[] },
  preferences: UserPreferences,
  options: PrepareOptions = {},
): PreparedPlace {
  const visits = history.visits
    .filter((visit) => visit.placeId === place.id)
    .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));
  const items = history.items.filter((item) => item.placeId === place.id);

  return {
    id: place.id,
    place,
    visits,
    items,
    budget: resolveBudget(place, visits),
    distanceKm: distanceFromOrigin(place, {
      origin: options.originCoordinates,
      originArea: options.originArea,
    }),
    isOpenNow: isOpenAt(place.openingHours, options.now ?? new Date(), options.timeZone),
    affinity: placeAffinityScore(place, preferences),
  };
}

export function preparePlaces(
  places: PlaceWithStats[],
  history: { visits: Visit[]; items: FoodItem[] },
  preferences: UserPreferences,
  options: PrepareOptions = {},
): PreparedPlace[] {
  return places.map((place) => preparePlace(place, history, preferences, options));
}

export function topHighlightItems(prepared: Pick<PreparedPlace, "items">, limit = 3): FoodItem[] {
  return [...prepared.items]
    .filter((item) => typeof item.rating === "number" || item.isHighlight)
    .sort(
      (a, b) =>
        Number(b.isHighlight) - Number(a.isHighlight) ||
        (b.rating ?? 0) - (a.rating ?? 0) ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, limit);
}
