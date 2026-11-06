import { describe, expect, it } from "vitest";
import { createManualPlace } from "@/lib/services/places";
import {
  addCircleMember,
  createSharedCircle,
  deleteSharedCircle,
  listSharedCircles,
  removeCircleMember,
} from "@/lib/services/circles";
import { loadUserLibrary } from "@/lib/services/library";
import {
  canEditSharedContent,
  isSharedContentEditableByGroup,
  setSharedContentEditableByGroup,
} from "@/lib/services/sharing";
import { logVisit } from "@/lib/services/visits";
import { createSecondUser, createTestContext } from "./helpers";

describe("shared circles", () => {
  it("shares members' libraries and folds both rating histories into recommendations", async () => {
    const ctx = await createTestContext();
    const friendId = await createSecondUser(ctx.repos, "friend@example.com");
    const circleId = await createSharedCircle(ctx.userId, "Dinner crew", ctx.repos);
    expect((await addCircleMember(ctx.userId, circleId, "friend@example.com", ctx.repos)).status).toBe("added");

    const mine = await createManualPlace(
      ctx.userId,
      { name: "My Greek Place", category: "restaurant", cuisines: ["Greek"] },
      ctx.repos,
    );
    const theirs = await createManualPlace(
      friendId,
      { name: "Friend's Mexican Place", category: "restaurant", cuisines: ["Mexican"] },
      ctx.repos,
    );
    if (mine.status !== "created" || theirs.status !== "created") throw new Error("Expected places");

    await logVisit(ctx.userId, { placeId: mine.place.id, visitedAt: "2026-08-01", rating: 4, items: [] }, ctx.repos);
    await logVisit(friendId, { placeId: theirs.place.id, visitedAt: "2026-08-02", rating: 5, items: [] }, ctx.repos);

    const combined = await loadUserLibrary(ctx.userId, { repos: ctx.repos });
    expect(combined.places.map((place) => place.name).sort()).toEqual([
      "Friend's Mexican Place",
      "My Greek Place",
    ]);
    expect(combined.preferences.ratedVisitCount).toBe(2);
    expect(combined.preferences.cuisineAffinity.mexican.average).toBe(5);

    const circles = await listSharedCircles(ctx.userId, ctx.repos);
    expect(circles).toMatchObject([{ name: "Dinner crew", memberCount: 2 }]);
  });

  it("uses one owner setting for editing shared content across all circles", async () => {
    const ctx = await createTestContext();
    const friendId = await createSecondUser(ctx.repos, "friend@example.com");
    const circleId = await createSharedCircle(ctx.userId, "Dinner crew", ctx.repos);
    await addCircleMember(ctx.userId, circleId, "friend@example.com", ctx.repos);

    expect(await isSharedContentEditableByGroup(ctx.userId, ctx.repos)).toBe(false);
    expect(await canEditSharedContent(friendId, ctx.userId, ctx.repos)).toBe(false);
    expect(await canEditSharedContent(ctx.userId, ctx.userId, ctx.repos)).toBe(true);

    await setSharedContentEditableByGroup(ctx.userId, true, ctx.repos);

    expect(await isSharedContentEditableByGroup(ctx.userId, ctx.repos)).toBe(true);
    expect(await canEditSharedContent(friendId, ctx.userId, ctx.repos)).toBe(true);
  });

  it("lists members and lets only the owner remove members or delete a circle", async () => {
    const ctx = await createTestContext();
    const friendId = await createSecondUser(ctx.repos, "friend@example.com");
    const circleId = await createSharedCircle(ctx.userId, "Dinner crew", ctx.repos);
    await addCircleMember(ctx.userId, circleId, "friend@example.com", ctx.repos);

    const [circle] = await listSharedCircles(ctx.userId, ctx.repos);
    expect(circle.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: ctx.userId, isOwner: true }),
      expect.objectContaining({ userId: friendId, email: "friend@example.com", isOwner: false }),
    ]));
    expect((await removeCircleMember(friendId, circleId, ctx.userId, ctx.repos)).status).toBe("forbidden");
    expect((await removeCircleMember(ctx.userId, circleId, friendId, ctx.repos)).status).toBe("removed");
    expect((await listSharedCircles(ctx.userId, ctx.repos))[0].memberCount).toBe(1);
    expect((await deleteSharedCircle(ctx.userId, circleId, ctx.repos)).status).toBe("deleted");
    expect(await listSharedCircles(ctx.userId, ctx.repos)).toEqual([]);
  });
});
