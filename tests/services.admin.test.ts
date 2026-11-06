import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { listAdminAccounts, resetAccountPassword } from "@/lib/services/admin";
import { createSecondUser, createTestContext, type TestContext } from "./helpers";

const databases: TestContext["db"][] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(databases.splice(0).map((db) => db.close()));
});

async function setup() {
  const ctx = await createTestContext();
  databases.push(ctx.db);
  const targetId = await createSecondUser(ctx.repos);
  await ctx.db.run("update users set is_admin = 1, password_hash = ? where id = ?", [hashPassword("admin-password"), ctx.userId]);
  await ctx.repos.users.updatePassword(targetId, hashPassword("old-password"));
  const input = { targetUserId: targetId, currentPassword: "admin-password", newPassword: "new-password", confirmPassword: "new-password" };
  return { ...ctx, targetId, input };
}

describe("account administration", () => {
  it("defaults new accounts to members and never returns hashes in the admin listing", async () => {
    const ctx = await setup();
    await ctx.repos.users.create({ email: "demo@example.com", name: "Demo", passwordHash: null, isDemo: true });
    expect((await ctx.repos.users.findById(ctx.targetId))?.is_admin).toBe(0);
    const accounts = await listAdminAccounts(ctx.userId, ctx.repos);
    expect(accounts).toHaveLength(2);
    expect(accounts?.find((account) => account.id === ctx.userId)?.isAdmin).toBe(true);
    expect(JSON.stringify(accounts)).not.toContain("password");
    expect(await listAdminAccounts(ctx.targetId, ctx.repos)).toBeNull();
  });

  it("rejects non-admins, missing actors and demo actors even if their admin flag is set", async () => {
    const ctx = await setup();
    const original = await ctx.repos.users.findById(ctx.targetId);
    expect((await resetAccountPassword(ctx.targetId, ctx.input, ctx.repos)).status).toBe("forbidden");
    expect((await resetAccountPassword("missing", ctx.input, ctx.repos)).status).toBe("forbidden");
    await ctx.db.run("update users set is_demo = 1 where id = ?", [ctx.userId]);
    expect((await resetAccountPassword(ctx.userId, ctx.input, ctx.repos)).status).toBe("forbidden");
    expect(await listAdminAccounts(ctx.userId, ctx.repos)).toBeNull();
    expect(await ctx.repos.users.findById(ctx.targetId)).toEqual(original);
  });

  it("rechecks a revoked admin role before changing any password", async () => {
    const ctx = await setup();
    expect(await listAdminAccounts(ctx.userId, ctx.repos)).not.toBeNull();
    await ctx.db.run("update users set is_admin = 0 where id = ?", [ctx.userId]);
    expect((await resetAccountPassword(ctx.userId, ctx.input, ctx.repos)).status).toBe("forbidden");
  });

  it("requires the admin's current password and throttles repeated incorrect attempts", async () => {
    const ctx = await setup();
    const bad = { ...ctx.input, currentPassword: "wrong-password" };
    for (let i = 0; i < 5; i++) expect((await resetAccountPassword(ctx.userId, bad, ctx.repos)).status).toBe("invalid_password");
    expect((await resetAccountPassword(ctx.userId, ctx.input, ctx.repos)).status).toBe("rate_limited");
    expect(verifyPassword("old-password", (await ctx.repos.users.findById(ctx.targetId))?.password_hash)).toBe(true);
    const audit = await ctx.db.all("select * from admin_audit_log");
    expect(audit).toHaveLength(5);
    expect(JSON.stringify(audit)).not.toContain("wrong-password");
    expect(JSON.stringify(audit)).not.toContain("admin-password");
  });

  it.each([
    { newPassword: "short", confirmPassword: "short" },
    { newPassword: "new-password", confirmPassword: "different-password" },
    { newPassword: "a".repeat(129), confirmPassword: "a".repeat(129) },
  ])("rejects invalid reset input: %j", async (invalid) => {
    const ctx = await setup();
    expect((await resetAccountPassword(ctx.userId, { ...ctx.input, ...invalid }, ctx.repos)).status).toBe("invalid_input");
    expect(verifyPassword("old-password", (await ctx.repos.users.findById(ctx.targetId))?.password_hash)).toBe(true);
  });

  it("rejects self-resets, demo targets and nonexistent targets", async () => {
    const ctx = await setup();
    expect((await resetAccountPassword(ctx.userId, { ...ctx.input, targetUserId: ctx.userId }, ctx.repos)).status).toBe("invalid_target");
    const demo = await ctx.repos.users.create({ email: "demo@example.com", name: "Demo", passwordHash: null, isDemo: true });
    expect((await resetAccountPassword(ctx.userId, { ...ctx.input, targetUserId: demo.id }, ctx.repos)).status).toBe("invalid_target");
    expect((await resetAccountPassword(ctx.userId, { ...ctx.input, targetUserId: "missing" }, ctx.repos)).status).toBe("not_found");
  });

  it("hashes the new password, invalidates all target sessions and preserves other accounts and personal data", async () => {
    const ctx = await setup();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    await ctx.repos.sessions.create({ userId: ctx.targetId, tokenHash: "target-session-1", expiresAt });
    await ctx.repos.sessions.create({ userId: ctx.targetId, tokenHash: "target-session-2", expiresAt });
    await ctx.repos.sessions.create({ userId: ctx.userId, tokenHash: "admin-session", expiresAt });
    const before = await ctx.repos.users.findById(ctx.targetId);
    const admin = await ctx.repos.users.findById(ctx.userId);
    expect((await resetAccountPassword(ctx.userId, ctx.input, ctx.repos)).status).toBe("updated");
    const after = await ctx.repos.users.findById(ctx.targetId);
    expect(verifyPassword("new-password", after?.password_hash)).toBe(true);
    expect(verifyPassword("old-password", after?.password_hash)).toBe(false);
    expect(after).toEqual({ ...before, password_hash: expect.stringMatching(/^scrypt:/) });
    expect(await ctx.repos.users.findById(ctx.userId)).toEqual(admin);
    expect(await ctx.repos.sessions.findValid("target-session-1")).toBeNull();
    expect(await ctx.repos.sessions.findValid("target-session-2")).toBeNull();
    expect(await ctx.repos.sessions.findValid("admin-session")).not.toBeNull();
    expect(await ctx.db.all("select actor_user_id, target_user_id, action from admin_audit_log")).toEqual([
      { actor_user_id: ctx.userId, target_user_id: ctx.targetId, action: "password_reset" },
    ]);
  });

  it("rolls back the password and session revocation together if the audit write fails", async () => {
    const ctx = await setup();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    await ctx.repos.sessions.create({ userId: ctx.targetId, tokenHash: "target-session", expiresAt });
    const original = await ctx.repos.users.findById(ctx.targetId);
    const run = ctx.db.run.bind(ctx.db);
    vi.spyOn(ctx.db, "run").mockImplementation(async (sql, params) => {
      if (sql.startsWith("insert into admin_audit_log")) throw new Error("Audit storage unavailable");
      return run(sql, params);
    });
    await expect(resetAccountPassword(ctx.userId, ctx.input, ctx.repos)).rejects.toThrow("Audit storage unavailable");
    expect(await ctx.repos.users.findById(ctx.targetId)).toEqual(original);
    expect(await ctx.repos.sessions.findValid("target-session")).not.toBeNull();
  });
});
