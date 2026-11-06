import { googleMapsCoordinatesFromUrl } from "@/lib/domain/place-links";
import type { Place } from "@/lib/domain/types";
import type { VenueLinkSubmissionInput } from "@/lib/domain/schemas";
import type { VenueLinkSubmissionStatus } from "@/lib/domain/types";
import type { Repositories } from "@/lib/data/repositories";
import { defaultRepositories } from "./library";

export async function submitVenueLink(userId: string, input: VenueLinkSubmissionInput) {
  const coordinates = googleMapsCoordinatesFromUrl(input.googleMapsUrl);
  const repos = await defaultRepositories();
  return repos.venueLinkSubmissions.create({ userId, googleMapsUrl: input.googleMapsUrl, note: input.note ?? null, latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null });
}

export async function listVenueLinkSubmissions(userId: string, repos?: Repositories) {
  const repo = repos ?? (await defaultRepositories());
  return repo.venueLinkSubmissions.listByUserIds(await repo.circles.accessibleUserIds(userId));
}

export async function reviewVenueLink(submissionId: string, reviewerId: string, status: VenueLinkSubmissionStatus, reviewNote: string | null, repos?: Repositories) {
  const repo = repos ?? (await defaultRepositories());
  const submission = await repo.venueLinkSubmissions.findById(submissionId);
  if (!submission) return { status: "not_found" as const };
  if (submission.userId !== reviewerId && !(await repo.circles.sharesCircle(reviewerId, submission.userId))) {
    return { status: "forbidden" as const };
  }
  await repo.venueLinkSubmissions.update(submissionId, reviewerId, { status, reviewNote });
  return { status: "updated" as const, submission };
}

export interface LinkedVenueReviewCandidate {
  placeId: string;
  name: string;
  ownerName: string;
  googleMapsUrl: string;
  missing: string[];
}

export async function listLinkedVenueReviewCandidates(userId: string, repos?: Repositories): Promise<LinkedVenueReviewCandidate[]> {
  const repo = repos ?? (await defaultRepositories());
  const userIds = await repo.circles.accessibleUserIds(userId);
  const submissions = await repo.venueLinkSubmissions.listByUserIds(userIds);
  const queuedUrls = new Set(submissions.filter((item) => item.status === "pending" || item.status === "in_review").map((item) => item.googleMapsUrl));
  const libraries = await Promise.all(userIds.map(async (ownerId) => ({
    owner: await repo.users.findById(ownerId),
    places: await repo.places.listByUser(ownerId),
  })));
  return libraries.flatMap(({ owner, places }) => places.flatMap((place) => {
    if (!place.googleMapsUrl || queuedUrls.has(place.googleMapsUrl)) return [];
    const missing = missingReviewDetails(place);
    return missing.length ? [{ placeId: place.id, name: place.name, ownerName: owner?.name ?? "Circle member", googleMapsUrl: place.googleMapsUrl, missing }] : [];
  }));
}

export async function enqueueLinkedVenueForReview(actorId: string, placeId: string, repos?: Repositories) {
  const repo = repos ?? (await defaultRepositories());
  const userIds = await repo.circles.accessibleUserIds(actorId);
  for (const ownerId of userIds) {
    const place = await repo.places.findById(ownerId, placeId);
    if (!place) continue;
    if (!place.googleMapsUrl) return { status: "no_link" as const };
    const existing = await repo.venueLinkSubmissions.listByUserIds([ownerId]);
    if (existing.some((item) => item.googleMapsUrl === place.googleMapsUrl && (item.status === "pending" || item.status === "in_review"))) return { status: "already_queued" as const };
    const coordinates = googleMapsCoordinatesFromUrl(place.googleMapsUrl);
    await repo.venueLinkSubmissions.create({ userId: ownerId, googleMapsUrl: place.googleMapsUrl, note: `Review details for ${place.name}`, latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null });
    return { status: "queued" as const };
  }
  return { status: "not_found" as const };
}

function missingReviewDetails(place: Place) {
  return [
    place.address ? null : "address",
    place.cuisines.length ? null : "cuisine",
    place.publicRating != null ? null : "public rating",
    place.expectedSpendMin != null || place.expectedSpendMax != null ? null : "budget",
  ].filter((value): value is string => Boolean(value));
}
