import { createRepositories, type Repositories } from "@/lib/data/repositories";
import type { VisitInput } from "@/lib/domain/schemas";
import type { FoodItem, Visit, VisitWithItems } from "@/lib/domain/types";
import { newId } from "@/lib/utils/ids";
import { defaultRepositories } from "./library";

export class VisitError extends Error {}

/**
 * Logging a visit writes the visit plus its dishes atomically, so a place page
 * can never show a visit without the food items the user just typed.
 */
export async function logVisit(
  userId: string,
  input: VisitInput,
  repos?: Repositories,
): Promise<VisitWithItems> {
  const repo = repos ?? (await defaultRepositories());
  const place = await repo.places.findById(userId, input.placeId);
  if (!place) throw new VisitError("That place is not in your list.");

  const now = new Date().toISOString();
  const visit: Visit = {
    id: newId("vis"),
    userId,
    placeId: input.placeId,
    visitedAt: normalizeDate(input.visitedAt),
    occasion: input.occasion ?? null,
    partySize: input.partySize ?? null,
    rating: input.rating ?? null,
    thoughts: input.thoughts?.trim() ? input.thoughts.trim() : null,
    spendPerPerson: input.spendPerPerson ?? null,
    wouldReturn: input.wouldReturn ?? null,
    tags: input.tags ?? [],
    createdAt: now,
  };

  const items: FoodItem[] = input.items
    .filter((item) => item.name.trim().length > 0)
    .map((item) => ({
      id: newId("itm"),
      userId,
      visitId: visit.id,
      placeId: input.placeId,
      name: item.name.trim(),
      category: item.category ?? null,
      rating: item.rating ?? null,
      comment: item.comment?.trim() ? item.comment.trim() : null,
      isHighlight: item.isHighlight ?? (item.rating ?? 0) >= 4.5,
      price: item.price ?? null,
      createdAt: now,
    }));

  await repo.db.transaction(async (tx) => {
    const txRepo = createRepositories(tx);
    await txRepo.visits.insert(visit);
    if (items.length > 0) await txRepo.foodItems.insertMany(items);
  });

  return { ...visit, items };
}

export async function updateVisit(
  userId: string,
  visitId: string,
  input: VisitInput,
  repos?: Repositories,
): Promise<VisitWithItems | null> {
  const repo = repos ?? (await defaultRepositories());
  const existing = await repo.visits.findById(userId, visitId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const visit: Partial<Visit> = {
    visitedAt: normalizeDate(input.visitedAt),
    occasion: input.occasion ?? null,
    partySize: input.partySize ?? null,
    rating: input.rating ?? null,
    thoughts: input.thoughts?.trim() ? input.thoughts.trim() : null,
    spendPerPerson: input.spendPerPerson ?? null,
    wouldReturn: input.wouldReturn ?? null,
    tags: input.tags ?? [],
  };

  const items: FoodItem[] = input.items
    .filter((item) => item.name.trim().length > 0)
    .map((item) => ({
      id: newId("itm"),
      userId,
      visitId,
      placeId: existing.placeId,
      name: item.name.trim(),
      category: item.category ?? null,
      rating: item.rating ?? null,
      comment: item.comment?.trim() ? item.comment.trim() : null,
      isHighlight: item.isHighlight ?? (item.rating ?? 0) >= 4.5,
      price: item.price ?? null,
      createdAt: now,
    }));

  await repo.db.transaction(async (tx) => {
    const txRepo = createRepositories(tx);
    await txRepo.visits.update(userId, visitId, visit);
    await txRepo.foodItems.deleteByVisit(userId, visitId);
    if (items.length > 0) await txRepo.foodItems.insertMany(items);
  });

  return { ...existing, ...visit, items } as VisitWithItems;
}

export async function deleteVisit(
  userId: string,
  visitId: string,
  repos?: Repositories,
): Promise<void> {
  const repo = repos ?? (await defaultRepositories());
  await repo.db.transaction(async (tx) => {
    const txRepo = createRepositories(tx);
    await txRepo.foodItems.deleteByVisit(userId, visitId);
    await txRepo.visits.delete(userId, visitId);
  });
}

export async function listVisitsWithItems(
  userId: string,
  placeId: string,
  repos?: Repositories,
): Promise<VisitWithItems[]> {
  const repo = repos ?? (await defaultRepositories());
  const [visits, items] = await Promise.all([
    repo.visits.listByPlace(userId, placeId),
    repo.foodItems.listByPlace(userId, placeId),
  ]);
  return visits.map((visit) => ({
    ...visit,
    items: items.filter((item) => item.visitId === visit.id),
  }));
}

/** Accepts a date input value and stores a full ISO timestamp at midday UTC. */
function normalizeDate(input: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T12:00:00.000Z`).toISOString();
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}
