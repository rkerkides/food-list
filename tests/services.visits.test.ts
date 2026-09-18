import { describe, expect, it } from "vitest";
import { addPlaceFromProvider } from "@/lib/services/places";
import { deleteVisit, logVisit, updateVisit } from "@/lib/services/visits";
import { createTestContext } from "./helpers";

const providerResult = {
  provider: "demo" as const,
  providerPlaceId: "demo-visits-01",
  name: "Kalathi Coffee Roasters",
  category: "cafe" as const,
  cuisines: ["Coffee", "Brunch"],
  address: "12 Pindarou Street, Nicosia",
  city: "Nicosia",
  area: "Engomi",
  district: "Nicosia",
  latitude: 35.1585,
  longitude: 33.3298,
  publicRating: 4.7,
  publicRatingCount: 260,
  priceLevel: 2,
  website: null,
  phone: null,
  openingHours: null,
  photoRef: null,
  externalMeta: null,
};

async function setup() {
  const ctx = await createTestContext();
  const created = await addPlaceFromProvider(ctx.userId, { result: providerResult }, ctx.repos);
  if (created.status !== "created") throw new Error("expected creation");
  return { ...ctx, placeId: created.place.id };
}

describe("visit logging", () => {
  it("stores a visit with its dishes atomically", async () => {
    const ctx = await setup();
    const visit = await logVisit(
      ctx.userId,
      {
        placeId: ctx.placeId,
        visitedAt: "2026-08-14",
        occasion: "work_lunch",
        partySize: 2,
        rating: 4.5,
        thoughts: "Quiet enough to work.",
        spendPerPerson: 12,
        wouldReturn: true,
        tags: ["work lunch"],
        items: [
          { name: "Pistachio croissant", category: "breakfast", rating: 5, price: 4 },
          { name: "Flat white", category: "coffee", rating: 4, price: 3.5, isHighlight: false },
        ],
      },
      ctx.repos,
    );

    expect(visit.items).toHaveLength(2);
    expect(visit.items[0].isHighlight).toBe(true); // auto-highlight for 5★
    expect(visit.items[1].isHighlight).toBe(false);
    expect(visit.visitedAt).toContain("2026-08-14");

    const stored = await ctx.repos.foodItems.listByVisit(ctx.userId, visit.id);
    expect(stored).toHaveLength(2);
  });

  it("replaces dishes when a visit is edited", async () => {
    const ctx = await setup();
    const visit = await logVisit(
      ctx.userId,
      {
        placeId: ctx.placeId,
        visitedAt: "2026-08-01",
        rating: 4,
        items: [{ name: "Cappuccino", category: "coffee", rating: 4 }],
      },
      ctx.repos,
    );

    await updateVisit(
      ctx.userId,
      visit.id,
      {
        placeId: ctx.placeId,
        visitedAt: "2026-08-02",
        rating: 5,
        items: [
          { name: "Cappuccino", category: "coffee", rating: 4.5 },
          { name: "Almond croissant", category: "breakfast", rating: 5 },
        ],
      },
      ctx.repos,
    );

    const stored = await ctx.repos.foodItems.listByVisit(ctx.userId, visit.id);
    expect(stored.map((item) => item.name).sort()).toEqual(["Almond croissant", "Cappuccino"]);
  });

  it("deletes a visit and its dishes together", async () => {
    const ctx = await setup();
    const visit = await logVisit(
      ctx.userId,
      {
        placeId: ctx.placeId,
        visitedAt: "2026-07-01",
        items: [{ name: "Latte", category: "coffee", rating: 4 }],
      },
      ctx.repos,
    );

    await deleteVisit(ctx.userId, visit.id, ctx.repos);
    expect(await ctx.repos.visits.findById(ctx.userId, visit.id)).toBeNull();
    expect(await ctx.repos.foodItems.listByVisit(ctx.userId, visit.id)).toHaveLength(0);
  });

  it("refuses to log a visit for someone else's place", async () => {
    const ctx = await createTestContext();
    await expect(
      logVisit(
        ctx.userId,
        { placeId: "plc_missing", visitedAt: "2026-08-01", items: [] },
        ctx.repos,
      ),
    ).rejects.toThrow();
  });
});
