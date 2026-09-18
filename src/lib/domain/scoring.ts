import { budgetMidpoint, type BudgetEstimate } from "./budget";
import { formatBudgetRange, formatDistanceKm, formatRating } from "@/lib/utils/format";
import { matchesPreferenceKeyword } from "./preferences";
import type { PreparedPlace } from "./place-view";
import type {
  DecideQuery,
  RecommendationReason,
  ScoreBreakdownEntry,
  ScoreResult,
  UserPreferences,
} from "./types";

/**
 * Transparent weighted ranking.
 *
 * There is no hidden model: every component is a 0..1 value with a published
 * weight, so the UI can explain exactly why something was suggested and the
 * weights can be tuned (or replaced by embeddings later) in one place.
 */
export const WEIGHTS = {
  intent: 0.22,
  affinity: 0.2,
  quality: 0.13,
  budget: 0.12,
  distance: 0.13,
  novelty: 0.1,
  interest: 0.1,
} as const;

export interface ScoreInput {
  prepared: PreparedPlace;
  query: DecideQuery;
  preferences: UserPreferences;
  now?: Date;
  /** Deterministic 0..1 sample used for "surprise me" tie-breaking. */
  random?: number;
}

export function scoreCandidate({
  prepared,
  query,
  preferences,
  now = new Date(),
  random,
}: ScoreInput): ScoreResult {
  const { place, budget, distanceKm, isOpenNow, visits, affinity } = prepared;

  const intent = intentScore(prepared, query);
  const quality = publicQualityScore(place.publicRating, place.publicRatingCount);
  const budgetScore = budgetSuitabilityScore(budget, query, preferences);
  const distanceScore = distanceSuitabilityScore(distanceKm, query);
  const novelty = noveltyScore(prepared, now);
  const interest = interestScore(prepared, now);
  const affinityWithHistory = blendAffinity(prepared, affinity);

  const breakdown: ScoreBreakdownEntry[] = [
    entry("intent", "Matches what you asked for", WEIGHTS.intent, intent),
    entry("affinity", "Your taste profile", WEIGHTS.affinity, affinityWithHistory),
    entry("quality", "Public quality signals", WEIGHTS.quality, quality),
    entry("budget", "Budget fit", WEIGHTS.budget, budgetScore),
    entry("distance", "How close it is", WEIGHTS.distance, distanceScore),
    entry("novelty", "Something new or long overdue", WEIGHTS.novelty, novelty),
    entry("interest", "How interested you were", WEIGHTS.interest, interest),
  ];

  const base = breakdown.reduce((sum, part) => sum + part.weighted, 0);
  const jitter = random === undefined ? 0 : (random - 0.5) * 0.12;
  const score = clamp(base + jitter, 0, 1);

  return {
    score,
    breakdown,
    reasons: buildReasons({ prepared, query, preferences, distanceScore, isOpenNow, visits, now }),
  };
}

export function matchPercent(score: number): number {
  return Math.round(clamp(45 + score * 53, 52, 98));
}

function entry(key: string, label: string, weight: number, value: number): ScoreBreakdownEntry {
  return { key, label, weight, value, weighted: weight * value };
}

function intentScore(prepared: PreparedPlace, query: DecideQuery): number {
  const signals: number[] = [];
  const { place, items } = prepared;
  const placeCuisines = place.cuisines.map((c) => c.toLowerCase());

  if (query.cuisines?.length) {
    const wanted = query.cuisines.map((c) => c.toLowerCase());
    signals.push(wanted.some((cuisine) => placeCuisines.includes(cuisine)) ? 1 : 0.2);
  }

  if (query.categories?.length) {
    signals.push(query.categories.includes(place.category) ? 1 : 0.2);
  }

  if (query.foodQuery) {
    const needle = query.foodQuery.trim().toLowerCase();
    const itemHit = items.find((item) => item.name.toLowerCase().includes(needle));
    if (itemHit && typeof itemHit.rating === "number") {
      signals.push(itemHit.rating >= 4 ? 1 : 0.75);
    } else if (
      place.name.toLowerCase().includes(needle) ||
      placeCuisines.some((cuisine) => cuisine.includes(needle)) ||
      (place.category as string).includes(needle)
    ) {
      signals.push(0.9);
    } else {
      signals.push(0.3);
    }
  }

  if (query.vibe && query.vibe !== "any") signals.push(vibeScore(prepared, query.vibe));
  if (query.occasion) signals.push(occasionScore(prepared, query.occasion));

  if (signals.length === 0) return 0.5;
  return average(signals);
}

function vibeScore(prepared: PreparedPlace, vibe: "quick" | "casual" | "nicer"): number {
  const { place, budget } = prepared;
  const midpoint = budgetMidpoint(budget);
  const quickCategories = ["cafe", "takeaway", "street_food", "bakery", "dessert"];

  if (vibe === "quick") {
    if (quickCategories.includes(place.category)) return 1;
    if (midpoint !== null && midpoint <= 15) return 0.9;
    return 0.45;
  }
  if (vibe === "nicer") {
    if (place.category === "restaurant" && (place.priceLevel ?? 0) >= 3) return 1;
    if (midpoint !== null && midpoint >= 35) return 0.9;
    if (place.category === "restaurant") return 0.7;
    return 0.4;
  }
  if (place.category === "restaurant" || place.category === "brunch") return 0.85;
  if (midpoint !== null && midpoint <= 30) return 0.8;
  return 0.6;
}

function occasionScore(
  prepared: PreparedPlace,
  occasion: NonNullable<DecideQuery["occasion"]>,
): number {
  const { place, budget, visits } = prepared;
  const midpoint = budgetMidpoint(budget);
  const historicBoost = Math.min(0.3, visits.filter((v) => v.occasion === occasion).length * 0.15);

  const base = (() => {
    switch (occasion) {
      case "quick_lunch":
      case "work_lunch":
        return ["cafe", "takeaway", "street_food", "bakery", "brunch"].includes(place.category)
          ? 1
          : midpoint !== null && midpoint <= 18
            ? 0.75
            : 0.4;
      case "coffee_break":
        return ["cafe", "bakery", "dessert"].includes(place.category) ? 1 : 0.35;
      case "date_night":
      case "special_occasion":
        return place.category === "restaurant" && (place.priceLevel ?? 0) >= 2 ? 0.95 : 0.5;
      case "group_meal":
      case "family_meal":
        return place.category === "restaurant" || place.category === "brunch" ? 0.9 : 0.55;
      case "delivery":
        return ["takeaway", "street_food", "restaurant"].includes(place.category) ? 0.9 : 0.45;
      case "casual_dinner":
      default:
        return place.category === "restaurant" ? 0.9 : 0.6;
    }
  })();

  return Math.min(1, base + historicBoost);
}

function publicQualityScore(rating: number | null, count: number | null): number {
  if (rating === null) return 0.5;
  let base: number;
  if (rating >= 4.7) base = 1;
  else if (rating >= 4.5) base = 0.9;
  else if (rating >= 4.2) base = 0.75;
  else if (rating >= 4.0) base = 0.6;
  else if (rating >= 3.5) base = 0.4;
  else base = 0.2;

  if (count !== null && count < 25) base *= 0.85;
  return clamp(base, 0, 1);
}

function budgetSuitabilityScore(
  budget: BudgetEstimate,
  query: DecideQuery,
  preferences: UserPreferences,
): number {
  const midpoint = budgetMidpoint(budget);
  if (midpoint === null) return 0.5;

  const parts: number[] = [];
  if (query.maxSpend != null) {
    if (midpoint <= query.maxSpend * 0.8) parts.push(1);
    else if (midpoint <= query.maxSpend) parts.push(0.85);
    else parts.push(0.15);
  }

  if (preferences.medianSpend) {
    const ratio = midpoint / preferences.medianSpend;
    parts.push(ratio <= 1.15 ? 0.9 : ratio <= 1.6 ? 0.65 : 0.4);
  }

  if (budget.approximate) parts.push(0.7);
  if (parts.length === 0) return 0.6;
  return average(parts);
}

function distanceSuitabilityScore(distanceKm: number | null, query: DecideQuery): number {
  if (distanceKm === null) return 0.55;
  if (query.maxDistanceKm != null && query.maxDistanceKm > 0) {
    const ratio = distanceKm / query.maxDistanceKm;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 0.9;
    if (ratio <= 0.8) return 0.75;
    return 0.6;
  }
  if (distanceKm <= 1.5) return 1;
  if (distanceKm <= 4) return 0.85;
  if (distanceKm <= 8) return 0.7;
  if (distanceKm <= 16) return 0.5;
  return 0.3;
}

/**
 * New places are exciting; somewhere you ate last week should step back, unless
 * you loved it and it has been months, which makes it a rediscovery candidate.
 */
function noveltyScore(prepared: PreparedPlace, now: Date): number {
  const { visits, place } = prepared;
  if (visits.length === 0) {
    const daysSinceSaved = daysBetween(new Date(place.savedAt), now);
    if (daysSinceSaved <= 30) return 1;
    if (daysSinceSaved <= 120) return 0.9;
    return 0.75;
  }

  const lastVisit = place.stats.lastVisitedAt ? new Date(place.stats.lastVisitedAt) : null;
  const daysSinceVisit = lastVisit ? daysBetween(lastVisit, now) : null;
  const personalRating = place.stats.personalRating;

  if (daysSinceVisit === null) return 0.6;
  if (daysSinceVisit <= 14) return personalRating !== null && personalRating >= 4.5 ? 0.35 : 0.25;
  if (daysSinceVisit <= 45) return personalRating !== null && personalRating >= 4.5 ? 0.5 : 0.4;
  if (daysSinceVisit <= 180) return personalRating !== null && personalRating >= 4.5 ? 0.75 : 0.55;
  return personalRating !== null && personalRating >= 4 ? 0.95 : 0.7;
}

function interestScore(prepared: PreparedPlace, now: Date): number {
  const { place, visits } = prepared;
  const daysSinceSaved = daysBetween(new Date(place.savedAt), now);

  switch (place.status) {
    case "favourite":
      return 1;
    case "wishlist":
      return visits.length === 0 && daysSinceSaved > 60 ? 1 : 0.9;
    case "archived":
      return 0.1;
    case "saved":
    default:
      if (visits.length === 0 && daysSinceSaved > 90) return 0.8;
      return 0.6;
  }
}

/**
 * A place you have never visited has no personal evidence, so its affinity is
 * whatever similar places suggest. A place with recorded dishes gets a boost
 * because those are the strongest possible signal ("order this again").
 */
function blendAffinity(prepared: PreparedPlace, affinity: number): number {
  const { items, place } = prepared;
  const lovedItems = items.filter((item) => (item.rating ?? 0) >= 4.5).length;
  const dislikedItems = items.filter((item) => (item.rating ?? 5) <= 2).length;
  let value = affinity;
  if (lovedItems > 0) value = Math.min(1, value + Math.min(0.25, lovedItems * 0.08));
  if (dislikedItems > 0) value = Math.max(0, value - Math.min(0.3, dislikedItems * 0.1));
  if (typeof place.stats.personalRating === "number") {
    const personal = (place.stats.personalRating - 1) / 4;
    value = value * 0.4 + personal * 0.6;
  }
  return clamp(value, 0, 1);
}

interface ReasonInput {
  prepared: PreparedPlace;
  query: DecideQuery;
  preferences: UserPreferences;
  distanceScore: number;
  isOpenNow: boolean | null;
  visits: PreparedPlace["visits"];
  now: Date;
}

function buildReasons({
  prepared,
  query,
  preferences,
  distanceScore,
  isOpenNow,
  visits,
  now,
}: ReasonInput): RecommendationReason[] {
  const { place, items, budget, distanceKm } = prepared;
  const reasons: RecommendationReason[] = [];
  const personalRating = place.stats.personalRating;

  if (distanceKm !== null) {
    const origin = query.area ?? place.area ?? place.city ?? "you";
    reasons.push({
      label: `${formatDistanceKm(distanceKm)} from ${origin}`,
      sentiment: distanceScore >= 0.7 ? "positive" : "neutral",
    });
  }

  const budgetText = formatBudgetRange(budget.min, budget.max, { approximate: budget.approximate });
  if (budget.min !== null || budget.max !== null) {
    const overBudget =
      query.maxSpend != null && (budget.max ?? budget.min ?? 0) > query.maxSpend;
    reasons.push({
      label:
        budget.source === "visit_history"
          ? `You usually spend ${budgetText} here`
          : `About ${budgetText}`,
      sentiment: overBudget ? "neutral" : "positive",
    });
  }

  const cuisineLabel = place.cuisines.slice(0, 2).join(" · ");
  if (cuisineLabel) reasons.push({ label: cuisineLabel, sentiment: "neutral" });

  const cuisineAffinity = place.cuisines
    .map((cuisine) => preferences.cuisineAffinity[cuisine.toLowerCase()])
    .filter((stat): stat is NonNullable<typeof stat> => Boolean(stat) && stat.count >= 2);
  const bestCuisine = cuisineAffinity.sort(
    (a, b) => b.average * b.confidence - a.average * a.confidence,
  )[0];
  if (bestCuisine && bestCuisine.average >= 3.8) {
    reasons.push({
      label: `You rate places like this ${formatRating(bestCuisine.average)} on average (${bestCuisine.count} visits)`,
      sentiment: "positive",
    });
  }

  const highlight = [...items]
    .filter((item) => typeof item.rating === "number" && item.rating >= 4)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  if (highlight) {
    reasons.push({
      label: `You rated the ${highlight.name} ${formatRating(highlight.rating)} here`,
      sentiment: "positive",
    });
  }

  if (query.foodQuery) {
    const keywordStat = matchesPreferenceKeyword(query.foodQuery, preferences);
    if (keywordStat && keywordStat.average >= 4) {
      reasons.push({
        label: `"${query.foodQuery}" is something you rate ${formatRating(keywordStat.average)}`,
        sentiment: "positive",
      });
    }
  }

  if (place.publicRating !== null) {
    const count = place.publicRatingCount
      ? ` from ${place.publicRatingCount} reviews`
      : "";
    reasons.push({
      label: `${formatRating(place.publicRating)} public rating${count}`,
      sentiment: "neutral",
    });
  }

  if (visits.length === 0) {
    const wait = Math.round(daysBetween(new Date(place.savedAt), now) / 30);
    reasons.push({
      label:
        wait >= 1
          ? `Saved ${wait === 1 ? "1 month" : `${wait} months`} ago but never visited`
          : "Saved recently and not tried yet",
      sentiment: "positive",
    });
  } else if (personalRating !== null) {
    const lastVisited = place.stats.lastVisitedAt;
    const daysSince = lastVisited ? daysBetween(new Date(lastVisited), now) : null;
    if (daysSince !== null && daysSince > 120 && personalRating >= 4) {
      reasons.push({
        label: `You rated it ${formatRating(personalRating)} — overdue a return`,
        sentiment: "positive",
      });
    } else {
      reasons.push({
        label: `You rated it ${formatRating(personalRating)} over ${visits.length} ${visits.length === 1 ? "visit" : "visits"}`,
        sentiment: personalRating >= 4 ? "positive" : "neutral",
      });
    }
  } else {
    reasons.push({ label: "You have been here but never rated it", sentiment: "neutral" });
  }

  if (place.status === "favourite") reasons.push({ label: "One of your favourites", sentiment: "positive" });
  if (isOpenNow === true) reasons.push({ label: "Open now", sentiment: "positive" });
  if (isOpenNow === false && query.openNow) {
    reasons.push({ label: "Closed right now — check the hours", sentiment: "neutral" });
  }

  return dedupeReasons(reasons).slice(0, 5);
}

function dedupeReasons(reasons: RecommendationReason[]): RecommendationReason[] {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = reason.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function daysBetween(from: Date, to: Date): number {
  return Math.abs(to.getTime() - from.getTime()) / 86_400_000;
}

/** Used by tests and the profile screen to show the relative weight of factors. */
export function explainBreakdown(result: ScoreResult): string[] {
  return [...result.breakdown]
    .sort((a, b) => b.weighted - a.weighted)
    .map((part) => `${part.label} (${Math.round(part.value * 100)}% × ${part.weight})`);
}
