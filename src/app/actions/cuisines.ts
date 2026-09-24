"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { addCuisineToCatalog, removeCustomCuisine, renameCustomCuisine } from "@/lib/services/cuisines";

export async function addCuisineAction(name: string) {
  const user = await requireUser();
  const result = await addCuisineToCatalog(user.id, name);
  if (result.ok) revalidatePath("/profile");
  return result;
}

export async function renameCuisineAction(id: string, name: string) {
  const user = await requireUser();
  const result = await renameCustomCuisine(user.id, id, name);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/places");
    revalidatePath("/profile");
  }
  return result;
}

export async function removeCuisineAction(id: string) {
  const user = await requireUser();
  const result = await removeCustomCuisine(user.id, id);
  if (result.ok) revalidatePath("/profile");
  return result;
}
