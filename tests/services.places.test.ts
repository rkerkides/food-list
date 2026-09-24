import { describe, expect, it } from "vitest";
import {
  addPlaceFromProvider,
  createManualPlace,
  refreshPlace,
  updatePlace,
} from "@/lib/services/places";
import { logVisit } from "@/lib/services/visits";
import { loadUserLibrary } from "@/lib/services/library";
import { resolveBudget } from "@/lib/domain/budget";
import { createSecondUser, createTestContext } from "./helpers";
import { DEMO_PLACES } from "@/lib/places";

const realDemoPlace = DEMO_PLACES.find((place) => place.name === "Tocayo Cocina")!;

const providerResult = {
  provider: "demo" as const,
  providerPlaceId: realDemoPlace.providerPlaceId,
  name: "Tocayo Cocina",
  category: "restaurant" as const,
  cuisines: ["Asian fusion"],
  address: "28A Stasikratous Street, Nicosia",
  city: "Nicosia",
  area: "Strovolos",
  district: "Nicosia",
  latitude: 35.1633,
  longitude: 33.3492,
  publicRating: 4.6,
  publicRatingCount: 410,
  priceLevel: 3,
  website: null,
  phone: null,
  openingHours: null,
  photoRef: null,
  externalMeta: realDemoPlace.externalMeta,
};

describe("place management", () => {
  it("saves a provider result with derived budget and external facts", async () => {
    const { repos, userId } = await createTestContext();
    const outcome = await addPlaceFromProvider(userId, { result: providerResult }, repos);

    expect(outcome.status).toBe("created");
    if (outcome.status !== "created") throw new Error("expected creation");

    expect(outcome.place.name).toBe("Tocayo Cocina");
    expect(outcome.place.publicRating).toBe(4.6);
    expect(outcome.place.expectedSpendMin).toBe(25);
    expect(outcome.place.budgetSource).toBe("provider_price_range");
    expect(outcome.place.externalFetchedAt).not.toBeNull();
  });

  it("prevents accidental duplicates but allows an explicit override", async () => {
    const { repos, userId } = await createTestContext();
    await addPlaceFromProvider(userId, { result: providerResult }, repos);

    const again = await addPlaceFromProvider(userId, { result: providerResult }, repos);
    expect(again.status).toBe("already_saved");

    const sameNameDifferentId = await addPlaceFromProvider(
      userId,
      { result: { ...providerResult, providerPlaceId: "demo-tocayo-copy" } },
      repos,
    );
    expect(sameNameDifferentId.status).toBe("duplicate");

    const forced = await addPlaceFromProvider(
      userId,
      { result: { ...providerResult, providerPlaceId: "demo-tocayo-copy" }, force: true },
      repos,
    );
    expect(forced.status).toBe("created");
    expect(await repos.places.countByUser(userId)).toBe(2);
  });

  it("scopes places per user", async () => {
    const { repos, userId } = await createTestContext();
    const otherUserId = await createSecondUser(repos);

    await addPlaceFromProvider(userId, { result: providerResult }, repos);
    const otherOutcome = await addPlaceFromProvider(otherUserId, { result: providerResult }, repos);

    expect(otherOutcome.status).toBe("created");
    expect(await repos.places.countByUser(otherUserId)).toBe(1);
    expect(await repos.places.countByUser(userId)).toBe(1);
  });

  it("creates manual places without provider data", async () => {
    const { repos, userId } = await createTestContext();
    const outcome = await createManualPlace(
      userId,
      {
        name: "Yiayia's Kitchen",
        category: "restaurant",
        city: "Nicosia",
        area: "Kaimakli",
        expectedSpendMin: 12,
        expectedSpendMax: 18,
      },
      repos,
    );

    expect(outcome.status).toBe("created");
    if (outcome.status !== "created") throw new Error("expected creation");
    expect(outcome.place.provider).toBe("manual");
    expect(outcome.place.budgetSource).toBe("manual");
    expect(outcome.place.overrides).toContain("name");
  });

  it("keeps a Google Maps link and derives coordinates for a manual place", async () => {
    const { repos, userId } = await createTestContext();
    const googleMapsUrl =
      "https://www.google.com/maps/place/KONA+KAI/@35.1707098,33.3735758,17z/data=!3m1!4b1!4m6!3m5!1s0x14de19dc2253f107:0xa552f54e2c512746!8m2!3d35.1707054!4d33.3761561";
    const outcome = await createManualPlace(
      userId,
      { name: "KONA KAI", category: "restaurant", googleMapsUrl },
      repos,
    );

    expect(outcome.status).toBe("created");
    if (outcome.status !== "created") throw new Error("expected creation");
    expect(outcome.place.googleMapsUrl).toBe(googleMapsUrl);
    expect(outcome.place.latitude).toBeCloseTo(35.1707054);
    expect(outcome.place.longitude).toBeCloseTo(33.3761561);
    expect(outcome.place.overrides).toContain("googleMapsUrl");
  });

  it("keeps user edits when external data is refreshed", async () => {
    const { repos, userId } = await createTestContext();
    const created = await addPlaceFromProvider(userId, { result: providerResult }, repos);
    if (created.status !== "created") throw new Error("expected creation");

    await updatePlace(
      userId,
      created.place.id,
      {
        name: "Tocayo (the good one)",
        cuisines: ["Asian"],
        expectedSpendMin: 18,
        expectedSpendMax: 24,
      },
      repos,
    );

    const refreshed = await refreshPlace(userId, created.place.id, repos);
    expect(refreshed.status === "updated" || refreshed.status === "unchanged").toBe(true);
    expect(refreshed.place!.name).toBe("Tocayo (the good one)");
    expect(refreshed.place!.cuisines).toEqual(["Asian"]);
    expect(refreshed.place!.expectedSpendMin).toBe(18);
    expect(refreshed.place!.budgetSource).toBe("manual");
    expect(refreshed.preserved).toContain("name");
  });

  it("keeps manually completed public facts and map coordinates on refresh", async () => {
    const { repos, userId } = await createTestContext();
    const created = await addPlaceFromProvider(userId, { result: providerResult }, repos);
    if (created.status !== "created") throw new Error("expected creation");

    await updatePlace(
      userId,
      created.place.id,
      {
        publicRating: 4.8,
        publicRatingCount: 999,
        latitude: 35.17,
        longitude: 33.36,
      },
      repos,
    );

    const refreshed = await refreshPlace(userId, created.place.id, repos);
    expect(refreshed.place!.publicRating).toBe(4.8);
    expect(refreshed.place!.publicRatingCount).toBe(999);
    expect(refreshed.place!.latitude).toBe(35.17);
    expect(refreshed.place!.longitude).toBe(33.36);
    expect(refreshed.preserved).toEqual(
      expect.arrayContaining(["publicRating", "publicRatingCount", "latitude", "longitude"]),
    );
  });

  it("records a refresh log entry", async () => {
    const { repos, userId } = await createTestContext();
    const created = await addPlaceFromProvider(userId, { result: providerResult }, repos);
    if (created.status !== "created") throw new Error("expected creation");

    await refreshPlace(userId, created.place.id, repos);
    const log = await repos.refreshes.listByPlace(userId, created.place.id);
    expect(log).toHaveLength(1);
    expect(log[0].source).toBe("demo");
  });

  it("keeps public ratings separate from personal ratings", async () => {
    const { repos, userId } = await createTestContext();
    const created = await addPlaceFromProvider(userId, { result: providerResult }, repos);
    if (created.status !== "created") throw new Error("expected creation");

    await logVisit(
      userId,
      {
        placeId: created.place.id,
        visitedAt: "2026-08-01",
        rating: 5,
        spendPerPerson: 30,
        items: [],
      },
      repos,
    );

    const library = await loadUserLibrary(userId, { repos });
    const place = library.places.find((entry) => entry.id === created.place.id)!;

    expect(place.publicRating).toBe(4.6);
    expect(place.stats.personalRating).toBe(5);
  });

  it("improves the budget estimate from recorded spending", async () => {
    const { repos, userId } = await createTestContext();
    const created = await addPlaceFromProvider(
      userId,
      {
        result: {
          ...providerResult,
          providerPlaceId: "demo-budget",
          priceLevel: 2,
          externalMeta: null,
        },
      },
      repos,
    );
    if (created.status !== "created") throw new Error("expected creation");

    for (const [index, spend] of [18, 22, 20].entries()) {
      await logVisit(
        userId,
        {
          placeId: created.place.id,
          visitedAt: `2026-0${index + 1}-10`,
          rating: 4,
          spendPerPerson: spend,
          items: [],
        },
        repos,
      );
    }

    const library = await loadUserLibrary(userId, { repos });
    const place = library.places.find((entry) => entry.id === created.place.id)!;
    const budget = resolveBudget(place, library.visits);

    expect(budget.source).toBe("visit_history");
    expect(budget.basedOnVisits).toBe(3);
    expect(budget.min).toBeLessThanOrEqual(20);
    expect(budget.max).toBeGreaterThanOrEqual(20);
  });
});
