import { budgetMidpoint, isWithinBudget } from "./budget";
import type { PreparedPlace } from "./place-view";
import type { PlaceCategory, PlaceStatus } from "./types";

export const PLACE_SORTS = [
  "recommendation",
  "distance",
  "public_rating",
  "personal_rating",
  "price",
  "recently_added",
  "recently_visited",
  "longest_since_visit",
  "name",
] as const;
export type PlaceSort = (typeof PLACE_SORTS)[number];

export const SORT_LABELS: Record<PlaceSort, string> = {
  recommendation: "Recommended",
  distance: "Nearest",
  public_rating: "Public rating",
  personal_rating: "My rating",
  price: "Cheapest",
  recently_added: "Recently added",
  recently_visited: "Recently visited",
  longest_since_visit: "Longest since visit",
  name: "A–Z",
};

export interface PlaceFilterQuery {
  search?: string | null;
  city?: string | null;
  areas?: string[];
  cuisines?: string[];
  categories?: PlaceCategory[];
  statuses?: PlaceStatus[];
  maxSpend?: number | null;
  minPublicRating?: number | null;
  minPersonalRating?: number | null;
  visitState?: "any" | "visited" | "unvisited";
  favouritesOnly?: boolean;
  wishlistOnly?: boolean;
  tags?: string[];
  openNow?: boolean;
  maxDistanceKm?: number | null;
  minDistanceKm?: number | null;
  sort?: PlaceSort;
}

/** Filtering is pure so it can be unit tested without a database. */
export function filterPreparedPlaces(
  places: PreparedPlace[],
  query: PlaceFilterQuery,
): PreparedPlace[] {
  const search = query.search?.trim().toLowerCase() ?? "";
  const cuisines = (query.cuisines ?? []).map((c) => c.toLowerCase());
  const tags = (query.tags ?? []).map((t) => t.toLowerCase());

  return places.filter((prepared) => {
    const { place, visits, budget, distanceKm, isOpenNow } = prepared;

    if (place.status === "archived" && !query.statuses?.includes("archived")) return false;

    if (search) {
      const haystack = [
        place.name,
        place.city,
        place.area,
        place.address,
        place.category,
        ...place.cuisines,
        ...place.tags,
        ...prepared.items.map((item) => item.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    if (query.city && (place.city ?? "").toLowerCase() !== query.city.toLowerCase()) {
      if ((place.district ?? "").toLowerCase() !== query.city.toLowerCase()) return false;
    }

    if (query.areas?.length) {
      const area = (place.area ?? "").toLowerCase();
      if (!query.areas.some((candidate) => area === candidate.toLowerCase())) return false;
    }

    if (query.categories?.length && !query.categories.includes(place.category)) return false;

    if (query.statuses?.length && !query.statuses.includes(place.status)) return false;
    if (query.favouritesOnly && place.status !== "favourite") return false;
    if (query.wishlistOnly && place.status !== "wishlist") return false;

    if (cuisines.length) {
      const placeCuisines = place.cuisines.map((c) => c.toLowerCase());
      if (!cuisines.some((cuisine) => placeCuisines.includes(cuisine))) return false;
    }

    if (tags.length) {
      const placeTags = place.tags.map((t) => t.toLowerCase());
      if (!tags.every((tag) => placeTags.includes(tag))) return false;
    }

    if (query.maxSpend != null && !isWithinBudget(budget, query.maxSpend)) return false;

    if (query.minPublicRating != null) {
      if (place.publicRating === null || place.publicRating < query.minPublicRating) return false;
    }

    if (query.minPersonalRating != null) {
      const personal = place.stats.personalRating;
      if (personal === null || personal < query.minPersonalRating) return false;
    }

    if (query.visitState === "visited" && visits.length === 0) return false;
    if (query.visitState === "unvisited" && visits.length > 0) return false;

    if (query.openNow && isOpenNow !== true) return false;

    if (query.maxDistanceKm != null) {
      if (distanceKm === null || distanceKm > query.maxDistanceKm) return false;
    }
    if (query.minDistanceKm != null) {
      if (distanceKm !== null && distanceKm < query.minDistanceKm) return false;
    }

    return true;
  });
}

export function sortPreparedPlaces(
  places: PreparedPlace[],
  sort: PlaceSort = "recommendation",
  scores: Record<string, number> = {},
): PreparedPlace[] {
  const byName = (a: PreparedPlace, b: PreparedPlace) => a.place.name.localeCompare(b.place.name);
  const sorted = [...places];

  switch (sort) {
    case "distance":
      return sorted.sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm || byName(a, b);
      });
    case "public_rating":
      return sorted.sort(
        (a, b) => (b.place.publicRating ?? -1) - (a.place.publicRating ?? -1) || byName(a, b),
      );
    case "personal_rating":
      return sorted.sort(
        (a, b) =>
          (b.place.stats.personalRating ?? -1) - (a.place.stats.personalRating ?? -1) ||
          byName(a, b),
      );
    case "price":
      return sorted.sort((a, b) => {
        const aMid = budgetMidpoint(a.budget) ?? Number.POSITIVE_INFINITY;
        const bMid = budgetMidpoint(b.budget) ?? Number.POSITIVE_INFINITY;
        return aMid - bMid || byName(a, b);
      });
    case "recently_added":
      return sorted.sort((a, b) => b.place.savedAt.localeCompare(a.place.savedAt));
    case "recently_visited":
      return sorted.sort((a, b) =>
        (b.place.stats.lastVisitedAt ?? "").localeCompare(a.place.stats.lastVisitedAt ?? ""),
      );
    case "longest_since_visit":
      return sorted.sort((a, b) => {
        const aDate = a.place.stats.lastVisitedAt;
        const bDate = b.place.stats.lastVisitedAt;
        if (aDate && !bDate) return -1;
        if (!aDate && bDate) return 1;
        if (!aDate && !bDate) return byName(a, b);
        return (aDate as string).localeCompare(bDate as string);
      });
    case "name":
      return sorted.sort(byName);
    case "recommendation":
    default:
      return sorted.sort((a, b) => {
        const aScore = scores[a.id] ?? 0;
        const bScore = scores[b.id] ?? 0;
        if (aScore !== bScore) return bScore - aScore;
        return (b.place.publicRating ?? 0) - (a.place.publicRating ?? 0) || byName(a, b);
      });
  }
}

/** Distinct filter options derived from the user's own library. */
export function deriveFilterOptions(places: PreparedPlace[]) {
  const cities = new Map<string, number>();
  const areas = new Map<string, number>();
  const cuisines = new Map<string, number>();
  const tags = new Map<string, number>();
  const categories = new Map<PlaceCategory, number>();

  for (const { place } of places) {
    if (place.city) cities.set(place.city, (cities.get(place.city) ?? 0) + 1);
    if (place.area) areas.set(place.area, (areas.get(place.area) ?? 0) + 1);
    for (const cuisine of place.cuisines) {
      cuisines.set(cuisine, (cuisines.get(cuisine) ?? 0) + 1);
    }
    for (const tag of place.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    categories.set(place.category, (categories.get(place.category) ?? 0) + 1);
  }

  const toSorted = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value]) => value);

  return {
    cities: toSorted(cities),
    areas: toSorted(areas),
    cuisines: toSorted(cuisines),
    tags: toSorted(tags),
    categories: [...categories.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value),
  };
}
