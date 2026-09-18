"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { credentialsSchema } from "@/lib/domain/schemas";
import { ensureMigrations, getDb } from "@/lib/db";
import { createRepositories } from "@/lib/data/repositories";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { ensureDemoUser } from "@/lib/services/seed";

export interface AuthState {
  error?: string;
}

async function repositories() {
  const db = getDb();
  await ensureMigrations(db);
  return createRepositories(db);
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your email and password." };
  }

  const repos = await repositories();
  const user = await repos.users.findByEmail(parsed.data.email);
  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    return { error: "That email and password combination does not match an account." };
  }

  const { token, expiresAt } = await createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  redirect("/");
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  const repos = await repositories();
  const existing = await repos.users.findByEmail(parsed.data.email);
  if (existing) {
    return { error: "An account with that email already exists. Sign in instead." };
  }

  const user = await repos.users.create({
    email: parsed.data.email,
    name: parsed.data.name?.trim() || parsed.data.email.split("@")[0],
    passwordHash: hashPassword(parsed.data.password),
  });

  const { token, expiresAt } = await createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  redirect("/");
}

/** One-click demo access: creates (or reuses) the seeded demo account. */
export async function demoSignInAction(): Promise<void> {
  const repos = await repositories();
  const { userId } = await ensureDemoUser(repos);
  const { token, expiresAt } = await createSession(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
