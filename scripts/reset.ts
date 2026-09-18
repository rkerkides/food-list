import { closeDb, ensureMigrations, getDb } from "../src/lib/db";
import { createRepositories } from "../src/lib/data/repositories";
import { resetDemoData } from "../src/lib/services/seed";

async function main() {
  const db = getDb();
  await ensureMigrations(db);
  const result = await resetDemoData(createRepositories(db));
  console.log(`Demo data reset: ${result.places} places, ${result.visits} visits, ${result.items} dishes.`);
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
