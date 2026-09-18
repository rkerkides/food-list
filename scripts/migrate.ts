import { closeDb, ensureMigrations, getDb } from "../src/lib/db";

async function main() {
  const db = getDb();
  await ensureMigrations(db);
  console.log(`Migrations applied (${db.dialect}).`);
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
