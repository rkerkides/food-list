import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repositories } from "@/lib/data/repositories";
import type { PlaceStatus } from "@/lib/domain/types";
import type { VenueReviewDetails } from "@/lib/services/venue-review";
import {
  addPlaceAction,
  completeVenueLinkReviewAction,
  createManualPlaceAction,
  reviewVenueLinkAction,
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

  const valid: VenueReviewDetails = {
    name: "Meze House",
    category: "restaurant",
    cuisines: [],
    address: null,
    area: null,
    expectedSpendMin: null,
    expectedSpendMax: null,
  };

  /** Runs the action with malformed details and checks nothing was written. */
  async function expectRejected(details: unknown, error: string, reviewNote: string | null = null) {
    const { repos, userId } = await setup();
    const submission = await queueSubmission(repos, userId);
    const result = await completeVenueLinkReviewAction(submission.id, details as VenueReviewDetails, reviewNote);
    expect(result).toEqual({ ok: false, error });
    expect((await repos.venueLinkSubmissions.findById(submission.id))?.status).toBe("pending");
    expect((await repos.places.listByUser(userId)).map((p) => p.name)).toEqual(["Status Taverna"]);
  }

  it("completes a valid review and stores normalised cuisines and trimmed text", async () => {
    const { repos, userId } = await setup();
    const submission = await queueSubmission(repos, userId);
    const result = await completeVenueLinkReviewAction(
      submission.id,
      { ...valid, name: "  Meze House ", cuisines: ["greek", "Cypriot"], address: " 1 Ledra Street ", area: "Old Town" },
      " Looks right ",
    );
    expect(result).toMatchObject({ ok: true, added: ["venue"] });
    if (!result.ok) throw new Error("Expected completion");
    expect(await repos.places.findById(userId, result.placeId)).toMatchObject({
      name: "Meze House",
      cuisines: ["Greek", "Cypriot"],
      address: "1 Ledra Street",
      area: "Old Town",
    });
    expect(await repos.venueLinkSubmissions.findById(submission.id)).toMatchObject({ status: "completed", reviewNote: "Looks right" });
  });

  it.each([undefined, 123, null, "A", "   A  "])("rejects the venue name %j without throwing", async (name) => {
    await expectRejected({ ...valid, name }, "Add the venue name before completing the review.");
  });

  it.each([
    ["name", { name: "M".repeat(121) }, "Keep the venue name to 120 characters or fewer."],
    ["address", { address: "a".repeat(201) }, "Keep the address to 200 characters or fewer."],
    ["area", { area: "a".repeat(101) }, "Keep the area to 100 characters or fewer."],
  ])("rejects a too-long %s", async (_field, overrides, error) => {
    await expectRejected({ ...valid, ...overrides }, error);
  });

  it("rejects a too-long review note", async () => {
    await expectRejected(valid, "Keep the review note to 1000 characters or fewer.", "n".repeat(1001));
  });

  it("rejects an unknown venue type", async () => {
    await expectRejected({ ...valid, category: "spaceship" }, "Choose a valid venue type.");
  });

  it.each([-1, 3000, Number.NaN, Number.POSITIVE_INFINITY])("rejects the budget %s", async (value) => {
    await expectRejected({ ...valid, expectedSpendMin: value }, "Enter a valid per-person budget.");
    await expectRejected({ ...valid, expectedSpendMax: value }, "Enter a valid per-person budget.");
  });

  it.each(["abc", "25"])("rejects the string budget %j", async (value) => {
    await expectRejected({ ...valid, expectedSpendMin: value }, "Enter a valid per-person budget.");
    await expectRejected({ ...valid, expectedSpendMax: value }, "Enter a valid per-person budget.");
  });

  it("rejects null details without throwing", async () => {
    const { repos, userId } = await setup();
    const submission = await queueSubmission(repos, userId);
    expect(await completeVenueLinkReviewAction(submission.id, null as unknown as VenueReviewDetails, null)).toMatchObject({ ok: false });
    expect((await repos.venueLinkSubmissions.findById(submission.id))?.status).toBe("pending");
    expect((await repos.places.listByUser(userId)).map((p) => p.name)).toEqual(["Status Taverna"]);
  });

  it("accepts every field at its limit", async () => {
    const { repos, userId } = await setup();
    const submission = await queueSubmission(repos, userId);
    const name = "M".repeat(120);
    const address = "a".repeat(200);
    const area = "b".repeat(100);
    const result = await completeVenueLinkReviewAction(
      submission.id,
      { ...valid, name, address, area, expectedSpendMin: 0, expectedSpendMax: 2000 },
      null,
    );
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("Expected completion");
    expect(await repos.places.findById(userId, result.placeId)).toMatchObject({
      name,
      address,
      area,
      expectedSpendMin: 0,
      expectedSpendMax: 2000,
    });
  });

  it("stores whitespace-only address, area and review note as null", async () => {
    const { repos, userId } = await setup();
    const submission = await queueSubmission(repos, userId);
    const result = await completeVenueLinkReviewAction(submission.id, { ...valid, address: "   ", area: " \t " }, "   ");
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("Expected completion");
    expect(await repos.places.findById(userId, result.placeId)).toMatchObject({ address: null, area: null });
    expect(await repos.venueLinkSubmissions.findById(submission.id)).toMatchObject({ status: "completed", reviewNote: null });
  });

  it("rejects a cuisine outside the owner's catalogue", async () => {
    await expectRejected(
      { ...valid, cuisines: ["Martian"] },
      "Martian is not in your cuisine catalogue. Add it from the cuisine picker first.",
    );
  });

  it("rejects more than 12 cuisines", async () => {
    await expectRejected({ ...valid, cuisines: Array.from({ length: 13 }, (_, i) => `Cuisine ${i}`) }, "Choose up to 12 cuisines.");
  });

  it("rejects malformed cuisines", async () => {
    await expectRejected({ ...valid, cuisines: "Greek" }, "Choose valid cuisines.");
    await expectRejected({ ...valid, cuisines: ["c".repeat(51)] }, "Keep each cuisine to 50 characters or fewer.");
  });
});

describe("reviewVenueLinkAction", () => {
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

  it("rejects a review note over 1000 characters and leaves the submission unchanged", async () => {
    const { repos, userId } = await setup();
    const submission = await queueSubmission(repos, userId);
    expect(await reviewVenueLinkAction(submission.id, "in_review", "n".repeat(1001))).toEqual({
      ok: false,
      error: "Keep the review note to 1000 characters or fewer.",
    });
    expect(await repos.venueLinkSubmissions.findById(submission.id)).toMatchObject({ status: "pending", reviewNote: null });
  });

  it("accepts a 1000-character note", async () => {
    const { repos, userId } = await setup();
    const submission = await queueSubmission(repos, userId);
    expect(await reviewVenueLinkAction(submission.id, "in_review", "n".repeat(1000))).toEqual({ ok: true });
    expect(await repos.venueLinkSubmissions.findById(submission.id)).toMatchObject({ status: "in_review", reviewNote: "n".repeat(1000) });
  });
});
