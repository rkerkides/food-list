import { PostgresClient } from "./postgres";
import { SqliteClient } from "./sqlite";
import { MIGRATIONS } from "./migrations";
import type { SqlClient } from "./sql-client";

let cached: SqlClient | null = null;
const migratedClients = new WeakSet<SqlClient>();

/** Arbitrary but stable key for the Postgres advisory lock guarding migrations. */
const MIGRATION_LOCK_KEY = 8675309;

export function databaseDriver(): "sqlite" | "postgres" {
  const driver = (process.env.DATABASE_DRIVER ?? "").trim().toLowerCase();
  if (driver === "postgres" || driver === "supabase") return "postgres";
  if (driver === "sqlite") return "sqlite";
  return process.env.DATABASE_URL ? "postgres" : "sqlite";
}

export function sqlitePath(): string {
  return process.env.SQLITE_PATH?.trim() || ".data/food-list.db";
}

export function createDbClient(): SqlClient {
  if (databaseDriver() === "postgres") {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_DRIVER=postgres requires DATABASE_URL. Set it or use DATABASE_DRIVER=sqlite.",
      );
    }
    const ssl = (process.env.DATABASE_SSL ?? "true") !== "false";
    return new PostgresClient(url, { ssl });
  }
  return new SqliteClient(process.env.SQLITE_PATH ?? sqlitePath());
}

export function getDb(): SqlClient {
  if (!cached) cached = createDbClient();
  return cached;
}

/**
 * Applies pending migrations. Idempotent, cheap after the first call, and safe
 * to call from request handlers so a fresh clone works without a manual step.
 */
export async function ensureMigrations(db: SqlClient = getDb()): Promise<void> {
  if (migratedClients.has(db)) return;

  if (db.dialect === "postgres") {
    // Serverless platforms can cold-start several instances at once. A
    // transaction-scoped advisory lock serialises them so only one applies the
    // schema while the others wait, instead of racing on schema_migrations.
    await db.transaction(async (tx) => {
      await tx.run("select pg_advisory_xact_lock(?)", [MIGRATION_LOCK_KEY]);
      await applyMigrations(tx);
    });
  } else {
    await applyMigrations(db);
  }

  migratedClients.add(db);
}

async function applyMigrations(db: SqlClient): Promise<void> {
  await db.exec(
    "create table if not exists schema_migrations (id text primary key, name text not null, applied_at text not null)",
  );
  const applied = await db.all<{ id: string }>("select id from schema_migrations");
  const done = new Set(applied.map((row) => row.id));

  for (const migration of MIGRATIONS) {
    if (done.has(migration.id)) continue;
    const sql = db.dialect === "sqlite" ? migration.sqlite : migration.postgres;
    await db.exec(sql);
    await db.run("insert into schema_migrations (id, name, applied_at) values (?, ?, ?)", [
      migration.id,
      migration.name,
      new Date().toISOString(),
    ]);
  }
}

export async function resetMigrationCache(): Promise<void> {}

/** Closes the cached connection (used by scripts and tests). */
export async function closeDb(): Promise<void> {
  if (!cached) return;
  await cached.close();
  cached = null;
}

export type { SqlClient };
