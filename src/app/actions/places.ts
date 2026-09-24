"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  addPlaceSchema,
  manualPlaceSchema,
  updatePlaceSchema,
  type AddPlaceInput,
  type ManualPlaceInput,
  type UpdatePlaceInput,
} from "@/lib/domain/schemas";
import type { PlaceStatus } from "@/lib/domain/types";
import {
  addPlaceFromProvider,
  createManualPlace,
  deletePlace,
  refreshPlace,
  setPlaceStatus,
  updatePlace,
} from "@/lib/services/places";
import { validateCuisines } from "@/lib/services/cuisines";

export type AddPlaceResult =
  | { ok: true; placeId: string }
  | {
      ok: false;
      error: string;
      code?: "duplicate" | "validation" | "provider";
      duplicate?: { placeId: string; name: string; reason: string };
    };

export async function addPlaceAction(input: AddPlaceInput): Promise<AddPlaceResult> {
  const user = await requireUser();
  const parsed = addPlaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Those details were not valid.", code: "validation" };
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
    return { ok: false, error: "Those details were not valid.", code: "validation" };
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

  if (parsed.data.cuisines !== undefined) {
    const cuisineCheck = await validateCuisines(user.id, parsed.data.cuisines);
    if (!cuisineCheck.ok) return { ok: false, error: cuisineCheck.error };
    parsed.data.cuisines = cuisineCheck.cuisines;
  }

  const updated = await updatePlace(user.id, placeId, parsed.data);
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
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await setPlaceStatus(user.id, placeId, status);
  revalidatePath("/");
  revalidatePath("/places");
  revalidatePath(`/places/${placeId}`);
  revalidatePath("/profile/data-status");
  return { ok: true };
}

export async function deletePlaceAction(placeId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await deletePlace(user.id, placeId);
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
  const outcome = await refreshPlace(user.id, placeId);
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
