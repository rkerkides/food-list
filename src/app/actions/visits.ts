"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { visitSchema, type VisitInput } from "@/lib/domain/schemas";
import { VisitError, deleteVisit, logVisit, updateVisit } from "@/lib/services/visits";
import { resolveEditablePlace, resolveEditableVisit } from "@/lib/services/sharing";

export type VisitActionResult =
  | { ok: true; visitId: string; items: number }
  | { ok: false; error: string };

export async function logVisitAction(input: VisitInput): Promise<VisitActionResult> {
  const user = await requireUser();
  const parsed = visitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Those details were not valid." };
  }

  const access = await resolveEditablePlace(user.id, parsed.data.placeId);
  if (access.access !== "allowed" || !access.ownerUserId) {
    return { ok: false, error: access.access === "forbidden" ? "This shared place can only be edited by its owner." : "That place could not be found." };
  }

  try {
    const visit = await logVisit(access.ownerUserId, parsed.data);
    revalidatePath("/");
    revalidatePath("/places");
    revalidatePath(`/places/${visit.placeId}`);
    revalidatePath("/decide");
    revalidatePath("/profile");
    return { ok: true, visitId: visit.id, items: visit.items.length };
  } catch (error) {
    if (error instanceof VisitError) return { ok: false, error: error.message };
    console.error("logVisitAction failed", error);
    return { ok: false, error: "Could not save that visit. Please try again." };
  }
}

export async function updateVisitAction(
  visitId: string,
  input: VisitInput,
): Promise<VisitActionResult> {
  const user = await requireUser();
  const parsed = visitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Those details were not valid." };
  }

  const access = await resolveEditableVisit(user.id, visitId);
  if (access.access !== "allowed" || !access.ownerUserId) {
    return { ok: false, error: access.access === "forbidden" ? "This shared visit can only be edited by its owner." : "That visit could not be found." };
  }

  const visit = await updateVisit(access.ownerUserId, visitId, parsed.data);
  if (!visit) return { ok: false, error: "That visit could not be found." };

  revalidatePath("/");
  revalidatePath("/places");
  revalidatePath(`/places/${visit.placeId}`);
  revalidatePath("/profile");
  return { ok: true, visitId: visit.id, items: visit.items.length };
}

export async function deleteVisitAction(
  visitId: string,
  placeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const access = await resolveEditableVisit(user.id, visitId);
  if (access.access === "not_found" || !access.ownerUserId) {
    return { ok: false, error: "That visit could not be found." };
  }
  if (access.ownerUserId !== user.id) {
    return { ok: false, error: "Only the owner can permanently delete a shared visit." };
  }
  await deleteVisit(access.ownerUserId, visitId);
  revalidatePath("/");
  revalidatePath("/places");
  revalidatePath(`/places/${placeId}`);
  revalidatePath("/profile");
  return { ok: true };
}
