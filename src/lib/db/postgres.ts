import { Pool, type PoolClient } from "pg";
import type { SqlClient, SqlValue } from "./sql-client";

/**
 * Postgres / Supabase driver. Statements are written with `?` placeholders and
 * rewritten to `$1..$n` here so the repository layer stays dialect agnostic.
 */
export class PostgresClient implements SqlClient {
  readonly dialect = "postgres" as const;
  private readonly pool: Pool;

  constructor(connectionString: string, options: { ssl?: boolean } = {}) {
    this.pool = new Pool({
      connectionString,
      ssl: options.ssl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }

  async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const result = await this.pool.query(rewrite(sql), params);
    return result.rows as T[];
  }

  async get<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    const result = await this.pool.query(rewrite(sql), params);
    return (result.rows[0] ?? null) as T | null;
  }

  async run(sql: string, params: SqlValue[] = []): Promise<void> {
    await this.pool.query(rewrite(sql), params);
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const tx = new PostgresTransactionClient(client);
      const result = await fn(tx);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class PostgresTransactionClient implements SqlClient {
  readonly dialect = "postgres" as const;

  constructor(private readonly client: PoolClient) {}

  async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const result = await this.client.query(rewrite(sql), params);
    return result.rows as T[];
  }

  async get<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    const result = await this.client.query(rewrite(sql), params);
    return (result.rows[0] ?? null) as T | null;
  }

  async run(sql: string, params: SqlValue[] = []): Promise<void> {
    await this.client.query(rewrite(sql), params);
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }

  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async close(): Promise<void> {
    // The pool owns the connection.
  }
}

function rewrite(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
