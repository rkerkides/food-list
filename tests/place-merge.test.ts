import { describe, expect, it } from "vitest";
import { findDuplicate, mergeExternalPlaceData } from "@/lib/domain/place-merge";
import type { Place, PlaceSearchResult } from "@/lib/domain/types";
import { makePlace } from "./fixtures";

function providerResult(overrides: Partial<PlaceSearchResult> = {}): PlaceSearchResult {
  return {
    provider: "google",
    providerPlaceId: "google-1",
    name: "Tocayo Cocina",
    category: "restaurant",
    cuisines: ["Asian fusion"],
    address: "28A Stasikratous Street, Nicosia",
    city: "Nicosia",
    area: "Strovolos",
    district: "Nicosia",
    latitude: 35.1633,
    longitude: 33.3492,
    publicRating: 4.6,
    publicRatingCount: 400,
    priceLevel: 3,
    website: "https://tocayo.example.com",
    phone: "+357 22 000 101",
    openingHours: null,
    photoRef: null,
    externalMeta: { priceRange: { min: 25, max: 35 } },
    ...overrides,
  };
}

describe("external data merging", () => {
  it("fills external facts on first save", () => {
    const existing: Pick<Place, "overrides"> = { overrides: [] };
    const merged = mergeExternalPlaceData(existing, providerResult(), { mode: "create" });

    expect(merged.values.name).toBe("Tocayo Cocina");
    expect(merged.values.publicRating).toBe(4.6);
    expect(merged.values.externalFetchedAt).toBeTruthy();
    expect(merged.values.budgetSource).toBe("provider_price_range");
    expect(merged.values.expectedSpendMin).toBe(25);
    expect(merged.values.expectedSpendMax).toBe(35);
  });

  it("never overwrites a field the user has edited", () => {
    const existing = makePlace({
      id: "plc_1",
      name: "Tocayo (my name)",
      cuisines: ["Asian"],
      overrides: ["name", "cuisines"],
      budgetSource: "manual",
      expectedSpendMin: 20,
      expectedSpendMax: 30,
    });

    const merged = mergeExternalPlaceData(existing, providerResult(), { mode: "refresh" });

    expect(merged.preserved).toContain("name");
    expect(merged.preserved).toContain("cuisines");
    expect(merged.values.name).toBeUndefined();
    expect(merged.values.cuisines).toBeUndefined();
    // External facts still update.
    expect(merged.values.publicRatingCount).toBe(400);
    // Manual budget is respected.
    expect(merged.values.expectedSpendMin).toBeUndefined();
  });

  it("keeps the previous provider payload for auditability", () => {
    const existing = makePlace({
      id: "plc_2",
      externalMeta: { providerSnapshot: { publicRating: 4.1 }, extra: "kept" },
    });
    const merged = mergeExternalPlaceData(existing, providerResult({ publicRating: 4.7 }), {
      mode: "refresh",
    });

    const meta = merged.values.externalMeta as Record<string, unknown>;
    expect(meta.extra).toBe("kept");
    expect((meta.previousSnapshot as { publicRating: number }).publicRating).toBe(4.1);
    expect((meta.providerSnapshot as { publicRating: number }).publicRating).toBe(4.7);
  });

  it("reports which external fields changed", () => {
    const existing = makePlace({ id: "plc_3", publicRating: 4.1, publicRatingCount: 100 });
    const merged = mergeExternalPlaceData(existing, providerResult(), { mode: "refresh" });
    expect(merged.changed).toContain("publicRating");
    expect(merged.changed).toContain("publicRatingCount");
  });
});

describe("duplicate detection", () => {
  it("matches on provider id before anything else", () => {
    const existing = [makePlace({ id: "plc_a", provider: "google", providerPlaceId: "google-1" })];
    const match = findDuplicate(providerResult(), existing);
    expect(match?.reason).toBe("provider_id");
    expect(match?.place.id).toBe("plc_a");
  });

  it("matches same name within 250 m", () => {
    const existing = [
      makePlace({
        id: "plc_b",
        provider: "demo",
        providerPlaceId: "demo-1",
        name: "Tocayo Cocina",
        latitude: 35.1633,
        longitude: 33.3492,
      }),
    ];
    const match = findDuplicate(
      providerResult({ providerPlaceId: "google-2", latitude: 35.1636, longitude: 33.3495 }),
      existing,
    );
    expect(match?.reason).toBe("same_name_nearby");
  });

  it("ignores a same-name venue in another city", () => {
    const existing = [
      makePlace({
        id: "plc_c",
        name: "Tocayo Cocina",
        city: "Larnaca",
        latitude: 34.9182,
        longitude: 33.6198,
      }),
    ];
    const match = findDuplicate(providerResult({ providerPlaceId: "google-3" }), existing);
    expect(match).toBeNull();
  });
});
