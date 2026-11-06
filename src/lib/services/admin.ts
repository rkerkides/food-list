import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createRepositories, type Repositories } from "@/lib/data/repositories";
import { defaultRepositories } from "./library";

export const adminPasswordResetSchema = z.object({
  targetUserId: z.string().min(1),
  currentPassword: z.string().min(1, "Enter your current password.").max(1024),
  newPassword: z.string().min(8, "Use at least 8 characters for the new password.").max(128, "Use at most 128 characters."),
  confirmPassword: z.string(),
}).refine((input) => input.newPassword === input.confirmPassword, {
  message: "The new passwords do not match.",
  path: ["confirmPassword"],
});

export async function listAdminAccounts(actorId: string, repos?: Repositories) {
  const repo = repos ?? (await defaultRepositories());
  const actor = await repo.users.findById(actorId);
  if (!actor || Number(actor.is_admin) !== 1 || Number(actor.is_demo) === 1) return null;
  const accounts = await repo.users.listPersonalAccounts();
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    isAdmin: Number(account.is_admin) === 1,
    createdAt: account.created_at,
  }));
}

export type AdminResetResult = { status: "updated" | "forbidden" | "invalid_password" | "rate_limited" | "not_found" | "invalid_target" | "invalid_input" };

/** Re-check authority and revoke every target session in the password transaction. */
export async function resetAccountPassword(
  actorId: string,
  input: z.infer<typeof adminPasswordResetSchema>,
  repos?: Repositories,
): Promise<AdminResetResult> {
  const repo = repos ?? (await defaultRepositories());
  const parsed = adminPasswordResetSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid_input" };

  return repo.db.transaction(async (tx) => {
    const transactional = createRepositories(tx);
    const actor = await transactional.users.findByIdForUpdate(actorId);
    if (!actor || Number(actor.is_admin) !== 1 || Number(actor.is_demo) === 1) return { status: "forbidden" };
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    if (await transactional.adminAudit.recentFailedResets(actorId, since) >= 5) return { status: "rate_limited" };
    if (!verifyPassword(parsed.data.currentPassword, actor.password_hash)) {
      await transactional.adminAudit.insert(actorId, null, "password_reset_denied");
      return { status: "invalid_password" };
    }
    const target = await transactional.users.findByIdForUpdate(parsed.data.targetUserId);
    if (!target) return { status: "not_found" };
    if (target.id === actor.id || Number(target.is_demo) === 1) return { status: "invalid_target" };

    await transactional.users.updatePassword(target.id, hashPassword(parsed.data.newPassword));
    await transactional.sessions.deleteByUserId(target.id);
    await transactional.adminAudit.insert(actorId, target.id, "password_reset");
    return { status: "updated" };
  });
}
