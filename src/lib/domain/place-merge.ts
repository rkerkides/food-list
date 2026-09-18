import { deriveProviderBudget } from "./budget";
import { distanceKm, hasCoordinates } from "./geo";
import { normalizeName } from "@/lib/utils/ids";
import type { Place, PlaceSearchResult } from "./types";

/**
 * Turning a provider search result into a saved place, safely.
 *
 * Invariants:
 *  - external facts and user-owned data are stored separately;
 *  - refreshing external data never overwrites a field the user has edited;
 *  - the previous provider payload is retained so nothing is silently lost.
 */

export const EXTERNAL_FIELDS = [
  "name",
  "category",
  "cuisines",
  "address",
  "city",
  "area",
  "district",
  "latitude",
  "longitude",
  "publicRating",
  "publicRatingCount",
  "priceLevel",
  "website",
  "phone",
  "openingHours",
  "photoRef",
] as const;

export type ExternalField = (typeof EXTERNAL_FIELDS)[number];

export interface MergeOptions {
  now?: Date;
  /** Refresh keeps status/note/tags/etc. New saves may seed them. */
  mode: "create" | "refresh";
}

export interface MergeResult {
  /** Fields that actually changed. */
  changed: ExternalField[];
  /** Fields the user owns, so they were preserved. */
  preserved: ExternalField[];
  values: Partial<Place>;
}

export function mergeExternalPlaceData(
  existing: Pick<Place, "overrides"> & Partial<Place>,
  incoming: PlaceSearchResult,
  options: MergeOptions,
): MergeResult {
  const overrides = new Set(existing.overrides ?? []);
  const now = options.now ?? new Date();
  const values: Partial<Place> = {};
  const changed: ExternalField[] = [];
  const preserved: ExternalField[] = [];

  const previousMeta = (existing.externalMeta ?? {}) as Record<string, unknown>;
  const providerSnapshot = {
    name: incoming.name,
    category: incoming.category,
    cuisines: incoming.cuisines,
    address: incoming.address,
    city: incoming.city,
    area: incoming.area,
    district: incoming.district,
    latitude: incoming.latitude,
    longitude: incoming.longitude,
    publicRating: incoming.publicRating,
    publicRatingCount: incoming.publicRatingCount,
    priceLevel: incoming.priceLevel,
    website: incoming.website,
    phone: incoming.phone,
    openingHours: incoming.openingHours,
    photoRef: incoming.photoRef,
  };

  for (const field of EXTERNAL_FIELDS) {
    const nextValue = providerSnapshot[field];
    if (nextValue === undefined || nextValue === null) continue;

    if (overrides.has(field)) {
      preserved.push(field);
      continue;
    }

    const currentValue = existing[field as keyof Place];
    if (!valuesEqual(currentValue, nextValue)) {
      values[field] = nextValue as never;
      changed.push(field);
    }
  }

  values.externalFetchedAt = now.toISOString();
  values.externalMeta = {
    ...previousMeta,
    providerSnapshot,
    previousSnapshot: options.mode === "refresh" ? previousMeta.providerSnapshot ?? null : undefined,
  };

  // Price level is an external signal; only convert it into an *estimate* when
  // the user has not already set (or corrected) the budget themselves.
  if (options.mode === "create" || !overrides.has("expectedSpendMin")) {
    const manual = existing.budgetSource === "manual";
    if (!manual) {
      const derived = deriveProviderBudget(incoming.priceLevel, readPriceRange(incoming.externalMeta));
      if (derived.min !== null || derived.max !== null) {
        values.expectedSpendMin = derived.min;
        values.expectedSpendMax = derived.max;
        values.budgetSource = derived.source;
        values.budgetUpdatedAt = now.toISOString();
      }
    }
  }

  return { changed, preserved, values };
}

function readPriceRange(meta: Record<string, unknown> | null): { min: number; max: number } | null {
  const range = meta?.priceRange;
  if (!range || typeof range !== "object") return null;
  const { min, max } = range as { min?: unknown; max?: unknown };
  if (typeof min !== "number" && typeof max !== "number") return null;
  return { min: typeof min === "number" ? min : 0, max: typeof max === "number" ? max : 0 };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "object" || typeof b === "object") {
    try {
      return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    } catch {
      return false;
    }
  }
  return false;
}

export interface DuplicateMatch {
  place: Place;
  reason: "provider_id" | "same_name_address" | "same_name_nearby";
  distanceMetres: number | null;
}

/**
 * Duplicate prevention. Provider IDs are authoritative; otherwise we fall back
 * to normalised name matching scoped by proximity (or same city when there are
 * no coordinates, which happens with partially populated provider results).
 */
export function findDuplicate(
  candidate: {
    name: string;
    city?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    provider: PlaceSearchResult["provider"];
    providerPlaceId?: string | null;
  },
  existing: Place[],
): DuplicateMatch | null {
  const normalisedName = normalizeName(candidate.name);

  for (const place of existing) {
    if (
      candidate.providerPlaceId &&
      place.providerPlaceId &&
      place.provider === candidate.provider &&
      place.providerPlaceId === candidate.providerPlaceId
    ) {
      return { place, reason: "provider_id", distanceMetres: metresBetween(candidate, place) };
    }
  }

  for (const place of existing) {
    if (normalizeName(place.name) !== normalisedName) continue;

    const distance = metresBetween(candidate, place);
    if (distance !== null && distance <= 250) {
      return { place, reason: "same_name_nearby", distanceMetres: distance };
    }
    if (
      distance === null &&
      candidate.city &&
      place.city &&
      candidate.city.toLowerCase() === place.city.toLowerCase()
    ) {
      return { place, reason: "same_name_address", distanceMetres: null };
    }
  }

  return null;
}

function metresBetween(
  a: { latitude?: number | null; longitude?: number | null },
  b: { latitude?: number | null; longitude?: number | null },
): number | null {
  if (!hasCoordinates(a) || !hasCoordinates(b)) return null;
  const km = distanceKm(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude },
  );
  return Math.round(km * 1000);
}
