import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MIGRATIONS } from "../src/lib/db/migrations";

/**
 * Emits plain .sql migrations so the schema can be applied with the Supabase CLI
 * (`supabase db push`) or psql, without depending on this codebase at runtime.
 */
function main() {
  const target = resolve(process.cwd(), "supabase/migrations");
  mkdirSync(target, { recursive: true });

  for (const migration of MIGRATIONS) {
    const file = resolve(target, `${migration.id}_${migration.name}.sql`);
    writeFileSync(file, `${migration.postgres.trim()}\n`, "utf8");
    console.log(`wrote ${file}`);
  }
}

main();
