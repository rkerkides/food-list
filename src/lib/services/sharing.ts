import type { Repositories } from "@/lib/data/repositories";
import type { Place, Visit } from "@/lib/domain/types";
import { defaultRepositories } from "./library";

export type SharedContentAccess = "allowed" | "forbidden" | "not_found";

export async function isSharedContentEditableByGroup(userId: string, repos?: Repositories): Promise<boolean> {
  const repo = repos ?? (await defaultRepositories());
  const user = await repo.users.findById(userId);
  return Number(user?.shared_content_editable_by_group ?? 0) === 1;
}

export async function setSharedContentEditableByGroup(
  userId: string,
  enabled: boolean,
  repos?: Repositories,
): Promise<void> {
  const repo = repos ?? (await defaultRepositories());
  await repo.users.setSharedContentEditableByGroup(userId, enabled);
}

/** Owners always retain access; members need both a shared circle and the owner's opt-in. */
export async function canEditSharedContent(
  actorUserId: string,
  ownerUserId: string,
  repos?: Repositories,
): Promise<boolean> {
  if (actorUserId === ownerUserId) return true;
  const repo = repos ?? (await defaultRepositories());
  const [enabled, sharesCircle] = await Promise.all([
    isSharedContentEditableByGroup(ownerUserId, repo),
    repo.circles.sharesCircle(actorUserId, ownerUserId),
  ]);
  return enabled && sharesCircle;
}

export async function resolveEditablePlace(
  actorUserId: string,
  placeId: string,
  repos?: Repositories,
): Promise<{ access: SharedContentAccess; ownerUserId?: string; place?: Place }> {
  const repo = repos ?? (await defaultRepositories());
  const ownerIds = await repo.circles.accessibleUserIds(actorUserId);
  for (const ownerUserId of ownerIds) {
    const place = await repo.places.findById(ownerUserId, placeId);
    if (!place) continue;
    return (await canEditSharedContent(actorUserId, ownerUserId, repo))
      ? { access: "allowed", ownerUserId, place }
      : { access: "forbidden", ownerUserId, place };
  }
  return { access: "not_found" };
}

export async function resolveEditableVisit(
  actorUserId: string,
  visitId: string,
  repos?: Repositories,
): Promise<{ access: SharedContentAccess; ownerUserId?: string; visit?: Visit }> {
  const repo = repos ?? (await defaultRepositories());
  const ownerIds = await repo.circles.accessibleUserIds(actorUserId);
  for (const ownerUserId of ownerIds) {
    const visit = await repo.visits.findById(ownerUserId, visitId);
    if (!visit) continue;
    return (await canEditSharedContent(actorUserId, ownerUserId, repo))
      ? { access: "allowed", ownerUserId, visit }
      : { access: "forbidden", ownerUserId, visit };
  }
  return { access: "not_found" };
}
