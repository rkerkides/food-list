import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repositories } from "@/lib/data/repositories";
import { deletePlaceAction } from "@/app/actions/places";
import { deleteVisitAction } from "@/app/actions/visits";
import { addCircleMember, createSharedCircle } from "@/lib/services/circles";
import { createManualPlace } from "@/lib/services/places";
import { setSharedContentEditableByGroup } from "@/lib/services/sharing";
import { logVisit } from "@/lib/services/visits";
import { createSecondUser, createTestContext } from "./helpers";

// Actions call requireUser() and services without repos, so route both to the in-memory test database.
const state = vi.hoisted(() => ({ repos: null as unknown as Repositories, userId: "" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(async () => ({ id: state.userId })) }));
vi.mock("@/lib/services/library", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/library")>()),
  defaultRepositories: vi.fn(async () => state.repos),
}));

/** Owner with one place and visit, plus a circle member the owner has opted in to edit shared content. */
async function setup() {
  const ctx = await createTestContext("owner@example.com");
  const ownerId = ctx.userId;
  const memberId = await createSecondUser(ctx.repos, "member@example.com");
  const circleId = await createSharedCircle(ownerId, "Dinner crew", ctx.repos);
  expect((await addCircleMember(ownerId, circleId, "member@example.com", ctx.repos)).status).toBe("added");
  await setSharedContentEditableByGroup(ownerId, true, ctx.repos);

  const created = await createManualPlace(ownerId, { name: "Owner's Taverna", category: "restaurant" }, ctx.repos);
  if (created.status !== "created") throw new Error("Expected a created place");
  const place = created.place;
  const visit = await logVisit(
    ownerId,
    { placeId: place.id, visitedAt: "2026-08-01", rating: 4, items: [] },
    ctx.repos,
  );

  state.repos = ctx.repos;
  return { repos: ctx.repos, ownerId, memberId, place, visit };
}

beforeEach(() => {
  state.repos = null as unknown as Repositories;
  state.userId = "";
});

describe("deletePlaceAction", () => {
  it("refuses an opted-in member and keeps the owner's place", async () => {
    const { repos, ownerId, memberId, place } = await setup();
    state.userId = memberId;
    expect(await deletePlaceAction(place.id)).toEqual({
      ok: false,
      error: "Only the owner can permanently delete a shared place.",
    });
    expect(await repos.places.findById(ownerId, place.id)).not.toBeNull();
  });

  it("lets the owner delete their place", async () => {
    const { repos, ownerId, place } = await setup();
    state.userId = ownerId;
    expect(await deletePlaceAction(place.id)).toEqual({ ok: true });
    expect(await repos.places.findById(ownerId, place.id)).toBeNull();
  });
});

describe("deleteVisitAction", () => {
  it("refuses an opted-in member and keeps the owner's visit", async () => {
    const { repos, ownerId, memberId, place, visit } = await setup();
    state.userId = memberId;
    expect(await deleteVisitAction(visit.id, place.id)).toEqual({
      ok: false,
      error: "Only the owner can permanently delete a shared visit.",
    });
    expect(await repos.visits.findById(ownerId, visit.id)).not.toBeNull();
  });

  it("lets the owner delete their visit", async () => {
    const { repos, ownerId, place, visit } = await setup();
    state.userId = ownerId;
    expect(await deleteVisitAction(visit.id, place.id)).toEqual({ ok: true });
    expect(await repos.visits.findById(ownerId, visit.id)).toBeNull();
  });
});
