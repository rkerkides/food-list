"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { adminPasswordResetSchema, resetAccountPassword } from "@/lib/services/admin";

export interface AdminResetState {
  error?: string;
  success?: string;
}

export async function resetAccountPasswordAction(_previous: AdminResetState, form: FormData): Promise<AdminResetState> {
  const user = await requireUser();
  if (!user.isAdmin) return { error: "Only an admin can reset another user's password." };
  const parsed = adminPasswordResetSchema.safeParse({
    targetUserId: form.get("targetUserId"),
    currentPassword: form.get("currentPassword"),
    newPassword: form.get("newPassword"),
    confirmPassword: form.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the password fields." };
  try {
    const result = await resetAccountPassword(user.id, parsed.data);
    if (result.status === "updated") {
      revalidatePath("/profile/admin");
      return { success: "Password updated. This user has been signed out on all devices and can sign in with the new password." };
    }
    const errors = {
      forbidden: "Only an admin can reset another user's password.",
      invalid_password: "Your current password is incorrect.",
      rate_limited: "Too many incorrect password attempts. Try again in 15 minutes.",
      not_found: "That account no longer exists.",
      invalid_target: "Choose another personal account to reset.",
      invalid_input: "Check the password fields.",
    };
    return { error: errors[result.status] };
  } catch {
    return { error: "Could not reset the password. Please try again." };
  }
}
