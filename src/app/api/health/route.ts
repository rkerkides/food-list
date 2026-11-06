import { NextResponse } from "next/server";
import { databaseDriver, ensureMigrations, getDb } from "@/lib/db";
import { describeProvider } from "@/lib/places";
import { getOsmCatalogStatus } from "@/lib/places/osm-catalog";

export const dynamic = "force-dynamic";

/**
 * Readiness probe for Docker and Netlify. Reports configuration state only —
 * never secret values — so it is safe to leave publicly reachable.
 */
export async function GET() {
  const driver = databaseDriver();
  const problems: string[] = [];

  try {
    const db = getDb();
    await ensureMigrations(db);
    await db.get("select 1 as ok");
  } catch (error) {
    problems.push(`database: ${error instanceof Error ? error.message : "unreachable"}`);
  }

  if (!process.env.SESSION_SECRET?.trim()) {
    problems.push("SESSION_SECRET is not set");
  }

  const provider = describeProvider();
  const osmCatalog =
    provider.id === "osm"
      ? await getOsmCatalogStatus().catch(() => ({ count: 0, syncedAt: null, source: null }))
      : null;
  if (provider.id === "osm" && osmCatalog?.count === 0) {
    problems.push("places: OpenStreetMap catalog is empty; run npm run places:sync");
  }

  return NextResponse.json(
    {
      status: problems.length === 0 ? "ok" : "degraded",
      database: { driver, reachable: !problems.some((p) => p.startsWith("database:")) },
      places: {
        provider: provider.id,
        mode: provider.mode,
        configured: provider.configured,
        catalogCount: osmCatalog?.count ?? null,
        catalogSyncedAt: osmCatalog?.syncedAt ?? null,
      },
      sessionSecretConfigured: Boolean(process.env.SESSION_SECRET?.trim()),
      problems,
    },
    { status: problems.length === 0 ? 200 : 503 },
  );
}
