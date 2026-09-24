import { describe, expect, it } from "vitest";
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
});
