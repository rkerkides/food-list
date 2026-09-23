import { z } from "zod";
import {
  CYPRUS_CITIES,
  FOOD_ITEM_CATEGORIES,
  PLACE_CATEGORIES,
  PLACE_STATUSES,
  VISIT_OCCASIONS,
} from "./types";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const optionalNumber = (min?: number, max?: number) =>
  z
    .union([z.number(), z.string()])
    .transform((value) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      const trimmed = value.trim();
      if (trimmed === "") return null;
      const parsed = Number(trimmed.replace(/[^0-9.,-]/g, "").replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    })
    .refine((value) => value === null || min === undefined || value >= min, {
      message: `Must be at least ${min}`,
    })
    .refine((value) => value === null || max === undefined || value <= max, {
      message: `Must be at most ${max}`,
    })
    .nullable()
    .optional();

export const placeSearchResultSchema = z.object({
  provider: z.enum(["osm", "demo", "google", "manual"]),
  providerPlaceId: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(PLACE_CATEGORIES),
  cuisines: z.array(z.string()).default([]),
  address: optionalString,
  city: optionalString,
  area: optionalString,
  district: optionalString,
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  publicRating: z.number().nullable().optional(),
  publicRatingCount: z.number().nullable().optional(),
  priceLevel: z.number().nullable().optional(),
  website: optionalString,
  phone: optionalString,
  openingHours: z.any().nullable().optional(),
  photoRef: optionalString,
  externalMeta: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const addPlaceSchema = z.object({
  result: placeSearchResultSchema,
  name: z.string().trim().min(1).optional(),
  city: optionalString,
  area: optionalString,
  address: optionalString,
  website: optionalString,
  phone: optionalString,
  expectedSpendMin: optionalNumber(0, 2000),
  expectedSpendMax: optionalNumber(0, 2000),
  cuisines: z.array(z.string()).optional(),
  tags: z.array(z.string()).max(12).optional(),
  note: optionalString,
  savedReason: optionalString,
  status: z.enum(PLACE_STATUSES).optional(),
  category: z.enum(PLACE_CATEGORIES).optional(),
  /** Set when the user has been warned about a likely duplicate and confirmed. */
  force: z.boolean().optional(),
});

export const manualPlaceSchema = z.object({
  name: z.string().trim().min(2, "Give the place a name"),
  category: z.enum(PLACE_CATEGORIES).default("restaurant"),
  cuisines: z.array(z.string()).optional(),
  address: optionalString,
  city: z.enum(CYPRUS_CITIES).nullable().optional(),
  area: optionalString,
  district: optionalString,
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  website: optionalString,
  phone: optionalString,
  expectedSpendMin: optionalNumber(0, 2000),
  expectedSpendMax: optionalNumber(0, 2000),
  tags: z.array(z.string()).max(12).optional(),
  note: optionalString,
  savedReason: optionalString,
  status: z.enum(PLACE_STATUSES).optional(),
  force: z.boolean().optional(),
});

export const updatePlaceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  category: z.enum(PLACE_CATEGORIES).optional(),
  cuisines: z.array(z.string()).optional(),
  city: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  expectedSpendMin: optionalNumber(0, 2000),
  expectedSpendMax: optionalNumber(0, 2000),
  tags: z.array(z.string()).max(12).optional(),
  note: z.string().nullable().optional(),
  savedReason: z.string().nullable().optional(),
  status: z.enum(PLACE_STATUSES).optional(),
});

export const foodItemSchema = z.object({
  name: z.string().trim().min(1, "Name the dish"),
  category: z.enum(FOOD_ITEM_CATEGORIES).nullable().optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
  comment: z.string().nullable().optional(),
  isHighlight: z.boolean().optional(),
  price: z.number().min(0).max(2000).nullable().optional(),
});

export const visitSchema = z.object({
  placeId: z.string().min(1),
  visitedAt: z.string().min(4),
  occasion: z.enum(VISIT_OCCASIONS).nullable().optional(),
  partySize: z.number().int().min(1).max(50).nullable().optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
  thoughts: z.string().nullable().optional(),
  spendPerPerson: z.number().min(0).max(5000).nullable().optional(),
  wouldReturn: z.boolean().nullable().optional(),
  tags: z.array(z.string()).max(12).optional(),
  items: z.array(foodItemSchema).max(30).default([]),
});

export const decideSchema = z.object({
  area: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  maxDistanceKm: z.number().min(0.5).max(200).nullable().optional(),
  cuisines: z.array(z.string()).optional(),
  foodQuery: z.string().nullable().optional(),
  maxSpend: z.number().min(1).max(1000).nullable().optional(),
  categories: z.array(z.enum(PLACE_CATEGORIES)).optional(),
  visitState: z.enum(["any", "visited", "unvisited"]).optional(),
  minPublicRating: z.number().min(0).max(5).nullable().optional(),
  minPersonalRating: z.number().min(0).max(5).nullable().optional(),
  occasion: z.enum(VISIT_OCCASIONS).nullable().optional(),
  vibe: z.enum(["quick", "casual", "nicer", "any"]).optional(),
  openNow: z.boolean().optional(),
  favouritesOnly: z.boolean().optional(),
  wishlistOnly: z.boolean().optional(),
  surprise: z.boolean().optional(),
  limit: z.number().int().min(1).max(10).optional(),
});

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
  name: z.string().trim().max(80).optional(),
});

export type AddPlaceInput = z.infer<typeof addPlaceSchema>;
export type ManualPlaceInput = z.infer<typeof manualPlaceSchema>;
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>;
export type VisitInput = z.infer<typeof visitSchema>;
export type DecideInput = z.infer<typeof decideSchema>;
