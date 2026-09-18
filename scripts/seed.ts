import { closeDb, ensureMigrations, getDb } from "../src/lib/db";
import { createRepositories } from "../src/lib/data/repositories";
import { ensureDemoUser, DEMO_USER_EMAIL, DEMO_USER_PASSWORD } from "../src/lib/services/seed";

async function main() {
  const db = getDb();
  await ensureMigrations(db);
  const repos = createRepositories(db);
  const result = await ensureDemoUser(repos, { reseed: true });

  console.log(
    [
      `Seeded the demo account (${db.dialect}).`,
      `  email:    ${DEMO_USER_EMAIL}`,
      `  password: ${DEMO_USER_PASSWORD}`,
      `  places:   ${result.places}`,
      `  visits:   ${result.visits}`,
      `  dishes:   ${result.items}`,
    ].join("\n"),
  );
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
