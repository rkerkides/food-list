import { describe, expect, it } from "vitest";
import { filterPreparedPlaces } from "@/lib/domain/filters";
import { buildLibrary } from "@/lib/services/library";
import { importStarterList } from "@/lib/services/starter-list";
import { createTestContext } from "./helpers";

describe("starter-list import", () => {
  it("keeps the tried list separate from the want-to-try list and can be safely rerun", async () => {
    const ctx = await createTestContext();

    const first = await importStarterList(ctx.userId, ctx.repos);
    expect(first).toEqual({
      createdPlaces: 61,
      existingPlaces: 0,
      importedVisits: 30,
      importedDishes: 3,
    });

    const [places, visits, items] = await Promise.all([
      ctx.repos.places.listByUser(ctx.userId),
      ctx.repos.visits.listByUser(ctx.userId),
      ctx.repos.foodItems.listByUser(ctx.userId),
    ]);
    const library = buildLibrary(places, visits, items);

    expect(filterPreparedPlaces(library.prepared, { visitState: "visited" })).toHaveLength(30);
    expect(filterPreparedPlaces(library.prepared, { visitState: "unvisited" })).toHaveLength(31);
    expect(places.find((place) => place.name === "Aigaion")?.status).toBe("wishlist");
    expect(items.map((item) => item.name).sort()).toEqual([
      "Gnocchi gorgonzola",
      "Spicy arrabbiata",
      "Tiramisu",
    ]);

    const second = await importStarterList(ctx.userId, ctx.repos);
    expect(second).toEqual({
      createdPlaces: 0,
      existingPlaces: 61,
      importedVisits: 0,
      importedDishes: 0,
    });
  });
});
