import { computePlaceStats } from "@/lib/services/library";
import type {
  FoodItem,
  OpeningHours,
  Place,
  PlaceStats,
  PlaceWithStats,
  Visit,
} from "@/lib/domain/types";

const DAY = 86_400_000;
const NOW = new Date("2026-09-18T09:00:00.000Z");

export function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

export function emptyWeek(): OpeningHours {
  return [[], [], [], [], [], [], []];
}

export function alwaysOpen(): OpeningHours {
  return emptyWeek().map(() => [{ open: "00:00", close: "23:59" }]);
}

export function makePlace(
  overrides: Partial<PlaceWithStats> = {},
  history: { visits?: Visit[]; items?: FoodItem[] } = {},
): PlaceWithStats {
  const base: Place = {
    id: overrides.id ?? `plc_${Math.random().toString(36).slice(2, 8)}`,
    userId: "usr_test",
    name: "Test Place",
    category: "restaurant",
    cuisines: ["Italian"],
    address: "1 Test Street, Nicosia",
    city: "Nicosia",
    area: "Strovolos",
    district: "Nicosia",
    latitude: 35.1633,
    longitude: 33.3492,
    provider: "demo",
    providerPlaceId: `demo-${Math.random().toString(36).slice(2, 8)}`,
    publicRating: 4.5,
    publicRatingCount: 250,
    priceLevel: 2,
    googleMapsUrl: null,
    website: null,
    phone: null,
    openingHours: alwaysOpen(),
    photoRef: null,
    externalFetchedAt: daysAgo(10),
    externalMeta: null,
    expectedSpendMin: 15,
    expectedSpendMax: 25,
    budgetSource: "provider_price_level",
    budgetUpdatedAt: daysAgo(10),
    note: null,
    savedReason: null,
    tags: [],
    overrides: [],
    status: "saved",
    savedAt: daysAgo(30),
    createdAt: daysAgo(30),
    updatedAt: daysAgo(10),
  };

  const visits = history.visits ?? [];
  const items = history.items ?? [];
  const computedStats = computePlaceStats(base.id, visits, items);
  const { stats: providedStats, ...restOverrides } = overrides;

  return {
    ...base,
    ...restOverrides,
    stats: providedStats ?? computedStats,
  };
}

export function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: `vis_${Math.random().toString(36).slice(2, 8)}`,
    userId: "usr_test",
    placeId: "plc_test",
    visitedAt: daysAgo(20),
    occasion: "casual_dinner",
    partySize: 2,
    rating: 4,
    thoughts: "Good.",
    spendPerPerson: 20,
    wouldReturn: true,
    tags: [],
    createdAt: daysAgo(20),
    ...overrides,
  };
}

export function makeItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: `itm_${Math.random().toString(36).slice(2, 8)}`,
    userId: "usr_test",
    visitId: "vis_test",
    placeId: "plc_test",
    name: "Truffle pasta",
    category: "main",
    rating: 5,
    comment: null,
    isHighlight: true,
    price: 18,
    createdAt: daysAgo(20),
    ...overrides,
  };
}

export const TEST_NOW = NOW;
