import { describe, expect, it } from "vitest";
import { normalizeCuisineList, normalizeCuisineName } from "@/lib/domain/cuisines";

describe("cuisine catalogue normalization", () => {
  it("homogenizes aliases and removes duplicate labels", () => {
    expect(normalizeCuisineList(["Burgers", "Burger", "street food", "Street Food"])).toEqual([
      "Burger",
      "Street Food",
    ]);
  });

  it("keeps registered custom labels intact", () => {
    expect(normalizeCuisineName("Ethiopian", ["Ethiopian"])).toBe("Ethiopian");
  });
});
