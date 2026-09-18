import { PLACE_CATEGORIES, type PlaceCategory, type PlaceStatus } from "./types";
import type { PlaceSort } from "./filters";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface PlaceListQuery {
  search: string | null;
  city: string | null;
  areas: string[];
  cuisines: string[];
  categories: PlaceCategory[];
  statuses: PlaceStatus[];
  tags: string[];
  maxSpend: number | null;
  minPublicRating: number | null;
  minPersonalRating: number | null;
  visitState: "any" | "visited" | "unvisited";
  favouritesOnly: boolean;
  wishlistOnly: boolean;
  openNow: boolean;
  maxDistanceKm: number | null;
  sort: PlaceSort;
  view: "grid" | "map";
}

const SORTS: PlaceSort[] = [
  "recommendation",
  "distance",
  "public_rating",
  "personal_rating",
  "price",
  "recently_added",
  "recently_visited",
  "longest_since_visit",
  "name",
];

const STATUSES: PlaceStatus[] = ["wishlist", "saved", "favourite", "archived"];

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function list(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function num(value: string | string[] | undefined): number | null {
  const raw = single(value);
  if (raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: string | string[] | undefined): boolean {
  const raw = single(value);
  return raw === "1" || raw === "true";
}

export function parsePlaceListQuery(params: RawSearchParams): PlaceListQuery {
  const categories = list(params.category).filter((value): value is PlaceCategory =>
    (PLACE_CATEGORIES as readonly string[]).includes(value),
  );
  const statuses = list(params.status).filter((value): value is PlaceStatus =>
    STATUSES.includes(value as PlaceStatus),
  );
  const sortRaw = single(params.sort);
  const visitStateRaw = single(params.visitState);

  return {
    search: single(params.q),
    city: single(params.city),
    areas: list(params.area),
    cuisines: list(params.cuisine),
    categories,
    statuses,
    tags: list(params.tag),
    maxSpend: num(params.maxSpend),
    minPublicRating: num(params.minPublic),
    minPersonalRating: num(params.minPersonal),
    visitState:
      visitStateRaw === "visited" || visitStateRaw === "unvisited" ? visitStateRaw : "any",
    favouritesOnly: bool(params.fav),
    wishlistOnly: bool(params.wishlist),
    openNow: bool(params.openNow),
    maxDistanceKm: num(params.maxDistance),
    sort: (SORTS.includes(sortRaw as PlaceSort) ? sortRaw : "recommendation") as PlaceSort,
    view: single(params.view) === "map" ? "map" : "grid",
  };
}

/** Only the parameters that are actually set, so URLs stay short and readable. */
export function toSearchParams(query: Partial<PlaceListQuery>): URLSearchParams {
  const params = new URLSearchParams();
  const setList = (key: string, values: string[] | undefined) => {
    if (values && values.length > 0) params.set(key, values.join(","));
  };

  if (query.search) params.set("q", query.search);
  if (query.city) params.set("city", query.city);
  setList("area", query.areas);
  setList("cuisine", query.cuisines);
  setList("category", query.categories);
  setList("status", query.statuses);
  setList("tag", query.tags);
  if (query.maxSpend != null) params.set("maxSpend", String(query.maxSpend));
  if (query.minPublicRating != null) params.set("minPublic", String(query.minPublicRating));
  if (query.minPersonalRating != null) params.set("minPersonal", String(query.minPersonalRating));
  if (query.visitState && query.visitState !== "any") params.set("visitState", query.visitState);
  if (query.favouritesOnly) params.set("fav", "1");
  if (query.wishlistOnly) params.set("wishlist", "1");
  if (query.openNow) params.set("openNow", "1");
  if (query.maxDistanceKm != null) params.set("maxDistance", String(query.maxDistanceKm));
  if (query.sort && query.sort !== "recommendation") params.set("sort", query.sort);
  if (query.view && query.view !== "grid") params.set("view", query.view);

  return params;
}

export function countActiveFilters(query: PlaceListQuery): number {
  return [
    query.city,
    query.maxSpend,
    query.minPublicRating,
    query.minPersonalRating,
    query.visitState !== "any" ? query.visitState : null,
    query.favouritesOnly,
    query.wishlistOnly,
    query.openNow,
    query.maxDistanceKm,
    ...query.areas,
    ...query.cuisines,
    ...query.categories,
    ...query.tags,
  ].filter(Boolean).length;
}

export interface DecideQueryParams {
  area: string | null;
  maxDistanceKm: number | null;
  cuisines: string[];
  foodQuery: string | null;
  maxSpend: number | null;
  categories: PlaceCategory[];
  occasion: string | null;
  vibe: "any" | "quick" | "casual" | "nicer";
  visitState: "any" | "unvisited" | "visited";
  minPublicRating: number | null;
  minPersonalRating: number | null;
  openNow: boolean;
  favouritesOnly: boolean;
  surprise: boolean;
}

const VIBES = ["any", "quick", "casual", "nicer"] as const;

export function parseDecideParams(params: RawSearchParams): DecideQueryParams {
  const vibeRaw = single(params.vibe);
  const visitStateRaw = single(params.visitState);
  return {
    area: single(params.area),
    maxDistanceKm: num(params.maxDistance),
    cuisines: list(params.cuisine),
    foodQuery: single(params.food),
    maxSpend: num(params.maxSpend),
    categories: list(params.category).filter((value): value is PlaceCategory =>
      (PLACE_CATEGORIES as readonly string[]).includes(value),
    ),
    occasion: single(params.occasion),
    vibe: (VIBES.includes(vibeRaw as (typeof VIBES)[number]) ? vibeRaw : "any") as DecideQueryParams["vibe"],
    visitState:
      visitStateRaw === "visited" || visitStateRaw === "unvisited" ? visitStateRaw : "any",
    minPublicRating: num(params.minPublic),
    minPersonalRating: num(params.minPersonal),
    openNow: bool(params.openNow),
    favouritesOnly: bool(params.fav),
    surprise: bool(params.surprise),
  };
}
