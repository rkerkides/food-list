import type { SqlClient, SqlValue } from "@/lib/db/sql-client";
import { ensureMigrations, getDb } from "@/lib/db";
import type { PlaceCategory } from "@/lib/domain/types";

const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_USER_AGENT = "Trapezi/0.1 (personal Cyprus food catalog)";

const CITY_CENTRES = [
  { name: "Nicosia", latitude: 35.1856, longitude: 33.3823 },
  { name: "Limassol", latitude: 34.6786, longitude: 33.0413 },
  { name: "Larnaca", latitude: 34.9182, longitude: 33.6232 },
  { name: "Paphos", latitude: 34.7754, longitude: 32.4245 },
  { name: "Paralimni", latitude: 35.0395, longitude: 33.9818 },
  { name: "Ayia Napa", latitude: 34.989, longitude: 34.0018 },
  { name: "Protaras", latitude: 35.0125, longitude: 34.0583 },
  { name: "Polis", latitude: 35.0353, longitude: 32.4264 },
] as const;

const CYPRUS_FOOD_QUERY = `
[out:json][timeout:180];
area["ISO3166-1"="CY"][boundary="administrative"]->.cyprus;
(
  nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|food_court)$"](area.cyprus);
  nwr["name"]["shop"~"^(bakery|confectionery|deli|coffee|pastry)$"](area.cyprus);
);
out center tags;
`;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

export interface OsmCatalogPlace {
  providerPlaceId: string;
  osmType: OverpassElement["type"];
  osmId: string;
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  address: string | null;
  city: string | null;
  area: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  website: string | null;
  phone: string | null;
  openingHoursRaw: string | null;
  searchText: string;
  tags: Record<string, string>;
  importedAt: string;
}

export interface OsmCatalogStatus {
  count: number;
  syncedAt: string | null;
  source: string | null;
}

export async function syncOsmCatalog(
  db: SqlClient = getDb(),
): Promise<OsmCatalogStatus> {
  await ensureMigrations(db);
  const endpoint = process.env.OSM_OVERPASS_URL?.trim() || DEFAULT_OVERPASS_URL;
  const userAgent = process.env.OSM_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
  const timeoutMs = positiveInteger(process.env.OSM_SYNC_TIMEOUT_MS, 210_000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": userAgent,
      },
      body: new URLSearchParams({ data: CYPRUS_FOOD_QUERY }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error("Could not download the Cyprus OpenStreetMap food catalog.", {
      cause: error,
    });
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500).trim();
    throw new Error(
      `OpenStreetMap catalog download returned ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  const payload = (await response.json()) as OverpassResponse;
  const importedAt = new Date().toISOString();
  const places = (payload.elements ?? [])
    .map((element) => normalizeElement(element, importedAt))
    .filter((place): place is OsmCatalogPlace => place !== null);

  if (places.length === 0) {
    throw new Error("OpenStreetMap returned no named Cyprus food venues; the existing catalog was kept.");
  }

  await db.transaction(async (tx) => {
    await tx.run("delete from osm_places");
    for (let index = 0; index < places.length; index += 40) {
      await insertBatch(tx, places.slice(index, index + 40));
    }
    await setMetadata(tx, "synced_at", importedAt);
    await setMetadata(tx, "source", endpoint);
    await setMetadata(tx, "place_count", String(places.length));
  });

  return { count: places.length, syncedAt: importedAt, source: endpoint };
}

export async function getOsmCatalogStatus(
  db: SqlClient = getDb(),
): Promise<OsmCatalogStatus> {
  await ensureMigrations(db);
  const countRow = await db.get<{ count: number }>("select count(*) as count from osm_places");
  const metadata = await db.all<{ key: string; value: string }>(
    "select key, value from osm_catalog_metadata where key in ('synced_at', 'source')",
  );
  const values = Object.fromEntries(metadata.map((entry) => [entry.key, entry.value]));
  return {
    count: Number(countRow?.count ?? 0),
    syncedAt: values.synced_at ?? null,
    source: values.source ?? null,
  };
}

function normalizeElement(
  element: OverpassElement,
  importedAt: string,
): OsmCatalogPlace | null {
  const tags = element.tags ?? {};
  const name = first(tags["name:en"], tags.name);
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!name || latitude == null || longitude == null) return null;

  const locality = first(
    tags["addr:city"],
    tags["addr:town"],
    tags["addr:village"],
    tags["addr:place"],
    tags["is_in:city"],
    tags["addr:municipality"],
  );
  const normalizedLocality = normalizeCity(locality);
  const city = isSupportedCity(normalizedLocality)
    ? normalizedLocality
    : nearestCity(latitude, longitude);
  const area = first(
    tags["addr:suburb"],
    tags["addr:neighbourhood"],
    tags["addr:quarter"],
    tags["is_in:suburb"],
    normalizedLocality !== city ? normalizedLocality : null,
  );
  const district = normalizeCity(first(tags["addr:district"], tags["is_in:district"], city));
  const category = categoryFor(tags);
  const cuisines = splitValues(tags.cuisine).map(titleCase).slice(0, 8);
  const address = addressFor(tags);
  const searchable = [
    name,
    tags.name,
    tags["name:el"],
    tags["name:tr"],
    ...cuisines,
    category,
    address,
    area,
    city,
    district,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return {
    providerPlaceId: `${element.type}/${element.id}`,
    osmType: element.type,
    osmId: String(element.id),
    name,
    category,
    cuisines,
    address,
    city,
    area,
    district,
    latitude,
    longitude,
    website: first(tags.website, tags["contact:website"]),
    phone: first(tags.phone, tags["contact:phone"]),
    openingHoursRaw: first(tags.opening_hours),
    searchText: normalizeCatalogText(searchable),
    tags,
    importedAt,
  };
}

async function insertBatch(db: SqlClient, places: OsmCatalogPlace[]): Promise<void> {
  const columns = [
    "provider_place_id",
    "osm_type",
    "osm_id",
    "name",
    "category",
    "cuisines",
    "address",
    "city",
    "area",
    "district",
    "latitude",
    "longitude",
    "website",
    "phone",
    "opening_hours",
    "search_text",
    "tags",
    "imported_at",
  ];
  const placeholders = places
    .map(() => `(${columns.map(() => "?").join(", ")})`)
    .join(", ");
  const values: SqlValue[] = places.flatMap((place) => [
    place.providerPlaceId,
    place.osmType,
    place.osmId,
    place.name,
    place.category,
    JSON.stringify(place.cuisines),
    place.address,
    place.city,
    place.area,
    place.district,
    place.latitude,
    place.longitude,
    place.website,
    place.phone,
    place.openingHoursRaw,
    place.searchText,
    JSON.stringify(place.tags),
    place.importedAt,
  ]);
  await db.run(
    `insert into osm_places (${columns.join(", ")}) values ${placeholders}`,
    values,
  );
}

async function setMetadata(db: SqlClient, key: string, value: string): Promise<void> {
  await db.run(
    `insert into osm_catalog_metadata (key, value) values (?, ?)
     on conflict(key) do update set value = excluded.value`,
    [key, value],
  );
}

function categoryFor(tags: Record<string, string>): PlaceCategory {
  switch (tags.amenity) {
    case "cafe":
      return "cafe";
    case "bar":
    case "pub":
      return "bar";
    case "ice_cream":
      return "dessert";
    case "fast_food":
      return "takeaway";
    case "food_court":
      return "street_food";
    case "restaurant":
      return "restaurant";
  }
  switch (tags.shop) {
    case "bakery":
    case "pastry":
      return "bakery";
    case "confectionery":
      return "dessert";
    case "coffee":
      return "cafe";
    case "deli":
      return "takeaway";
    default:
      return "other";
  }
}

function addressFor(tags: Record<string, string>): string | null {
  if (tags["addr:full"]) return tags["addr:full"];
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const locality = first(tags["addr:suburb"], tags["addr:city"]);
  const parts = [street, locality, tags["addr:postcode"]].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function normalizeCity(value: string | null): string | null {
  if (!value) return null;
  const aliases: Record<string, string> = {
    lefkosia: "Nicosia",
    lefkosa: "Nicosia",
    λευκωσια: "Nicosia",
    nicosia: "Nicosia",
    lemesos: "Limassol",
    λεμεσος: "Limassol",
    limasol: "Limassol",
    limassol: "Limassol",
    larnaka: "Larnaca",
    λαρνακα: "Larnaca",
    larnaca: "Larnaca",
    pafos: "Paphos",
    παφος: "Paphos",
    baf: "Paphos",
    paphos: "Paphos",
    "ayia napa": "Ayia Napa",
    "agia napa": "Ayia Napa",
    "αγια ναπα": "Ayia Napa",
    paralimni: "Paralimni",
    protaras: "Protaras",
    polis: "Polis",
  };
  return aliases[normalizeCatalogText(value)] ?? value.trim();
}

function isSupportedCity(value: string | null): value is (typeof CITY_CENTRES)[number]["name"] {
  return CITY_CENTRES.some((city) => city.name === value);
}

function nearestCity(latitude: number, longitude: number): (typeof CITY_CENTRES)[number]["name"] {
  let nearest: (typeof CITY_CENTRES)[number] = CITY_CENTRES[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const city of CITY_CENTRES) {
    const lat = latitude - city.latitude;
    const lon = (longitude - city.longitude) * Math.cos((latitude * Math.PI) / 180);
    const distance = lat * lat + lon * lon;
    if (distance < nearestDistance) {
      nearest = city;
      nearestDistance = distance;
    }
  }
  return nearest.name;
}

function splitValues(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function first(...values: (string | null | undefined)[]): string | null {
  return values.find((value) => value?.trim())?.trim() ?? null;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function normalizeCatalogText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
