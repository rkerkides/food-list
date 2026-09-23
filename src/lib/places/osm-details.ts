import type { Place } from "@/lib/domain/types";

export interface OsmAmenity {
  key: string;
  label: string;
  tone: "positive" | "neutral";
}

export interface OsmDetails {
  description: string | null;
  openingHoursRaw: string | null;
  amenities: OsmAmenity[];
  menuUrl: string | null;
  sourceUrl: string | null;
  commonsPageUrl: string | null;
  commonsFileName: string | null;
  operator: string | null;
  brand: string | null;
}

export function readOsmDetails(
  place: Pick<Place, "provider" | "externalMeta">,
): OsmDetails | null {
  if (place.provider !== "osm") return null;
  const meta = place.externalMeta ?? {};
  const tags = isStringRecord(meta.tags) ? meta.tags : {};
  const osmType = stringValue(meta.osmType);
  const osmId = stringValue(meta.osmId);
  const commons = commonsFile(tags.wikimedia_commons) ?? commonsFile(tags.image);

  return {
    description: first(tags["description:en"], tags.description),
    openingHoursRaw: first(stringValue(meta.openingHoursRaw), tags.opening_hours),
    amenities: amenitiesFromTags(tags),
    menuUrl: safeHttpUrl(first(tags.menu, tags["contact:menu"])),
    sourceUrl:
      osmType && osmId && ["node", "way", "relation"].includes(osmType)
        ? `https://www.openstreetmap.org/${osmType}/${encodeURIComponent(osmId)}`
        : null,
    commonsPageUrl: commons
      ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(commons).replaceAll("%2F", "/")}`
      : null,
    commonsFileName: commons,
    operator: first(tags.operator),
    brand: first(tags.brand),
  };
}

export function osmPhotoRef(tags: Record<string, string>): string | null {
  const file = commonsFile(tags.wikimedia_commons) ?? commonsFile(tags.image);
  return file ? `commons:${file}` : null;
}

function amenitiesFromTags(tags: Record<string, string>): OsmAmenity[] {
  const amenities: OsmAmenity[] = [];
  addChoice(amenities, "takeaway", tags.takeaway, {
    yes: "Takeaway",
    only: "Takeaway only",
    no: "No takeaway",
  });
  addChoice(amenities, "delivery", tags.delivery, {
    yes: "Delivery",
    only: "Delivery only",
    no: "No delivery",
  });
  addChoice(amenities, "outdoor", tags.outdoor_seating, {
    yes: "Outdoor seating",
    no: "No outdoor seating",
  });
  addChoice(amenities, "wheelchair", tags.wheelchair, {
    yes: "Wheelchair accessible",
    limited: "Limited wheelchair access",
    no: "Not wheelchair accessible",
  });
  addChoice(amenities, "reservation", tags.reservation, {
    yes: "Reservations",
    required: "Reservation required",
    recommended: "Reservation recommended",
    no: "No reservations",
  });
  addChoice(amenities, "wifi", tags.internet_access, {
    wlan: "Wi-Fi",
    yes: "Internet access",
    no: "No Wi-Fi",
  });
  addChoice(amenities, "drive-through", tags.drive_through, {
    yes: "Drive-through",
    no: "No drive-through",
  });

  const diets: [string, string][] = [
    ["diet:vegetarian", "Vegetarian options"],
    ["diet:vegan", "Vegan options"],
    ["diet:gluten_free", "Gluten-free options"],
    ["diet:halal", "Halal options"],
    ["diet:kosher", "Kosher options"],
  ];
  for (const [key, label] of diets) {
    if (["yes", "only"].includes(tags[key]?.toLowerCase() ?? "")) {
      amenities.push({ key, label: tags[key] === "only" ? `${label} only` : label, tone: "positive" });
    }
  }
  return amenities.slice(0, 12);
}

function addChoice(
  target: OsmAmenity[],
  key: string,
  raw: string | undefined,
  labels: Record<string, string>,
): void {
  const value = raw?.trim().toLowerCase();
  if (!value || !labels[value]) return;
  target.push({
    key,
    label: labels[value],
    tone: value === "no" ? "neutral" : "positive",
  });
}

function commonsFile(value: string | undefined): string | null {
  if (!value?.startsWith("File:")) return null;
  const name = value.slice(5).trim();
  return name.length > 0 ? name : null;
}

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
      typeof value === "object" &&
      Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "string"),
  );
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function first(...values: (string | null | undefined)[]): string | null {
  return values.find((value) => value?.trim())?.trim() ?? null;
}
