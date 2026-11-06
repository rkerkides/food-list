import type { Repositories } from "@/lib/data/repositories";
import { filterPreparedPlaces, sortPreparedPlaces, type PlaceFilterQuery } from "@/lib/domain/filters";
import { matchPercent, scoreCandidate } from "@/lib/domain/scoring";
import type { DecideInput } from "@/lib/domain/schemas";
import type { Recommendation } from "@/lib/domain/types";
import { resolveAreaCoordinates } from "@/lib/domain/geo";
import { loadUserLibrary, type UserLibrary } from "./library";

export interface DecideOutcome {
  recommendations: Recommendation[];
  /** Optional filters that had to be loosened to find anything. */
  relaxed: string[];
  considered: number;
  message: string | null;
  libraryEmpty: boolean;
  areaResolved: boolean;
}

export interface DecideOptions {
  repos?: Repositories;
  now?: Date;
  /** Fixed seed makes "surprise me" deterministic in tests. */
  seed?: number;
  library?: UserLibrary;
}

const DEFAULT_LIMIT = 5;

/**
 * "Where should we eat?" — hard constraints first, then transparent scoring.
 *
 * Hard constraints (never relaxed): maximum spend, maximum distance, category,
 * open-now. Soft preferences are relaxed progressively so the user gets a
 * useful answer instead of an empty screen, and we tell them what was relaxed.
 */
export async function recommend(
  userId: string,
  input: DecideInput,
  options: DecideOptions = {},
): Promise<DecideOutcome> {
  const now = options.now ?? new Date();
  const originArea = input.area ?? input.city ?? null;
  const originCoordinates =
    input.originLatitude != null && input.originLongitude != null
      ? { latitude: input.originLatitude, longitude: input.originLongitude }
      : null;
  const library =
    options.library ??
    (await loadUserLibrary(userId, {
      originArea,
      originCoordinates,
      now,
      repos: options.repos,
    }));

  if (library.places.length === 0) {
    return {
      recommendations: [],
      relaxed: [],
      considered: 0,
      message: "Save a few places first and I will be able to suggest something.",
      libraryEmpty: true,
      areaResolved: false,
    };
  }

  const relaxed: string[] = [];
  const attempts: PlaceFilterQuery[] = [];
  attempts.push(buildFilter(input, originArea));

  if (input.surprise) {
    attempts[0] = relaxForSurprise(attempts[0]);
    relaxed.push("Cuisine and vibe preferences");
  } else {
    attempts.push(...progressiveRelaxations(attempts[0], relaxed));
  }

  let filtered: ReturnType<typeof filterPreparedPlaces> = [];
  for (const attempt of attempts) {
    filtered = filterPreparedPlaces(library.prepared, attempt);
    if (filtered.length > 0) break;
  }

  const limit = input.limit ?? DEFAULT_LIMIT;
  const seed = options.seed ?? Math.floor(Math.random() * 1_000_000);

  const scored = filtered
    .map((prepared) => {
      const result = scoreCandidate({
        prepared,
        query: input,
        preferences: library.preferences,
        now,
        random: input.surprise ? pseudoRandom(seed, prepared.id) : undefined,
      });
      return { prepared, result };
    })
    .sort((a, b) => b.result.score - a.result.score);

  const recommendations: Recommendation[] = scored.slice(0, limit).map(({ prepared, result }) => ({
    place: prepared.place,
    items: [...prepared.items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3),
    matchPercent: matchPercent(result.score),
    reasons: result.reasons,
    breakdown: result.breakdown,
    hardFiltersSatisfied: satisfiedFilters(input),
    distanceKm: prepared.distanceKm,
    isOpenNow: prepared.isOpenNow,
    surprise: Boolean(input.surprise),
  }));

  return {
    recommendations,
    relaxed,
    considered: filtered.length,
    message:
      recommendations.length === 0
        ? "Nothing in your list fits all of those constraints. Try widening the distance or budget."
        : null,
    libraryEmpty: false,
    areaResolved: Boolean(originCoordinates ?? resolveAreaCoordinates(originArea)),
  };
}

export function buildFilter(input: DecideInput, originArea: string | null): PlaceFilterQuery {
  return {
    city: input.city ?? null,
    areas: [],
    cuisines: input.cuisines ?? [],
    categories: input.categories ?? [],
    maxSpend: input.maxSpend ?? null,
    minPublicRating: input.minPublicRating ?? null,
    minPersonalRating: input.minPersonalRating ?? null,
    visitState: input.visitState ?? "any",
    openNow: input.openNow ?? false,
    favouritesOnly: input.favouritesOnly ?? false,
    wishlistOnly: input.wishlistOnly ?? false,
    maxDistanceKm: input.maxDistanceKm ?? null,
    search: input.foodQuery ?? null,
    sort: "recommendation",
    ...(originArea ? {} : {}),
  };
}

function relaxForSurprise(filter: PlaceFilterQuery): PlaceFilterQuery {
  return {
    ...filter,
    cuisines: [],
    search: null,
    minPublicRating: null,
    minPersonalRating: null,
    visitState: "any",
  };
}

/** Each step drops one soft preference, keeping budget/distance/category hard. */
function progressiveRelaxations(
  filter: PlaceFilterQuery,
  relaxed: string[],
): PlaceFilterQuery[] {
  const attempts: PlaceFilterQuery[] = [];

  if (filter.minPersonalRating != null) {
    attempts.push({ ...filter, minPersonalRating: null });
    relaxed.push("Your personal rating filter");
  }
  if (filter.search) {
    attempts.push({ ...filter, search: null, minPersonalRating: null });
    relaxed.push("The dish/cuisine keyword");
  }
  if (filter.cuisines?.length) {
    attempts.push({ ...filter, search: null, cuisines: [], minPersonalRating: null });
    relaxed.push("The cuisine filter");
  }
  if (filter.minPublicRating != null) {
    attempts.push({
      ...filter,
      search: null,
      cuisines: [],
      minPersonalRating: null,
      minPublicRating: null,
    });
    relaxed.push("The minimum public rating");
  }

  return attempts;
}

function satisfiedFilters(input: DecideInput) {
  const keys: Recommendation["hardFiltersSatisfied"] = [];
  if (input.maxDistanceKm != null) keys.push("maxDistanceKm");
  if (input.maxSpend != null) keys.push("maxSpend");
  if (input.categories?.length) keys.push("category");
  if (input.city) keys.push("city");
  if (input.minPublicRating != null) keys.push("minPublicRating");
  if (input.minPersonalRating != null) keys.push("minPersonalRating");
  if (input.visitState && input.visitState !== "any") keys.push("visitState");
  if (input.occasion) keys.push("occasion");
  return keys;
}

/** Stable hash-based sample so surprise results can be reproduced in tests. */
function pseudoRandom(seed: number, id: string): number {
  let hash = seed >>> 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 10000) / 10000;
}

export function rankLibrary(
  library: UserLibrary,
  input: DecideInput,
  options: { now?: Date; seed?: number } = {},
): Recommendation[] {
  const now = options.now ?? new Date();
  const seed = options.seed ?? 1;
  const filtered = filterPreparedPlaces(library.prepared, buildFilter(input, input.area ?? null));
  const scored = filtered.map((prepared) => ({
    prepared,
    result: scoreCandidate({
      prepared,
      query: input,
      preferences: library.preferences,
      now,
      random: input.surprise ? pseudoRandom(seed, prepared.id) : undefined,
    }),
  }));

  return sortPreparedPlaces(
    scored.map((entry) => entry.prepared),
    "recommendation",
    Object.fromEntries(scored.map((entry) => [entry.prepared.id, entry.result.score])),
  )
    .slice(0, input.limit ?? DEFAULT_LIMIT)
    .map((prepared) => {
      const result = scored.find((entry) => entry.prepared.id === prepared.id)?.result;
      return {
        place: prepared.place,
        items: prepared.items,
        matchPercent: matchPercent(result?.score ?? 0),
        reasons: result?.reasons ?? [],
        breakdown: result?.breakdown ?? [],
        hardFiltersSatisfied: satisfiedFilters(input),
        distanceKm: prepared.distanceKm,
        isOpenNow: prepared.isOpenNow,
        surprise: Boolean(input.surprise),
      };
    });
}
