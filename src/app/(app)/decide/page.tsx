import { DecideForm, type DecideFormState } from "@/components/app/decide-form";
import { RecommendationCard } from "@/components/app/recommendation-card";
import { AddPlaceDialogButton } from "@/components/app/add-place-dialog-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
import { deriveFilterOptions } from "@/lib/domain/filters";
import { parseDecideParams, type RawSearchParams } from "@/lib/domain/place-query";
import { VISIT_OCCASIONS, type VisitOccasion } from "@/lib/domain/types";
import { loadUserLibrary } from "@/lib/services/library";
import { recommend } from "@/lib/services/recommendations";
import { Compass, Sparkles, UtensilsCrossed } from "lucide-react";

export const metadata = { title: "Decide" };

export default async function DecidePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requireUser();
  const raw = await searchParams;
  const params = parseDecideParams(raw);

  const hasCriteria = Object.entries(raw).some(([, value]) => Boolean(value));
  const library = await loadUserLibrary(user.id, { originArea: params.area });
  const options = deriveFilterOptions(library.prepared);

  const occasion = VISIT_OCCASIONS.includes(params.occasion as VisitOccasion)
    ? (params.occasion as VisitOccasion)
    : null;

  const outcome = await recommend(
    user.id,
    {
      area: params.area,
      maxDistanceKm: params.maxDistanceKm,
      cuisines: params.cuisines,
      foodQuery: params.foodQuery,
      maxSpend: params.maxSpend,
      categories: params.categories,
      occasion,
      vibe: params.vibe,
      visitState: params.visitState,
      minPublicRating: params.minPublicRating,
      minPersonalRating: params.minPersonalRating,
      openNow: params.openNow,
      favouritesOnly: params.favouritesOnly,
      surprise: params.surprise,
      limit: 5,
    },
    { library, seed: params.surprise ? hashSeed(raw) : undefined },
  );

  const formState: DecideFormState = {
    area: params.area ?? "",
    maxDistanceKm: params.maxDistanceKm ?? 60,
    cuisines: params.cuisines,
    foodQuery: params.foodQuery ?? "",
    maxSpend: params.maxSpend ?? 120,
    categories: params.categories,
    occasion: occasion ?? "",
    vibe: params.vibe,
    visitState: params.visitState,
    minPublicRating: params.minPublicRating,
    openNow: params.openNow,
    favouritesOnly: params.favouritesOnly,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <Badge variant="clay">
          <Compass className="size-3" />
          Decide
        </Badge>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Where should we eat?</h1>
        <p className="max-w-2xl text-sm text-ink-muted text-pretty">
          Tell me what you feel like, where you are and what you want to spend. I will weigh your
          own ratings, the dishes you loved, the venue data and how long it has been, then explain
          each suggestion.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        <Card className="p-4 sm:p-5 lg:sticky lg:top-24">
          <DecideForm options={options} initial={formState} />
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold">
              {params.surprise
                ? "Surprise picks"
                : hasCriteria
                  ? "Your best matches"
                  : "Strong matches right now"}
            </h2>
            {outcome.recommendations.length > 0 ? (
              <span className="text-xs text-ink-muted">
                {outcome.considered} candidate{outcome.considered === 1 ? "" : "s"} considered
              </span>
            ) : null}
          </div>

          {params.surprise ? (
            <Alert variant="info" title="Surprise mode">
              Cuisine, vibe and rating filters are relaxed. Your maximum budget
              {params.maxDistanceKm ? " and distance" : ""} still apply.
            </Alert>
          ) : null}

          {outcome.relaxed.length > 0 && outcome.recommendations.length > 0 ? (
            <Alert variant="info" title="Relaxed to find matches">
              {outcome.relaxed.join(", ")} — nothing matched strictly enough, so these are the
              closest options.
            </Alert>
          ) : null}

          {outcome.libraryEmpty ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="Save a few places first"
              description="Recommendations get interesting once you have saved places and logged what you thought of them. Add a couple of venues and come back."
              action={<AddPlaceDialogButton />}
            />
          ) : outcome.recommendations.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nothing fits all of that"
              description={outcome.message ?? "Try widening the distance or budget, or relax a filter."}
            />
          ) : (
            <div className="space-y-4">
              {outcome.recommendations.map((recommendation, index) => (
                <RecommendationCard
                  key={recommendation.place.id}
                  recommendation={recommendation}
                  rank={index + 1}
                />
              ))}
            </div>
          )}

          {outcome.recommendations.length > 0 && outcome.relaxed.length === 0 ? (
            <p className="text-xs text-ink-muted">
              Scores are transparent: open “Why this?” on any card to see how each factor
              contributed. Ratings come from your own visits first.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function hashSeed(params: RawSearchParams): number {
  const raw = JSON.stringify(params);
  let hash = 7;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) % 1_000_003;
  }
  return hash;
}
