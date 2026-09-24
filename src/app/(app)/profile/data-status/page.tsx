import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataStatusEditor } from "@/components/app/data-status-editor";
import { requireUser } from "@/lib/auth/session";
import { loadDataQuality, type DataQualityField } from "@/lib/services/data-quality";
import { CheckCircle2, CircleAlert, MapPin } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Data status" };

const TRACKED_FIELDS: { field: DataQualityField; label: string }[] = [
  { field: "publicRating", label: "Public ratings" },
  { field: "publicRatingCount", label: "Review counts" },
  { field: "budget", label: "Budgets" },
  { field: "cuisines", label: "Cuisines" },
  { field: "category", label: "Venue types" },
  { field: "photo", label: "Images" },
  { field: "address", label: "Addresses" },
  { field: "mapLocation", label: "Map locations" },
];

export default async function DataStatusPage() {
  const user = await requireUser();
  const data = await loadDataQuality(user.id);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold">Data status</h1>
        <p className="max-w-2xl text-sm text-ink-muted text-pretty">
          A private checklist for your saved places. Public ratings and review counts are snapshots,
          so this shows what still needs a lookup rather than claiming that external facts are live.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Saved places" value={data.total} />
        <StatCard label="Ready to browse" value={data.complete} tone="good" />
        <StatCard label="Need attention" value={data.needsAttention} tone={data.needsAttention ? "warn" : "good"} />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-start gap-2">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-clay-700" />
          <div>
            <h2 className="text-sm font-semibold">Coverage by field</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              A place is ready when it has a rating, review count, usable budget, cuisine, venue type and image.
            </p>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {TRACKED_FIELDS.map(({ field, label }) => {
            const missing = data.missing[field];
            return (
              <div key={field} className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="text-ink-soft">{label}</dt>
                <dd className={missing === 0 ? "font-medium text-olive-800" : "font-medium text-clay-800"}>
                  {missing === 0 ? "Complete" : `${missing} missing`}
                </dd>
              </div>
            );
          })}
        </dl>
      </Card>

      {data.needsAttention === 0 ? (
        <Card className="flex items-center gap-3 p-5 text-sm text-ink-soft">
          <CheckCircle2 className="size-5 shrink-0 text-olive-700" />
          Every saved place has the core browsing data. Address and map-pin gaps, if any, are listed above.
        </Card>
      ) : (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Places to complete</h2>
            <span className="text-sm text-ink-muted">Most incomplete first</span>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
            <ul className="divide-y divide-line">
              {data.places
                .filter((entry) => !entry.isComplete)
                .map((entry) => (
                  <li key={entry.place.id} className="space-y-3 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <Link href={`/places/${entry.place.id}`} className="font-medium hover:text-clay-800 hover:underline">
                          {entry.place.name}
                        </Link>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                          <MapPin className="size-3" />
                          {entry.place.city ?? entry.place.address ?? "Location not set"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <div className="flex flex-wrap gap-1.5">
                          {entry.issues.map((issue) => (
                            <Badge key={issue.field} variant="clay" size="sm">
                              {issue.label}
                            </Badge>
                          ))}
                        </div>
                        <DataStatusEditor place={entry.place} issues={entry.issues} />
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "warn";
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      <p className={tone === "good" ? "mt-1 font-display text-3xl font-semibold text-olive-800" : tone === "warn" ? "mt-1 font-display text-3xl font-semibold text-clay-800" : "mt-1 font-display text-3xl font-semibold"}>
        {value}
      </p>
    </Card>
  );
}
