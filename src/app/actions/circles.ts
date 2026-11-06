"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  addCircleMember,
  createSharedCircle,
  deleteSharedCircle,
  removeCircleMember,
} from "@/lib/services/circles";
import { setSharedContentEditableByGroup } from "@/lib/services/sharing";

export async function setSharedContentEditingAction(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  try {
    await setSharedContentEditableByGroup(user.id, enabled);
    revalidatePath("/");
    revalidatePath("/places");
    revalidatePath("/decide");
    revalidatePath("/map");
    revalidatePath("/profile");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update shared editing." };
  }
}

export async function createSharedCircleAction(
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  try {
    await createSharedCircle(user.id, name);
    revalidatePath("/");
    revalidatePath("/places");
    revalidatePath("/decide");
    revalidatePath("/map");
    revalidatePath("/profile");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create that circle." };
  }
}

export async function addCircleMemberAction(
  circleId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  try {
    const result = await addCircleMember(user.id, circleId, email);
    if (result.status === "user_not_found") {
      return { ok: false, error: "That person needs to create an account first." };
    }
    if (result.status === "forbidden") return { ok: false, error: "Only the circle owner can add members." };
    if (result.status === "not_found") return { ok: false, error: "That circle no longer exists." };
    revalidatePath("/");
    revalidatePath("/places");
    revalidatePath("/decide");
    revalidatePath("/map");
    revalidatePath("/profile");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not add that member." };
  }
}

export async function removeCircleMemberAction(
  circleId: string,
  memberUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const result = await removeCircleMember(user.id, circleId, memberUserId);
  if (result.status === "forbidden") return { ok: false, error: "Only the circle owner can remove members." };
  if (result.status === "owner") return { ok: false, error: "The circle owner cannot be removed." };
  if (result.status === "not_found") return { ok: false, error: "That circle no longer exists." };
  revalidateCirclePaths();
  return { ok: true };
}

export async function deleteSharedCircleAction(
  circleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const result = await deleteSharedCircle(user.id, circleId);
  if (result.status === "forbidden") return { ok: false, error: "Only the circle owner can delete this circle." };
  if (result.status === "not_found") return { ok: false, error: "That circle no longer exists." };
  revalidateCirclePaths();
  return { ok: true };
}

function revalidateCirclePaths() {
  revalidatePath("/");
  revalidatePath("/places");
  revalidatePath("/decide");
  revalidatePath("/map");
  revalidatePath("/profile");
}
