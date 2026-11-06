import { describe, expect, it } from "vitest";
import { addCircleMember, createSharedCircle, deleteSharedCircle, removeCircleMember } from "@/lib/services/circles";
import { createManualPlace, deletePlace } from "@/lib/services/places";
import { resolveEditablePlace, resolveEditableVisit, setSharedContentEditableByGroup } from "@/lib/services/sharing";
import { deleteVisit, listVisitsWithItems, logVisit } from "@/lib/services/visits";
import { createSecondUser, createTestContext } from "./helpers";

/** Owner with one place and one visit; member shares a circle with the owner; outsider shares none. */
async function setup({ editableByGroup }: { editableByGroup: boolean }) {
  const ctx = await createTestContext("owner@example.com");
  const ownerId = ctx.userId;
  const memberId = await createSecondUser(ctx.repos, "member@example.com");
  const outsiderId = await createSecondUser(ctx.repos, "outsider@example.com");

  const circleId = await createSharedCircle(ownerId, "Dinner crew", ctx.repos);
  expect((await addCircleMember(ownerId, circleId, "member@example.com", ctx.repos)).status).toBe("added");
  await setSharedContentEditableByGroup(ownerId, editableByGroup, ctx.repos);

  const created = await createManualPlace(ownerId, { name: "Owner's Taverna", category: "restaurant" }, ctx.repos);
  if (created.status !== "created") throw new Error("Expected a created place");
  const place = created.place;
  const visit = await logVisit(
    ownerId,
    { placeId: place.id, visitedAt: "2026-08-01", rating: 4, items: [] },
    ctx.repos,
  );

  return { ctx, repos: ctx.repos, ownerId, memberId, outsiderId, circleId, place, visit };
}

const NOT_FOUND = { access: "not_found" };

describe("resolveEditablePlace", () => {
  it("allows the owner", async () => {
    const { repos, ownerId, place } = await setup({ editableByGroup: false });
    const result = await resolveEditablePlace(ownerId, place.id, repos);
    expect(result.access).toBe("allowed");
    expect(result.ownerUserId).toBe(ownerId);
    expect(result.place?.id).toBe(place.id);
  });

  it("forbids a circle member when the owner has not opted in", async () => {
    const { repos, ownerId, memberId, place } = await setup({ editableByGroup: false });
    const result = await resolveEditablePlace(memberId, place.id, repos);
    expect(result.access).toBe("forbidden");
    expect(result.ownerUserId).toBe(ownerId);
  });

  it("allows a circle member when the owner has opted in, resolving to the owner", async () => {
    const { repos, ownerId, memberId, place } = await setup({ editableByGroup: true });
    const result = await resolveEditablePlace(memberId, place.id, repos);
    expect(result.access).toBe("allowed");
    expect(result.ownerUserId).toBe(ownerId);
    expect(result.ownerUserId).not.toBe(memberId);
    expect(result.place?.id).toBe(place.id);
  });

  it("hides the place from a user who shares no circle with the owner", async () => {
    const { repos, outsiderId, place } = await setup({ editableByGroup: true });
    expect(await resolveEditablePlace(outsiderId, place.id, repos)).toEqual(NOT_FOUND);
  });

  it("hides the place from a member the owner removed", async () => {
    const { repos, ownerId, memberId, circleId, place } = await setup({ editableByGroup: true });
    expect((await removeCircleMember(ownerId, circleId, memberId, repos)).status).toBe("removed");
    expect(await resolveEditablePlace(memberId, place.id, repos)).toEqual(NOT_FOUND);
  });

  it("returns not_found for an id that exists for nobody", async () => {
    const { repos, ownerId, memberId } = await setup({ editableByGroup: true });
    expect(await resolveEditablePlace(ownerId, "pl_missing", repos)).toEqual(NOT_FOUND);
    expect(await resolveEditablePlace(memberId, "pl_missing", repos)).toEqual(NOT_FOUND);
  });

  it("forbids the member again once the owner revokes the opt-in", async () => {
    const { repos, ownerId, memberId, place } = await setup({ editableByGroup: true });
    expect((await resolveEditablePlace(memberId, place.id, repos)).access).toBe("allowed");
    await setSharedContentEditableByGroup(ownerId, false, repos);
    const result = await resolveEditablePlace(memberId, place.id, repos);
    expect(result.access).toBe("forbidden");
    expect(result.ownerUserId).toBe(ownerId);
  });

  it("ignores the member's own opt-in when the owner's is off", async () => {
    const { repos, ownerId, memberId, place } = await setup({ editableByGroup: false });
    await setSharedContentEditableByGroup(memberId, true, repos);
    const result = await resolveEditablePlace(memberId, place.id, repos);
    expect(result.access).toBe("forbidden");
    expect(result.ownerUserId).toBe(ownerId);
  });

  it("hides the place from the member once the owner deletes the circle", async () => {
    const { repos, ownerId, memberId, circleId, place } = await setup({ editableByGroup: true });
    expect((await deleteSharedCircle(ownerId, circleId, repos)).status).toBe("deleted");
    expect(await resolveEditablePlace(memberId, place.id, repos)).toEqual(NOT_FOUND);
  });
});

describe("resolveEditableVisit", () => {
  it("allows the owner", async () => {
    const { repos, ownerId, visit } = await setup({ editableByGroup: false });
    const result = await resolveEditableVisit(ownerId, visit.id, repos);
    expect(result.access).toBe("allowed");
    expect(result.ownerUserId).toBe(ownerId);
    expect(result.visit?.id).toBe(visit.id);
  });

  it("forbids a circle member when the owner has not opted in", async () => {
    const { repos, ownerId, memberId, visit } = await setup({ editableByGroup: false });
    const result = await resolveEditableVisit(memberId, visit.id, repos);
    expect(result.access).toBe("forbidden");
    expect(result.ownerUserId).toBe(ownerId);
  });

  it("allows a circle member when the owner has opted in, resolving to the owner", async () => {
    const { repos, ownerId, memberId, visit } = await setup({ editableByGroup: true });
    const result = await resolveEditableVisit(memberId, visit.id, repos);
    expect(result.access).toBe("allowed");
    expect(result.ownerUserId).toBe(ownerId);
    expect(result.ownerUserId).not.toBe(memberId);
    expect(result.visit?.id).toBe(visit.id);
  });

  it("hides the visit from a user who shares no circle with the owner", async () => {
    const { repos, outsiderId, visit } = await setup({ editableByGroup: true });
    expect(await resolveEditableVisit(outsiderId, visit.id, repos)).toEqual(NOT_FOUND);
  });

  it("hides the visit from a member the owner removed", async () => {
    const { repos, ownerId, memberId, circleId, visit } = await setup({ editableByGroup: true });
    expect((await removeCircleMember(ownerId, circleId, memberId, repos)).status).toBe("removed");
    expect(await resolveEditableVisit(memberId, visit.id, repos)).toEqual(NOT_FOUND);
  });

  it("returns not_found for an id that exists for nobody", async () => {
    const { repos, ownerId, memberId } = await setup({ editableByGroup: true });
    expect(await resolveEditableVisit(ownerId, "vis_missing", repos)).toEqual(NOT_FOUND);
    expect(await resolveEditableVisit(memberId, "vis_missing", repos)).toEqual(NOT_FOUND);
  });
});

describe("deletePlace", () => {
  it("scopes deletes to the given user id, leaving another owner's place intact", async () => {
    const { repos, ownerId, memberId, place } = await setup({ editableByGroup: true });
    await deletePlace(memberId, place.id, repos);
    expect(await repos.places.findById(ownerId, place.id)).not.toBeNull();
    await deletePlace(ownerId, place.id, repos);
    expect(await repos.places.findById(ownerId, place.id)).toBeNull();
  });
});

describe("deleteVisit", () => {
  it("scopes deletes to the given user id, leaving another owner's visit and its items intact", async () => {
    const { repos, ownerId, memberId, place } = await setup({ editableByGroup: true });
    const visit = await logVisit(
      ownerId,
      {
        placeId: place.id,
        visitedAt: "2026-08-02",
        rating: 5,
        items: [{ name: "Halloumi", category: "starter", rating: 5 }],
      },
      repos,
    );
    expect(visit.items).toHaveLength(1);
    await deleteVisit(memberId, visit.id, repos);
    const remaining = await listVisitsWithItems(ownerId, place.id, repos);
    const kept = remaining.find((entry) => entry.id === visit.id);
    expect(kept).toBeDefined();
    expect(kept?.items.map((item) => item.name)).toEqual(["Halloumi"]);
  });
});
