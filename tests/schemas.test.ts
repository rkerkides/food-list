import { describe, expect, it } from "vitest";
import { addPlaceSchema, manualPlaceSchema, placeStatusSchema, updatePlaceSchema } from "@/lib/domain/schemas";

const searchResult = {
  provider: "manual" as const,
  providerPlaceId: "manual-1",
  name: "Range Taverna",
  category: "restaurant" as const,
  cuisines: [],
};

const schemas = [
  { name: "addPlaceSchema", schema: addPlaceSchema, base: { result: searchResult } },
  { name: "manualPlaceSchema", schema: manualPlaceSchema, base: { name: "Range Taverna" } },
  { name: "updatePlaceSchema", schema: updatePlaceSchema, base: {} },
] as const;

describe.each(schemas)("$name spend range", ({ schema, base }) => {
  const parse = (expectedSpendMin: number | string | null, expectedSpendMax: number | string | null) =>
    schema.safeParse({ ...base, expectedSpendMin, expectedSpendMax });

  it("accepts a minimum below the maximum", () => {
    expect(parse(15, 25).success).toBe(true);
  });

  it("accepts an equal minimum and maximum", () => {
    expect(parse(20, 20).success).toBe(true);
  });

  it("accepts a range with only one side set", () => {
    expect(parse(15, null).success).toBe(true);
    expect(parse(null, 25).success).toBe(true);
    expect(parse("15", "").success).toBe(true);
  });

  it("rejects a minimum above the maximum on expectedSpendMax", () => {
    const result = parse(40, 20);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]).toMatchObject({ path: ["expectedSpendMax"], message: "Minimum can't exceed maximum" });
  });

  it("rejects an inverted range given as strings", () => {
    const result = parse("40", "20");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("Minimum can't exceed maximum");
  });
});

describe("placeStatusSchema", () => {
  it.each(["wishlist", "saved", "favourite", "archived"])("accepts %s", (status) => {
    expect(placeStatusSchema.safeParse(status).success).toBe(true);
  });

  it.each(["deleted", "", "Saved", null, 1])("rejects %j", (status) => {
    expect(placeStatusSchema.safeParse(status).success).toBe(false);
  });
});
