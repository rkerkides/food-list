import { createRepositories, type Repositories } from "@/lib/data/repositories";
import { defaultRepositories } from "./library";
import { DEMO_PLACES } from "@/lib/places";
import { parseWeekSpec } from "@/lib/domain/opening-hours";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/utils/ids";
import type {
  FoodItem,
  FoodItemCategory,
  Place,
  PlaceSearchResult,
  PlaceStatus,
  Visit,
  VisitOccasion,
} from "@/lib/domain/types";

export const DEMO_USER_EMAIL = "demo@food-list.app";
export const DEMO_USER_PASSWORD = "demo1234";
export const DEMO_USER_NAME = "Demo diner";

interface SeedVisit {
  daysAgo: number;
  rating: number;
  occasion: VisitOccasion;
  spend: number;
  partySize?: number;
  wouldReturn?: boolean;
  thoughts: string;
  tags?: string[];
  items: {
    name: string;
    category?: FoodItemCategory;
    rating: number;
    comment?: string;
    price?: number;
    highlight?: boolean;
  }[];
}

interface SeedPlace {
  name: string;
  status: PlaceStatus;
  savedDaysAgo: number;
  note?: string;
  savedReason?: string;
  tags?: string[];
  budget?: { min: number; max: number };
  visits?: SeedVisit[];
}

/**
 * A believable personal history: Nicosia-centric with city trips, strong Asian
 * and brunch signals, a weak Italian streak, an expensive steak favourite and a
 * few saved-but-never-visited places so "want to try" and "under budget" flows
 * have real data behind them.
 */
const SEED_PLAN: SeedPlace[] = [
  {
    name: "Tocayo Cocina",
    status: "favourite",
    savedDaysAgo: 420,
    savedReason: "Recommended by Andreas for the gyoza",
    tags: ["date night", "cocktails"],
    note: "Ask for the counter seats.",
    visits: [
      {
        daysAgo: 300,
        rating: 5,
        occasion: "date_night",
        spend: 32,
        partySize: 2,
        wouldReturn: true,
        thoughts: "Everything small-plate was excellent. The truffle gyoza is the best thing I have eaten in Nicosia.",
        tags: ["date night"],
        items: [
          {
            name: "Truffle gyoza",
            category: "starter",
            rating: 5,
            comment: "Silky, deeply savoury. Order two.",
            price: 9,
            highlight: true,
          },
          { name: "Robata chicken", category: "main", rating: 4.5, price: 15 },
          { name: "Yuzu spritz", category: "drink", rating: 4, price: 8 },
        ],
      },
      {
        daysAgo: 390,
        rating: 4,
        occasion: "group_meal",
        spend: 28,
        partySize: 4,
        wouldReturn: true,
        thoughts: "Loud with a big group but still very good. Service slower than usual.",
        items: [{ name: "Wagyu slider", category: "starter", rating: 4, price: 7 }],
      },
    ],
  },
  {
    name: "Yuzu & Co Sushi",
    status: "saved",
    savedDaysAgo: 260,
    savedReason: "Heard the omakase counter is the best in Cyprus",
    tags: ["book ahead"],
    visits: [
      {
        daysAgo: 240,
        rating: 5,
        occasion: "date_night",
        spend: 42,
        wouldReturn: true,
        thoughts: "Worth the price. Twelve courses, every one of them interesting.",
        items: [
          {
            name: "Otoro nigiri",
            category: "main",
            rating: 5,
            comment: "Melted. Unreal.",
            highlight: true,
          },
          { name: "Miso black cod", category: "main", rating: 4.5, highlight: true },
        ],
      },
      {
        daysAgo: 120,
        rating: 4.5,
        occasion: "special_occasion",
        spend: 48,
        wouldReturn: true,
        thoughts: "Second time just as strong. The rice is perfect.",
        items: [{ name: "Toro hand roll", category: "starter", rating: 4.5, highlight: true }],
      },
    ],
  },
  {
    name: "Kalathi Coffee Roasters",
    status: "favourite",
    savedDaysAgo: 500,
    tags: ["work friendly"],
    visits: [
      {
        daysAgo: 12,
        rating: 4.5,
        occasion: "work_lunch",
        spend: 11,
        wouldReturn: true,
        thoughts: "My default for a working morning. Flat white is consistent.",
        items: [
          {
            name: "Pistachio croissant",
            category: "breakfast",
            rating: 5,
            comment: "Warm, flaky, pistachio cream actually tastes of pistachio.",
            price: 4,
            highlight: true,
          },
          { name: "Flat white", category: "coffee", rating: 4.5, price: 3.5 },
        ],
      },
      {
        daysAgo: 70,
        rating: 4,
        occasion: "coffee_break",
        spend: 8,
        wouldReturn: true,
        thoughts: "Busy at 10am, but the courtyard makes up for it.",
        items: [{ name: "Filter coffee", category: "coffee", rating: 4, price: 3 }],
      },
      {
        daysAgo: 150,
        rating: 4.5,
        occasion: "work_lunch",
        spend: 12,
        wouldReturn: true,
        thoughts: "Quiet enough to take a call.",
        items: [{ name: "Avocado toast", category: "breakfast", rating: 4, price: 7 }],
      },
    ],
  },
  {
    name: "Sesame & Fig Brunch",
    status: "saved",
    savedDaysAgo: 180,
    tags: ["weekend"],
    visits: [
      {
        daysAgo: 95,
        rating: 4.5,
        occasion: "quick_lunch",
        spend: 16,
        partySize: 2,
        wouldReturn: true,
        thoughts: "Best brunch in Strovolos. Get there before 10 to avoid the queue.",
        items: [
          {
            name: "Shakshuka",
            category: "breakfast",
            rating: 4.5,
            comment: "Rich, spicy, properly cooked yolks.",
            price: 9,
            highlight: true,
          },
          { name: "Labneh toast", category: "breakfast", rating: 4, price: 7 },
        ],
      },
      {
        daysAgo: 40,
        rating: 4,
        occasion: "quick_lunch",
        spend: 15,
        wouldReturn: true,
        thoughts: "Solid again, slightly slower service this time.",
        items: [{ name: "Halloumi honey toast", category: "breakfast", rating: 4, price: 8 }],
      },
    ],
  },
  {
    name: "Grill & Grain Steakhouse",
    status: "saved",
    savedDaysAgo: 210,
    savedReason: "For a celebration dinner",
    tags: ["special occasion"],
    visits: [
      {
        daysAgo: 45,
        rating: 4.5,
        occasion: "special_occasion",
        spend: 58,
        partySize: 2,
        wouldReturn: true,
        thoughts: "Expensive but the best steak I have had on the island.",
        items: [
          {
            name: "Dry-aged ribeye",
            category: "main",
            rating: 5,
            comment: "Perfect crust, asked for medium rare and got it.",
            price: 42,
            highlight: true,
          },
          { name: "Bone marrow butter", category: "side", rating: 5, price: 5, highlight: true },
          { name: "Triple-cooked chips", category: "side", rating: 4, price: 6 },
        ],
      },
    ],
  },
  {
    name: "Sokolata Patisserie",
    status: "saved",
    savedDaysAgo: 320,
    tags: ["dessert"],
    visits: [
      {
        daysAgo: 200,
        rating: 5,
        occasion: "casual_dinner",
        spend: 9,
        wouldReturn: true,
        thoughts: "Worth the detour in Limassol every single time.",
        items: [
          {
            name: "Chocolate tart",
            category: "dessert",
            rating: 5,
            comment: "Dense, dark, not too sweet.",
            price: 6,
            highlight: true,
          },
        ],
      },
    ],
  },
  {
    name: "Pizza Engomi Wood Fired",
    status: "saved",
    savedDaysAgo: 400,
    visits: [
      {
        daysAgo: 260,
        rating: 3,
        occasion: "delivery",
        spend: 14,
        wouldReturn: false,
        thoughts: "Fine, but arrived lukewarm and the base was soggy in the middle.",
        items: [{ name: "Margherita", category: "main", rating: 3, price: 11 }],
      },
      {
        daysAgo: 330,
        rating: 3.5,
        occasion: "group_meal",
        spend: 16,
        partySize: 4,
        wouldReturn: true,
        thoughts: "Better in the restaurant than delivered. Good with a group.",
        items: [{ name: "Diavola", category: "main", rating: 3.5, price: 13 }],
      },
    ],
  },
  {
    name: "Mackenzie Brunch Club",
    status: "saved",
    savedDaysAgo: 130,
    visits: [
      {
        daysAgo: 75,
        rating: 4,
        occasion: "quick_lunch",
        spend: 17,
        wouldReturn: true,
        thoughts: "Nice spot by the sea. Turkish eggs were good, coffee just okay.",
        items: [
          { name: "Turkish eggs", category: "breakfast", rating: 4.5, price: 9, highlight: true },
          { name: "Cappuccino", category: "coffee", rating: 3.5, price: 3.5 },
        ],
      },
    ],
  },
  {
    name: "To Kentro tou Nisou",
    status: "saved",
    savedDaysAgo: 340,
    visits: [
      {
        daysAgo: 310,
        rating: 4,
        occasion: "family_meal",
        spend: 21,
        partySize: 6,
        wouldReturn: true,
        thoughts: "Twenty-two plates and nobody left hungry. Great value for a group.",
        items: [
          { name: "Grilled halloumi", category: "starter", rating: 4, price: 7 },
          { name: "Kleftiko", category: "main", rating: 4.5, price: 14, highlight: true },
        ],
      },
    ],
  },
  {
    name: "Harbour House Paphos",
    status: "saved",
    savedDaysAgo: 150,
    visits: [
      {
        daysAgo: 140,
        rating: 4,
        occasion: "date_night",
        spend: 34,
        partySize: 2,
        wouldReturn: true,
        thoughts: "Great sunset, good fish, slightly tourist prices.",
        items: [
          { name: "Grilled octopus", category: "starter", rating: 4.5, price: 14, highlight: true },
          { name: "Sea bream", category: "main", rating: 4, price: 22 },
        ],
      },
    ],
  },
  {
    name: "Pane e Vino Toscana",
    status: "saved",
    savedDaysAgo: 500,
    visits: [
      {
        daysAgo: 430,
        rating: 3.5,
        occasion: "date_night",
        spend: 38,
        partySize: 2,
        wouldReturn: false,
        thoughts: "Nice room but the pasta was under-seasoned for the price.",
        items: [{ name: "Truffle tagliatelle", category: "main", rating: 3, price: 24 }],
      },
    ],
  },
  {
    name: "Nom Bakery",
    status: "wishlist",
    savedDaysAgo: 18,
    savedReason: "Everyone says the cardamom buns sell out by 11",
    tags: ["takeaway"],
    budget: { min: 5, max: 12 },
  },
  {
    name: "Pesce Mare",
    status: "wishlist",
    savedDaysAgo: 62,
    savedReason: "Seafront dinner for the anniversary",
    tags: ["special occasion"],
  },
  {
    name: "Anoi Village Tavern",
    status: "wishlist",
    savedDaysAgo: 95,
    savedReason: "Mountain meze drive on a Sunday",
    tags: ["countryside"],
  },
  {
    name: "Parekklisia Grove Kitchen",
    status: "wishlist",
    savedDaysAgo: 8,
    savedReason: "Farm brunch outside Limassol",
    tags: ["weekend"],
  },
  {
    name: "Ta Pinakia Street Kitchen",
    status: "saved",
    savedDaysAgo: 210,
    visits: [
      {
        daysAgo: 30,
        rating: 4,
        occasion: "quick_lunch",
        spend: 8,
        wouldReturn: true,
        thoughts: "Reliable cheap lunch. The gyros is better than the souvlaki.",
        items: [{ name: "Pork gyros wrap", category: "main", rating: 4, price: 6, highlight: true }],
      },
    ],
  },
  {
    name: "Latsia Grill House",
    status: "saved",
    savedDaysAgo: 190,
    visits: [
      {
        daysAgo: 160,
        rating: 4.5,
        occasion: "group_meal",
        spend: 12,
        partySize: 4,
        wouldReturn: true,
        thoughts: "Best sheftalia in the area and it is cheap.",
        items: [{ name: "Sheftalia", category: "main", rating: 4.5, price: 8, highlight: true }],
      },
    ],
  },
];

export interface SeedResult {
  userId: string;
  places: number;
  visits: number;
  items: number;
  created: boolean;
}

export async function ensureDemoUser(
  repos?: Repositories,
  options: { reseed?: boolean } = {},
): Promise<SeedResult> {
  const repo = repos ?? (await defaultRepositories());
  let user = await repo.users.findByEmail(DEMO_USER_EMAIL);
  let created = false;

  if (!user) {
    user = await repo.users.create({
      email: DEMO_USER_EMAIL,
      name: DEMO_USER_NAME,
      passwordHash: hashPassword(DEMO_USER_PASSWORD),
      isDemo: true,
    });
    created = true;
  }

  const existing = await repo.places.countByUser(user.id);
  if (existing > 0 && !options.reseed) {
    return { userId: user.id, places: existing, visits: 0, items: 0, created };
  }

  if (options.reseed && existing > 0) {
    await clearUserData(user.id, repo);
  }

  const seeded = await seedLibrary(user.id, repo);
  return { userId: user.id, ...seeded, created: true };
}

export async function resetDemoData(repos?: Repositories): Promise<SeedResult> {
  const repo = repos ?? (await defaultRepositories());
  return ensureDemoUser(repo, { reseed: true });
}

async function clearUserData(userId: string, repo: Repositories): Promise<void> {
  const places = await repo.places.listByUser(userId);
  for (const place of places) {
    const visits = await repo.visits.listByPlace(userId, place.id);
    for (const visit of visits) {
      await repo.foodItems.deleteByVisit(userId, visit.id);
      await repo.visits.delete(userId, visit.id);
    }
    await repo.places.delete(userId, place.id);
  }
}

async function seedLibrary(
  userId: string,
  repo: Repositories,
): Promise<{ places: number; visits: number; items: number }> {
  const now = Date.now();
  let visitCount = 0;
  let itemCount = 0;

  for (const plan of SEED_PLAN) {
    const result = DEMO_PLACES.find((place) => place.name === plan.name);
    if (!result) continue;
    const place = buildPlace(userId, result, plan, now);
    await repo.places.insert(place);

    for (const visitPlan of plan.visits ?? []) {
      const visit = buildVisit(userId, place.id, visitPlan, now);
      await repo.visits.insert(visit);
      visitCount += 1;
      const items = visitPlan.items.map((item) => buildFoodItem(userId, visit, item, now));
      if (items.length > 0) {
        await repo.foodItems.insertMany(items);
        itemCount += items.length;
      }
    }
  }

  return { places: SEED_PLAN.length, visits: visitCount, items: itemCount };
}

function buildPlace(
  userId: string,
  result: PlaceSearchResult,
  plan: SeedPlace,
  now: number,
): Place {
  const savedAt = new Date(now - plan.savedDaysAgo * 86_400_000).toISOString();
  const priceRange = (result.externalMeta?.priceRange ?? null) as {
    min: number;
    max: number;
  } | null;

  const hasManualBudget = Boolean(plan.budget);
  return {
    id: newId("plc"),
    userId,
    name: result.name,
    category: result.category,
    cuisines: result.cuisines,
    address: result.address,
    city: result.city,
    area: result.area,
    district: result.district,
    latitude: result.latitude,
    longitude: result.longitude,
    provider: "demo",
    providerPlaceId: result.providerPlaceId,
    publicRating: result.publicRating,
    publicRatingCount: result.publicRatingCount,
    priceLevel: result.priceLevel,
    website: result.website,
    phone: result.phone,
    openingHours: result.openingHours ?? parseWeekSpec("Mo-Su 09:00-23:00"),
    photoRef: result.photoRef,
    externalFetchedAt: new Date(now - 5 * 86_400_000).toISOString(),
    externalMeta: result.externalMeta,
    expectedSpendMin: hasManualBudget ? plan.budget!.min : (priceRange?.min ?? null),
    expectedSpendMax: hasManualBudget
      ? plan.budget!.max
      : (priceRange?.max ?? priceRange?.min ?? null),
    budgetSource: hasManualBudget ? "manual" : priceRange ? "provider_price_range" : "provider_price_level",
    budgetUpdatedAt: savedAt,
    note: plan.note ?? null,
    savedReason: plan.savedReason ?? null,
    tags: plan.tags ?? [],
    overrides: hasManualBudget ? ["expectedSpendMin", "expectedSpendMax"] : [],
    status: plan.status,
    savedAt,
    createdAt: savedAt,
    updatedAt: savedAt,
  };
}

function buildVisit(userId: string, placeId: string, plan: SeedVisit, now: number): Visit {
  const visitedAt = new Date(now - plan.daysAgo * 86_400_000).toISOString();
  return {
    id: newId("vis"),
    userId,
    placeId,
    visitedAt,
    occasion: plan.occasion,
    partySize: plan.partySize ?? null,
    rating: plan.rating,
    thoughts: plan.thoughts,
    spendPerPerson: plan.spend,
    wouldReturn: plan.wouldReturn ?? true,
    tags: plan.tags ?? [],
    createdAt: visitedAt,
  };
}

function buildFoodItem(
  userId: string,
  visit: Visit,
  item: SeedVisit["items"][number],
  now: number,
): FoodItem {
  return {
    id: newId("itm"),
    userId,
    visitId: visit.id,
    placeId: visit.placeId,
    name: item.name,
    category: item.category ?? null,
    rating: item.rating,
    comment: item.comment ?? null,
    isHighlight: item.highlight ?? item.rating >= 4.5,
    price: item.price ?? null,
    createdAt: visit.visitedAt,
  };
}
