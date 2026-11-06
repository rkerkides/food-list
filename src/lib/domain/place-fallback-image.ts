import type { PlaceCategory } from "./types";

export type PlaceFallbackImage =
  | "burger"
  | "sandwich"
  | "barbecue"
  | "italian"
  | "greek"
  | "gyros"
  | "asian"
  | "fusion"
  | "cafe"
  | "bakery"
  | "dessert"
  | "seafood"
  | "bar"
  | "general";

export const PLACE_STOCK_IMAGES: readonly {
  key: PlaceFallbackImage;
  label: string;
  src: string;
}[] = [
  { key: "burger", label: "Burgers", src: "/images/place-fallbacks/burger.webp" },
  { key: "sandwich", label: "Sandwiches", src: "/images/place-fallbacks/sandwich-v1.png" },
  { key: "barbecue", label: "Barbecue", src: "/images/place-fallbacks/barbecue-v1.png" },
  { key: "italian", label: "Italian", src: "/images/place-fallbacks/italian.webp" },
  { key: "greek", label: "Greek", src: "/images/place-fallbacks/greek.webp" },
  { key: "gyros", label: "Gyros", src: "/images/place-fallbacks/gyros.webp" },
  { key: "asian", label: "Asian", src: "/images/place-fallbacks/asian.webp" },
  { key: "fusion", label: "Fusion", src: "/images/place-fallbacks/fusion.webp" },
  { key: "cafe", label: "Cafe", src: "/images/place-fallbacks/cafe.webp" },
  { key: "bakery", label: "Bakery", src: "/images/place-fallbacks/bakery.webp" },
  { key: "dessert", label: "Dessert", src: "/images/place-fallbacks/dessert.webp" },
  { key: "seafood", label: "Seafood", src: "/images/place-fallbacks/seafood.webp" },
  { key: "bar", label: "Bar", src: "/images/place-fallbacks/bar.webp" },
  { key: "general", label: "Restaurant", src: "/images/place-fallbacks/general.webp" },
];

const IMAGE_PATHS = Object.fromEntries(
  PLACE_STOCK_IMAGES.map((image) => [image.key, image.src]),
) as Record<PlaceFallbackImage, string>;

export function isPlaceStockImage(value: string): value is PlaceFallbackImage {
  return PLACE_STOCK_IMAGES.some((image) => image.key === value);
}

export function placeStockImageSrc(key: PlaceFallbackImage): string {
  return IMAGE_PATHS[key];
}

export function placeStockImageFromRef(ref: string | null | undefined): PlaceFallbackImage | null {
  if (!ref?.startsWith("stock:")) return null;
  const key = ref.slice("stock:".length);
  return isPlaceStockImage(key) ? key : null;
}

const CUISINE_RULES: { image: PlaceFallbackImage; terms: string[] }[] = [
  {
    image: "barbecue",
    terms: ["barbecue", "bbq", "smokehouse", "smoked meat", "american barbecue"],
  },
  {
    image: "burger",
    terms: ["burger", "hamburger", "cheeseburger", "smashburger", "fast food"],
  },
  {
    image: "sandwich",
    terms: ["sandwich", "steak sandwich", "deli sandwich"],
  },
  {
    image: "gyros",
    terms: ["gyros", "gyro", "souvlaki", "kebab", "shawarma", "doner"],
  },
  {
    image: "italian",
    terms: ["pizza", "pizzeria", "italian", "pasta", "trattoria", "tuscan"],
  },
  {
    image: "fusion",
    terms: ["fusion", "contemporary", "modern european", "international"],
  },
  {
    image: "asian",
    terms: [
      "asian",
      "sushi",
      "japanese",
      "chinese",
      "thai",
      "indian",
      "korean",
      "vietnamese",
      "ramen",
      "noodle",
      "dumpling",
    ],
  },
  {
    image: "seafood",
    terms: ["seafood", "fish", "oyster", "shellfish"],
  },
  {
    image: "greek",
    terms: ["greek", "cypriot", "cyprus", "meze", "mediterranean"],
  },
  {
    image: "cafe",
    terms: ["cafe", "coffee", "brunch", "breakfast", "tea room"],
  },
  {
    image: "bakery",
    terms: ["bakery", "pastry", "patisserie", "sourdough", "bread", "boulangerie"],
  },
  {
    image: "dessert",
    terms: ["dessert", "ice cream", "gelato", "chocolate", "confectionery", "sweet"],
  },
  {
    image: "bar",
    terms: ["cocktail", "bar food", "wine bar", "pub", "tapas"],
  },
];

export function placeFallbackImage({
  name,
  category,
  cuisines,
}: {
  name: string;
  category: PlaceCategory;
  cuisines?: string[];
}): { key: PlaceFallbackImage; src: string } {
  const cuisineText = searchable(cuisines ?? []);
  const nameText = searchable([name]);

  for (const rule of CUISINE_RULES) {
    if (rule.terms.some((term) => contains(cuisineText, term))) {
      return { key: rule.image, src: IMAGE_PATHS[rule.image] };
    }
  }
  for (const rule of CUISINE_RULES) {
    if (rule.terms.some((term) => contains(nameText, term))) {
      return { key: rule.image, src: IMAGE_PATHS[rule.image] };
    }
  }

  const categoryImage: Partial<Record<PlaceCategory, PlaceFallbackImage>> = {
    cafe: "cafe",
    brunch: "cafe",
    bakery: "bakery",
    dessert: "dessert",
    bar: "bar",
  };
  const key = categoryImage[category] ?? "general";
  return { key, src: IMAGE_PATHS[key] };
}

function searchable(values: string[]): string {
  const normalized = values
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return ` ${normalized} `;
}

function contains(searchableText: string, term: string): boolean {
  return searchableText.includes(` ${term} `);
}
