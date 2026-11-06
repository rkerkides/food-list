import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repositories } from "@/lib/data/repositories";
import type { PlaceStatus } from "@/lib/domain/types";
import {
  addPlaceAction,
  completeVenueLinkReviewAction,
  createManualPlaceAction,
  setPlaceStatusAction,
  updatePlaceAction,
} from "@/app/actions/places";
import { createManualPlace } from "@/lib/services/places";
import { createTestContext } from "./helpers";

// Actions call requireUser() and services without repos, so route both to the in-memory test database.
const state = vi.hoisted(() => ({ repos: null as unknown as Repositories, userId: "" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(async () => ({ id: state.userId })) }));
vi.mock("@/lib/services/library", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/library")>()),
  defaultRepositories: vi.fn(async () => state.repos),
}));

async function setup() {
  const ctx = await createTestContext("owner@example.com");
  const created = await createManualPlace(
    ctx.userId,
    { name: "Status Taverna", category: "restaurant", status: "saved", expectedSpendMin: 15, expectedSpendMax: 25 },
    ctx.repos,
  );
  if (created.status !== "created") throw new Error("Expected a created place");
  state.repos = ctx.repos;
  state.userId = ctx.userId;
  return { repos: ctx.repos, userId: ctx.userId, place: created.place };
}

beforeEach(() => {
  state.repos = null as unknown as Repositories;
  state.userId = "";
});

describe("setPlaceStatusAction", () => {
  it.each(["deleted", "", "Saved"])("rejects %j and leaves the status unchanged", async (status) => {
    const { repos, userId, place } = await setup();
    expect(await setPlaceStatusAction(place.id, status as PlaceStatus)).toEqual({
      ok: false,
      error: "Choose a valid status.",
    });
    expect((await repos.places.findById(userId, place.id))?.status).toBe("saved");
  });

  it("rejects an invalid status before looking up the place", async () => {
    await setup();
    expect(await setPlaceStatusAction("place_missing", "deleted" as PlaceStatus)).toEqual({
      ok: false,
      error: "Choose a valid status.",
    });
  });

  it("updates a valid status", async () => {
    const { repos, userId, place } = await setup();
    expect(await setPlaceStatusAction(place.id, "favourite")).toEqual({ ok: true });
    expect((await repos.places.findById(userId, place.id))?.status).toBe("favourite");
  });
});

describe("spend range on place actions", () => {
  it("rejects an inverted range on update and keeps the stored spend", async () => {
    const { repos, userId, place } = await setup();
    expect(await updatePlaceAction(place.id, { expectedSpendMin: 40, expectedSpendMax: 20 })).toEqual({
      ok: false,
      error: "Minimum can't exceed maximum",
    });
    expect(await repos.places.findById(userId, place.id)).toMatchObject({ expectedSpendMin: 15, expectedSpendMax: 25 });
  });

  it("rejects a max-only update below the stored minimum and keeps the stored spend", async () => {
    const { repos, userId, place } = await setup();
    expect(await updatePlaceAction(place.id, { expectedSpendMax: 10 })).toEqual({
      ok: false,
      error: "Minimum can't exceed maximum",
    });
    expect(await repos.places.findById(userId, place.id)).toMatchObject({ expectedSpendMin: 15, expectedSpendMax: 25 });
  });

  it("rejects an inverted range on provider add and stores nothing", async () => {
    const { repos, userId } = await setup();
    expect(
      await addPlaceAction({
        result: { provider: "demo", providerPlaceId: "demo-inverted", name: "Inverted Meze", category: "restaurant", cuisines: [] },
        expectedSpendMin: 40,
        expectedSpendMax: 20,
      }),
    ).toEqual({ ok: false, error: "Minimum can't exceed maximum", code: "validation" });
    expect((await repos.places.listByUser(userId)).map((p) => p.name)).toEqual(["Status Taverna"]);
  });

  it("keeps the generic message when the inverted range comes with another problem", async () => {
    const { repos, userId } = await setup();
    expect(
      await createManualPlaceAction({ name: "X", category: "restaurant", expectedSpendMin: 40, expectedSpendMax: 20 }),
    ).toMatchObject({ ok: false, error: "Those details were not valid.", code: "validation" });
    expect((await repos.places.listByUser(userId)).map((p) => p.name)).toEqual(["Status Taverna"]);
  });

  it("rejects an inverted range on manual add and stores nothing", async () => {
    const { repos, userId } = await setup();
    expect(await createManualPlaceAction({ name: "Inverted Grill", category: "restaurant", expectedSpendMin: 40, expectedSpendMax: 20 })).toMatchObject({
      ok: false,
      error: "Minimum can't exceed maximum",
    });
    expect((await repos.places.listByUser(userId)).map((p) => p.name)).toEqual(["Status Taverna"]);
  });
});

describe("completeVenueLinkReviewAction", () => {
  async function queueSubmission(repos: Repositories, userId: string) {
    await repos.venueLinkSubmissions.create({
      userId,
      googleMapsUrl: "https://www.google.com/maps/place/Example/@35.17,33.37,17z",
      note: null,
      latitude: 35.17,
      longitude: 33.37,
    });
    const [submission] = await repos.venueLinkSubmissions.listAll();
    return submission;
  }

  it("completes a review with an equal minimum and maximum", async () => {
    const { repos, userId } = await setup();
    const submission = await queueSubmission(repos, userId);
    expect(
      await completeVenueLinkReviewAction(
        submission.id,
        { name: "Reviewed venue", category: "cafe", cuisines: [], address: null, area: null, expectedSpendMin: 20, expectedSpendMax: 20 },
        null,
      ),
    ).toMatchObject({ ok: true });
    expect((await repos.venueLinkSubmissions.findById(submission.id))?.status).not.toBe("pending");
  });

  it("rejects an inverted range and leaves the submission pending", async () => {
    const { repos, userId } = await setup();
    const submission = await queueSubmission(repos, userId);

    expect(
      await completeVenueLinkReviewAction(
        submission.id,
        { name: "Reviewed venue", category: "cafe", cuisines: [], address: null, area: null, expectedSpendMin: 40, expectedSpendMax: 20 },
        null,
      ),
    ).toEqual({ ok: false, error: "Minimum can't exceed maximum" });
    expect((await repos.venueLinkSubmissions.findById(submission.id))?.status).toBe("pending");
    expect((await repos.places.listByUser(userId)).map((p) => p.name)).toEqual(["Status Taverna"]);
  });
});
