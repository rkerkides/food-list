import type { OpeningHours } from "./types";

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

export function parseTime(value: string): number | null {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function parseDayHours(spec: string): { open: string; close: string }[] {
  const trimmed = spec.trim();
  if (!trimmed || trimmed.toLowerCase() === "closed") return [];
  return trimmed
    .split(",")
    .map((chunk) => chunk.trim())
    .flatMap((chunk) => {
      const [open, close] = chunk.split("-").map((part) => part.trim());
      if (!open || !close || parseTime(open) === null || parseTime(close) === null) return [];
      return [{ open, close }];
    });
}

export function formatDayHours(hours: { open: string; close: string }[]): string {
  if (hours.length === 0) return "Closed";
  return hours.map(({ open, close }) => `${open}–${close}`).join(", ");
}

export const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Open-now check. Handles past-midnight closing times (e.g. 12:00–01:00) by
 * also checking the previous day's window.
 */
export function isOpenAt(
  hours: OpeningHours | null,
  date: Date = new Date(),
  timeZone = "Asia/Nicosia",
): boolean | null {
  if (!hours || hours.length === 0) return null;

  const { day, minutes } = localDayAndMinutes(date, timeZone);
  const today = hours[day] ?? [];
  const yesterday = hours[(day + 6) % 7] ?? [];

  for (const window of today) {
    const open = parseTime(window.open);
    const close = parseTime(window.close);
    if (open === null || close === null) continue;
    if (close <= open) {
      if (minutes >= open) return true; // spills into tomorrow
    } else if (minutes >= open && minutes < close) {
      return true;
    }
  }

  for (const window of yesterday) {
    const open = parseTime(window.open);
    const close = parseTime(window.close);
    if (open === null || close === null) continue;
    if (close <= open && minutes < close) return true; // still open past midnight
  }

  return false;
}

export function localDayAndMinutes(
  date: Date,
  timeZone: string,
): { day: number; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const dayIndex = DAY_SHORT.indexOf(weekday);
  return {
    day: dayIndex === -1 ? date.getDay() : dayIndex,
    minutes: (hour % 24) * 60 + minute,
  };
}

/** Groups a weekly schedule into "Mon–Fri 09:00–23:00" style summaries. */
export function summariseWeek(hours: OpeningHours | null): string[] {
  if (!hours || hours.length === 0) return [];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const lines: string[] = [];
  for (const day of order) {
    lines.push(`${DAY_LABELS[day]}: ${formatDayHours(hours[day] ?? [])}`);
  }
  return lines;
}

const DAY_TOKENS: Record<string, number> = {
  su: 0,
  sun: 0,
  sunday: 0,
  mo: 1,
  mon: 1,
  monday: 1,
  tu: 2,
  tue: 2,
  tues: 2,
  tuesday: 2,
  we: 3,
  wed: 3,
  wednesday: 3,
  th: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fr: 5,
  fri: 5,
  friday: 5,
  sa: 6,
  sat: 6,
  saturday: 6,
};

/**
 * Parses the compact weekly spec used by the demo provider, e.g.
 * "Mo-Fr 12:00-23:00 | Sa 10:00-00:30 | Su closed".
 */
export function parseWeekSpec(spec: string): OpeningHours {
  const week: OpeningHours = [[], [], [], [], [], [], []];
  for (const rawSegment of spec.split("|")) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    const match = /^([A-Za-z,\-\s]+)\s+(.*)$/.exec(segment);
    if (!match) continue;
    const [, daysPart, hoursPart] = match;
    const days = expandDays(daysPart);
    const windows = parseDayHours(hoursPart);
    for (const day of days) week[day] = windows;
  }
  return week;
}

function expandDays(daysPart: string): number[] {
  const days = new Set<number>();
  for (const chunk of daysPart.split(",")) {
    const part = chunk.trim();
    if (!part) continue;
    const range = /^([A-Za-z]+)\s*-\s*([A-Za-z]+)$/.exec(part);
    if (range) {
      const start = DAY_TOKENS[range[1].toLowerCase()];
      const end = DAY_TOKENS[range[2].toLowerCase()];
      if (start === undefined || end === undefined) continue;
      let cursor = start;
      for (let i = 0; i < 7; i += 1) {
        days.add(cursor);
        if (cursor === end) break;
        cursor = (cursor + 1) % 7;
      }
      continue;
    }
    const day = DAY_TOKENS[part.toLowerCase()];
    if (day !== undefined) days.add(day);
  }
  return [...days];
}
