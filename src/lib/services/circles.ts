import type { Repositories } from "@/lib/data/repositories";
import { defaultRepositories } from "./library";

export interface SharedCircleSummary {
  id: string;
  name: string;
  ownerUserId: string;
  ownerName: string;
  memberCount: number;
  members: SharedCircleMember[];
}

export interface SharedCircleMember {
  userId: string;
  name: string;
  email: string;
  isOwner: boolean;
}

export async function listSharedCircles(
  userId: string,
  repos?: Repositories,
): Promise<SharedCircleSummary[]> {
  const repo = repos ?? (await defaultRepositories());
  const rows = await repo.circles.listForUser(userId);
  return Promise.all(rows.map(async (row) => ({
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    memberCount: Number(row.member_count),
    members: (await repo.circles.listMembers(row.id, userId)).map((member) => ({
      userId: member.user_id,
      name: member.name,
      email: member.email,
      isOwner: member.role === "owner",
    })),
  })));
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

export async function removeCircleMember(
  userId: string,
  circleId: string,
  memberUserId: string,
  repos?: Repositories,
) {
  const repo = repos ?? (await defaultRepositories());
  return repo.circles.removeMember(circleId, userId, memberUserId);
}

export async function deleteSharedCircle(userId: string, circleId: string, repos?: Repositories) {
  const repo = repos ?? (await defaultRepositories());
  return repo.circles.delete(circleId, userId);
}
