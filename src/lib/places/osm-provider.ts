import { ensureMigrations, getDb, type SqlClient } from "@/lib/db";
import { decodeJson } from "@/lib/db/sql-client";
import { parseWeekSpec } from "@/lib/domain/opening-hours";
import type { OpeningHours, PlaceCategory, PlaceSearchResult } from "@/lib/domain/types";
import { normalizeCatalogText } from "./osm-catalog";
import { osmPhotoRef } from "./osm-details";
import { PlaceProviderError, type PlaceProvider, type PlaceSearchQuery } from "./types";

interface OsmPlaceRow {
  provider_place_id: string;
  osm_type: string;
  osm_id: string;
  name: string;
  category: string;
  cuisines: string;
  address: string | null;
  city: string | null;
  area: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  tags: string;
  imported_at: string;
}

/** Searches a locally imported snapshot of real OpenStreetMap venues. */
export class OsmPlaceProvider implements PlaceProvider {
  readonly id = "osm" as const;
  readonly label = "OpenStreetMap Cyprus";
  readonly mode = "local" as const;
  readonly configured = true;

  constructor(private readonly db?: SqlClient) {}

  async search(query: PlaceSearchQuery): Promise<PlaceSearchResult[]> {
    const db = this.db ?? getDb();
    await ensureMigrations(db);
    await this.assertPopulated(db);

    const tokens = normalizeCatalogText(query.text)
      .split(" ")
      .filter(Boolean)
      .slice(0, 8);
    const conditions = tokens.map(() => "search_text like ?");
    const params: (string | number | null)[] = tokens.map((token) => `%${token}%`);
    if (query.city) {
      conditions.push("lower(city) = lower(?)");
      params.push(query.city);
    }
    const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
    const rows = await db.all<OsmPlaceRow>(
      `select * from osm_places ${where} order by name asc limit 150`,
      params,
    );

    return rows
      .map((row) => ({ result: toResult(row), score: scoreRow(row, tokens, query.city) }))
      .sort((a, b) => b.score - a.score || a.result.name.localeCompare(b.result.name))
      .slice(0, query.limit ?? 8)
      .map((entry) => entry.result);
  }

  async getDetails(providerPlaceId: string): Promise<PlaceSearchResult | null> {
    const db = this.db ?? getDb();
    await ensureMigrations(db);
    const row = await db.get<OsmPlaceRow>(
      "select * from osm_places where provider_place_id = ?",
      [providerPlaceId],
    );
    return row ? toResult(row) : null;
  }

  private async assertPopulated(db: SqlClient): Promise<void> {
    const row = await db.get<{ count: number }>("select count(*) as count from osm_places");
    if (Number(row?.count ?? 0) === 0) {
      throw new PlaceProviderError(
        "unavailable",
        "The local OpenStreetMap catalog is empty. Run `npm run places:sync` once to populate it.",
      );
    }
  }
}

function toResult(row: OsmPlaceRow): PlaceSearchResult {
  const tags = decodeJson<Record<string, string>>(row.tags, {});
  return {
    provider: "osm",
    providerPlaceId: row.provider_place_id,
    name: row.name,
    category: row.category as PlaceCategory,
    cuisines: decodeJson<string[]>(row.cuisines, []),
    address: row.address,
    city: row.city,
    area: row.area,
    district: row.district,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    publicRating: null,
    publicRatingCount: null,
    priceLevel: null,
    website: row.website,
    phone: row.phone,
    openingHours: parseOpeningHours(row.opening_hours),
    photoRef: osmPhotoRef(tags),
    externalMeta: {
      source: "openstreetmap",
      osmType: row.osm_type,
      osmId: row.osm_id,
      importedAt: row.imported_at,
      openingHoursRaw: row.opening_hours,
      tags,
      attribution: "© OpenStreetMap contributors",
    },
  };
}

function parseOpeningHours(value: string | null): OpeningHours | null {
  if (!value) return null;
  if (value.trim() === "24/7") {
    return Array.from({ length: 7 }, () => [{ open: "00:00", close: "24:00" }]);
  }
  const parsed = parseWeekSpec(value.replaceAll(";", " | "));
  return parsed.some((day) => day.length > 0) ? parsed : null;
}

function scoreRow(row: OsmPlaceRow, tokens: string[], city: string | null | undefined): number {
  const name = normalizeCatalogText(row.name);
  const cuisines = normalizeCatalogText(row.cuisines);
  const area = normalizeCatalogText(row.area ?? "");
  const rowCity = normalizeCatalogText(row.city ?? "");
  const category = normalizeCatalogText(row.category);
  let score = city && rowCity === normalizeCatalogText(city) ? 2 : 0;
  for (const token of tokens) {
    if (name.startsWith(token)) score += 8;
    else if (name.includes(token)) score += 6;
    else if (cuisines.includes(token)) score += 4;
    else if (area.includes(token)) score += 3;
    else if (rowCity.includes(token)) score += 2.5;
    else if (category.includes(token)) score += 2;
  }
  return score;
}
