import { decodeJson, fromSqlBool } from "@/lib/db/sql-client";
import type {
  BudgetSource,
  FoodItem,
  FoodItemCategory,
  OpeningHours,
  Place,
  PlaceCategory,
  PlaceProviderId,
  PlaceStatus,
  Visit,
  VisitOccasion,
} from "@/lib/domain/types";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  is_demo: number;
  is_admin: number;
  shared_content_editable_by_group: number;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  user_agent: string | null;
}

export interface CuisineCatalogRow {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  created_at: string;
  updated_at: string;
}

export interface PlaceRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  cuisines: string;
  address: string | null;
  city: string | null;
  area: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  provider: string;
  provider_place_id: string | null;
  public_rating: number | null;
  public_rating_count: number | null;
  price_level: number | null;
  google_maps_url: string | null;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  photo_ref: string | null;
  external_fetched_at: string | null;
  external_meta: string | null;
  expected_spend_min: number | null;
  expected_spend_max: number | null;
  budget_source: string;
  budget_updated_at: string | null;
  note: string | null;
  saved_reason: string | null;
  tags: string;
  overrides: string;
  status: string;
  saved_at: string;
  created_at: string;
  updated_at: string;
}

export interface VisitRow {
  id: string;
  user_id: string;
  place_id: string;
  visited_at: string;
  occasion: string | null;
  party_size: number | null;
  rating: number | null;
  thoughts: string | null;
  spend_per_person: number | null;
  would_return: number | null;
  tags: string;
  created_at: string;
}

export interface FoodItemRow {
  id: string;
  user_id: string;
  visit_id: string;
  place_id: string;
  name: string;
  category: string | null;
  rating: number | null;
  comment: string | null;
  is_highlight: number;
  price: number | null;
  created_at: string;
}

export interface PlaceRefreshRow {
  id: string;
  user_id: string;
  place_id: string;
  source: string;
  status: string;
  changed_fields: string;
  preserved_fields: string;
  message: string | null;
  created_at: string;
}

/**
 * Single source of truth for the place column order, so the INSERT statement in
 * the repository can never drift from the SELECT column list.
 */
export const PLACE_FIELD_MAP: Record<keyof Place, string> = {
  id: "id",
  userId: "user_id",
  name: "name",
  category: "category",
  cuisines: "cuisines",
  address: "address",
  city: "city",
  area: "area",
  district: "district",
  latitude: "latitude",
  longitude: "longitude",
  provider: "provider",
  providerPlaceId: "provider_place_id",
  publicRating: "public_rating",
  publicRatingCount: "public_rating_count",
  priceLevel: "price_level",
  googleMapsUrl: "google_maps_url",
  website: "website",
  phone: "phone",
  openingHours: "opening_hours",
  photoRef: "photo_ref",
  externalFetchedAt: "external_fetched_at",
  externalMeta: "external_meta",
  expectedSpendMin: "expected_spend_min",
  expectedSpendMax: "expected_spend_max",
  budgetSource: "budget_source",
  budgetUpdatedAt: "budget_updated_at",
  note: "note",
  savedReason: "saved_reason",
  tags: "tags",
  overrides: "overrides",
  status: "status",
  savedAt: "saved_at",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export const PLACE_JSON_FIELDS = new Set<keyof Place>([
  "cuisines",
  "tags",
  "overrides",
  "openingHours",
  "externalMeta",
]);

export const PLACE_COLUMNS = Object.values(PLACE_FIELD_MAP).join(", ");

export const VISIT_COLUMNS = [
  "id",
  "user_id",
  "place_id",
  "visited_at",
  "occasion",
  "party_size",
  "rating",
  "thoughts",
  "spend_per_person",
  "would_return",
  "tags",
  "created_at",
].join(", ");

export const FOOD_ITEM_COLUMNS = [
  "id",
  "user_id",
  "visit_id",
  "place_id",
  "name",
  "category",
  "rating",
  "comment",
  "is_highlight",
  "price",
  "created_at",
].join(", ");

export function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category as PlaceCategory,
    cuisines: decodeJson<string[]>(row.cuisines, []),
    address: row.address,
    city: row.city,
    area: row.area,
    district: row.district,
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    provider: row.provider as PlaceProviderId,
    providerPlaceId: row.provider_place_id,
    publicRating: numberOrNull(row.public_rating),
    publicRatingCount: row.public_rating_count ?? null,
    priceLevel: numberOrNull(row.price_level),
    googleMapsUrl: row.google_maps_url,
    website: row.website,
    phone: row.phone,
    openingHours: decodeJson<OpeningHours | null>(row.opening_hours, null),
    photoRef: row.photo_ref,
    externalFetchedAt: row.external_fetched_at,
    externalMeta: decodeJson<Record<string, unknown> | null>(row.external_meta, null),
    expectedSpendMin: numberOrNull(row.expected_spend_min),
    expectedSpendMax: numberOrNull(row.expected_spend_max),
    budgetSource: (row.budget_source ?? "unknown") as BudgetSource,
    budgetUpdatedAt: row.budget_updated_at,
    note: row.note,
    savedReason: row.saved_reason,
    tags: decodeJson<string[]>(row.tags, []),
    overrides: decodeJson<string[]>(row.overrides, []),
    status: (row.status ?? "saved") as PlaceStatus,
    savedAt: row.saved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    userId: row.user_id,
    placeId: row.place_id,
    visitedAt: row.visited_at,
    occasion: (row.occasion as VisitOccasion | null) ?? null,
    partySize: row.party_size ?? null,
    rating: numberOrNull(row.rating),
    thoughts: row.thoughts,
    spendPerPerson: numberOrNull(row.spend_per_person),
    wouldReturn: fromSqlBool(row.would_return),
    tags: decodeJson<string[]>(row.tags, []),
    createdAt: row.created_at,
  };
}

export function toFoodItem(row: FoodItemRow): FoodItem {
  return {
    id: row.id,
    userId: row.user_id,
    visitId: row.visit_id,
    placeId: row.place_id,
    name: row.name,
    category: (row.category as FoodItemCategory | null) ?? null,
    rating: numberOrNull(row.rating),
    comment: row.comment,
    isHighlight: Number(row.is_highlight) === 1,
    price: numberOrNull(row.price),
    createdAt: row.created_at,
  };
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}
