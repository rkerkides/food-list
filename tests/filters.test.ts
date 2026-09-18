import { describe, expect, it } from "vitest";
import { deriveFilterOptions, filterPreparedPlaces, sortPreparedPlaces } from "@/lib/domain/filters";
import { buildUserPreferences } from "@/lib/domain/preferences";
import { preparePlaces } from "@/lib/domain/place-view";
import { emptyWeek, makeItem, makePlace, makeVisit } from "./fixtures";

const visits = [
  makeVisit({
    id: "v_pizza",
    placeId: "pizza",
    rating: 3,
    spendPerPerson: 14,
    visitedAt: new Date("2026-05-01").toISOString(),
  }),
  makeVisit({
    id: "v_tocayo",
    placeId: "tocayo",
    rating: 5,
    spendPerPerson: 30,
    visitedAt: new Date("2025-08-01").toISOString(),
  }),
];

const items = [
  makeItem({ id: "i1", placeId: "tocayo", visitId: "v_tocayo", name: "Truffle gyoza", rating: 5 }),
];

const history = { visits, items };

const places = [
  makePlace({
    id: "jp",
    name: "Yuzu & Co",
    cuisines: ["Japanese", "Sushi"],
    category: "restaurant",
    city: "Limassol",
    area: "Agia Zoni",
    priceLevel: 3,
    expectedSpendMin: 30,
    expectedSpendMax: 45,
    publicRating: 4.8,
    status: "wishlist",
    savedAt: new Date("2026-08-01").toISOString(),
  }, history),
  makePlace({
    id: "pizza",
    name: "Pizza Engomi",
    cuisines: ["Pizza", "Italian"],
    category: "restaurant",
    city: "Nicosia",
    area: "Engomi",
    priceLevel: 1,
    expectedSpendMin: 10,
    expectedSpendMax: 16,
    publicRating: 4.2,
    status: "saved",
    savedAt: new Date("2026-06-01").toISOString(),
  }, history),
  makePlace({
    id: "brunch",
    name: "Sesame & Fig",
    cuisines: ["Brunch", "Mediterranean"],
    category: "brunch",
    city: "Nicosia",
    area: "Strovolos",
    priceLevel: 2,
    expectedSpendMin: 12,
    expectedSpendMax: 22,
    publicRating: 4.6,
    status: "favourite",
    savedAt: new Date("2026-07-01").toISOString(),
    openingHours: emptyWeek(),
  }, history),
  makePlace({
    id: "tocayo",
    name: "Tocayo Cocina",
    cuisines: ["Asian fusion", "Japanese"],
    category: "restaurant",
    city: "Nicosia",
    area: "Strovolos",
    priceLevel: 3,
    expectedSpendMin: 25,
    expectedSpendMax: 35,
    publicRating: 4.6,
    status: "saved",
    savedAt: new Date("2025-06-01").toISOString(),
  }, history),
];

const preferences = buildUserPreferences(places, visits, items);
const prepared = preparePlaces(places, { visits, items }, preferences, { originArea: "Nicosia" });

describe("place filtering", () => {
  it("filters by city and by cuisine", () => {
    const limassol = filterPreparedPlaces(prepared, { city: "Limassol" });
    expect(limassol.map((entry) => entry.place.id)).toEqual(["jp"]);

    const japanese = filterPreparedPlaces(prepared, { cuisines: ["Japanese"] });
    expect(japanese.map((entry) => entry.place.id).sort()).toEqual(["jp", "tocayo"]);
  });

  it("enforces a maximum spend using the resolved budget", () => {
    const cheap = filterPreparedPlaces(prepared, { maxSpend: 17 });
    expect(cheap.map((entry) => entry.place.id).sort()).toEqual(["brunch", "pizza"]);
  });

  it("separates visited from unvisited places", () => {
    expect(
      filterPreparedPlaces(prepared, { visitState: "visited" }).map((entry) => entry.place.id).sort(),
    ).toEqual(["pizza", "tocayo"]);
    expect(
      filterPreparedPlaces(prepared, { visitState: "unvisited" })
        .map((entry) => entry.place.id)
        .sort(),
    ).toEqual(["brunch", "jp"]);
  });

  it("supports favourites, wishlist and tag filters", () => {
    expect(
      filterPreparedPlaces(prepared, { favouritesOnly: true }).map((entry) => entry.place.id),
    ).toEqual(["brunch"]);
    expect(filterPreparedPlaces(prepared, { wishlistOnly: true }).map((entry) => entry.place.id)).toEqual([
      "jp",
    ]);
    expect(
      filterPreparedPlaces(prepared, { tags: ["book ahead"] }).map((entry) => entry.place.id),
    ).toEqual([]);
  });

  it("filters by search text across name, dish and area", () => {
    expect(
      filterPreparedPlaces(prepared, { search: "strovolos" }).map((entry) => entry.place.id).sort(),
    ).toEqual(["brunch", "tocayo"]);
    expect(filterPreparedPlaces(prepared, { search: "gyoza" }).map((entry) => entry.place.id)).toEqual([
      "tocayo",
    ]);
  });

  it("drops places that are closed when open-now is requested", () => {
    const openNow = filterPreparedPlaces(prepared, { openNow: true });
    expect(openNow.map((entry) => entry.place.id)).not.toContain("brunch");
  });

  it("applies distance constraints when coordinates are known", () => {
    const near = filterPreparedPlaces(prepared, { maxDistanceKm: 3 });
    expect(near.every((entry) => entry.distanceKm !== null && entry.distanceKm <= 3)).toBe(true);
  });
});

describe("place sorting", () => {
  it("sorts by price, rating and recency", () => {
    expect(sortPreparedPlaces(prepared, "price").map((entry) => entry.place.id)[0]).toBe("pizza");
    expect(sortPreparedPlaces(prepared, "public_rating").map((entry) => entry.place.id)[0]).toBe("jp");
    expect(sortPreparedPlaces(prepared, "recently_added").map((entry) => entry.place.id)[0]).toBe("jp");
    expect(sortPreparedPlaces(prepared, "longest_since_visit").map((entry) => entry.place.id)[0]).toBe(
      "tocayo",
    );
  });

  it("derives filter options from the library", () => {
    const options = deriveFilterOptions(prepared);
    expect(options.cities).toEqual(["Nicosia", "Limassol"]);
    expect(options.categories).toContain("brunch");
    expect(options.cuisines).toContain("Japanese");
  });
});
