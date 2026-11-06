import type { Repositories } from "@/lib/data/repositories";
import { findDuplicate } from "@/lib/domain/place-merge";
import type { Place, PlaceCategory } from "@/lib/domain/types";
import { newId } from "@/lib/utils/ids";
import { createManualPlace } from "./places";
import { defaultRepositories } from "./library";

export interface VenueReviewDetails {
  name: string;
  category: PlaceCategory | null;
  cuisines: string[];
  address: string | null;
  area: string | null;
  expectedSpendMin: number | null;
  expectedSpendMax: number | null;
}

export interface VenueReviewContradiction {
  id: string;
  field: string;
  current: string;
  suggested: string;
  detectedAt: string;
}

export function reviewContradictions(place: Pick<Place, "externalMeta">): VenueReviewContradiction[] {
  const value = place.externalMeta?.reviewContradictions;
  return Array.isArray(value) ? value.filter(isContradiction) : [];
}

export async function completeVenueReview(
  reviewerId: string,
  submissionId: string,
  details: VenueReviewDetails,
  reviewNote: string | null,
  repos?: Repositories,
): Promise<{ status: "completed"; placeId: string; added: string[]; contradictions: VenueReviewContradiction[] } | { status: "forbidden" | "not_found" | "duplicate" }> {
  const repo = repos ?? (await defaultRepositories());
  const submission = await repo.venueLinkSubmissions.findById(submissionId);
  if (!submission) return { status: "not_found" };
  if (submission.userId !== reviewerId && !(await repo.circles.sharesCircle(reviewerId, submission.userId))) {
    return { status: "forbidden" };
  }

  const places = await repo.places.listByUser(submission.userId);
  const candidate = {
    name: details.name,
    address: details.address,
    latitude: submission.latitude,
    longitude: submission.longitude,
    provider: "manual" as const,
    providerPlaceId: null,
  };
  const existing = places.find((place) => place.googleMapsUrl === submission.googleMapsUrl)
    ?? findDuplicate(candidate, places)?.place;

  if (!existing) {
    const created = await createManualPlace(submission.userId, {
      name: details.name,
      category: details.category ?? "restaurant",
      cuisines: details.cuisines,
      address: details.address,
      area: details.area,
      latitude: submission.latitude,
      longitude: submission.longitude,
      googleMapsUrl: submission.googleMapsUrl,
      expectedSpendMin: details.expectedSpendMin,
      expectedSpendMax: details.expectedSpendMax,
      note: submission.note,
    }, repo);
    if (created.status !== "created") return { status: "duplicate" };
    await repo.venueLinkSubmissions.update(submission.id, reviewerId, { status: "completed", reviewNote });
    return { status: "completed", placeId: created.place.id, added: ["venue"], contradictions: [] };
  }

  const now = new Date().toISOString();
  const merge = mergeIntoExisting(existing, submission.googleMapsUrl, submission.latitude, submission.longitude, submission.note, details, now);
  if (Object.keys(merge.patch).length > 0) {
    await repo.places.update(submission.userId, existing.id, { ...merge.patch, updatedAt: now });
  }
  await repo.venueLinkSubmissions.update(submission.id, reviewerId, { status: "completed", reviewNote });
  return { status: "completed", placeId: existing.id, added: merge.added, contradictions: merge.contradictions };
}

export async function dismissVenueReviewContradiction(
  actorId: string,
  placeId: string,
  contradictionId: string,
  repos?: Repositories,
): Promise<"dismissed" | "forbidden" | "not_found"> {
  const repo = repos ?? (await defaultRepositories());
  const ownerIds = await repo.circles.accessibleUserIds(actorId);
  for (const ownerId of ownerIds) {
    const place = await repo.places.findById(ownerId, placeId);
    if (!place) continue;
    if (ownerId !== actorId && !(await repo.circles.sharesCircle(actorId, ownerId))) return "forbidden";
    const remaining = reviewContradictions(place).filter((item) => item.id !== contradictionId);
    await repo.places.update(ownerId, placeId, {
      externalMeta: { ...(place.externalMeta ?? {}), reviewContradictions: remaining },
      updatedAt: new Date().toISOString(),
    });
    return "dismissed";
  }
  return "not_found";
}

function mergeIntoExisting(
  place: Place,
  googleMapsUrl: string,
  latitude: number | null,
  longitude: number | null,
  note: string | null,
  details: VenueReviewDetails,
  detectedAt: string,
) {
  const patch: Partial<Place> = {};
  const added: string[] = [];
  const contradictions = reviewContradictions(place);
  const overrides = new Set(place.overrides);
  const consider = (field: keyof Place, label: string, suggested: unknown, present: boolean) => {
    if (!present) return;
    const current = place[field];
    if (isEmpty(current)) {
      patch[field] = suggested as never;
      overrides.add(field);
      added.push(label);
    } else if (!equal(current, suggested)) {
      contradictions.push({ id: newId("conflict"), field: String(field), current: display(current), suggested: display(suggested), detectedAt });
    }
  };

  consider("name", "name", details.name, Boolean(details.name));
  consider("category", "venue type", details.category, details.category !== null);
  consider("cuisines", "cuisines", details.cuisines, details.cuisines.length > 0);
  consider("address", "address", details.address, details.address !== null);
  consider("area", "area", details.area, details.area !== null);
  consider("googleMapsUrl", "Google Maps link", googleMapsUrl, true);
  if (latitude !== null && longitude !== null) {
    if (place.latitude === null && place.longitude === null) {
      patch.latitude = latitude;
      patch.longitude = longitude;
      overrides.add("latitude"); overrides.add("longitude");
      added.push("map location");
    } else if (place.latitude !== latitude || place.longitude !== longitude) {
      contradictions.push({ id: newId("conflict"), field: "mapLocation", current: `${place.latitude}, ${place.longitude}`, suggested: `${latitude}, ${longitude}`, detectedAt });
    }
  }
  if (details.expectedSpendMin !== null || details.expectedSpendMax !== null) {
    if (place.expectedSpendMin === null && place.expectedSpendMax === null) {
      patch.expectedSpendMin = details.expectedSpendMin;
      patch.expectedSpendMax = details.expectedSpendMax ?? details.expectedSpendMin;
      patch.budgetSource = "manual";
      patch.budgetUpdatedAt = detectedAt;
      overrides.add("expectedSpendMin"); overrides.add("expectedSpendMax");
      added.push("budget");
    } else if (place.expectedSpendMin !== details.expectedSpendMin || place.expectedSpendMax !== (details.expectedSpendMax ?? details.expectedSpendMin)) {
      contradictions.push({ id: newId("conflict"), field: "budget", current: `${place.expectedSpendMin ?? "?"}–${place.expectedSpendMax ?? "?"}`, suggested: `${details.expectedSpendMin ?? "?"}–${details.expectedSpendMax ?? details.expectedSpendMin ?? "?"}`, detectedAt });
    }
  }
  consider("note", "note", note, note !== null);
  if (contradictions.length !== reviewContradictions(place).length) {
    patch.externalMeta = { ...(place.externalMeta ?? {}), reviewContradictions: contradictions };
  }
  if (added.length > 0) patch.overrides = [...overrides];
  return { patch, added, contradictions: contradictions.slice(reviewContradictions(place).length) };
}

function isEmpty(value: unknown) { return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0); }
function equal(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }
function display(value: unknown) { return Array.isArray(value) ? value.join(", ") : String(value ?? "—"); }
function isContradiction(value: unknown): value is VenueReviewContradiction {
  return Boolean(value && typeof value === "object" && typeof (value as VenueReviewContradiction).id === "string" && typeof (value as VenueReviewContradiction).field === "string");
}
