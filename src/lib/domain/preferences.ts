import type {
  FoodItem,
  PlaceWithStats,
  PreferenceStat,
  UserPreferences,
  Visit,
} from "./types";

/**
 * Lightweight, explainable taste profile inferred from visit history.
 *
 * Deliberately not machine learning: averages with a confidence ramp so that a
 * single good meal can nudge suggestions but never define a preference.
 */

/** Small samples are shrunk toward neutral: 1 visit → 0.33, 4 visits → 0.67. */
export function confidenceFor(count: number): number {
  if (count <= 0) return 0;
  return count / (count + 2);
}

function accumulate(
  bucket: Record<string, { total: number; count: number }>,
  key: string | null | undefined,
  rating: number,
): void {
  if (!key) return;
  const normalised = key.trim().toLowerCase();
  if (!normalised) return;
  const entry = bucket[normalised] ?? { total: 0, count: 0 };
  entry.total += rating;
  entry.count += 1;
  bucket[normalised] = entry;
}

function finalise(bucket: Record<string, { total: number; count: number }>): Record<string, PreferenceStat> {
  return Object.fromEntries(
    Object.entries(bucket).map(([key, { total, count }]) => [
      key,
      {
        average: total / count,
        count,
        confidence: confidenceFor(count),
      } satisfies PreferenceStat,
    ]),
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function buildUserPreferences(
  places: PlaceWithStats[],
  visits: Visit[],
  items: FoodItem[],
): UserPreferences {
  const placeById = new Map(places.map((place) => [place.id, place]));
  const visitsByPlace = new Map<string, Visit[]>();
  for (const visit of visits) {
    const list = visitsByPlace.get(visit.placeId) ?? [];
    list.push(visit);
    visitsByPlace.set(visit.placeId, list);
  }

  const cuisineBucket: Record<string, { total: number; count: number }> = {};
  const categoryBucket: Record<string, { total: number; count: number }> = {};
  const foodBucket: Record<string, { total: number; count: number }> = {};
  const categoryVisitCount = new Map<string, number>();

  let ratingTotal = 0;
  let ratingCount = 0;

  for (const visit of visits) {
    categoryVisitCount.set(visit.placeId, (categoryVisitCount.get(visit.placeId) ?? 0) + 1);
    if (typeof visit.rating !== "number") continue;
    ratingTotal += visit.rating;
    ratingCount += 1;

    const place = placeById.get(visit.placeId);
    if (!place) continue;
    for (const cuisine of place.cuisines) accumulate(cuisineBucket, cuisine, visit.rating);
    accumulate(categoryBucket, place.category, visit.rating);
  }

  for (const item of items) {
    if (typeof item.rating !== "number") continue;
    accumulate(foodBucket, item.name, item.rating);
  }

  const spends = visits
    .map((visit) => visit.spendPerPerson)
    .filter((spend): spend is number => typeof spend === "number" && spend > 0);

  const cuisineAffinity = finalise(cuisineBucket);
  const categoryAffinity = finalise(categoryBucket);
  const foodItemAffinity = finalise(foodBucket);

  const ranked = (record: Record<string, PreferenceStat>) =>
    Object.entries(record)
      .filter(([, stat]) => stat.count >= 2 && stat.average >= 3.8)
      .sort(
        (a, b) =>
          b[1].average * b[1].confidence - a[1].average * a[1].confidence ||
          b[1].count - a[1].count,
      )
      .map(([key]) => key);

  const categoryByVisits = [...categoryVisitCount.entries()]
    .map(([placeId, count]) => ({ category: placeById.get(placeId)?.category, count }))
    .filter((entry): entry is { category: NonNullable<PlaceWithStats["category"]>; count: number } =>
      Boolean(entry.category),
    )
    .reduce<Record<string, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] ?? 0) + entry.count;
      return acc;
    }, {});

  const mostVisitedCategories = Object.entries(categoryByVisits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);

  const underratedCategories = Object.entries(categoryAffinity)
    .filter(([, stat]) => stat.count >= 2 && stat.average < 3.5)
    .sort((a, b) => a[1].average - b[1].average)
    .map(([category]) => category);

  return {
    cuisineAffinity,
    categoryAffinity,
    foodItemAffinity,
    medianSpend: median(spends),
    averagePersonalRating: ratingCount > 0 ? ratingTotal / ratingCount : null,
    ratedVisitCount: ratingCount,
    visitCount: visits.length,
    favouriteCuisines: ranked(cuisineAffinity).slice(0, 5),
    favouriteFoodItems: ranked(foodItemAffinity).slice(0, 5),
    mostVisitedCategories,
    underratedCategories,
  };
}

/**
 * Affinity 0..1 for a place, from its cuisines/category and recorded visits to
 * similar places. Neutral (0.5) when there is no evidence either way.
 */
export function placeAffinityScore(place: PlaceWithStats, prefs: UserPreferences): number {
  const evidence: number[] = [];

  for (const cuisine of place.cuisines) {
    const stat = prefs.cuisineAffinity[cuisine.toLowerCase()];
    if (stat) evidence.push(affinityFromStat(stat));
  }

  const categoryStat = prefs.categoryAffinity[place.category.toLowerCase()];
  if (categoryStat) evidence.push(affinityFromStat(categoryStat));

  if (typeof place.stats.personalRating === "number") {
    evidence.push((place.stats.personalRating - 1) / 4);
  }

  if (evidence.length === 0) return 0.5;
  return evidence.reduce((sum, value) => sum + value, 0) / evidence.length;
}

function affinityFromStat(stat: PreferenceStat): number {
  const normalised = (stat.average - 1) / 4;
  return 0.5 + (normalised - 0.5) * stat.confidence * 1.4;
}

export function matchesPreferenceKeyword(name: string, prefs: UserPreferences): PreferenceStat | null {
  const key = name.trim().toLowerCase();
  const direct = prefs.foodItemAffinity[key];
  if (direct) return direct;
  const partial = Object.entries(prefs.foodItemAffinity).find(
    ([item]) => item.includes(key) || key.includes(item),
  );
  return partial ? partial[1] : null;
}
