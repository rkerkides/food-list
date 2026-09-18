import { describe, expect, it } from "vitest";
import { budgetFitScore, isWithinBudget, resolveBudget } from "@/lib/domain/budget";
import { buildUserPreferences } from "@/lib/domain/preferences";
import { preparePlace } from "@/lib/domain/place-view";
import { WEIGHTS, matchPercent, scoreCandidate } from "@/lib/domain/scoring";
import type { DecideQuery, FoodItem, PlaceWithStats, Visit } from "@/lib/domain/types";
import { makeItem, makePlace, makeVisit } from "./fixtures";

function prepared(
  placeOverrides: Partial<PlaceWithStats> = {},
  history: { visits?: Visit[]; items?: FoodItem[] } = {},
  options: { originArea?: string | null; now?: Date } = {},
) {
  const place = makePlace(placeOverrides, history);
  const preferences = buildUserPreferences(
    [place],
    history.visits ?? [],
    history.items ?? [],
  );
  return { prepared: preparePlace(place, { visits: history.visits ?? [], items: history.items ?? [] }, preferences, options), preferences };
}

describe("recommendation scoring", () => {
  it("uses weights that add up to 1", () => {
    const total = Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("scores a cheaper place better than an expensive one under a budget cap", () => {
    const cheap = prepared({ id: "cheap", priceLevel: 1, expectedSpendMin: 8, expectedSpendMax: 14 });
    const pricey = prepared({ id: "pricey", priceLevel: 4, expectedSpendMin: 50, expectedSpendMax: 70 });
    const query: DecideQuery = { maxSpend: 25 };

    const cheapScore = scoreCandidate({
      prepared: cheap.prepared,
      query,
      preferences: cheap.preferences,
    });
    const priceyScore = scoreCandidate({
      prepared: pricey.prepared,
      query,
      preferences: pricey.preferences,
    });

    const cheapBudget = cheapScore.breakdown.find((part) => part.key === "budget")!;
    const priceyBudget = priceyScore.breakdown.find((part) => part.key === "budget")!;
    expect(cheapBudget.value).toBeGreaterThan(priceyBudget.value);
    expect(cheapScore.score).toBeGreaterThan(priceyScore.score);
  });

  it("prefers a closer place when the user gives their area", () => {
    const near = prepared({ id: "near", latitude: 35.166, longitude: 33.35 });
    const far = prepared({ id: "far", latitude: 34.7071, longitude: 33.0226 });
    const query: DecideQuery = { area: "Nicosia", maxDistanceKm: 40 };

    const nearScore = scoreCandidate({ prepared: near.prepared, query, preferences: near.preferences });
    const farScore = scoreCandidate({ prepared: far.prepared, query, preferences: far.preferences });

    expect(near.prepared.distanceKm!).toBeLessThan(far.prepared.distanceKm!);
    expect(nearScore.score).toBeGreaterThan(farScore.score);
  });

  it("boosts places whose cuisine the user rates highly", () => {
    const japaneseVisits: Visit[] = [
      makeVisit({ id: "v1", placeId: "plcA", rating: 5, visitedAt: new Date("2026-01-10").toISOString() }),
      makeVisit({ id: "v2", placeId: "plcA", rating: 5, visitedAt: new Date("2026-02-10").toISOString() }),
      makeVisit({ id: "v3", placeId: "plcA", rating: 4.5, visitedAt: new Date("2026-03-10").toISOString() }),
    ];
    const italianVisits: Visit[] = [
      makeVisit({ id: "v4", placeId: "plcB", rating: 2, visitedAt: new Date("2026-01-12").toISOString() }),
      makeVisit({ id: "v5", placeId: "plcB", rating: 2.5, visitedAt: new Date("2026-02-12").toISOString() }),
      makeVisit({ id: "v6", placeId: "plcB", rating: 2, visitedAt: new Date("2026-03-12").toISOString() }),
    ];

    const historyPlaces = [
      makePlace({ id: "plcA", cuisines: ["Japanese"], category: "restaurant" }),
      makePlace({ id: "plcB", cuisines: ["Italian"], category: "restaurant" }),
    ];
    const allVisits = [...japaneseVisits, ...italianVisits];
    const preferences = buildUserPreferences(historyPlaces, allVisits, []);

    const japanese = preparePlace(
      makePlace({ id: "new-jp", cuisines: ["Japanese"] }),
      { visits: [], items: [] },
      preferences,
    );
    const italian = preparePlace(
      makePlace({ id: "new-it", cuisines: ["Italian"] }),
      { visits: [], items: [] },
      preferences,
    );

    expect(japanese.affinity).toBeGreaterThan(italian.affinity);

    const query: DecideQuery = {};
    const jpScore = scoreCandidate({ prepared: japanese, query, preferences });
    const itScore = scoreCandidate({ prepared: italian, query, preferences });
    expect(jpScore.score).toBeGreaterThan(itScore.score);
  });

  it("explains itself with human-readable reasons and bounded match percentages", () => {
    const visits = [makeVisit({ placeId: "plc_x", rating: 5, spendPerPerson: 24 })];
    const items = [makeItem({ placeId: "plc_x", visitId: visits[0].id, name: "Ribeye steak", rating: 5 })];
    const ctx = prepared({ id: "plc_x" }, { visits, items }, { originArea: "Nicosia" });

    const result = scoreCandidate({
      prepared: ctx.prepared,
      query: { area: "Nicosia", maxSpend: 30 },
      preferences: ctx.preferences,
    });

    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.length).toBeLessThanOrEqual(5);
    expect(result.reasons.every((reason) => reason.label.trim().length > 0)).toBe(true);
    expect(result.reasons.some((reason) => /km|m from/.test(reason.label))).toBe(true);
    expect(result.reasons.some((reason) => reason.label.includes("Ribeye"))).toBe(true);

    const percent = matchPercent(result.score);
    expect(percent).toBeGreaterThanOrEqual(52);
    expect(percent).toBeLessThanOrEqual(98);
    expect(result.breakdown).toHaveLength(Object.keys(WEIGHTS).length);
  });

  it("keeps surprise randomness bounded so hard constraints still lead", () => {
    const ctx = prepared({ id: "plc_s", priceLevel: 1, expectedSpendMin: 9, expectedSpendMax: 13 });
    const base = scoreCandidate({
      prepared: ctx.prepared,
      query: { maxSpend: 20 },
      preferences: ctx.preferences,
      random: 0.5,
    });
    const lucky = scoreCandidate({
      prepared: ctx.prepared,
      query: { maxSpend: 20 },
      preferences: ctx.preferences,
      random: 1,
    });

    expect(lucky.score - base.score).toBeLessThanOrEqual(0.061);
    expect(lucky.score).toBeLessThanOrEqual(1);
  });
});

describe("budget helpers", () => {
  it("favours places comfortably inside the budget", () => {
    expect(budgetFitScore({ min: 10, max: 15 }, 25)).toBe(1);
    expect(budgetFitScore({ min: 30, max: 40 }, 25)).toBeLessThan(0.5);
  });

  it("treats unknown budgets as allowed but neutral", () => {
    expect(isWithinBudget({ min: null, max: null }, 20)).toBe(true);
    expect(budgetFitScore({ min: null, max: null }, 20)).toBe(0.5);
  });

  it("never overwrites a manually set budget", () => {
    const budget = resolveBudget(
      {
        expectedSpendMin: 40,
        expectedSpendMax: 55,
        budgetSource: "manual",
        priceLevel: 4,
      },
      [makeVisit({ spendPerPerson: 12 })],
    );
    expect(budget.source).toBe("manual");
    expect(budget.min).toBe(40);
  });
});
