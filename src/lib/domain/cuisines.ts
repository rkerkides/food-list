/**
 * The shared cuisine vocabulary. Labels here are the canonical values stored on
 * places; aliases let imports and older records converge without losing data.
 */
export const STANDARD_CUISINES = [
  "American Barbecue",
  "Asian",
  "Asian Fusion",
  "Bakery",
  "Bao",
  "Bar Food",
  "Brunch",
  "Burger",
  "Cafe",
  "Chinese",
  "Coffee",
  "Comfort Food",
  "Contemporary",
  "Cocktails",
  "Crepes",
  "Cypriot",
  "Cypriot Street Food",
  "Dessert",
  "European",
  "Fusion",
  "Greek",
  "Grill",
  "International",
  "Italian",
  "Japanese",
  "Lebanese",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Pasta",
  "Pizza",
  "Regional",
  "Sandwich",
  "Steakhouse",
  "Street Food",
  "Sushi",
  "Tacos",
  "Vegetarian",
  "Wine Bar",
] as const;

export const CUISINE_ALIASES: Record<string, string> = {
  bbq: "American Barbecue",
  barbecue: "American Barbecue",
  burgers: "Burger",
  "asian fusion": "Asian Fusion",
  "street food": "Street Food",
  "wine bar": "Wine Bar",
  sandwiches: "Sandwich",
};

function key(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

const STANDARD_BY_KEY = new Map(STANDARD_CUISINES.map((name) => [key(name), name]));

/** Returns a canonical label for a known cuisine, otherwise a tidy custom label. */
export function normalizeCuisineName(value: string, customNames: readonly string[] = []): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const normalized = key(cleaned);
  const custom = customNames.find((name) => key(name) === normalized);
  return custom ?? CUISINE_ALIASES[normalized] ?? STANDARD_BY_KEY.get(normalized) ?? cleaned;
}

/** Normalises aliases, removes blanks, and de-duplicates case-insensitively. */
export function normalizeCuisineList(values: readonly string[], customNames: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cuisine = normalizeCuisineName(value, customNames);
    const cuisineKey = key(cuisine);
    if (!cuisine || seen.has(cuisineKey)) continue;
    seen.add(cuisineKey);
    result.push(cuisine);
  }
  return result;
}

export function cuisineKey(value: string): string {
  return key(value);
}
