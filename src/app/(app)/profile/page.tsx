import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { AuthenticatedOnly, SignOutButton, DemoResetButton } from "@/components/app/profile-controls";
import { SharedCircles } from "@/components/app/shared-circles";
import { CuisineCatalogManager } from "@/components/app/cuisine-catalog-manager";
import { Stars } from "@/components/app/rating";
import { requireUser } from "@/lib/auth/session";
import { loadTasteInsights } from "@/lib/services/insights";
import { loadUserLibrary } from "@/lib/services/library";
import { listSharedCircles } from "@/lib/services/circles";
import { listCuisineCatalog } from "@/lib/services/cuisines";
import { describeProvider, resolveProviderId } from "@/lib/places";
import { formatBudgetRange, formatRating, titleCase } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ClipboardList, Compass, ListChecks, Sparkles, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const [insights, library, circles, cuisineCatalog] = await Promise.all([
    loadTasteInsights(user.id),
    loadUserLibrary(user.id),
    listSharedCircles(user.id),
    listCuisineCatalog(user.id),
  ]);
  const provider = describeProvider();
  const providerId = resolveProviderId();

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold">Your taste</h1>
        <p className="max-w-2xl text-sm text-ink-muted text-pretty">
          Lightweight patterns inferred from your own visits and dish ratings — not a black box.
          Small samples are deliberately down-weighted so one good meal never defines you.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Places saved" value={library.places.length} />
        <StatCard label="Visits logged" value={library.visits.length} />
        <StatCard
          label="Median spend"
          value={
            insights.spending.median != null
              ? formatBudgetRange(insights.spending.median, null, {
                  approximate: true,
                  perPersonSuffix: false,
                })
              : "—"
          }
        />
      </div>

      {!insights.hasEnoughData ? (
        <EmptyState
          icon={Compass}
          title="Not enough history yet"
          description="Log a few visits with dish ratings and your taste profile will start to take shape here. Until then, recommendations lean on your saved places and public data."
          action={
            <Button asChild>
              <Link href="/places?visitState=unvisited">Find somewhere to try</Link>
            </Button>
          }
        />
      ) : (
        <>
          {insights.highlights.length > 0 ? (
            <Card className="space-y-2 p-5">
              <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                What stands out
              </h2>
              <ul className="space-y-2">
                {insights.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-2 text-sm text-ink-soft">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-clay-600" />
                    <span className="text-pretty">{highlight}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <TasteTable
              title="Cuisines"
              rows={insights.cuisines.slice(0, 8)}
              emptyLabel="No cuisine patterns yet"
            />
            <TasteTable
              title="Venue types"
              rows={insights.categories.slice(0, 8)}
              emptyLabel="No venue-type patterns yet"
            />
          </div>

          {insights.dishes.length > 0 ? (
            <Card className="space-y-3 p-5">
              <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                Dishes you rate highly
              </h2>
              <div className="flex flex-wrap gap-2">
                {insights.dishes.map((dish) => (
                  <span
                    key={dish.key}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm"
                  >
                    {dish.label}
                    <Stars value={dish.average} size="sm" />
                    <span className="text-xs text-ink-muted">{dish.note}</span>
                  </span>
                ))}
              </div>
            </Card>
          ) : null}

          {insights.spending.byCategory.length > 0 ? (
            <Card className="space-y-3 p-5">
              <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                What you actually spend
              </h2>
              <ul className="divide-y divide-line">
                {insights.spending.byCategory.map((row) => (
                  <li key={row.category} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink-soft">{titleCase(row.category)}</span>
                    <span className="text-ink-muted">
                      {formatBudgetRange(row.median, null, {
                        approximate: true,
                        perPersonSuffix: false,
                      })}{" "}
                      · {row.count} {row.count === 1 ? "visit" : "visits"}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}

      {insights.disclaimers.length > 0 ? (
        <div className="space-y-2">
          {insights.disclaimers.map((disclaimer) => (
            <Alert key={disclaimer} variant="info">
              {disclaimer}
            </Alert>
          ))}
        </div>
      ) : null}

      <SharedCircles circles={circles} currentUserId={user.id} />

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">Cuisine catalogue</h2>
          <p className="mt-1 text-sm text-ink-muted">Controlled labels keep filters and taste insights consistent.</p>
        </div>
        <CuisineCatalogManager
          initial={cuisineCatalog
            .filter((entry) => entry.source === "custom")
            .map((entry) => ({ id: entry.id, name: entry.name }))}
        />
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">Account</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">Name</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Places provider</dt>
            <dd className="flex items-center gap-2 font-medium">
              {provider.label}
              <Badge variant={providerId !== "demo" ? "olive" : "default"} size="sm">
                {providerId === "google"
                  ? "Live"
                  : providerId === "osm"
                    ? "Local OSM"
                    : "Demo data"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Data store</dt>
            <dd className="font-medium">
              {(process.env.DATABASE_DRIVER ?? "sqlite") === "postgres"
                ? "Postgres / Supabase"
                : "Local SQLite file"}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button asChild variant="outline">
            <Link href="/profile/data-status">
              <ListChecks className="size-4" />
              Data status
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile/review-queue">
              <ClipboardList className="size-4" />
              Review queue
            </Link>
          </Button>
          <SignOutButton />
          <DemoResetButton isDemo={user.isDemo} />
          <AuthenticatedOnly />
        </div>
      </Card>

      <p className="pb-4 text-xs text-ink-muted">
        {library.preferences.visitCount > 0
          ? `Based on ${library.preferences.visitCount} visits and ${library.preferences.ratedVisitCount} ratings. Average personal rating ${library.preferences.averagePersonalRating ? formatRating(library.preferences.averagePersonalRating) : "—"}.`
          : "No visit history yet — your taste profile will fill in as you log visits."}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    </Card>
  );
}

function TasteTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: { key: string; label: string; average: number; count: number; confidence: string; note: string }[];
  emptyLabel: string;
}) {
  return (
    <Card className="space-y-3 p-5">
      <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.key} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="flex items-center gap-2 text-ink-muted">
                  <Stars value={row.average} size="sm" />
                  {formatRating(row.average)}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase",
                      row.confidence === "high"
                        ? "bg-olive-100 text-olive-800"
                        : row.confidence === "medium"
                          ? "bg-clay-100 text-clay-800"
                          : "bg-surface-muted text-ink-muted",
                    )}
                  >
                    {row.confidence} confidence
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-clay-500"
                  style={{ width: `${(row.average / 5) * 100}%` }}
                />
              </div>
              <p className="text-xs text-ink-muted">{row.note}</p>
            </li>
          ))}
        </ul>
      )}
      {rows.length === 0 ? <UtensilsCrossed className="size-4 text-ink-muted" /> : null}
    </Card>
  );
}
