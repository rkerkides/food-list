import { describe, expect, it } from "vitest";
import {
  budgetMidpoint,
  estimateFromPriceLevel,
  estimateFromVisits,
  resolveBudget,
} from "@/lib/domain/budget";
import { makeVisit } from "./fixtures";

describe("budget intelligence", () => {
  it("turns a generic provider price level into a clearly approximate estimate", () => {
    const estimate = estimateFromPriceLevel(3);
    expect(estimate).not.toBeNull();
    expect(estimate!.min).toBe(26);
    expect(estimate!.max).toBe(45);
    expect(estimate!.approximate).toBe(true);
    expect(estimate!.source).toBe("provider_price_level");
  });

  it("uses recorded spend from visits once there is history", () => {
    const estimate = estimateFromVisits([
      makeVisit({ spendPerPerson: 10 }),
      makeVisit({ spendPerPerson: 20 }),
      makeVisit({ spendPerPerson: 30 }),
    ]);
    expect(estimate).not.toBeNull();
    expect(estimate!.source).toBe("visit_history");
    expect(estimate!.basedOnVisits).toBe(3);
    expect(estimate!.min).toBeLessThanOrEqual(20);
    expect(estimate!.max).toBeGreaterThanOrEqual(20);
  });

  it("is honest about a single recorded visit", () => {
    const estimate = estimateFromVisits([makeVisit({ spendPerPerson: 30 })]);
    expect(estimate!.basedOnVisits).toBe(1);
    expect(estimate!.approximate).toBe(true);
    expect(estimate!.min).toBe(26);
    expect(estimate!.max).toBe(35);
  });

  it("uses visit history when there is no manual budget", () => {
    const budget = resolveBudget(
      { expectedSpendMin: 15, expectedSpendMax: 25, budgetSource: "provider_price_level", priceLevel: 2 },
      [makeVisit({ spendPerPerson: 12 }), makeVisit({ spendPerPerson: 14 })],
    );
    expect(budget.source).toBe("visit_history");
    expect(budget.label).toMatch(/recorded visits/);
    expect(budgetMidpoint(budget)).toBeCloseTo(13, 0);
  });

  it("falls back to unknown when nothing is known", () => {
    const budget = resolveBudget(
      { expectedSpendMin: null, expectedSpendMax: null, budgetSource: "unknown", priceLevel: null },
      [],
    );
    expect(budget.source).toBe("unknown");
    expect(budgetMidpoint(budget)).toBeNull();
    expect(budget.label).toBe("Budget unknown");
  });
});
