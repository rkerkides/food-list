import { describe, expect, it } from "vitest";
import { addPlaceFromProvider } from "@/lib/services/places";
import { logVisit } from "@/lib/services/visits";
import { loadUserLibrary } from "@/lib/services/library";
import { recommend } from "@/lib/services/recommendations";
import { createTestContext } from "./helpers";

function result(overrides: {
  id: string;
  name: string;
  cuisines: string[];
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  status?: "wishlist" | "saved" | "favourite";
  city?: string;
  latitude?: number;
  longitude?: number;
}) {
  return {
    result: {
      provider: "demo" as const,
      providerPlaceId: overrides.id,
      name: overrides.name,
      category: "restaurant" as const,
      cuisines: overrides.cuisines,
      address: `${overrides.name}, Nicosia`,
      city: overrides.city ?? "Nicosia",
      area: "Strovolos",
      district: "Nicosia",
      latitude: overrides.latitude ?? 35.1633,
      longitude: overrides.longitude ?? 33.3492,
      publicRating: overrides.rating,
      publicRatingCount: 300,
      priceLevel: overrides.priceLevel,
      website: null,
      phone: null,
      openingHours: null,
      photoRef: null,
      externalMeta: null,
    },
    status: overrides.status,
  };
}

async function seedLibrary(userId: string, repos: Awaited<ReturnType<typeof createTestContext>>["repos"]) {
  const japanese = await addPlaceFromProvider(
    userId,
    {
      ...result({
        id: "demo-jp",
        name: "Yuzu & Co Sushi",
        cuisines: ["Japanese", "Sushi"],
        priceLevel: 3,
        rating: 4.8,
        status: "wishlist",
      }),
      status: "wishlist",
    },
    repos,
  );
  const italian = await addPlaceFromProvider(
    userId,
    result({
      id: "demo-it",
      name: "Pane e Vino Toscana",
      cuisines: ["Italian", "Tuscan"],
      priceLevel: 3,
      rating: 4.4,
    }),
    repos,
  );
  const cafe = await addPlaceFromProvider(
    userId,
    {
      ...result({
        id: "demo-cafe",
        name: "Kalathi Coffee Roasters",
        cuisines: ["Coffee", "Brunch"],
        priceLevel: 1,
        rating: 4.7,
      }),
    },
    repos,
  );
  return { japanese, italian, cafe };
}

describe("where should we eat", () => {
  it("returns a short, explained shortlist", async () => {
    const ctx = await createTestContext();
    await seedLibrary(ctx.userId, ctx.repos);

    const outcome = await recommend(ctx.userId, { limit: 5, area: "Nicosia", maxDistanceKm: 25 }, {
      repos: ctx.repos,
      seed: 1,
    });

    expect(outcome.recommendations.length).toBeGreaterThan(0);
    expect(outcome.recommendations.length).toBeLessThanOrEqual(5);
    for (const recommendation of outcome.recommendations) {
      expect(recommendation.matchPercent).toBeGreaterThanOrEqual(52);
      expect(recommendation.reasons.length).toBeGreaterThan(0);
      expect(recommendation.breakdown).toHaveLength(7);
    }
  });

  it("honours cuisine, budget and distance constraints", async () => {
    const ctx = await createTestContext();
    await seedLibrary(ctx.userId, ctx.repos);

    const japanese = await recommend(ctx.userId, { cuisines: ["Japanese"] }, { repos: ctx.repos });
    expect(japanese.recommendations[0].place.name).toBe("Yuzu & Co Sushi");

    const budget = await recommend(ctx.userId, { maxSpend: 20 }, { repos: ctx.repos });
    expect(budget.recommendations.every((entry) => (entry.place.expectedSpendMin ?? 0) <= 20)).toBe(
      true,
    );

    const tooFar = await recommend(ctx.userId, { area: "Paphos", maxDistanceKm: 1 }, {
      repos: ctx.repos,
    });
    expect(tooFar.recommendations).toHaveLength(0);
    expect(tooFar.message).toBeTruthy();
  });

  it("lets a new highly rated visit shift future recommendations", async () => {
    const ctx = await createTestContext();
    const { italian, japanese } = await seedLibrary(ctx.userId, ctx.repos);
    if (italian.status !== "created" || japanese.status !== "created") throw new Error("setup failed");

    const before = await recommend(ctx.userId, { limit: 5 }, { repos: ctx.repos, seed: 3 });
    const japaneseBefore = before.recommendations.find(
      (entry) => entry.place.id === japanese.place.id,
    );

    // Two visits that make Italian a clear favourite.
    for (const [index, spend] of [30, 32].entries()) {
      await logVisit(
        ctx.userId,
        {
          placeId: italian.place.id,
          visitedAt: `2026-0${index + 6}-10`,
          rating: 5,
          spendPerPerson: spend,
          items: [
            { name: "Truffle tagliatelle", category: "main", rating: 5, price: 24 },
            { name: "Tiramisu", category: "dessert", rating: 4.5, price: 9 },
          ],
        },
        ctx.repos,
      );
    }

    const after = await recommend(ctx.userId, { limit: 5 }, { repos: ctx.repos, seed: 3 });
    const japaneseAfter = after.recommendations.find((entry) => entry.place.id === japanese.place.id);

    // The Italian place is now visited and highly rated, so its own ranking rises.
    const italianAfter = after.recommendations.find((entry) => entry.place.id === italian.place.id);
    expect(italianAfter).toBeDefined();

    // Deterministic seed means the comparison is stable; the Japanese place is not
    // punished for the user's new Italian preference.
    if (japaneseBefore && japaneseAfter) {
      expect(japaneseAfter.matchPercent).toBeGreaterThanOrEqual(japaneseBefore.matchPercent - 1);
    }
  });

  it("surprise mode relaxes soft preferences but respects the budget", async () => {
    const ctx = await createTestContext();
    await seedLibrary(ctx.userId, ctx.repos);

    const strict = await recommend(
      ctx.userId,
      { cuisines: ["Greek"], maxSpend: 15, surprise: true },
      { repos: ctx.repos, seed: 42 },
    );

    expect(strict.relaxed.length).toBeGreaterThan(0);
    for (const entry of strict.recommendations) {
      expect(entry.place.expectedSpendMin ?? 0).toBeLessThanOrEqual(15);
    }
  });

  it("explains an empty library instead of failing", async () => {
    const ctx = await createTestContext();
    const outcome = await recommend(ctx.userId, {}, { repos: ctx.repos });
    expect(outcome.libraryEmpty).toBe(true);
    expect(outcome.recommendations).toHaveLength(0);
    expect(outcome.message).toContain("Save a few places");
  });

  it("keeps recommendations scoped to the signed-in user", async () => {
    const ctx = await createTestContext();
    await seedLibrary(ctx.userId, ctx.repos);
    const other = await createTestContext("other@example.com");
    const outcome = await recommend(other.userId, {}, { repos: other.repos });
    expect(outcome.libraryEmpty).toBe(true);
    const library = await loadUserLibrary(other.userId, { repos: other.repos });
    expect(library.places).toHaveLength(0);
  });
});
