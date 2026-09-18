import type { Repositories } from "@/lib/data/repositories";
import { resolveBudget } from "@/lib/domain/budget";
import { isOpenAt } from "@/lib/domain/opening-hours";
import { preparePlaces } from "@/lib/domain/place-view";
import { matchPercent, scoreCandidate } from "@/lib/domain/scoring";
import type { FoodItem, PlaceWithStats, Recommendation, Visit, VisitWithItems } from "@/lib/domain/types";
import { loadUserLibrary, withStats, type UserLibrary } from "./library";

export interface DashboardHighlight {
  item: FoodItem;
  place: PlaceWithStats;
  visit: Visit | null;
}

export interface DashboardData {
  library: UserLibrary;
  topPick: Recommendation | null;
  recentlySaved: PlaceWithStats[];
  wantToTry: PlaceWithStats[];
  recentVisits: VisitWithItems[];
  rediscover: PlaceWithStats[];
  highlights: DashboardHighlight[];
  counts: {
    places: number;
    visits: number;
    unvisited: number;
    cities: number;
    dishes: number;
    ratedVisits: number;
  };
}

export async function loadDashboard(
  userId: string,
  options: { repos?: Repositories; now?: Date; originArea?: string | null } = {},
): Promise<DashboardData> {
  const now = options.now ?? new Date();
  const library = await loadUserLibrary(userId, {
    repos: options.repos,
    now,
    originArea: options.originArea ?? null,
  });

  const { places, visits, items, preferences } = library;
  const placeById = new Map(places.map((place) => [place.id, place]));

  const activePlaces = places.filter((place) => place.status !== "archived");
  const unvisited = activePlaces.filter((place) => place.stats.visitCount === 0);

  const recentlySaved = [...unvisited]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, 6);

  const wantToTry = unvisited
    .filter((place) => place.status === "wishlist" || place.status === "favourite")
    .sort((a, b) => {
      const aAffinity = preferenceStrength(a, preferences);
      const bAffinity = preferenceStrength(b, preferences);
      return bAffinity - aAffinity || b.savedAt.localeCompare(a.savedAt);
    })
    .slice(0, 6);

  const visitsByPlace = groupVisits(visits);
  const itemsByVisit = groupItems(items);
  const recentVisits: VisitWithItems[] = visits.slice(0, 5).map((visit) => ({
    ...visit,
    items: itemsByVisit.get(visit.id) ?? [],
  }));

  const rediscover = activePlaces
    .filter(
      (place) =>
        place.stats.visitCount > 0 &&
        (place.stats.personalRating ?? 0) >= 3.5 &&
        place.stats.lastVisitedAt !== null &&
        daysSince(place.stats.lastVisitedAt, now) > 60,
    )
    .sort((a, b) => {
      const aScore = (a.stats.personalRating ?? 0) * daysSince(a.stats.lastVisitedAt as string, now);
      const bScore = (b.stats.personalRating ?? 0) * daysSince(b.stats.lastVisitedAt as string, now);
      return bScore - aScore;
    })
    .slice(0, 4);

  const highlights: DashboardHighlight[] = items
    .filter((item) => (item.rating ?? 0) >= 4.5 || item.isHighlight)
    .sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, 6)
    .flatMap((item) => {
      const place = placeById.get(item.placeId);
      if (!place) return [];
      return [
        {
          item,
          place,
          visit: visits.find((visit) => visit.id === item.visitId) ?? null,
        },
      ];
    });

  const prepared = preparePlaces(places, { visits, items }, preferences, { now });
  const candidate = prepared
    .filter((entry) => entry.place.status !== "archived")
    .map((entry) => ({
      entry,
      result: scoreCandidate({
        prepared: entry,
        query: { area: options.originArea ?? null },
        preferences,
        now,
      }),
    }))
    .sort((a, b) => b.result.score - a.result.score)[0];

  const topPick: Recommendation | null = candidate
    ? {
        place: candidate.entry.place,
        items: candidate.entry.items.slice(0, 3),
        matchPercent: matchPercent(candidate.result.score),
        reasons: candidate.result.reasons,
        breakdown: candidate.result.breakdown,
        hardFiltersSatisfied: [],
        distanceKm: candidate.entry.distanceKm,
        isOpenNow: candidate.entry.isOpenNow,
        surprise: false,
      }
    : null;

  return {
    library,
    topPick,
    recentlySaved,
    wantToTry,
    recentVisits,
    rediscover,
    highlights,
    counts: {
      places: activePlaces.length,
      visits: visits.length,
      unvisited: unvisited.length,
      cities: new Set(activePlaces.map((place) => place.city).filter(Boolean)).size,
      dishes: items.length,
      ratedVisits: visits.filter((visit) => typeof visit.rating === "number").length,
    },
  };
}

export interface PlaceDetailData {
  place: PlaceWithStats;
  visits: VisitWithItems[];
  items: FoodItem[];
  budget: ReturnType<typeof resolveBudget>;
  isOpenNow: boolean | null;
  preferenceAverage: number | null;
}

export async function loadPlaceDetail(
  userId: string,
  placeId: string,
  options: { repos?: Repositories; now?: Date } = {},
): Promise<PlaceDetailData | null> {
  const now = options.now ?? new Date();
  const library = await loadUserLibrary(userId, { repos: options.repos, now });
  const place = library.places.find((entry) => entry.id === placeId);
  if (!place) return null;

  const visits = library.visits.filter((visit) => visit.placeId === placeId);
  const items = library.items.filter((item) => item.placeId === placeId);
  const visitsWithItems: VisitWithItems[] = visits.map((visit) => ({
    ...visit,
    items: items.filter((item) => item.visitId === visit.id),
  }));

  return {
    place,
    visits: visitsWithItems,
    items,
    budget: resolveBudget(place, visits),
    isOpenNow: isOpenAt(place.openingHours, now),
    preferenceAverage: averageCuisineAffinity(place, library),
  };
}

function averageCuisineAffinity(place: PlaceWithStats, library: UserLibrary): number | null {
  const stats = place.cuisines
    .map((cuisine) => library.preferences.cuisineAffinity[cuisine.toLowerCase()])
    .filter((stat): stat is NonNullable<typeof stat> => Boolean(stat) && stat.count >= 2);
  if (stats.length === 0) return null;
  return stats.reduce((sum, stat) => sum + stat.average, 0) / stats.length;
}

function preferenceStrength(place: PlaceWithStats, preferences: UserLibrary["preferences"]): number {
  const stats = place.cuisines
    .map((cuisine) => preferences.cuisineAffinity[cuisine.toLowerCase()])
    .filter((stat): stat is NonNullable<typeof stat> => Boolean(stat));
  if (stats.length === 0) return 0;
  return Math.max(...stats.map((stat) => stat.average * stat.confidence));
}

function groupVisits(visits: Visit[]): Map<string, Visit[]> {
  const map = new Map<string, Visit[]>();
  for (const visit of visits) {
    const list = map.get(visit.placeId) ?? [];
    list.push(visit);
    map.set(visit.placeId, list);
  }
  return map;
}

function groupItems(items: FoodItem[]): Map<string, FoodItem[]> {
  const map = new Map<string, FoodItem[]>();
  for (const item of items) {
    const list = map.get(item.visitId) ?? [];
    list.push(item);
    map.set(item.visitId, list);
  }
  return map;
}

function daysSince(iso: string, now: Date): number {
  return Math.abs(now.getTime() - new Date(iso).getTime()) / 86_400_000;
}

export { withStats };
