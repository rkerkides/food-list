import { ensureMigrations } from "@/lib/db";
import { SqliteClient } from "@/lib/db/sqlite";
import { createRepositories, type Repositories } from "@/lib/data/repositories";

export interface TestContext {
  db: SqliteClient;
  repos: Repositories;
  userId: string;
}

/** Fresh in-memory database with migrations applied, plus one test user. */
export async function createTestContext(email = "test@example.com"): Promise<TestContext> {
  const db = new SqliteClient(":memory:");
  await ensureMigrations(db);
  const repos = createRepositories(db);
  const user = await repos.users.create({ email, name: "Test Diner", passwordHash: null });
  return { db, repos, userId: user.id };
}

export async function createSecondUser(repos: Repositories, email = "second@example.com") {
  const user = await repos.users.create({ email, name: "Second Diner", passwordHash: null });
  return user.id;
}
