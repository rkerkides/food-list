import { describe, expect, it } from "vitest";
import type { Repositories } from "@/lib/data/repositories";
import { addCircleMember, createSharedCircle } from "@/lib/services/circles";
import { addCuisineToCatalog } from "@/lib/services/cuisines";
import { createManualPlace } from "@/lib/services/places";
import { completeVenueReview, type VenueReviewDetails } from "@/lib/services/venue-review";
import { createSecondUser, createTestContext } from "./helpers";

const LINK = "https://www.google.com/maps/place/Example/@35.17,33.37,17z";

const details = (overrides: Partial<VenueReviewDetails> = {}): VenueReviewDetails => ({
  name: "Meze House",
  category: "restaurant",
  cuisines: [],
  address: null,
  area: null,
  expectedSpendMin: null,
  expectedSpendMax: null,
  ...overrides,
});

async function queueSubmission(repos: Repositories, userId: string) {
  await repos.venueLinkSubmissions.create({ userId, googleMapsUrl: LINK, note: null, latitude: 35.17, longitude: 33.37 });
  const [submission] = await repos.venueLinkSubmissions.listAll();
  return submission;
}

async function withCircleReviewer() {
  const ctx = await createTestContext("owner@example.com");
  const reviewerId = await createSecondUser(ctx.repos, "reviewer@example.com");
  const circleId = await createSharedCircle(ctx.userId, "Food friends", ctx.repos);
  await addCircleMember(ctx.userId, circleId, "reviewer@example.com", ctx.repos);
  return { ...ctx, reviewerId };
}

describe("completeVenueReview cuisine validation", () => {
  it("rejects a cuisine outside the owner's catalogue and writes nothing", async () => {
    const { repos, userId } = await createTestContext();
    const submission = await queueSubmission(repos, userId);

    const result = await completeVenueReview(userId, submission.id, details({ cuisines: ["Martian"] }), null, repos);

    expect(result).toEqual({
      status: "invalid_cuisines",
      error: "Martian is not in your cuisine catalogue. Add it from the cuisine picker first.",
    });
    expect((await repos.venueLinkSubmissions.findById(submission.id))?.status).toBe("pending");
    expect(await repos.places.listByUser(userId)).toEqual([]);
  });

  it("checks permission before cuisines for a reviewer outside the owner's circles", async () => {
    const { repos, userId } = await createTestContext("owner@example.com");
    const strangerId = await createSecondUser(repos, "stranger@example.com");
    const submission = await queueSubmission(repos, userId);

    const result = await completeVenueReview(strangerId, submission.id, details({ cuisines: ["Martian"] }), null, repos);

    expect(result).toEqual({ status: "forbidden" });
    expect((await repos.venueLinkSubmissions.findById(submission.id))?.status).toBe("pending");
    expect(await repos.places.listByUser(userId)).toEqual([]);
  });

  it("rejects an unknown cuisine before merging into an existing place", async () => {
    const { repos, userId } = await createTestContext();
    const existing = await createManualPlace(userId, { name: "Meze House", category: "restaurant", googleMapsUrl: LINK }, repos);
    if (existing.status !== "created") throw new Error("Expected a place");
    const submission = await queueSubmission(repos, userId);

    const result = await completeVenueReview(userId, submission.id, details({ cuisines: ["Martian"] }), null, repos);

    expect(result.status).toBe("invalid_cuisines");
    expect((await repos.venueLinkSubmissions.findById(submission.id))?.status).toBe("pending");
    expect((await repos.places.findById(userId, existing.place.id))?.cuisines).toEqual([]);
  });

  it("accepts the owner's custom cuisine when a circle member reviews", async () => {
    const { repos, userId, reviewerId } = await withCircleReviewer();
    await addCuisineToCatalog(userId, "Martian Fusion", repos);
    const submission = await queueSubmission(repos, userId);

    const result = await completeVenueReview(reviewerId, submission.id, details({ cuisines: ["martian fusion"] }), null, repos);

    expect(result.status).toBe("completed");
    if (result.status !== "completed") throw new Error("Expected completion");
    expect((await repos.places.findById(userId, result.placeId))?.cuisines).toEqual(["Martian Fusion"]);
  });

  it("checks the owner's catalogue, not the reviewer's", async () => {
    const { repos, userId, reviewerId } = await withCircleReviewer();
    await addCuisineToCatalog(reviewerId, "Martian Fusion", repos);
    const submission = await queueSubmission(repos, userId);

    const result = await completeVenueReview(reviewerId, submission.id, details({ cuisines: ["Martian Fusion"] }), null, repos);

    expect(result.status).toBe("invalid_cuisines");
    expect((await repos.venueLinkSubmissions.findById(submission.id))?.status).toBe("pending");
  });

  it("stores normalised cuisine names on a new place", async () => {
    const { repos, userId } = await createTestContext();
    const submission = await queueSubmission(repos, userId);

    const result = await completeVenueReview(userId, submission.id, details({ cuisines: ["  greek ", "BBQ", "Greek"] }), null, repos);

    if (result.status !== "completed") throw new Error("Expected completion");
    expect((await repos.places.findById(userId, result.placeId))?.cuisines).toEqual(["Greek", "American Barbecue"]);
  });

  it("merges normalised cuisine names into an existing place", async () => {
    const { repos, userId } = await createTestContext();
    const existing = await createManualPlace(userId, { name: "Meze House", category: "restaurant", googleMapsUrl: LINK }, repos);
    if (existing.status !== "created") throw new Error("Expected a place");
    const submission = await queueSubmission(repos, userId);

    const result = await completeVenueReview(userId, submission.id, details({ cuisines: ["cypriot", "burgers"] }), null, repos);

    expect(result).toMatchObject({ status: "completed", placeId: existing.place.id });
    expect((await repos.places.findById(userId, existing.place.id))?.cuisines).toEqual(["Cypriot", "Burger"]);
  });
});
