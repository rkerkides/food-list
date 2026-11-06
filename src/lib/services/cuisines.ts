import type { Repositories } from "@/lib/data/repositories";
import { cuisineKey, normalizeCuisineList, normalizeCuisineName, STANDARD_CUISINES } from "@/lib/domain/cuisines";
import { defaultRepositories } from "./library";

export interface CuisineCatalogEntry {
  id: string;
  name: string;
  source: "standard" | "custom";
}

export async function listCuisineCatalog(userId: string, repos?: Repositories): Promise<CuisineCatalogEntry[]> {
  const repo = repos ?? (await defaultRepositories());
  const custom = await repo.cuisines.listActive(userId);
  const names = normalizeCuisineList([...STANDARD_CUISINES, ...custom.map((entry) => entry.name)]);
  return names
    .map((name) => {
      const entry = custom.find((candidate) => cuisineKey(candidate.name) === cuisineKey(name));
      return {
        id: entry?.id ?? `standard:${cuisineKey(name)}`,
        name,
        source: entry ? ("custom" as const) : ("standard" as const),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function validateCuisines(
  userId: string,
  values: readonly string[],
  repos?: Repositories,
): Promise<{ ok: true; cuisines: string[] } | { ok: false; error: string }> {
  const catalog = await listCuisineCatalog(userId, repos);
  const names = catalog.map((entry) => entry.name);
  const cuisines = normalizeCuisineList(values, names);
  const unknown = cuisines.filter((cuisine) => !names.some((name) => cuisineKey(name) === cuisineKey(cuisine)));
  if (unknown.length) {
    return {
      ok: false,
      error: `${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not in your cuisine catalogue. Add it from the cuisine picker first.`,
    };
  }
  return { ok: true, cuisines };
}

export async function addCuisineToCatalog(
  userId: string,
  value: string,
  repos?: Repositories,
): Promise<{ ok: true; entry: CuisineCatalogEntry } | { ok: false; error: string }> {
  const name = normalizeCuisineName(value);
  if (name.length < 2 || name.length > 50) return { ok: false, error: "Use a cuisine name between 2 and 50 characters." };
  const repo = repos ?? (await defaultRepositories());
  const existing = await listCuisineCatalog(userId, repo);
  const match = existing.find((entry) => cuisineKey(entry.name) === cuisineKey(name));
  if (match) return { ok: true, entry: match };
  const row = await repo.cuisines.create(userId, name, cuisineKey(name));
  return { ok: true, entry: { id: row.id, name: row.name, source: "custom" } };
}

export async function renameCustomCuisine(
  userId: string,
  cuisineId: string,
  value: string,
  repos?: Repositories,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const repo = repos ?? (await defaultRepositories());
  const current = await repo.cuisines.findById(userId, cuisineId);
  if (!current) return { ok: false, error: "That custom cuisine no longer exists." };
  const name = normalizeCuisineName(value);
  if (name.length < 2 || name.length > 50) return { ok: false, error: "Use a cuisine name between 2 and 50 characters." };
  const catalog = await listCuisineCatalog(userId, repo);
  const collision = catalog.find((entry) => entry.id !== cuisineId && cuisineKey(entry.name) === cuisineKey(name));
  if (collision) return { ok: false, error: `${collision.name} is already in the catalogue.` };

  const places = await repo.places.listByUser(userId);
  for (const place of places) {
    if (!place.cuisines.some((cuisine) => cuisineKey(cuisine) === cuisineKey(current.name))) continue;
    const cuisines = normalizeCuisineList(
      place.cuisines.map((cuisine) => (cuisineKey(cuisine) === cuisineKey(current.name) ? name : cuisine)),
      catalog.filter((entry) => entry.id !== cuisineId).map((entry) => entry.name).concat(name),
    );
    await repo.places.update(userId, place.id, { cuisines, updatedAt: new Date().toISOString() });
  }
  await repo.cuisines.rename(userId, cuisineId, name, cuisineKey(name));
  return { ok: true };
}

export async function removeCustomCuisine(
  userId: string,
  cuisineId: string,
  repos?: Repositories,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const repo = repos ?? (await defaultRepositories());
  const current = await repo.cuisines.findById(userId, cuisineId);
  if (!current) return { ok: false, error: "That custom cuisine no longer exists." };
  const uses = (await repo.places.listByUser(userId)).filter((place) =>
    place.cuisines.some((cuisine) => cuisineKey(cuisine) === cuisineKey(current.name)),
  );
  if (uses.length) return { ok: false, error: `Used by ${uses.length} saved ${uses.length === 1 ? "place" : "places"}. Rename or remove it there first.` };
  await repo.cuisines.remove(userId, cuisineId);
  return { ok: true };
}
