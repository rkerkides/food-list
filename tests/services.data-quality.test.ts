import { describe, expect, it } from "vitest";
import { assessPlaceDataQuality } from "@/lib/services/data-quality";
import { createManualPlace } from "@/lib/services/places";
import { createTestContext } from "./helpers";

describe("data quality", () => {
  it("reports the core fields needed for a useful place card", async () => {
    const { repos, userId } = await createTestContext();
    const created = await createManualPlace(userId, { name: "Unfinished", category: "other" }, repos);
    if (created.status !== "created") throw new Error("expected creation");

    const entry = assessPlaceDataQuality({
      ...created.place,
      stats: {
        visitCount: 0,
        lastVisitedAt: null,
        firstVisitedAt: null,
        personalRating: null,
        observedSpendMedian: null,
        observedSpendMin: null,
        observedSpendMax: null,
        highlightCount: 0,
        foodItemCount: 0,
        topFoodItems: [],
        wouldReturnRate: null,
      },
    });

    expect(entry.isComplete).toBe(false);
    expect(entry.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["publicRating", "publicRatingCount", "budget", "cuisines", "category", "photo"]),
    );
  });

  it("accepts a fully enriched venue", async () => {
    const { repos, userId } = await createTestContext();
    const created = await createManualPlace(userId, { name: "Ready", category: "restaurant" }, repos);
    if (created.status !== "created") throw new Error("expected creation");

    const entry = assessPlaceDataQuality({
      ...created.place,
      category: "restaurant",
      cuisines: ["Cypriot"],
      publicRating: 4.5,
      publicRatingCount: 100,
      expectedSpendMin: 20,
      expectedSpendMax: 35,
      budgetSource: "manual",
      photoRef: "stock:cypriot",
      address: "1 Example Street, Nicosia",
      latitude: 35.17,
      longitude: 33.36,
      stats: {
        visitCount: 0,
        lastVisitedAt: null,
        firstVisitedAt: null,
        personalRating: null,
        observedSpendMedian: null,
        observedSpendMin: null,
        observedSpendMax: null,
        highlightCount: 0,
        foodItemCount: 0,
        topFoodItems: [],
        wouldReturnRate: null,
      },
    });

    expect(entry.isComplete).toBe(true);
    expect(entry.issues).toEqual([]);
  });
});
