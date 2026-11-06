"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  addPlaceSchema,
  manualPlaceSchema,
  placeStatusSchema,
  SPEND_RANGE_MESSAGE,
  updatePlaceSchema,
  venueLinkSubmissionSchema,
  type AddPlaceInput,
  type ManualPlaceInput,
  type UpdatePlaceInput,
} from "@/lib/domain/schemas";
import {
  PLACE_CATEGORIES,
  VENUE_LINK_SUBMISSION_STATUSES,
  type PlaceStatus,
  type VenueLinkSubmissionStatus,
} from "@/lib/domain/types";
import {
  addPlaceFromProvider,
  createManualPlace,
  deletePlace,
  refreshPlace,
  setPlaceStatus,
  updatePlace,
} from "@/lib/services/places";
import { validateCuisines } from "@/lib/services/cuisines";
import { resolveEditablePlace } from "@/lib/services/sharing";
import { enqueueLinkedVenueForReview, reviewVenueLink, submitVenueLink } from "@/lib/services/venue-link-submissions";
import { completeVenueReview, dismissVenueReviewContradiction, type VenueReviewDetails } from "@/lib/services/venue-review";

const SHARED_EDITING_DISABLED = "This shared place can only be edited by its owner.";

export async function submitVenueLinkAction(input: { googleMapsUrl: string; note?: string | null }) {
  const user = await requireUser();
  const parsed = venueLinkSubmissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Enter a valid link." };
  await submitVenueLink(user.id, parsed.data);
  revalidatePath("/profile/review-queue");
  return { ok: true as const };
}

export async function enqueueLinkedVenueForReviewAction(placeId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const result = await enqueueLinkedVenueForReview(user.id, placeId);
  if (result.status === "queued") {
    revalidatePath("/profile/review-queue");
    return { ok: true };
  }
  return { ok: false, error: result.status === "already_queued" ? "This venue is already in the review queue." : result.status === "no_link" ? "This venue has no Google Maps link." : "That venue could not be found." };
}

export async function reviewVenueLinkAction(id: string, status: VenueLinkSubmissionStatus, reviewNote: string | null) {
  const user = await requireUser();
  if (!(VENUE_LINK_SUBMISSION_STATUSES as readonly string[]).includes(status)) {
    return { ok: false as const, error: "Choose a valid review status." };
  }
  const result = await reviewVenueLink(id, user.id, status, reviewNote);
  if (result.status === "forbidden") return { ok: false as const, error: "Only you or someone in a shared circle can review this suggestion." };
  if (result.status === "not_found") return { ok: false as const, error: "That suggestion no longer exists." };
  revalidatePath("/profile/review-queue");
  return { ok: true as const };
}

export async function completeVenueLinkReviewAction(
  id: string,
  details: VenueReviewDetails,
  reviewNote: string | null,
): Promise<{ ok: true; placeId: string; added: string[]; contradictions: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const name = details.name.trim();
  if (name.length < 2) return { ok: false, error: "Add the venue name before completing the review." };
  if (details.category !== null && !PLACE_CATEGORIES.includes(details.category)) {
    return { ok: false, error: "Choose a valid venue type." };
  }
  const values = [details.expectedSpendMin, details.expectedSpendMax];
  if (values.some((value) => value !== null && (!Number.isFinite(value) || value < 0 || value > 2000))) {
    return { ok: false, error: "Enter a valid per-person budget." };
  }
  if (details.expectedSpendMin !== null && details.expectedSpendMax !== null && details.expectedSpendMin > details.expectedSpendMax) {
    return { ok: false, error: SPEND_RANGE_MESSAGE };
  }
  const outcome = await completeVenueReview(user.id, id, { ...details, name }, reviewNote);
  if (outcome.status === "forbidden") return { ok: false, error: "Only you or someone in a shared circle can complete this review." };
  if (outcome.status === "not_found") return { ok: false, error: "That suggestion no longer exists." };
  if (outcome.status === "duplicate") return { ok: false, error: "This venue matches another saved place. Open that place and complete the review there." };
  if (outcome.status !== "completed") return { ok: false, error: "Could not complete this review." };
  revalidatePath("/");
  revalidatePath("/places");
  revalidatePath(`/places/${outcome.placeId}`);
  revalidatePath("/profile/review-queue");
  return { ok: true, placeId: outcome.placeId, added: outcome.added, contradictions: outcome.contradictions.length };
}

export async function dismissVenueReviewContradictionAction(
  placeId: string,
  contradictionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const outcome = await dismissVenueReviewContradiction(user.id, placeId, contradictionId);
  if (outcome !== "dismissed") return { ok: false, error: outcome === "forbidden" ? "You cannot dismiss this reference." : "That reference no longer exists." };
  revalidatePath(`/places/${placeId}`);
  return { ok: true };
}

export type AddPlaceResult =
  | { ok: true; placeId: string }
  | {
      ok: false;
      error: string;
      code?: "duplicate" | "validation" | "provider";
      duplicate?: { placeId: string; name: string; reason: string };
    };

/** Add flows keep a generic message, except when the spend-range rule is the only problem. */
function placeValidationError(issues: { message: string }[]) {
  return issues.length === 1 && issues[0].message === SPEND_RANGE_MESSAGE ? SPEND_RANGE_MESSAGE : "Those details were not valid.";
}

export async function addPlaceAction(input: AddPlaceInput): Promise<AddPlaceResult> {
  const user = await requireUser();
  const parsed = addPlaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: placeValidationError(parsed.error.issues), code: "validation" };
  }

  const cuisineCheck = await validateCuisines(
    user.id,
    parsed.data.cuisines ?? parsed.data.result.cuisines,
  );
  if (!cuisineCheck.ok) return { ok: false, error: cuisineCheck.error, code: "validation" };
  parsed.data.cuisines = cuisineCheck.cuisines;

  try {
    const outcome = await addPlaceFromProvider(user.id, parsed.data);
    if (outcome.status === "created") {
      revalidatePath("/");
      revalidatePath("/places");
      return { ok: true, placeId: outcome.place.id };
    }

    return {
      ok: false,
      code: "duplicate",
      error: "That place looks like a duplicate.",
      duplicate: {
        placeId: outcome.duplicate.place.id,
        name: outcome.duplicate.place.name,
        reason:
          outcome.status === "already_saved"
            ? "It is already in your list"
            : outcome.duplicate.reason === "same_name_nearby"
              ? "Same name, very close by"
              : "Same name in the same city",
      },
    };
  } catch (error) {
    console.error("addPlaceAction failed", error);
    return { ok: false, error: "Could not save that place. Please try again.", code: "provider" };
  }
}

export async function createManualPlaceAction(input: ManualPlaceInput): Promise<AddPlaceResult> {
  const user = await requireUser();
  const parsed = manualPlaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: placeValidationError(parsed.error.issues), code: "validation" };
  }

  const cuisineCheck = await validateCuisines(user.id, parsed.data.cuisines ?? []);
  if (!cuisineCheck.ok) return { ok: false, error: cuisineCheck.error, code: "validation" };
  parsed.data.cuisines = cuisineCheck.cuisines;

  const outcome = await createManualPlace(user.id, parsed.data);
  if (outcome.status === "created") {
    revalidatePath("/");
    revalidatePath("/places");
    return { ok: true, placeId: outcome.place.id };
  }

  return {
    ok: false,
    code: "duplicate",
    error: "That place looks like a duplicate.",
    duplicate: {
      placeId: outcome.duplicate.place.id,
      name: outcome.duplicate.place.name,
      reason:
        outcome.duplicate.reason === "same_name_nearby"
          ? "Same name, very close by"
          : "Same name in the same city",
    },
  };
}

export async function updatePlaceAction(
  placeId: string,
  input: UpdatePlaceInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = updatePlaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Those details were not valid." };
  }

  const access = await resolveEditablePlace(user.id, placeId);
  if (access.access === "forbidden") return { ok: false, error: SHARED_EDITING_DISABLED };
  if (access.access === "not_found" || !access.ownerUserId) {
    return { ok: false, error: "That place could not be found." };
  }

  const storedMin = access.place?.expectedSpendMin;
  const newMax = parsed.data.expectedSpendMax;
  if (parsed.data.expectedSpendMin === undefined && typeof newMax === "number" && storedMin != null && storedMin > newMax) {
    return { ok: false, error: SPEND_RANGE_MESSAGE };
  }

  if (parsed.data.cuisines !== undefined) {
    const cuisineCheck = await validateCuisines(access.ownerUserId, parsed.data.cuisines);
    if (!cuisineCheck.ok) return { ok: false, error: cuisineCheck.error };
    parsed.data.cuisines = cuisineCheck.cuisines;
  }

  const updated = await updatePlace(access.ownerUserId, placeId, parsed.data);
  if (!updated) return { ok: false, error: "That place is not in your list." };

  revalidatePath("/");
  revalidatePath("/places");
  revalidatePath(`/places/${placeId}`);
  revalidatePath("/profile/data-status");
  return { ok: true };
}

export async function setPlaceStatusAction(
  placeId: string,
  status: PlaceStatus,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsedStatus = placeStatusSchema.safeParse(status);
  if (!parsedStatus.success) return { ok: false, error: "Choose a valid status." };
  const access = await resolveEditablePlace(user.id, placeId);
  if (access.access !== "allowed" || !access.ownerUserId) {
    return { ok: false, error: access.access === "forbidden" ? SHARED_EDITING_DISABLED : "That place could not be found." };
  }
  await setPlaceStatus(access.ownerUserId, placeId, parsedStatus.data);
  revalidatePath("/");
  revalidatePath("/places");
  revalidatePath(`/places/${placeId}`);
  revalidatePath("/profile/data-status");
  return { ok: true };
}

export async function deletePlaceAction(placeId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const access = await resolveEditablePlace(user.id, placeId);
  if (access.access === "not_found" || !access.ownerUserId) {
    return { ok: false, error: "That place could not be found." };
  }
  if (access.ownerUserId !== user.id) {
    return { ok: false, error: "Only the owner can permanently delete a shared place." };
  }
  await deletePlace(access.ownerUserId, placeId);
  revalidatePath("/");
  revalidatePath("/places");
  return { ok: true };
}

export interface RefreshActionResult {
  ok: boolean;
  status: string;
  message: string;
  changed: string[];
  preserved: string[];
}

export async function refreshPlaceAction(placeId: string): Promise<RefreshActionResult> {
  const user = await requireUser();
  const access = await resolveEditablePlace(user.id, placeId);
  if (access.access !== "allowed" || !access.ownerUserId) {
    return {
      ok: false,
      status: access.access,
      message: access.access === "forbidden" ? SHARED_EDITING_DISABLED : "That place could not be found.",
      changed: [],
      preserved: [],
    };
  }
  const outcome = await refreshPlace(access.ownerUserId, placeId);
  revalidatePath(`/places/${placeId}`);
  revalidatePath("/places");

  return {
    ok: outcome.status === "updated" || outcome.status === "unchanged",
    status: outcome.status,
    message: outcome.message,
    changed: outcome.changed,
    preserved: outcome.preserved,
  };
}
