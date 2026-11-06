import { describe, expect, it } from "vitest";
import { createManualPlace } from "@/lib/services/places";
import { addCircleMember, createSharedCircle } from "@/lib/services/circles";
import { listVenueLinkSubmissions, reviewVenueLink } from "@/lib/services/venue-link-submissions";
import { completeVenueReview } from "@/lib/services/venue-review";
import { createSecondUser, createTestContext } from "./helpers";

describe("venue-link submission repository", () => {
  it("queues a link with extracted coordinates and records its review", async () => {
    const { repos, userId } = await createTestContext();
    const reviewerId = await createSecondUser(repos, "reviewer@example.com");

    await repos.venueLinkSubmissions.create({
      userId,
      googleMapsUrl: "https://www.google.com/maps/place/Example/@35.1707054,33.3761561,17z",
      note: "Worth checking out",
      latitude: 35.1707054,
      longitude: 33.3761561,
    });

    const [queued] = await repos.venueLinkSubmissions.listAll();
    expect(queued).toMatchObject({
      submitterName: "Test Diner",
      status: "pending",
      note: "Worth checking out",
      latitude: 35.1707054,
      longitude: 33.3761561,
    });

    await repos.venueLinkSubmissions.update(queued.id, reviewerId, {
      status: "completed",
      reviewNote: "Added to the venue list",
    });

    const [reviewed] = await repos.venueLinkSubmissions.listAll();
    expect(reviewed).toMatchObject({
      status: "completed",
      reviewNote: "Added to the venue list",
      reviewedBy: reviewerId,
    });
    expect(reviewed.reviewedAt).toBeTruthy();
  });

  it("shares queues with circle members and fills only missing venue details", async () => {
    const { repos, userId } = await createTestContext();
    const reviewerId = await createSecondUser(repos, "reviewer@example.com");
    const circleId = await createSharedCircle(userId, "Food friends", repos);
    await addCircleMember(userId, circleId, "reviewer@example.com", repos);
    const link = "https://www.google.com/maps/place/Example/@35.1707054,33.3761561,17z";

    const existing = await createManualPlace(userId, {
      name: "Original venue",
      category: "restaurant",
      googleMapsUrl: link,
      expectedSpendMin: 20,
      expectedSpendMax: 25,
      note: "Owner's note",
    }, repos);
    if (existing.status !== "created") throw new Error("Expected a venue");
    await repos.venueLinkSubmissions.create({
      userId,
      googleMapsUrl: link,
      note: "Queue note",
      latitude: 35.1707054,
      longitude: 33.3761561,
    });

    const [queued] = await listVenueLinkSubmissions(reviewerId, repos);
    expect(queued.userId).toBe(userId);
    expect((await reviewVenueLink(queued.id, reviewerId, "in_review", null, repos)).status).toBe("updated");

    const result = await completeVenueReview(reviewerId, queued.id, {
      name: "Suggested venue",
      category: "cafe",
      cuisines: ["Coffee"],
      address: "1 Review Street",
      area: null,
      expectedSpendMin: 10,
      expectedSpendMax: 15,
    }, "Checked it", repos);
    expect(result.status).toBe("completed");
    if (result.status !== "completed") throw new Error("Expected completion");
    expect(result.contradictions.map((item) => item.field)).toEqual(expect.arrayContaining(["name", "category", "budget", "note"]));

    const updated = await repos.places.findById(userId, existing.place.id);
    expect(updated).toMatchObject({
      name: "Original venue",
      expectedSpendMin: 20,
      expectedSpendMax: 25,
      note: "Owner's note",
      address: "1 Review Street",
    });
  });
});
