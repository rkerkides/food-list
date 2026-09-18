import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureMigrations, getDb } from "@/lib/db";
import { createRepositories, type Repositories } from "@/lib/data/repositories";

export const SESSION_COOKIE = "foodlist_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isDemo: boolean;
  createdAt: string;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    // Failing loudly beats silently signing every session with a public constant.
    throw new Error(
      "SESSION_SECRET is not set. Set it to a random 32+ character string (for example `openssl rand -base64 32`).",
    );
  }
  return "dev-only-session-secret-change-me-please";
}

function hashToken(token: string): string {
  return createHash("sha256").update(`${token}${sessionSecret()}`).digest("hex");
}

export async function createSession(
  userId: string,
  userAgent?: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const repos = await defaultRepositories();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await repos.sessions.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: expiresAt.toISOString(),
    userAgent: userAgent ?? null,
  });
  return { token, expiresAt };
}

export async function getSessionUser(repos?: Repositories): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const repo = repos ?? (await defaultRepositories());
  const found = await repo.sessions.findValid(hashToken(token));
  if (!found) return null;

  return {
    id: found.user.id,
    email: found.user.email,
    name: found.user.name,
    isDemo: Number(found.user.is_demo) === 1,
    createdAt: found.user.created_at,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const repos = await defaultRepositories();
    await repos.sessions.deleteByTokenHash(hashToken(token));
  }
  store.delete(SESSION_COOKIE);
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

async function defaultRepositories(): Promise<Repositories> {
  const db = getDb();
  await ensureMigrations(db);
  return createRepositories(db);
}
