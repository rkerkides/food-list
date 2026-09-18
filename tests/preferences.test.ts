import { describe, expect, it } from "vitest";
import {
  buildUserPreferences,
  confidenceFor,
  matchesPreferenceKeyword,
  placeAffinityScore,
} from "@/lib/domain/preferences";
import { makeItem, makePlace, makeVisit } from "./fixtures";

describe("taste profile", () => {
  it("down-weights small samples instead of overreacting", () => {
    expect(confidenceFor(1)).toBeCloseTo(0.333, 2);
    expect(confidenceFor(4)).toBeCloseTo(0.667, 2);
    expect(confidenceFor(0)).toBe(0);
    expect(confidenceFor(10)).toBeGreaterThan(0.8);
  });

  it("does not claim a favourite cuisine from a single visit", () => {
    const place = makePlace({ id: "p1", cuisines: ["Japanese"] });
    const visits = [makeVisit({ placeId: "p1", rating: 5 })];
    const prefs = buildUserPreferences([place], visits, []);

    expect(prefs.cuisineAffinity.japanese.count).toBe(1);
    expect(prefs.favouriteCuisines).not.toContain("japanese");
  });

  it("builds cuisine, category and dish affinities from history", () => {
    const places = [
      makePlace({ id: "p1", cuisines: ["Japanese"], category: "restaurant" }),
      makePlace({ id: "p2", cuisines: ["Japanese"], category: "restaurant" }),
      makePlace({ id: "p3", cuisines: ["Italian"], category: "cafe" }),
      makePlace({ id: "p4", cuisines: ["Italian"], category: "cafe" }),
    ];
    const visits = [
      makeVisit({ id: "v1", placeId: "p1", rating: 5, spendPerPerson: 30 }),
      makeVisit({ id: "v2", placeId: "p2", rating: 4.5, spendPerPerson: 28 }),
      makeVisit({ id: "v3", placeId: "p3", rating: 3, spendPerPerson: 18 }),
      makeVisit({ id: "v4", placeId: "p4", rating: 2.5, spendPerPerson: 16 }),
    ];
    const items = [
      makeItem({ id: "i1", placeId: "p1", visitId: "v1", name: "Otoro nigiri", rating: 5 }),
      makeItem({ id: "i2", placeId: "p2", visitId: "v2", name: "Otoro nigiri", rating: 4.5 }),
    ];

    const prefs = buildUserPreferences(places, visits, items);

    expect(prefs.favouriteCuisines[0]).toBe("japanese");
    expect(prefs.underratedCategories).toContain("cafe");
    expect(prefs.favouriteFoodItems).toContain("otoro nigiri");
    expect(prefs.averagePersonalRating).toBeCloseTo(3.75, 2);
    expect(prefs.medianSpend).toBe(23);
    expect(prefs.visitCount).toBe(4);
  });

  it("scores affinity higher for cuisines with better history", () => {
    const places = [
      makePlace({ id: "p1", cuisines: ["Japanese"] }),
      makePlace({ id: "p2", cuisines: ["Italian"] }),
      makePlace({ id: "p3", cuisines: ["Italian"] }),
    ];
    const visits = [
      makeVisit({ id: "v1", placeId: "p1", rating: 5 }),
      makeVisit({ id: "v2", placeId: "p1", rating: 5 }),
      makeVisit({ id: "v3", placeId: "p2", rating: 2 }),
      makeVisit({ id: "v4", placeId: "p3", rating: 2 }),
    ];
    const prefs = buildUserPreferences(places, visits, []);

    const japanese = makePlace({ id: "new-jp", cuisines: ["Japanese"] });
    const italian = makePlace({ id: "new-it", cuisines: ["Italian"] });

    expect(placeAffinityScore(japanese, prefs)).toBeGreaterThan(placeAffinityScore(italian, prefs));
  });

  it("matches a dish keyword against history", () => {
    const place = makePlace({ id: "p1" });
    const visit = makeVisit({ id: "v1", placeId: "p1", rating: 5 });
    const item = makeItem({ placeId: "p1", visitId: "v1", name: "Pistachio croissant", rating: 5 });
    const prefs = buildUserPreferences([place], [visit], [item]);

    expect(matchesPreferenceKeyword("croissant", prefs)?.average).toBe(5);
    expect(matchesPreferenceKeyword("caviar", prefs)).toBeNull();
  });
});
