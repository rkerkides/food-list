import { googleMapsCoordinatesFromUrl } from "@/lib/domain/place-links";
import type { VenueLinkSubmissionInput } from "@/lib/domain/schemas";
import type { VenueLinkSubmissionStatus } from "@/lib/domain/types";
import { defaultRepositories } from "./library";

export async function submitVenueLink(userId: string, input: VenueLinkSubmissionInput) {
  const coordinates = googleMapsCoordinatesFromUrl(input.googleMapsUrl);
  const repos = await defaultRepositories();
  return repos.venueLinkSubmissions.create({ userId, googleMapsUrl: input.googleMapsUrl, note: input.note ?? null, latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null });
}

export async function listVenueLinkSubmissions() {
  return (await defaultRepositories()).venueLinkSubmissions.listAll();
}

export async function reviewVenueLink(submissionId: string, reviewerId: string, status: VenueLinkSubmissionStatus, reviewNote: string | null) {
  return (await defaultRepositories()).venueLinkSubmissions.update(submissionId, reviewerId, { status, reviewNote });
}
