import { parseDayHours } from "@/lib/domain/opening-hours";
import type { OpeningHours, PlaceCategory, PlaceSearchResult } from "@/lib/domain/types";
import { PlaceProviderError, type PlaceProvider, type PlaceSearchQuery } from "./types";

/**
 * Google Places API (New) adapter.
 *
 * Text Search:  POST https://places.googleapis.com/v1/places:searchText
 * Place Details: GET  https://places.googleapis.com/v1/places/{place_id}
 *
 * Results are normalised into `PlaceSearchResult`; nothing Google-specific leaks
 * past this module except the raw payload we keep in `externalMeta` for audit.
 */

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.priceRange",
  "places.primaryType",
  "places.types",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.regularOpeningHours",
  "places.photos",
  "places.addressComponents",
  "places.businessStatus",
].join(",");

const DETAILS_FIELD_MASK = SEARCH_FIELD_MASK.replace(/places\./g, "");

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  priceRange?: {
    startPrice?: { units?: string; currencyCode?: string };
    endPrice?: { units?: string; currencyCode?: string };
  };
  primaryType?: string;
  types?: string[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { periods?: GooglePeriod[]; weekdayDescriptions?: string[] };
  photos?: { name?: string }[];
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
  businessStatus?: string;
}

interface GooglePeriod {
  open?: { day?: number; hour?: number; minute?: number };
  close?: { day?: number; hour?: number; minute?: number };
}

export class GooglePlacesProvider implements PlaceProvider {
  readonly id = "google" as const;
  readonly label = "Google Places";
  readonly mode = "live" as const;
  readonly configured: boolean;

  constructor(private readonly apiKey: string | undefined) {
    this.configured = Boolean(apiKey);
  }

  async search(query: PlaceSearchQuery): Promise<PlaceSearchResult[]> {
    this.assertConfigured();
    const body: Record<string, unknown> = {
      textQuery: query.city ? `${query.text} ${query.city} Cyprus` : `${query.text} Cyprus`,
      languageCode: "en",
      regionCode: query.regionCode ?? "CY",
      maxResultCount: Math.min(query.limit ?? 8, 20),
    };
    if (query.latitude != null && query.longitude != null) {
      body.locationBias = {
        circle: {
          center: { latitude: query.latitude, longitude: query.longitude },
          radius: 30000,
        },
      };
    }

    const payload = await this.request<{ places?: GooglePlace[] }>(SEARCH_URL, {
      method: "POST",
      fieldMask: SEARCH_FIELD_MASK,
      body,
    });

    return (payload.places ?? [])
      .map((place) => this.normalise(place))
      .filter((place): place is PlaceSearchResult => place !== null);
  }

  async getDetails(providerPlaceId: string): Promise<PlaceSearchResult | null> {
    this.assertConfigured();
    const payload = await this.request<GooglePlace>(
      `${DETAILS_URL}/${encodeURIComponent(providerPlaceId)}`,
      { method: "GET", fieldMask: DETAILS_FIELD_MASK },
    );
    return this.normalise(payload);
  }

  private assertConfigured(): void {
    if (!this.apiKey) {
      throw new PlaceProviderError(
        "invalid_request",
        "GOOGLE_PLACES_API_KEY is not set. Configure it or use PLACES_PROVIDER=demo.",
      );
    }
  }

  private async request<T>(
    url: string,
    options: { method: "GET" | "POST"; fieldMask: string; body?: unknown },
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey as string,
          "X-Goog-FieldMask": options.fieldMask,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      throw new PlaceProviderError("unavailable", "Could not reach Google Places.", {
        cause: error,
      });
    }

    if (response.status === 429) {
      throw new PlaceProviderError("rate_limited", "Google Places rate limit reached.");
    }
    if (response.status === 404) {
      throw new PlaceProviderError("not_found", "That place could not be found.");
    }
    if (!response.ok) {
      const detail = await safeText(response);
      throw new PlaceProviderError(
        response.status >= 500 ? "unavailable" : "invalid_request",
        `Google Places returned ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }

    return (await response.json()) as T;
  }

  private normalise(place: GooglePlace): PlaceSearchResult | null {
    if (!place.id || !place.displayName?.text) return null;
    if (place.businessStatus && place.businessStatus === "CLOSED_PERMANENTLY") {
      return null;
    }

    const components = place.addressComponents ?? [];
    const locality =
      findComponent(components, ["locality", "postal_town", "administrative_area_level_2"]) ?? null;
    const district = findComponent(components, ["administrative_area_level_1"]) ?? locality;
    const area = findComponent(components, ["sublocality_level_1", "sublocality", "neighborhood"]);

    const priceRange = readPriceRange(place.priceRange);

    return {
      provider: "google",
      providerPlaceId: place.id,
      name: place.displayName.text,
      category: mapCategory(place.primaryType, place.types ?? []),
      cuisines: inferCuisines(place.primaryType, place.types ?? []),
      address: place.formattedAddress ?? place.shortFormattedAddress ?? null,
      city: normaliseCity(locality),
      area: area ?? null,
      district: district ?? null,
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
      publicRating: place.rating ?? null,
      publicRatingCount: place.userRatingCount ?? null,
      priceLevel: mapPriceLevel(place.priceLevel),
      website: place.websiteUri ?? null,
      phone: place.nationalPhoneNumber ?? null,
      openingHours: mapOpeningHours(place.regularOpeningHours),
      photoRef: place.photos?.[0]?.name ?? null,
      externalMeta: {
        source: "google",
        priceRange,
        types: place.types ?? [],
        businessStatus: place.businessStatus ?? null,
        weekdayDescriptions: place.regularOpeningHours?.weekdayDescriptions ?? null,
      },
    };
  }
}

function findComponent(
  components: { longText?: string; types?: string[] }[],
  types: string[],
): string | null {
  for (const type of types) {
    const match = components.find((component) => component.types?.includes(type));
    if (match?.longText) return match.longText;
  }
  return null;
}

function normaliseCity(locality: string | null): string | null {
  if (!locality) return null;
  const map: Record<string, string> = {
    lefkosia: "Nicosia",
    nicosia: "Nicosia",
    lemesos: "Limassol",
    limassol: "Limassol",
    larnaka: "Larnaca",
    larnaca: "Larnaca",
    pafos: "Paphos",
    paphos: "Paphos",
    "ayia napa": "Ayia Napa",
    paralimni: "Paralimni",
    protaras: "Protaras",
    polis: "Polis",
  };
  return map[locality.trim().toLowerCase()] ?? locality;
}

export const GOOGLE_TYPE_TO_CATEGORY: Record<string, PlaceCategory> = {
  restaurant: "restaurant",
  cafe: "cafe",
  coffee_shop: "cafe",
  bar: "bar",
  night_club: "bar",
  bakery: "bakery",
  dessert_shop: "dessert",
  ice_cream_shop: "dessert",
  meal_takeaway: "takeaway",
  meal_delivery: "takeaway",
  sandwich_shop: "takeaway",
  fast_food_restaurant: "takeaway",
  breakfast_restaurant: "brunch",
  brunch_restaurant: "brunch",
  food_court: "street_food",
};

function mapCategory(primaryType: string | undefined, types: string[]): PlaceCategory {
  for (const type of [primaryType, ...types]) {
    if (!type) continue;
    const mapped = GOOGLE_TYPE_TO_CATEGORY[type];
    if (mapped) return mapped;
  }
  return "restaurant";
}

const TYPE_TO_CUISINE: Record<string, string> = {
  italian_restaurant: "Italian",
  japanese_restaurant: "Japanese",
  sushi_restaurant: "Sushi",
  chinese_restaurant: "Chinese",
  indian_restaurant: "Indian",
  greek_restaurant: "Greek",
  mediterranean_restaurant: "Mediterranean",
  seafood_restaurant: "Seafood",
  steak_house: "Steakhouse",
  pizza_restaurant: "Pizza",
  mexican_restaurant: "Mexican",
  thai_restaurant: "Thai",
  turkish_restaurant: "Turkish",
  lebanese_restaurant: "Lebanese",
  vegetarian_restaurant: "Vegetarian",
  vegan_restaurant: "Vegan",
  bakery: "Bakery",
  cafe: "Coffee",
  bar: "Bar food",
};

function inferCuisines(primaryType: string | undefined, types: string[]): string[] {
  const cuisines = new Set<string>();
  for (const type of [primaryType, ...types]) {
    if (!type) continue;
    const cuisine = TYPE_TO_CUISINE[type];
    if (cuisine) cuisines.add(cuisine);
  }
  return [...cuisines].slice(0, 3);
}

export function mapPriceLevel(level: string | undefined): number | null {
  switch (level) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return null;
  }
}

function readPriceRange(
  range: GooglePlace["priceRange"],
): { min: number; max: number } | null {
  const unitsOf = (price?: { units?: string }) => {
    const value = Number(price?.units ?? NaN);
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  const min = unitsOf(range?.startPrice);
  const max = unitsOf(range?.endPrice);
  if (min === null && max === null) return null;
  return { min: min ?? 0, max: max ?? min ?? 0 };
}

export function mapOpeningHours(
  hours: GooglePlace["regularOpeningHours"],
): OpeningHours | null {
  const periods = hours?.periods ?? [];
  if (periods.length === 0) {
    const descriptions = hours?.weekdayDescriptions ?? [];
    if (descriptions.length === 7) return descriptionsToHours(descriptions);
    return null;
  }

  const week: OpeningHours = [[], [], [], [], [], [], []];
  for (const period of periods) {
    const day = period.open?.day ?? 0;
    if (!period.open || !period.close) continue;
    // Google uses Monday = 1 … Sunday = 0 for both, matching our index.
    week[day].push({
      open: formatMinutes(period.open.hour ?? 0, period.open.minute ?? 0),
      close: formatMinutes(period.close.hour ?? 0, period.close.minute ?? 0),
    });
  }
  return week;
}

function descriptionsToHours(descriptions: string[]): OpeningHours {
  // weekdayDescriptions start on Monday.
  const week: OpeningHours = [[], [], [], [], [], [], []];
  descriptions.forEach((description, index) => {
    const googleDay = index + 1; // Monday = 1 … Sunday = 7
    const normalisedDay = googleDay === 7 ? 0 : googleDay;
    const match = /(\d{1,2}:\d{2})\s*(?:AM|PM)?\s*[–-]\s*(\d{1,2}:\d{2})\s*(AM|PM)?/i.exec(
      description,
    );
    if (!match) return;
    week[normalisedDay] = parseDayHours(`${to24h(match[1], match[3])}-${to24h(match[2], match[3])}`);
  });
  return week;
}

function to24h(time: string, meridiem?: string): string {
  const [hourPart, minute] = time.split(":");
  let hour = Number(hourPart);
  if (meridiem) {
    const upper = meridiem.toUpperCase();
    if (upper === "PM" && hour < 12) hour += 12;
    if (upper === "AM" && hour === 12) hour = 0;
  }
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function formatMinutes(hour: number, minute: number): string {
  return `${String(hour % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 200);
  } catch {
    return "";
  }
}
