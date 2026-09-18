import type { Repositories } from "@/lib/data/repositories";
import { confidenceFor } from "@/lib/domain/preferences";
import { titleCase } from "@/lib/utils/format";
import { loadUserLibrary } from "./library";
import type { PreferenceStat } from "@/lib/domain/types";

export interface TasteRow {
  key: string;
  label: string;
  average: number;
  count: number;
  confidence: "low" | "medium" | "high";
  note: string;
}

export interface TasteInsights {
  hasEnoughData: boolean;
  visitCount: number;
  ratedVisitCount: number;
  cuisines: TasteRow[];
  categories: TasteRow[];
  dishes: TasteRow[];
  spending: {
    median: number | null;
    byCategory: { category: string; median: number; count: number }[];
  };
  highlights: string[];
  disclaimers: string[];
}

/**
 * Deliberately cautious insights: nothing is claimed from a single data point,
 * and confidence is shown alongside every number.
 */
export async function loadTasteInsights(
  userId: string,
  options: { repos?: Repositories } = {},
): Promise<TasteInsights> {
  const library = await loadUserLibrary(userId, { repos: options.repos });
  const { preferences, visits, places } = library;

  const cuisines = toRows(preferences.cuisineAffinity, (key) => titleCase(key));
  const categories = toRows(preferences.categoryAffinity, (key) => titleCase(key));
  const dishes = toRows(preferences.foodItemAffinity, (key) => titleCase(key)).slice(0, 8);

  const spendsByCategory = new Map<string, number[]>();
  const placeById = new Map(places.map((place) => [place.id, place]));
  for (const visit of visits) {
    if (typeof visit.spendPerPerson !== "number" || visit.spendPerPerson <= 0) continue;
    const place = placeById.get(visit.placeId);
    if (!place) continue;
    const list = spendsByCategory.get(place.category) ?? [];
    list.push(visit.spendPerPerson);
    spendsByCategory.set(place.category, list);
  }

  const highlights: string[] = [];
  const topCuisine = cuisines.find((row) => row.count >= 3 && row.average >= 4.2);
  if (topCuisine) {
    highlights.push(
      `${topCuisine.label} is your strongest pattern: ${topCuisine.average.toFixed(1)} average across ${topCuisine.count} visits.`,
    );
  }
  const favouriteDish = dishes.find((row) => row.count >= 2 && row.average >= 4.5);
  if (favouriteDish) {
    highlights.push(
      `${favouriteDish.label} shows up repeatedly and scores ${favouriteDish.average.toFixed(1)}.`,
    );
  }
  const weakest = categories.find((row) => row.count >= 2 && row.average < 3.5);
  if (weakest) {
    highlights.push(
      `${weakest.label} is your least rewarding category so far (${weakest.average.toFixed(1)}).`,
    );
  }

  const disclaimers: string[] = [];
  if (visits.length < 8) {
    disclaimers.push(
      "With fewer than 8 visits these patterns are indicative, not conclusions. They get sharper as you log more.",
    );
  }
  if (preferences.ratedVisitCount < visits.length) {
    disclaimers.push(
      `${visits.length - preferences.ratedVisitCount} of your visits have no rating yet — adding one sharpens recommendations.`,
    );
  }

  return {
    hasEnoughData: visits.length >= 3,
    visitCount: visits.length,
    ratedVisitCount: preferences.ratedVisitCount,
    cuisines,
    categories,
    dishes,
    spending: {
      median: preferences.medianSpend,
      byCategory: [...spendsByCategory.entries()]
        .map(([category, values]) => ({
          category,
          median: median(values),
          count: values.length,
        }))
        .sort((a, b) => b.count - a.count),
    },
    highlights,
    disclaimers,
  };
}

function toRows(
  record: Record<string, PreferenceStat>,
  labeller: (key: string) => string,
): TasteRow[] {
  return Object.entries(record)
    .map(([key, stat]) => ({
      key,
      label: labeller(key),
      average: stat.average,
      count: stat.count,
      confidence: confidenceLabel(stat.count),
      note: stat.count < 2 ? "Early signal" : `${stat.count} visits`,
    }))
    .sort((a, b) => b.average * confidenceFor(b.count) - a.average * confidenceFor(a.count));
}

function confidenceLabel(count: number): "low" | "medium" | "high" {
  if (count >= 6) return "high";
  if (count >= 3) return "medium";
  return "low";
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
