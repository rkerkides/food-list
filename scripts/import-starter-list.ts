import { closeDb, ensureMigrations, getDb } from "../src/lib/db";
import { createRepositories } from "../src/lib/data/repositories";
import {
  enrichStarterListFromOsm,
  geocodeRemainingStarterList,
  importStarterList,
  applyVerifiedStarterVenueFacts,
} from "../src/lib/services/starter-list";

function emailFromArgs(): string | null {
  const argument = process.argv.find((value) => value.startsWith("--email="));
  return argument?.slice("--email=".length).trim().toLowerCase() || null;
}

function shouldGeocode(): boolean {
  return process.argv.includes("--geocode");
}

async function main() {
  const email = emailFromArgs();
  if (!email) throw new Error("Usage: npm run db:import-starter-list -- --email=you@example.com");

  const db = getDb();
  await ensureMigrations(db);
  const repos = createRepositories(db);
  const user = await repos.users.findByEmail(email);
  if (!user) throw new Error(`No user found for ${email}. Sign up first, then run this command again.`);

  const result = await importStarterList(user.id, repos);
  const enrichment = await enrichStarterListFromOsm(user.id, repos);
  const verifiedFacts = await applyVerifiedStarterVenueFacts(user.id, repos);
  const geocoding = shouldGeocode()
    ? await geocodeRemainingStarterList(user.id, repos)
    : { geocoded: 0, unresolved: [] as string[] };
  console.log(
    `Starter list imported for ${user.email}: ${result.createdPlaces} places added, ${result.existingPlaces} already present, ${result.importedVisits} prior visits, ${result.importedDishes} dishes; ${enrichment.matched} OSM matches enriched, ${verifiedFacts} venue facts verified${shouldGeocode() ? `, ${geocoding.geocoded} coordinates resolved, ${geocoding.unresolved.length} still need review` : ". Run again with --geocode for the approved one-time Nominatim fallback."}`,
  );
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
