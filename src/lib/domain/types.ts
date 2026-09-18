/**
 * Core domain types.
 *
 * These are deliberately independent from both the database representation and
 * from any external place provider so that storage (SQLite/Postgres) and the
 * provider (Google Places / demo seed) can be swapped without touching UI code.
 */

export const PLACE_CATEGORIES = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "brunch",
  "dessert",
  "takeaway",
  "street_food",
  "other",
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const PLACE_STATUSES = ["wishlist", "saved", "favourite", "archived"] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

export const VISIT_OCCASIONS = [
  "quick_lunch",
  "work_lunch",
  "casual_dinner",
  "date_night",
  "group_meal",
  "family_meal",
  "special_occasion",
  "coffee_break",
  "delivery",
] as const;
export type VisitOccasion = (typeof VISIT_OCCASIONS)[number];

export const FOOD_ITEM_CATEGORIES = [
  "starter",
  "main",
  "dessert",
  "drink",
  "coffee",
  "side",
  "snack",
  "breakfast",
  "other",
] as const;
export type FoodItemCategory = (typeof FOOD_ITEM_CATEGORIES)[number];

export type BudgetSource =
  | "manual"
  | "provider_price_range"
  | "provider_price_level"
  | "visit_history"
  | "unknown";

export const CYPRUS_CITIES = [
  "Nicosia",
  "Limassol",
  "Larnaca",
  "Paphos",
  "Famagusta",
  "Paralimni",
  "Ayia Napa",
  "Protaras",
  "Polis",
  "Troodos",
  "Other",
] as const;
export type CyprusCity = (typeof CYPRUS_CITIES)[number];

export type District =
  | "Nicosia"
  | "Limassol"
  | "Larnaca"
  | "Paphos"
  | "Famagusta"
  | "Kyrenia"
  | "Other";

/** Normalised opening hours: index 0 = Sunday … 6 = Saturday (JS `getDay()`). */
export interface DayHours {
  open: string;
  close: string;
}
export type OpeningHours = DayHours[][];

export type PlaceProviderId = "demo" | "google" | "manual";

export interface Place {
  id: string;
  userId: string;
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  address: string | null;
  city: string | null;
  area: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  provider: PlaceProviderId;
  providerPlaceId: string | null;
  /** External facts — never silently overwritten by user edits. */
  publicRating: number | null;
  publicRatingCount: number | null;
  priceLevel: number | null;
  website: string | null;
  phone: string | null;
  openingHours: OpeningHours | null;
  photoRef: string | null;
  /** Bumped on every successful external refresh; powers "stale data" UI. */
  externalFetchedAt: string | null;
  /** Extra provider payload we do not model explicitly (address components etc). */
  externalMeta: Record<string, unknown> | null;

  /** User-owned data. */
  expectedSpendMin: number | null;
  expectedSpendMax: number | null;
  budgetSource: BudgetSource;
  budgetUpdatedAt: string | null;
  note: string | null;
  savedReason: string | null;
  tags: string[];
  /**
   * Field names the user has edited by hand. External refreshes never overwrite
   * these — see `mergeExternalPlaceData`.
   */
  overrides: string[];
  status: PlaceStatus;
  savedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  userId: string;
  placeId: string;
  visitedAt: string;
  occasion: VisitOccasion | null;
  partySize: number | null;
  rating: number | null;
  thoughts: string | null;
  spendPerPerson: number | null;
  wouldReturn: boolean | null;
  tags: string[];
  createdAt: string;
}

export interface FoodItem {
  id: string;
  userId: string;
  visitId: string;
  placeId: string;
  name: string;
  category: FoodItemCategory | null;
  rating: number | null;
  comment: string | null;
  isHighlight: boolean;
  price: number | null;
  createdAt: string;
}

export interface VisitWithItems extends Visit {
  items: FoodItem[];
}

export interface PlaceStats {
  visitCount: number;
  lastVisitedAt: string | null;
  firstVisitedAt: string | null;
  /** Mean of visit ratings (personal), null when never rated. */
  personalRating: number | null;
  /** Median spend observed across visits, null when never recorded. */
  observedSpendMedian: number | null;
  observedSpendMin: number | null;
  observedSpendMax: number | null;
  highlightCount: number;
  foodItemCount: number;
  topFoodItems: FoodItem[];
  wouldReturnRate: number | null;
}

export interface PlaceWithStats extends Place {
  stats: PlaceStats;
}

export interface PlaceSearchResult {
  provider: PlaceProviderId;
  providerPlaceId: string;
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  address: string | null;
  city: string | null;
  area: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  publicRating: number | null;
  publicRatingCount: number | null;
  priceLevel: number | null;
  website: string | null;
  phone: string | null;
  openingHours: OpeningHours | null;
  photoRef: string | null;
  externalMeta: Record<string, unknown> | null;
  /** True when the venue is already saved by the current user. */
  alreadySaved?: boolean;
  savedPlaceId?: string | null;
}

/** Everything the recommendation engine needs, with no DB access. */
export interface RecommendationCandidate {
  place: PlaceWithStats;
  items: FoodItem[];
}

export interface UserPreferences {
  /** Average of personal visit ratings, cuisine -> {avg, count}. */
  cuisineAffinity: Record<string, PreferenceStat>;
  categoryAffinity: Record<string, PreferenceStat>;
  foodItemAffinity: Record<string, PreferenceStat>;
  /** Median spend across all visits where spend was recorded. */
  medianSpend: number | null;
  averagePersonalRating: number | null;
  ratedVisitCount: number;
  visitCount: number;
  favouriteCuisines: string[];
  favouriteFoodItems: string[];
  mostVisitedCategories: string[];
  underratedCategories: string[];
}

export interface PreferenceStat {
  average: number;
  count: number;
  /** 0 → 1 confidence ramp: small samples are down-weighted. */
  confidence: number;
}

export type RecommendationConstraintKey =
  | "maxDistanceKm"
  | "maxSpend"
  | "category"
  | "city"
  | "minPublicRating"
  | "minPersonalRating"
  | "visitState"
  | "occasion";

export interface RecommendationReason {
  label: string;
  /** "positive" reasons push a place up, "neutral" adds context. */
  sentiment: "positive" | "neutral";
}

export interface Recommendation {
  place: PlaceWithStats;
  items: FoodItem[];
  matchPercent: number;
  reasons: RecommendationReason[];
  breakdown: ScoreBreakdownEntry[];
  /** Human readable list of the filters the place satisfied. */
  hardFiltersSatisfied: RecommendationConstraintKey[];
  distanceKm: number | null;
  isOpenNow: boolean | null;
  surprise: boolean;
}

export interface ScoreBreakdownEntry {
  key: string;
  label: string;
  weight: number;
  /** 0..1 */
  value: number;
  weighted: number;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdownEntry[];
  reasons: RecommendationReason[];
}

export interface DecideQuery {
  area?: string | null;
  city?: string | null;
  maxDistanceKm?: number | null;
  cuisines?: string[];
  foodQuery?: string | null;
  maxSpend?: number | null;
  categories?: PlaceCategory[];
  visitState?: "any" | "unvisited" | "visited";
  minPublicRating?: number | null;
  minPersonalRating?: number | null;
  occasion?: VisitOccasion | null;
  vibe?: "quick" | "casual" | "nicer" | "any";
  openNow?: boolean;
  favouritesOnly?: boolean;
  wishlistOnly?: boolean;
  surprise?: boolean;
  limit?: number;
}

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  bar: "Bar",
  bakery: "Bakery",
  brunch: "Brunch",
  dessert: "Dessert",
  takeaway: "Takeaway",
  street_food: "Street food",
  other: "Other",
};

export const CATEGORY_PLURAL_LABELS: Record<PlaceCategory, string> = {
  restaurant: "Restaurants",
  cafe: "Cafes",
  bar: "Bars",
  bakery: "Bakeries",
  brunch: "Brunch spots",
  dessert: "Dessert places",
  takeaway: "Takeaway",
  street_food: "Street food",
  other: "Other",
};

export const STATUS_LABELS: Record<PlaceStatus, string> = {
  wishlist: "Want to try",
  saved: "Saved",
  favourite: "Favourite",
  archived: "Archived",
};

export const OCCASION_LABELS: Record<VisitOccasion, string> = {
  quick_lunch: "Quick lunch",
  work_lunch: "Work lunch",
  casual_dinner: "Casual dinner",
  date_night: "Date night",
  group_meal: "Group meal",
  family_meal: "Family meal",
  special_occasion: "Special occasion",
  coffee_break: "Coffee break",
  delivery: "Delivery",
};

export const FOOD_ITEM_CATEGORY_LABELS: Record<FoodItemCategory, string> = {
  starter: "Starter",
  main: "Main",
  dessert: "Dessert",
  drink: "Drink",
  coffee: "Coffee",
  side: "Side",
  snack: "Snack",
  breakfast: "Breakfast",
  other: "Other",
};
