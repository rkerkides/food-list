"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { addCircleMember, createSharedCircle } from "@/lib/services/circles";

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
