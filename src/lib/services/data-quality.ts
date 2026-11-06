import { resolveBudget } from "@/lib/domain/budget";
import type { PlaceWithStats, Visit } from "@/lib/domain/types";
import { loadUserLibrary } from "./library";

export type DataQualityField =
  | "publicRating"
  | "publicRatingCount"
  | "budget"
  | "cuisines"
  | "category"
  | "photo"
  | "address"
  | "mapLocation";

export interface DataQualityIssue {
  field: DataQualityField;
  label: string;
}

export interface PlaceDataQuality {
  place: PlaceWithStats;
  issues: DataQualityIssue[];
  isComplete: boolean;
}

export interface DataQualityData {
  total: number;
  complete: number;
  needsAttention: number;
  missing: Record<DataQualityField, number>;
  places: PlaceDataQuality[];
}

const ISSUE_LABELS: Record<DataQualityField, string> = {
  publicRating: "Public rating",
  publicRatingCount: "Review count",
  budget: "Budget",
  cuisines: "Cuisine",
  category: "Venue type",
  photo: "Image",
  address: "Address",
  mapLocation: "Map location",
};

const CORE_FIELDS: DataQualityField[] = [
  "publicRating",
  "publicRatingCount",
  "budget",
  "cuisines",
  "category",
  "photo",
];

/**
 * Identifies the data that makes a saved place useful for browsing and deciding.
 * A venue marked as `other` is intentionally surfaced: it is a valid stored
 * category, but not a useful food/venue type for filtering.
 */
export function assessPlaceDataQuality(
  place: PlaceWithStats,
  visits: Pick<Visit, "spendPerPerson" | "visitedAt">[] = [],
): PlaceDataQuality {
  const issues: DataQualityIssue[] = [];
  const budget = resolveBudget(place, visits);
  const missing = (field: DataQualityField) => issues.push({ field, label: ISSUE_LABELS[field] });

  if (place.publicRating == null) missing("publicRating");
  if (place.publicRatingCount == null) missing("publicRatingCount");
  if (budget.min == null && budget.max == null) missing("budget");
  if (place.cuisines.length === 0) missing("cuisines");
  if (place.category === "other") missing("category");
  if (!place.photoRef) missing("photo");
  if (!place.address) missing("address");
  if (place.latitude == null || place.longitude == null) missing("mapLocation");

  return {
    place,
    issues,
    isComplete: !issues.some((issue) => CORE_FIELDS.includes(issue.field)),
  };
}

export async function loadDataQuality(userId: string): Promise<DataQualityData> {
  // The status page audits only the signed-in user's own list. Shared circles
  // remain readable elsewhere, but must not make another person's data look
  // like an outstanding task for this user.
  const library = await loadUserLibrary(userId, { includeShared: false });
  const visitsByPlace = new Map<string, typeof library.visits>();
  for (const visit of library.visits) {
    const visits = visitsByPlace.get(visit.placeId) ?? [];
    visits.push(visit);
    visitsByPlace.set(visit.placeId, visits);
  }

  const places = library.places
    .map((place) => assessPlaceDataQuality(place, visitsByPlace.get(place.id) ?? []))
    .sort(
      (a, b) =>
        Number(b.isComplete) - Number(a.isComplete) ||
        b.issues.length - a.issues.length ||
        a.place.name.localeCompare(b.place.name),
    );

  const missing = Object.fromEntries(
    (Object.keys(ISSUE_LABELS) as DataQualityField[]).map((field) => [field, 0]),
  ) as Record<DataQualityField, number>;
  for (const entry of places) {
    for (const issue of entry.issues) missing[issue.field] += 1;
  }

  const complete = places.filter((place) => place.isComplete).length;
  return {
    total: places.length,
    complete,
    needsAttention: places.length - complete,
    missing,
    places,
  };
}
