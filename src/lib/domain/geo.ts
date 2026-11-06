import type { Place } from "./types";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Approximate city centres used for "near me"-style distance and sorting. */
export const CITY_CENTROIDS: Record<string, Coordinates> = {
  Nicosia: { latitude: 35.1856, longitude: 33.3823 },
  Strovolos: { latitude: 35.1456, longitude: 33.3431 },
  Engomi: { latitude: 35.1597, longitude: 33.3258 },
  Aglantzia: { latitude: 35.1458, longitude: 33.3956 },
  Latsia: { latitude: 35.1065, longitude: 33.3747 },
  Limassol: { latitude: 34.7071, longitude: 33.0226 },
  Germasogeia: { latitude: 34.7086, longitude: 33.0856 },
  Larnaca: { latitude: 34.9182, longitude: 33.6198 },
  Paphos: { latitude: 34.7754, longitude: 32.4245 },
  "Kato Paphos": { latitude: 34.7572, longitude: 32.4112 },
  Famagusta: { latitude: 35.1205, longitude: 33.9434 },
  Paralimni: { latitude: 35.0395, longitude: 33.9817 },
  "Ayia Napa": { latitude: 34.989, longitude: 34.0006 },
  Protaras: { latitude: 35.0126, longitude: 34.0583 },
  Polis: { latitude: 35.0349, longitude: 32.4255 },
  Troodos: { latitude: 34.9229, longitude: 32.8802 },
  Kyrenia: { latitude: 35.3364, longitude: 33.3178 },
};

/** Areas that are widely used when describing where you are in Cyprus. */
export const AREA_ALIASES: Record<string, string> = {
  nicosia: "Nicosia",
  lefkosia: "Nicosia",
  strovolos: "Strovolos",
  engomi: "Engomi",
  aglantzia: "Aglantzia",
  latsia: "Latsia",
  limassol: "Limassol",
  lemesos: "Limassol",
  germasogeia: "Germasogeia",
  larnaca: "Larnaca",
  larnaka: "Larnaca",
  paphos: "Paphos",
  pafos: "Paphos",
  "kato paphos": "Kato Paphos",
  famagusta: "Famagusta",
  paralimni: "Paralimni",
  "ayia napa": "Ayia Napa",
  "agia napa": "Ayia Napa",
  protaras: "Protaras",
  polis: "Polis",
  troodos: "Troodos",
  kyrenia: "Kyrenia",
};

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function hasCoordinates(
  place: { latitude?: number | null; longitude?: number | null },
): place is { latitude: number; longitude: number } {
  return (
    typeof place.latitude === "number" &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude)
  );
}

export function resolveAreaCoordinates(area: string | null | undefined): Coordinates | null {
  if (!area) return null;
  const direct = CITY_CENTROIDS[area];
  if (direct) return direct;
  const alias = AREA_ALIASES[area.trim().toLowerCase()];
  if (alias && CITY_CENTROIDS[alias]) return CITY_CENTROIDS[alias];
  const loose = Object.entries(CITY_CENTROIDS).find(([key]) =>
    key.toLowerCase().includes(area.trim().toLowerCase()),
  );
  return loose ? loose[1] : null;
}

export function distanceFromArea(
  place: Pick<Place, "latitude" | "longitude" | "area" | "city">,
  area: string | null | undefined,
): number | null {
  const origin = resolveAreaCoordinates(area ?? place.area ?? place.city ?? null);
  if (!origin || !hasCoordinates(place)) return null;
  return distanceKm(origin, { latitude: place.latitude, longitude: place.longitude });
}

/** Distance from an explicit point, falling back to a named Cyprus area. */
export function distanceFromOrigin(
  place: Pick<Place, "latitude" | "longitude" | "area" | "city">,
  options: { origin?: Coordinates | null; originArea?: string | null } = {},
): number | null {
  const origin = options.origin ?? resolveAreaCoordinates(options.originArea ?? place.area ?? place.city ?? null);
  if (!origin || !hasCoordinates(place)) return null;
  return distanceKm(origin, { latitude: place.latitude, longitude: place.longitude });
}

/**
 * The area a place belongs to, biased to the finer-grained "area" when present.
 * Used for grouping, filtering and light personalisation.
 */
export function placeAreaKey(place: Pick<Place, "area" | "city">): string {
  return (place.area || place.city || "Unknown").trim();
}

/**
 * Google's `viewport`/`location` are the only geographic authority we use; this
 * guards against provider payloads with swapped latitude/longitude.
 */
export function isValidCyprusCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude > 34.4 &&
    latitude < 35.8 &&
    longitude > 32.1 &&
    longitude < 34.8
  );
}
