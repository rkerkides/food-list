import { describe, expect, it } from "vitest";
import { toMapPoints } from "@/lib/domain/map-points";
import { preparePlace } from "@/lib/domain/place-view";
import { buildUserPreferences } from "@/lib/domain/preferences";
import type { PlaceWithStats } from "@/lib/domain/types";
import { makePlace, makeVisit } from "./fixtures";

function prepareAll(overrides: Partial<PlaceWithStats>[]) {
  const places = overrides.map((o) => makePlace(o));
  const preferences = buildUserPreferences(places, [], []);
  return places.map((place) =>
    preparePlace(place, { visits: [], items: [] }, preferences, { originArea: "Nicosia" }),
  );
}

describe("toMapPoints", () => {
  it("drops a place without latitude and keeps the rest in order", () => {
    const prepared = prepareAll([
      { id: "a" },
      { id: "b", latitude: null },
      { id: "c" },
    ]);
    expect(toMapPoints(prepared).map((point) => point.id)).toEqual(["a", "c"]);
  });

  it("drops a place that has latitude but no longitude", () => {
    const prepared = prepareAll([{ id: "a", latitude: 35.1, longitude: null }]);
    expect(toMapPoints(prepared)).toEqual([]);
  });

  it("keeps a place whose coordinate is zero", () => {
    const prepared = prepareAll([
      { id: "a", latitude: 0, longitude: 33 },
      { id: "b", latitude: 35, longitude: 0 },
    ]);
    expect(
      toMapPoints(prepared).map(({ id, latitude, longitude }) => ({ id, latitude, longitude })),
    ).toEqual([
      { id: "a", latitude: 0, longitude: 33 },
      { id: "b", latitude: 35, longitude: 0 },
    ]);
  });

  it("drops a place with a non-finite coordinate", () => {
    const prepared = prepareAll([
      { id: "a", latitude: Number.NaN, longitude: 33 },
      { id: "b", latitude: 35, longitude: Number.POSITIVE_INFINITY },
    ]);
    expect(toMapPoints(prepared)).toEqual([]);
  });

  it("returns no points when no place has coordinates", () => {
    const prepared = prepareAll([
      { id: "a", latitude: null, longitude: null },
      { id: "b", latitude: null, longitude: null },
    ]);
    expect(toMapPoints(prepared)).toEqual([]);
  });

  it("builds each point with the same fields the map pages use", () => {
    const place = makePlace(
      {
        id: "a",
        name: "Meze House",
        category: "restaurant",
        latitude: 35.1856,
        longitude: 33.3823,
        area: "Nicosia",
        city: "Nicosia",
        publicRating: 4.2,
        expectedSpendMin: 20,
        expectedSpendMax: 20,
        budgetSource: "provider_price_level",
        status: "favourite",
      },
      { visits: [makeVisit({ placeId: "a", rating: 4 })] },
    );
    const preferences = buildUserPreferences([place], [], []);
    const prepared = preparePlace(place, { visits: [], items: [] }, preferences, {
      originArea: "Strovolos",
    });

    expect(toMapPoints([prepared])).toEqual([
      {
        id: "a",
        name: "Meze House",
        category: "restaurant",
        latitude: 35.1856,
        longitude: 33.3823,
        area: "Nicosia",
        city: "Nicosia",
        publicRating: 4.2,
        personalRating: 4,
        budgetText: "~€20/person",
        distanceKm: expect.closeTo(5.699, 3),
        status: "favourite",
      },
    ]);
  });
});
