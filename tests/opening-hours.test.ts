import { describe, expect, it } from "vitest";
import {
  formatDayHours,
  isOpenAt,
  localDayAndMinutes,
  parseDayHours,
  parseWeekSpec,
} from "@/lib/domain/opening-hours";
import { emptyWeek } from "./fixtures";

describe("opening hours", () => {
  it("parses compact weekly specs", () => {
    const week = parseWeekSpec("Mo-Fr 09:00-17:00 | Sa 10:00-14:00 | Su closed");
    expect(week[1]).toEqual([{ open: "09:00", close: "17:00" }]);
    expect(week[5]).toEqual([{ open: "09:00", close: "17:00" }]);
    expect(week[6]).toEqual([{ open: "10:00", close: "14:00" }]);
    expect(week[0]).toEqual([]);
  });

  it("parses split service hours", () => {
    expect(parseDayHours("12:00-15:00, 18:00-23:00")).toHaveLength(2);
    expect(formatDayHours(parseDayHours("closed"))).toBe("Closed");
  });

  it("detects open and closed windows in Cyprus time", () => {
    const date = new Date("2026-09-16T12:00:00Z"); // 15:00 in Nicosia
    const { day } = localDayAndMinutes(date, "Asia/Nicosia");

    const open = emptyWeek();
    open[day] = [{ open: "12:00", close: "23:00" }];
    expect(isOpenAt(open, date)).toBe(true);

    const closed = emptyWeek();
    closed[day] = [{ open: "18:00", close: "23:00" }];
    expect(isOpenAt(closed, date)).toBe(false);
  });

  it("handles venues that close after midnight", () => {
    const date = new Date("2026-09-15T22:00:00Z"); // 01:00 next day in Nicosia
    const { day } = localDayAndMinutes(date, "Asia/Nicosia");
    const previousDay = (day + 6) % 7;
    const week = emptyWeek();
    week[previousDay] = [{ open: "12:00", close: "02:00" }];

    expect(isOpenAt(week, date)).toBe(true);
  });

  it("returns null when no hours are known", () => {
    expect(isOpenAt(null)).toBeNull();
  });
});
