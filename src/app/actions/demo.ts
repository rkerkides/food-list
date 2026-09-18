"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { resetDemoData } from "@/lib/services/seed";

export async function resetDemoDataAction(): Promise<
  { ok: true; places: number; visits: number } | { ok: false; error: string }
> {
  const user = await requireUser();
  if (!user.isDemo) {
    return { ok: false, error: "Demo data can only be reset for the demo account." };
  }

  try {
    const result = await resetDemoData();
    revalidatePath("/");
    revalidatePath("/places");
    revalidatePath("/decide");
    revalidatePath("/map");
    revalidatePath("/profile");
    return { ok: true, places: result.places, visits: result.visits };
  } catch (error) {
    console.error("resetDemoDataAction failed", error);
    return { ok: false, error: "Could not reset the demo data." };
  }
}
