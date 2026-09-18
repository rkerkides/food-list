import type { BudgetSource, Place, Visit } from "./types";

/**
 * Budget intelligence.
 *
 * Precedence (highest first):
 *   1. manual             — the user typed it, we never overwrite it
 *   2. visit_history      — median of what the user actually paid
 *   3. provider_price_range — provider gave an explicit range
 *   4. provider_price_level — generic €/€€/€€€ → clearly approximate
 */

export const PRICE_LEVEL_RANGES: Record<number, { min: number; max: number }> = {
  1: { min: 8, max: 14 },
  2: { min: 15, max: 25 },
  3: { min: 26, max: 45 },
  4: { min: 46, max: 80 },
};

export interface BudgetEstimate {
  min: number | null;
  max: number | null;
  source: BudgetSource;
  /** True when the number is a rough guess that the user should sanity-check. */
  approximate: boolean;
  /** Number of visits the estimate is based on (0 for provider-only estimates). */
  basedOnVisits: number;
  /** Human readable provenance, safe to show in the UI. */
  label: string;
}

export function estimateFromPriceLevel(priceLevel: number | null | undefined): BudgetEstimate | null {
  if (typeof priceLevel !== "number") return null;
  const range = PRICE_LEVEL_RANGES[Math.round(priceLevel)];
  if (!range) return null;
  return {
    min: range.min,
    max: range.max,
    source: "provider_price_level",
    approximate: true,
    basedOnVisits: 0,
    label: "Rough estimate from the venue's price level",
  };
}

export function estimateFromVisits(
  visits: Pick<Visit, "spendPerPerson" | "visitedAt">[],
): BudgetEstimate | null {
  const spends = visits
    .map((visit) => visit.spendPerPerson)
    .filter((spend): spend is number => typeof spend === "number" && spend > 0)
    .sort((a, b) => a - b);

  if (spends.length === 0) return null;

  const median = quantile(spends, 0.5);
  if (spends.length === 1) {
    return {
      min: Math.max(1, Math.round(median * 0.85)),
      max: Math.round(median * 1.15),
      source: "visit_history",
      approximate: true,
      basedOnVisits: 1,
      label: "Based on 1 recorded visit",
    };
  }

  const low = quantile(spends, 0.25);
  const high = quantile(spends, 0.75);
  const min = Math.round(Math.min(low, median * 0.9));
  const max = Math.round(Math.max(high, median * 1.1));

  return {
    min,
    max: max <= min ? min + 2 : max,
    source: "visit_history",
    approximate: false,
    basedOnVisits: spends.length,
    label: `Based on ${spends.length} recorded visits`,
  };
}

/**
 * Effective budget for a place, taking manual entries and visit history into
 * account. Provider data is only ever a fallback estimate.
 */
export function resolveBudget(
  place: Pick<
    Place,
    "expectedSpendMin" | "expectedSpendMax" | "budgetSource" | "priceLevel"
  >,
  visits: Pick<Visit, "spendPerPerson" | "visitedAt">[] = [],
): BudgetEstimate {
  const hasManual =
    place.budgetSource === "manual" &&
    (typeof place.expectedSpendMin === "number" || typeof place.expectedSpendMax === "number");

  if (hasManual) {
    return {
      min: place.expectedSpendMin,
      max: place.expectedSpendMax,
      source: "manual",
      approximate: false,
      basedOnVisits: visits.length,
      label: "Set by you",
    };
  }

  const fromVisits = estimateFromVisits(visits);
  if (fromVisits) return fromVisits;

  if (typeof place.expectedSpendMin === "number" || typeof place.expectedSpendMax === "number") {
    return {
      min: place.expectedSpendMin,
      max: place.expectedSpendMax,
      source: place.budgetSource === "unknown" ? "provider_price_level" : place.budgetSource,
      approximate: place.budgetSource !== "provider_price_range",
      basedOnVisits: 0,
      label: "Provider estimate",
    };
  }

  return (
    estimateFromPriceLevel(place.priceLevel) ?? {
      min: null,
      max: null,
      source: "unknown",
      approximate: true,
      basedOnVisits: 0,
      label: "Budget unknown",
    }
  );
}

/** Midpoint used for budget-fit scoring; falls back to the known edge. */
export function budgetMidpoint(estimate: Pick<BudgetEstimate, "min" | "max">): number | null {
  const { min, max } = estimate;
  if (typeof min === "number" && typeof max === "number") return (min + max) / 2;
  if (typeof min === "number") return min;
  if (typeof max === "number") return max;
  return null;
}

/**
 * How well a budget fits a maximum spend, from 0 (way over) to 1 (comfortably
 * inside). Places without any budget information score in the middle so they
 * are neither hidden nor promoted.
 */
export function budgetFitScore(
  estimate: Pick<BudgetEstimate, "min" | "max">,
  maxSpend: number | null | undefined,
): number {
  const midpoint = budgetMidpoint(estimate);
  if (midpoint === null) return 0.5;
  if (typeof maxSpend !== "number") return 0.75;
  if (midpoint <= maxSpend * 0.75) return 1;
  if (midpoint <= maxSpend) return 0.8;
  if (midpoint <= maxSpend * 1.15) return 0.45;
  return 0.1;
}

export function isWithinBudget(
  estimate: Pick<BudgetEstimate, "min" | "max">,
  maxSpend: number | null | undefined,
): boolean {
  if (typeof maxSpend !== "number") return true;
  const reference = estimate.min ?? estimate.max;
  // Unknown budgets are not treated as violations — they are surfaced as
  // "check the price" instead of silently disappearing.
  if (reference === null) return true;
  return reference <= maxSpend;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sorted[base + 1] ?? sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

export function deriveProviderBudget(
  priceLevel: number | null | undefined,
  priceRange: { min: number; max: number } | null | undefined,
): { min: number | null; max: number | null; source: BudgetSource } {
  if (priceRange && (priceRange.min || priceRange.max)) {
    return {
      min: priceRange.min || null,
      max: priceRange.max || priceRange.min || null,
      source: "provider_price_range",
    };
  }
  const fromLevel = estimateFromPriceLevel(priceLevel);
  if (fromLevel) {
    return { min: fromLevel.min, max: fromLevel.max, source: "provider_price_level" };
  }
  return { min: null, max: null, source: "unknown" };
}
