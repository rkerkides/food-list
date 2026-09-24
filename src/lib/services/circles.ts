import type { Repositories } from "@/lib/data/repositories";
import { defaultRepositories } from "./library";

export interface SharedCircleSummary {
  id: string;
  name: string;
  ownerUserId: string;
  ownerName: string;
  memberCount: number;
}

export async function listSharedCircles(
  userId: string,
  repos?: Repositories,
): Promise<SharedCircleSummary[]> {
  const repo = repos ?? (await defaultRepositories());
  const rows = await repo.circles.listForUser(userId);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    memberCount: Number(row.member_count),
  }));
}

export async function createSharedCircle(userId: string, name: string, repos?: Repositories) {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) throw new Error("Give the circle a name between 2 and 60 characters.");
  const repo = repos ?? (await defaultRepositories());
  return repo.circles.create(userId, trimmed);
}

export async function addCircleMember(
  userId: string,
  circleId: string,
  email: string,
  repos?: Repositories,
) {
  const trimmed = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(trimmed)) throw new Error("Enter a valid email address.");
  const repo = repos ?? (await defaultRepositories());
  return repo.circles.addMemberByEmail(circleId, userId, trimmed);
}
