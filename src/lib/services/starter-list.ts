import type { Repositories } from "@/lib/data/repositories";
import { mergeExternalPlaceData } from "@/lib/domain/place-merge";
import { IMPORTED_HISTORY_TAG, isImportedHistory } from "@/lib/domain/visit-history";
import type { FoodItem, FoodItemCategory, Place, PlaceCategory, Visit } from "@/lib/domain/types";
import { OsmPlaceProvider } from "@/lib/places/osm-provider";
import { newId } from "@/lib/utils/ids";
import { defaultRepositories } from "./library";

export { IMPORTED_HISTORY_TAG } from "@/lib/domain/visit-history";

const IMPORT_NOTE = "Imported from your previous food list.";
const UNKNOWN_VISIT_NOTE = `${IMPORT_NOTE} You had already visited this venue; the date was not recorded.`;

interface StarterPlace {
  name: string;
  category: PlaceCategory;
  visited: boolean;
  dishes?: { name: string; category?: FoodItemCategory }[];
}

/** Facts confirmed from current first-party venue sources; not inferred from names. */
const VERIFIED_VENUE_FACTS: Record<
  string,
  {
    category: PlaceCategory;
    cuisines: string[];
    city: string;
    area?: string;
    address?: string;
    website?: string;
    stockImage?: "barbecue" | "sandwich" | "italian" | "greek";
    sourceUrl: string;
  }
> = {
  "Bar Italia": {
    category: "restaurant",
    cuisines: ["Italian", "Pizza", "Pasta"],
    city: "Nicosia",
    address: "1 Zinonos Sozou, Nicosia 1075",
    website: "https://www.baritalianicosia.com/",
    stockImage: "italian",
    sourceUrl: "https://www.baritalianicosia.com/",
  },
  "Barbeque Project": {
    category: "restaurant",
    cuisines: ["American Barbecue", "Burger"],
    city: "Larnaca",
    address: "Faneromenis 212, Larnaca 6037",
    website: "https://barbequeproject.com/",
    stockImage: "barbecue",
    sourceUrl: "https://barbequeproject.com/about",
  },
  "Buns and Guns": {
    category: "takeaway",
    cuisines: ["Burger", "Sandwich"],
    city: "Larnaca",
    area: "Pyla",
    stockImage: "sandwich",
    sourceUrl: "https://www.foodiesearchcy.com/restaurants/buns-and-guns",
  },
  "Palia Elia": {
    category: "restaurant",
    cuisines: ["Greek", "Cypriot", "Mediterranean"],
    city: "Nicosia",
    area: "Strovolos",
    address: "44 Stadiou, Strovolos, Nicosia 2062",
    website: "https://www.paleaelia.com/",
    stockImage: "greek",
    sourceUrl: "https://www.paleaelia.com/",
  },
};

const visitedRestaurants = [
  "Tocayo", "Il Forno", "Beba", "Palia Elia", "Deliyard", "Wagamama", "Crosta Nostra",
  "Neromilos sti Steni", "Piklas", "Tochni Tavern", "Rococo", "Jasmines", "Picnic",
  "Columbia Steakhouse", "Cam On Asian", "Muses", "Stavris", "Bao Pau", "Lush",
  "GaliniCafe22", "Filomena Pizzeria",
].map((name): StarterPlace => ({ name, category: "restaurant", visited: true }));

const barItalia: StarterPlace = {
  name: "Bar Italia",
  category: "restaurant",
  visited: true,
  dishes: [
    { name: "Gnocchi gorgonzola", category: "main" },
    { name: "Spicy arrabbiata", category: "main" },
    { name: "Tiramisu", category: "dessert" },
  ],
};

const visitedFastFood = [
  "Savvikos", "Pasta Strada", "Hangry Ghost", "Filippos", "Burger Heroes", "Burger Shop",
  "Cam On Asian Cantina", "Guido",
].map((name): StarterPlace => ({ name, category: "takeaway", visited: true }));

const wantToTry = [
  ["Aigaion", "restaurant"], ["Wok and Oven", "restaurant"], ["Barbeque Project", "restaurant"],
  ["Farma", "restaurant"], ["Furen", "restaurant"], ["Sentio", "restaurant"],
  ["Henry's", "brunch"], ["Verde", "restaurant"], ["Salomi", "restaurant"],
  ["ΞΙΤΡΟΥΛΛΟ", "restaurant"], ["Barrio", "restaurant"], ["DOT", "restaurant"],
  ["Mandarino", "restaurant"], ["Pinolo", "restaurant"], ["Pralina", "dessert"],
  ["Botega Amaro", "restaurant"], ["Rous", "restaurant"], ["Lick My Bun", "takeaway"],
  ["Cor", "restaurant"], ["Marbre", "restaurant"], ["Regrub Protaras", "takeaway"],
  ["Masamoro", "restaurant"], ["Cozo Cy", "bar"], ["Ταχυδρομείο", "restaurant"],
  ["To Anamma", "restaurant"], ["Buns and Guns", "takeaway"], ["Vino Cultura", "restaurant"],
  ["Kuzuba", "restaurant"], ["Loukou Gia Lunch", "cafe"], ["To Biscotto", "cafe"],
  ["Syno Flame", "restaurant"],
] as const satisfies readonly (readonly [string, PlaceCategory])[];

const STARTER_PLACES: StarterPlace[] = [
  ...visitedRestaurants,
  barItalia,
  ...visitedFastFood,
  ...wantToTry.map(([name, category]) => ({ name, category, visited: false })),
];

export interface StarterListImportResult {
  createdPlaces: number;
  existingPlaces: number;
  importedVisits: number;
  importedDishes: number;
}

export interface StarterListEnrichmentResult {
  matched: number;
  unmatched: string[];
}

export interface StarterListGeocodeResult {
  geocoded: number;
  unresolved: string[];
}

/**
 * Imports the user's supplied starting list without touching existing notes,
 * ratings or visits. A venue counts as visited only when an actual Visit is
 * present; this importer creates one tagged date-unknown history entry for
 * each venue in the already-visited sections.
 */
export async function importStarterList(
  userId: string,
  repos?: Repositories,
): Promise<StarterListImportResult> {
  const repo = repos ?? (await defaultRepositories());
  const existing = await repo.places.listByUser(userId);
  const byName = new Map(existing.map((place) => [normaliseName(place.name), place]));
  const now = new Date().toISOString();
  let createdPlaces = 0;
  let existingPlaces = 0;
  let importedVisits = 0;
  let importedDishes = 0;

  for (const plan of STARTER_PLACES) {
    let place = byName.get(normaliseName(plan.name));
    if (!place) {
      place = buildStarterPlace(userId, plan, now);
      await repo.places.insert(place);
      byName.set(normaliseName(plan.name), place);
      createdPlaces += 1;
    } else {
      existingPlaces += 1;
    }

    if (!plan.visited) continue;
    const visits = await repo.visits.listByPlace(userId, place.id);
    if (visits.some(isImportedHistory) || visits.length > 0) continue;

    const visit = buildImportedVisit(userId, place.id, now);
    await repo.visits.insert(visit);
    importedVisits += 1;

    const dishes = (plan.dishes ?? []).map((dish) => buildImportedDish(userId, place!.id, visit, dish));
    if (dishes.length > 0) {
      await repo.foodItems.insertMany(dishes);
      importedDishes += dishes.length;
    }
  }

  return { createdPlaces, existingPlaces, importedVisits, importedDishes };
}

/**
 * Replaces only unambiguous imported manual records with local OpenStreetMap
 * facts. It deliberately leaves ambiguous chains (for example, Wagamama) for
 * the owner to resolve rather than placing a pin at a random branch.
 */
export async function enrichStarterListFromOsm(
  userId: string,
  repos?: Repositories,
): Promise<StarterListEnrichmentResult> {
  const repo = repos ?? (await defaultRepositories());
  const provider = new OsmPlaceProvider(repo.db);
  const places = await repo.places.listByUser(userId);
  let matched = 0;
  const unmatched: string[] = [];

  for (const place of places) {
    if (!place.tags.includes("starter list") || place.provider === "osm") continue;
    const result = await findUnambiguousOsmMatch(provider, place.name);
    if (!result) {
      unmatched.push(place.name);
      continue;
    }

    // The starter-list category was inferred from the old headings, not edited
    // by the user. Remove those import-time placeholders before merging facts.
    const overrides = place.overrides.filter((field) => !["category", "cuisines", "address"].includes(field));
    const merge = mergeExternalPlaceData({ ...place, overrides }, result, { mode: "refresh" });
    await repo.places.update(userId, place.id, {
      ...merge.values,
      provider: "osm",
      providerPlaceId: result.providerPlaceId,
      overrides,
      updatedAt: new Date().toISOString(),
    });
    matched += 1;
  }

  return { matched, unmatched };
}

export async function applyVerifiedStarterVenueFacts(userId: string, repos?: Repositories): Promise<number> {
  const repo = repos ?? (await defaultRepositories());
  const places = await repo.places.listByUser(userId);
  let updated = 0;
  for (const place of places) {
    const facts = VERIFIED_VENUE_FACTS[place.name];
    if (!facts) continue;
    await repo.places.update(userId, place.id, {
      category: facts.category,
      cuisines: facts.cuisines,
      city: facts.city,
      area: facts.area ?? place.area,
      address: facts.address ?? place.address,
      website: facts.website ?? place.website,
      photoRef: facts.stockImage ? `stock:${facts.stockImage}` : place.photoRef,
      externalMeta: {
        ...(place.externalMeta ?? {}),
        verifiedVenueFacts: { source: facts.sourceUrl, verifiedAt: new Date().toISOString() },
      },
      updatedAt: new Date().toISOString(),
    });
    updated += 1;
  }
  return updated;
}

/**
 * Geocodes only the remaining imported venues and persists the result, so the
 * public Nominatim service is never contacted during normal app use. Calls are
 * deliberately serialized at a little over one second apart, as required by
 * Nominatim's public-service usage policy.
 */
export async function geocodeRemainingStarterList(
  userId: string,
  repos?: Repositories,
): Promise<StarterListGeocodeResult> {
  const repo = repos ?? (await defaultRepositories());
  const places = await repo.places.listByUser(userId);
  const needsCoordinates = places.filter(
    (place) => place.tags.includes("starter list") && (place.latitude == null || place.longitude == null),
  );
  let geocoded = 0;
  const unresolved: string[] = [];

  for (let index = 0; index < needsCoordinates.length; index += 1) {
    if (index > 0) await pause(1_100);
    const place = needsCoordinates[index];
    const result = await geocodeVenue(place.name);
    if (!result) {
      unresolved.push(place.name);
      continue;
    }
    await repo.places.update(userId, place.id, {
      latitude: result.latitude,
      longitude: result.longitude,
      city: place.city ?? result.city,
      externalMeta: {
        ...(place.externalMeta ?? {}),
        geocoding: { source: "OpenStreetMap Nominatim", label: result.label },
      },
      updatedAt: new Date().toISOString(),
    });
    geocoded += 1;
  }

  return { geocoded, unresolved };
}

function buildStarterPlace(userId: string, plan: StarterPlace, now: string): Place {
  return {
    id: newId("plc"),
    userId,
    name: plan.name,
    category: plan.category,
    cuisines: [],
    address: null,
    city: null,
    area: null,
    district: null,
    latitude: null,
    longitude: null,
    provider: "manual",
    providerPlaceId: `starter-list-${newId("place")}`,
    publicRating: null,
    publicRatingCount: null,
    priceLevel: null,
    googleMapsUrl: null,
    website: null,
    phone: null,
    openingHours: null,
    photoRef: null,
    externalFetchedAt: null,
    externalMeta: { source: "starter-list-import" },
    expectedSpendMin: null,
    expectedSpendMax: null,
    budgetSource: "unknown",
    budgetUpdatedAt: null,
    note: plan.visited ? IMPORT_NOTE : null,
    savedReason: plan.visited ? null : "Imported from your “Try” list.",
    tags: ["starter list"],
    overrides: ["name", "category"],
    status: plan.visited ? "saved" : "wishlist",
    savedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function buildImportedVisit(userId: string, placeId: string, now: string): Visit {
  return {
    id: newId("vis"),
    userId,
    placeId,
    // A stable, deliberately old marker keeps unknown-date history out of recent activity.
    visitedAt: "2000-01-01T12:00:00.000Z",
    occasion: null,
    partySize: null,
    rating: null,
    thoughts: UNKNOWN_VISIT_NOTE,
    spendPerPerson: null,
    wouldReturn: null,
    tags: [IMPORTED_HISTORY_TAG],
    createdAt: now,
  };
}

function buildImportedDish(
  userId: string,
  placeId: string,
  visit: Visit,
  dish: NonNullable<StarterPlace["dishes"]>[number],
): FoodItem {
  return {
    id: newId("itm"),
    userId,
    visitId: visit.id,
    placeId,
    name: dish.name,
    category: dish.category ?? null,
    rating: null,
    comment: "Imported from your previous food list.",
    isHighlight: false,
    price: null,
    createdAt: visit.createdAt,
  };
}

function normaliseName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findUnambiguousOsmMatch(
  provider: OsmPlaceProvider,
  name: string,
) {
  const candidates = await provider.search({ text: osmSearchName(name), limit: 12 });
  const expected = normaliseName(name);
  const exact = candidates.filter((candidate) => normaliseName(candidate.name) === expected);
  return exact.length === 1 ? exact[0] : null;
}

function osmSearchName(name: string): string {
  const aliases: Record<string, string> = {
    "Palia Elia": "Palea Elia",
    "GaliniCafe22": "Galini Cafe 22",
    "Wok and Oven": "Wok Oven",
  };
  return aliases[name] ?? name;
}

async function geocodeVenue(name: string): Promise<{
  latitude: number;
  longitude: number;
  city: string | null;
  label: string;
} | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${name}, Cyprus`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "3");
  url.searchParams.set("countrycodes", "cy");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");

  try {
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "Trapezi personal food-list import (contact: local user)",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
      namedetails?: Record<string, string>;
      address?: { city?: string; town?: string; village?: string; municipality?: string };
    }>;
    const expected = normaliseName(name);
    const match = results.find((candidate) => {
      const names = [candidate.namedetails?.name, candidate.display_name?.split(",")[0]]
        .filter((value): value is string => Boolean(value))
        .map(normaliseName);
      return names.includes(expected);
    });
    const latitude = Number(match?.lat);
    const longitude = Number(match?.lon);
    if (!match || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      city: match.address?.city ?? match.address?.town ?? match.address?.village ?? match.address?.municipality ?? null,
      label: match.display_name ?? name,
    };
  } catch {
    return null;
  }
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
