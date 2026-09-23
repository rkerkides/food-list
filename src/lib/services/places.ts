import type { Repositories } from "@/lib/data/repositories";
import { deriveProviderBudget } from "@/lib/domain/budget";
import { findDuplicate, mergeExternalPlaceData } from "@/lib/domain/place-merge";
import type { AddPlaceInput, ManualPlaceInput, UpdatePlaceInput } from "@/lib/domain/schemas";
import type { Place, PlaceSearchResult, PlaceStatus } from "@/lib/domain/types";
import { getPlaceDetails, searchPlaces, type ProviderInfo } from "@/lib/places";
import { PlaceProviderError } from "@/lib/places/types";
import { newId } from "@/lib/utils/ids";
import { defaultRepositories } from "./library";

export interface DuplicateInfo {
  place: Place;
  reason: "provider_id" | "same_name_address" | "same_name_nearby";
  distanceMetres: number | null;
}

export type AddPlaceOutcome =
  | { status: "created"; place: Place; provider: ProviderInfo }
  | { status: "already_saved"; duplicate: DuplicateInfo }
  | { status: "duplicate"; duplicate: DuplicateInfo };

/**
 * Saves a provider result, keeping external facts and user data separate and
 * refusing to create accidental duplicates.
 */
export async function addPlaceFromProvider(
  userId: string,
  input: AddPlaceInput,
  repos?: Repositories,
): Promise<AddPlaceOutcome> {
  const repo = repos ?? (await defaultRepositories());
  const existing = await repo.places.listByUser(userId);
  const duplicate = findDuplicate(input.result, existing);

  if (duplicate) {
    const info: DuplicateInfo = {
      place: duplicate.place,
      reason: duplicate.reason,
      distanceMetres: duplicate.distanceMetres,
    };
    if (duplicate.reason === "provider_id") return { status: "already_saved", duplicate: info };
    if (!input.force) return { status: "duplicate", duplicate: info };
  }

  const now = new Date();
  const result = input.result;
  const name = input.name?.trim() || result.name;
  const city = input.city === undefined ? result.city ?? null : input.city;
  const area = input.area === undefined ? result.area ?? null : input.area;
  const address = input.address === undefined ? result.address ?? null : input.address;
  const website = input.website === undefined ? result.website ?? null : input.website;
  const phone = input.phone === undefined ? result.phone ?? null : input.phone;
  const base: Place = {
    id: newId("plc"),
    userId,
    name,
    category: input.category ?? result.category,
    cuisines: input.cuisines?.length ? input.cuisines : result.cuisines,
    address,
    city,
    area,
    district: result.district ?? null,
    latitude: result.latitude ?? null,
    longitude: result.longitude ?? null,
    provider: result.provider,
    providerPlaceId: result.providerPlaceId,
    publicRating: result.publicRating ?? null,
    publicRatingCount: result.publicRatingCount ?? null,
    priceLevel: result.priceLevel ?? null,
    website,
    phone,
    openingHours: result.openingHours ?? null,
    photoRef: result.photoRef ?? null,
    externalFetchedAt: now.toISOString(),
    externalMeta: result.externalMeta ?? null,
    expectedSpendMin: null,
    expectedSpendMax: null,
    budgetSource: "unknown",
    budgetUpdatedAt: null,
    note: input.note ?? null,
    savedReason: input.savedReason ?? null,
    tags: input.tags?.filter(Boolean) ?? [],
    overrides: [],
    status: input.status ?? "saved",
    savedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  if (input.expectedSpendMin != null || input.expectedSpendMax != null) {
    base.expectedSpendMin = input.expectedSpendMin ?? null;
    base.expectedSpendMax = input.expectedSpendMax ?? base.expectedSpendMin;
    base.budgetSource = "manual";
    base.budgetUpdatedAt = now.toISOString();
    base.overrides = ["expectedSpendMin", "expectedSpendMax"];
  } else {
    const derived = deriveProviderBudget(result.priceLevel, readPriceRange(result.externalMeta));
    if (derived.min !== null || derived.max !== null) {
      base.expectedSpendMin = derived.min;
      base.expectedSpendMax = derived.max;
      base.budgetSource = derived.source;
      base.budgetUpdatedAt = now.toISOString();
    }
  }

  if (input.category && input.category !== result.category) base.overrides.push("category");
  if (input.cuisines?.length) base.overrides.push("cuisines");
  if (name !== result.name) base.overrides.push("name");
  if (city !== (result.city ?? null)) base.overrides.push("city");
  if (area !== (result.area ?? null)) base.overrides.push("area");
  if (address !== (result.address ?? null)) base.overrides.push("address");
  if (website !== (result.website ?? null)) base.overrides.push("website");
  if (phone !== (result.phone ?? null)) base.overrides.push("phone");

  const created = await repo.places.insert(base);
  return {
    status: "created",
    place: created,
    provider: {
      id: result.provider,
      label: providerLabel(result.provider),
      mode: result.provider === "demo" ? "demo" : result.provider === "osm" ? "local" : "live",
      configured: true,
    },
  };
}

export async function createManualPlace(
  userId: string,
  input: ManualPlaceInput,
  repos?: Repositories,
): Promise<AddPlaceOutcome> {
  const repo = repos ?? (await defaultRepositories());
  const existing = await repo.places.listByUser(userId);
  const candidate: PlaceSearchResult = {
    provider: "manual",
    providerPlaceId: `manual-${newId("m")}`,
    name: input.name,
    category: input.category,
    cuisines: input.cuisines ?? [],
    address: input.address ?? null,
    city: input.city ?? null,
    area: input.area ?? null,
    district: input.district ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    publicRating: null,
    publicRatingCount: null,
    priceLevel: null,
    website: input.website ?? null,
    phone: input.phone ?? null,
    openingHours: null,
    photoRef: null,
    externalMeta: { source: "manual" },
  };

  const duplicate = findDuplicate(candidate, existing);
  if (duplicate && !input.force) {
    return {
      status: "duplicate",
      duplicate: {
        place: duplicate.place,
        reason: duplicate.reason,
        distanceMetres: duplicate.distanceMetres,
      },
    };
  }

  const now = new Date().toISOString();
  const place: Place = {
    id: newId("plc"),
    userId,
    name: candidate.name,
    category: candidate.category,
    cuisines: candidate.cuisines,
    address: candidate.address,
    city: candidate.city,
    area: candidate.area,
    district: candidate.district,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    provider: "manual",
    providerPlaceId: candidate.providerPlaceId,
    publicRating: null,
    publicRatingCount: null,
    priceLevel: null,
    website: candidate.website,
    phone: candidate.phone,
    openingHours: null,
    photoRef: null,
    externalFetchedAt: null,
    externalMeta: { source: "manual" },
    expectedSpendMin: input.expectedSpendMin ?? null,
    expectedSpendMax: input.expectedSpendMax ?? input.expectedSpendMin ?? null,
    budgetSource: input.expectedSpendMin != null || input.expectedSpendMax != null ? "manual" : "unknown",
    budgetUpdatedAt: now,
    note: input.note ?? null,
    savedReason: input.savedReason ?? null,
    tags: input.tags ?? [],
    overrides: ["name", "category", "cuisines", "address"],
    status: input.status ?? "saved",
    savedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const created = await repo.places.insert(place);
  return {
    status: "created",
    place: created,
    provider: { id: "manual", label: "Manual entry", mode: "demo", configured: true },
  };
}

const OVERRIDABLE_FIELDS = [
  "name",
  "category",
  "cuisines",
  "city",
  "area",
  "address",
  "website",
  "phone",
] as const;

/**
 * Applies user edits. Any field that also comes from the provider is recorded as
 * an override so a later refresh cannot silently revert the user's choice.
 */
export async function updatePlace(
  userId: string,
  placeId: string,
  input: UpdatePlaceInput,
  repos?: Repositories,
): Promise<Place | null> {
  const repo = repos ?? (await defaultRepositories());
  const current = await repo.places.findById(userId, placeId);
  if (!current) return null;

  const patch: Partial<Place> = { ...input, updatedAt: new Date().toISOString() };
  const overrides = new Set(current.overrides);

  for (const field of OVERRIDABLE_FIELDS) {
    if (field in input && input[field as keyof UpdatePlaceInput] !== undefined) {
      overrides.add(field);
    }
  }

  if (input.expectedSpendMin !== undefined || input.expectedSpendMax !== undefined) {
    patch.budgetSource = "manual";
    patch.budgetUpdatedAt = new Date().toISOString();
    overrides.add("expectedSpendMin");
    overrides.add("expectedSpendMax");
    if (input.expectedSpendMax === undefined && input.expectedSpendMin != null) {
      patch.expectedSpendMax = input.expectedSpendMin;
    }
  }

  patch.overrides = [...overrides];
  return repo.places.update(userId, placeId, patch);
}

export interface RefreshOutcome {
  status: "updated" | "unchanged" | "unavailable" | "not_found" | "manual" | "no_provider_id";
  place: Place | null;
  changed: string[];
  preserved: string[];
  message: string;
  provider: ProviderInfo | null;
}

/**
 * Explicit, safe external refresh: writes a refresh log entry and never touches
 * fields the user has overridden.
 */
export async function refreshPlace(
  userId: string,
  placeId: string,
  repos?: Repositories,
): Promise<RefreshOutcome> {
  const repo = repos ?? (await defaultRepositories());
  const place = await repo.places.findById(userId, placeId);
  if (!place) {
    return {
      status: "not_found",
      place: null,
      changed: [],
      preserved: [],
      message: "That place is not in your list.",
      provider: null,
    };
  }

  if (place.provider === "manual" || !place.providerPlaceId) {
    return {
      status: "manual",
      place,
      changed: [],
      preserved: [],
      message: "This was added by hand, so there is nothing to refresh.",
      provider: null,
    };
  }

  try {
    const providerId =
      place.provider === "google" || place.provider === "osm" ? place.provider : "demo";
    const { result, provider } = await getPlaceDetails(providerId, place.providerPlaceId);

    if (!result) {
      await repo.refreshes.insert({
        userId,
        placeId,
        source: place.provider,
        status: "not_found",
        changedFields: [],
        preservedFields: [],
        message: "The provider no longer returns this place.",
      });
      return {
        status: "not_found",
        place,
        changed: [],
        preserved: [],
        message: "This place is no longer listed by the provider. Your data is untouched.",
        provider,
      };
    }

    const merged = mergeExternalPlaceData(place, result, { mode: "refresh" });
    const updated = await repo.places.update(userId, placeId, {
      ...merged.values,
      updatedAt: new Date().toISOString(),
    });

    await repo.refreshes.insert({
      userId,
      placeId,
      source: result.provider,
      status: merged.changed.length > 0 ? "updated" : "unchanged",
      changedFields: merged.changed,
      preservedFields: merged.preserved,
      message: null,
    });

    return {
      status: merged.changed.length > 0 ? "updated" : "unchanged",
      place: updated,
      changed: merged.changed,
      preserved: merged.preserved,
      message:
        merged.changed.length > 0
          ? `Updated ${merged.changed.length} field${merged.changed.length === 1 ? "" : "s"}.`
          : "Everything is already up to date.",
      provider,
    };
  } catch (error) {
    const code = error instanceof PlaceProviderError ? error.code : "unknown";
    const message =
      code === "rate_limited"
        ? "The place provider is rate limiting us. Try again in a few minutes."
        : "Could not reach the place provider. Your saved data is unchanged.";

    await repo.refreshes.insert({
      userId,
      placeId,
      source: place.provider,
      status: "unavailable",
      changedFields: [],
      preservedFields: [],
      message,
    });

    return {
      status: "unavailable",
      place,
      changed: [],
      preserved: [],
      message,
      provider: null,
    };
  }
}

export async function setPlaceStatus(
  userId: string,
  placeId: string,
  status: PlaceStatus,
  repos?: Repositories,
): Promise<Place | null> {
  const repo = repos ?? (await defaultRepositories());
  return repo.places.update(userId, placeId, {
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function deletePlace(
  userId: string,
  placeId: string,
  repos?: Repositories,
): Promise<void> {
  const repo = repos ?? (await defaultRepositories());
  await repo.places.delete(userId, placeId);
}

export interface PlaceSearchResponse {
  results: (PlaceSearchResult & { alreadySaved: boolean; savedPlaceId: string | null })[];
  provider: ProviderInfo;
}

/** Provider search + "already in your list" flags for the Add place dialog. */
export async function searchPlacesForUser(
  userId: string,
  text: string,
  options: { city?: string | null; limit?: number; repos?: Repositories } = {},
): Promise<PlaceSearchResponse> {
  const repo = options.repos ?? (await defaultRepositories());
  const { results, provider } = await searchPlaces({
    text,
    city: options.city ?? null,
    limit: options.limit ?? 8,
  });
  const existing = await repo.places.listByUser(userId);

  return {
    provider,
    results: results.map((result) => {
      const match = existing.find(
        (place) =>
          place.providerPlaceId === result.providerPlaceId && place.provider === result.provider,
      );
      return {
        ...result,
        alreadySaved: Boolean(match),
        savedPlaceId: match?.id ?? null,
      };
    }),
  };
}

function providerLabel(provider: PlaceSearchResult["provider"]): string {
  switch (provider) {
    case "osm":
      return "OpenStreetMap Cyprus";
    case "google":
      return "Google Places";
    case "demo":
      return "Demo Cyprus dataset";
    default:
      return "Manual entry";
  }
}

function readPriceRange(
  meta: Record<string, unknown> | null | undefined,
): { min: number; max: number } | null {
  const range = meta?.priceRange;
  if (!range || typeof range !== "object") return null;
  const { min, max } = range as { min?: unknown; max?: unknown };
  if (typeof min !== "number" && typeof max !== "number") return null;
  return { min: typeof min === "number" ? min : 0, max: typeof max === "number" ? max : 0 };
}
