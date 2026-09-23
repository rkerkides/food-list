import { closeDb, getDb } from "../src/lib/db";
import { getOsmCatalogStatus, syncOsmCatalog } from "../src/lib/places/osm-catalog";

async function main() {
  const db = getDb();
  if (process.argv.includes("--if-empty")) {
    const current = await getOsmCatalogStatus(db);
    if (current.count > 0) {
      console.log(
        `OpenStreetMap catalog already contains ${current.count} venues; keeping the existing snapshot.`,
      );
      await closeDb();
      return;
    }
  }
  console.log("Downloading named food venues in Cyprus from OpenStreetMap…");
  const result = await syncOsmCatalog(db);
  console.log(
    `OpenStreetMap catalog updated (${db.dialect}): ${result.count} venues at ${result.syncedAt}.`,
  );
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
