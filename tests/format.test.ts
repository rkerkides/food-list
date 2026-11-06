import { describe, expect, it } from "vitest";
import { relativeTime } from "@/lib/utils/format";

const DAY = 86_400_000;
const NOW = new Date("2026-09-18T09:00:00.000Z");

function offset(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}

describe("relativeTime", () => {
  it("reads 'yesterday' for one day in the past", () => {
    expect(relativeTime(offset(-DAY), NOW)).toBe("yesterday");
  });

  it("reads 'tomorrow' for one day in the future", () => {
    expect(relativeTime(offset(DAY), NOW)).toBe("tomorrow");
  });

  it("reads 'today' within the same day", () => {
    expect(relativeTime(offset(-3 * 60 * 60 * 1000), NOW)).toBe("today");
  });

  it("counts several days in either direction", () => {
    expect(relativeTime(offset(-5 * DAY), NOW)).toBe("5 days ago");
    expect(relativeTime(offset(5 * DAY), NOW)).toBe("in 5 days");
  });

  it("keeps month and year wording", () => {
    expect(relativeTime(offset(-45 * DAY), NOW)).toBe("1 month ago");
    expect(relativeTime(offset(-400 * DAY), NOW)).toBe("1 year ago");
  });

  it("rounds hours to the nearest day at the boundaries", () => {
    const HOUR = 60 * 60 * 1000;
    const MINUTE = 60 * 1000;
    expect(relativeTime(offset(-(11 * HOUR + 59 * MINUTE)), NOW)).toBe("today");
    expect(relativeTime(offset(-12 * HOUR), NOW)).toBe("yesterday");
    expect(relativeTime(offset(-(35 * HOUR + 59 * MINUTE)), NOW)).toBe("yesterday");
    expect(relativeTime(offset(-36 * HOUR), NOW)).toBe("2 days ago");
  });

  it("switches units at the day, month and year boundaries", () => {
    expect(relativeTime(offset(-29 * DAY), NOW)).toBe("29 days ago");
    expect(relativeTime(offset(-30 * DAY), NOW)).toBe("1 month ago");
    expect(relativeTime(offset(-59 * DAY), NOW)).toBe("1 month ago");
    expect(relativeTime(offset(-60 * DAY), NOW)).toBe("2 months ago");
    expect(relativeTime(offset(-729 * DAY), NOW)).toBe("1 year ago");
    expect(relativeTime(offset(-730 * DAY), NOW)).toBe("2 years ago");
  });

  it("words future offsets", () => {
    expect(relativeTime(offset(3 * 60 * 60 * 1000), NOW)).toBe("today");
    expect(relativeTime(offset(45 * DAY), NOW)).toBe("in 1 month");
    expect(relativeTime(offset(800 * DAY), NOW)).toBe("in 2 years");
  });

  it("accepts ISO strings", () => {
    expect(relativeTime(offset(-DAY).toISOString(), NOW)).toBe("yesterday");
  });

  it("returns a dash for missing or invalid input", () => {
    expect(relativeTime(null, NOW)).toBe("—");
    expect(relativeTime(undefined, NOW)).toBe("—");
    expect(relativeTime("not a date", NOW)).toBe("—");
  });
});
