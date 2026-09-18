import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import type { SqlClient, SqlValue } from "./sql-client";

/**
 * The native addon is loaded on first use instead of at import time, so a
 * Postgres-only deployment (Netlify, Docker with Postgres) never has to load a
 * native binary into the server runtime.
 */
function loadDriver(): typeof BetterSqlite3 {
  return require("better-sqlite3") as typeof BetterSqlite3;
}

/**
 * Local-first SQLite driver: zero credentials, used for development, the demo
 * and tests. The same SQL runs against Postgres in production.
 */
export class SqliteClient implements SqlClient {
  readonly dialect = "sqlite" as const;
  private readonly db: BetterSqlite3.Database;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(path: string) {
    const BetterSqlite3 = loadDriver();
    const file = path === ":memory:" ? path : resolve(process.cwd(), path);
    if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
    this.db = new BetterSqlite3(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async get<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    const row = this.db.prepare(sql).get(...params);
    return (row ?? null) as T | null;
  }

  async run(sql: string, params: SqlValue[] = []): Promise<void> {
    this.db.prepare(sql).run(...params);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  /**
   * better-sqlite3 is synchronous; async callers are serialised through a queue
   * so concurrent requests cannot interleave inside a transaction.
   */
  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      this.db.exec("begin immediate");
      try {
        const result = await fn(this);
        this.db.exec("commit");
        return result;
      } catch (error) {
        this.db.exec("rollback");
        throw error;
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
