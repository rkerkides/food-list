const EUR = new Intl.NumberFormat("en-CY", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEur(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return EUR.format(value);
}

/** €12–18 / person, ~€25 / person, or "Budget unknown". */
export function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
  opts: { approximate?: boolean; perPersonSuffix?: boolean } = {},
): string {
  const suffix = opts.perPersonSuffix === false ? "" : "/person";
  const hasMin = typeof min === "number";
  const hasMax = typeof max === "number";

  if (!hasMin && !hasMax) return "Budget unknown";
  if (hasMin && hasMax && min !== max) {
    return `${formatEur(min)}–${formatEur(max)}${suffix}`;
  }
  const value = (hasMin ? min : max) as number;
  return `${opts.approximate ? "~" : ""}${formatEur(value)}${suffix}`;
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km === null || km === undefined || Number.isNaN(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatRating(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatMonthYear(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function relativeTime(input: string | Date | null | undefined, now = new Date()): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = now.getTime() - date.getTime();
  const past = diffMs >= 0;
  const days = Math.round(Math.abs(diffMs) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return past ? "yesterday" : "tomorrow";
  const label =
    days < 30
      ? `${days} days`
      : days < 60
        ? "1 month"
        : days < 365
          ? `${Math.round(days / 30)} months`
          : days < 730
            ? "1 year"
            : `${Math.round(days / 365)} years`;
  return past ? `${label} ago` : `in ${label}`;
}

export function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function todayIsoDate(now = new Date()): string {
  const tz = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}
