"use client";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PLACE_CATEGORIES, CATEGORY_LABELS, CYPRUS_CITIES } from "@/lib/domain/types";
import type { PlaceCategory, PlaceSearchResult, PlaceStatus } from "@/lib/domain/types";
import type { ProviderInfo } from "@/lib/places";
import { cn } from "@/lib/utils/cn";
import { formatBudgetRange, formatRating } from "@/lib/utils/format";
import { ArrowLeft, Check, Loader2, MapPin, Plus, Search, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { addPlaceAction, createManualPlaceAction } from "@/app/actions/places";
import { PlaceVisual } from "./place-visual";

type SearchResult = PlaceSearchResult & { alreadySaved: boolean; savedPlaceId: string | null };

interface DuplicateWarning {
  placeId: string;
  name: string;
  reason: string;
}

const CITY_FILTERS = ["", "Nicosia", "Limassol", "Larnaca", "Paphos"] as const;

export function AddPlaceDialog({
  provider,
  trigger,
}: {
  provider: ProviderInfo;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"search" | "details" | "manual">("search");
  const [query, setQuery] = React.useState("");
  const [city, setCity] = React.useState<string>("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [providerNote, setProviderNote] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<SearchResult | null>(null);
  const [duplicate, setDuplicate] = React.useState<DuplicateWarning | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = React.useCallback(() => {
    setStep("search");
    setQuery("");
    setResults([]);
    setSelected(null);
    setDuplicate(null);
    setSubmitError(null);
    setSearchError(null);
    setProviderNote(null);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (step === "search") {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [open, step]);

  React.useEffect(() => {
    if (!open || step !== "search") return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (city) params.set("city", city);
        const response = await fetch(`/api/places/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Place search is unavailable right now.");
        }
        const body = (await response.json()) as {
          results: SearchResult[];
          provider: ProviderInfo;
        };
        setResults(body.results);
        setProviderNote(body.provider.fallbackReason ?? null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchError(
          error instanceof Error ? error.message : "Place search is unavailable right now.",
        );
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 260);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, city, open, step]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setTimeout(reset, 200);
  }

  function selectResult(result: SearchResult) {
    if (result.alreadySaved && result.savedPlaceId) {
      handleOpenChange(false);
      router.push(`/places/${result.savedPlaceId}`);
      return;
    }
    setSelected(result);
    setDuplicate(null);
    setStep("details");
  }

  const visibleResults = query.trim().length >= 2 ? results : [];

  async function handleDetailsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const force = Boolean(duplicate);
    setSubmitting(true);
    setSubmitError(null);
    setDuplicate(null);

    const outcome = await addPlaceAction({
      result: selected,
      name: readString(form.get("name")) ?? selected.name,
      category: readCategory(form.get("category")),
      city: readString(form.get("city")),
      area: readString(form.get("area")),
      address: readString(form.get("address")),
      cuisines: readList(form.get("cuisines")),
      tags: readList(form.get("tags")),
      expectedSpendMin: readNumber(form.get("expectedSpendMin")),
      expectedSpendMax: readNumber(form.get("expectedSpendMax")),
      note: readString(form.get("note")),
      savedReason: readString(form.get("savedReason")),
      status: readStatus(form.get("status")),
      force,
    });

    setSubmitting(false);
    if (outcome.ok) {
      finish(outcome.placeId);
      return;
    }
    if (outcome.code === "duplicate" && outcome.duplicate) {
      setDuplicate(outcome.duplicate);
      return;
    }
    setSubmitError(outcome.error);
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setSubmitError(null);
    setDuplicate(null);

    const outcome = await createManualPlaceAction({
      name: readString(form.get("name")) ?? "",
      category: readCategory(form.get("category")) ?? "restaurant",
      city: (readString(form.get("city")) as never) ?? null,
      area: readString(form.get("area")),
      address: readString(form.get("address")),
      cuisines: readList(form.get("cuisines")),
      tags: readList(form.get("tags")),
      expectedSpendMin: readNumber(form.get("expectedSpendMin")),
      expectedSpendMax: readNumber(form.get("expectedSpendMax")),
      note: readString(form.get("note")),
      savedReason: readString(form.get("savedReason")),
      status: readStatus(form.get("status")),
      force: Boolean(duplicate),
    });

    setSubmitting(false);
    if (outcome.ok) {
      finish(outcome.placeId);
      return;
    }
    if (outcome.code === "duplicate" && outcome.duplicate) {
      setDuplicate(outcome.duplicate);
      return;
    }
    setSubmitError(outcome.error);
  }

  function finish(placeId: string) {
    handleOpenChange(false);
    router.refresh();
    router.push(`/places/${placeId}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add place</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </DialogTrigger>
      )}

        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            {step === "search" ? (
              <>
                <DialogTitle className="text-xl">Add a place</DialogTitle>
                <p className="text-sm text-ink-muted">
                  Type a name, a dish or an area — for example “brunch Strovolos”.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Back to search"
                  onClick={() => {
                    setStep("search");
                    setSelected(null);
                    setDuplicate(null);
                    setSubmitError(null);
                  }}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div>
                  <DialogTitle className="text-xl">
                    {step === "manual" ? "Add it by hand" : selected?.name}
                  </DialogTitle>
                  <p className="text-xs text-ink-muted">
                    {step === "manual"
                      ? "For places the provider does not know about."
                      : providerNote ?? `Details fetched from ${providerLabel(provider)}`}
                  </p>
                </div>
              </div>
            )}
          </DialogHeader>

          {step === "search" ? (
            <DialogBody className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tocayo, brunch Strovolos, pizza Engomi…"
                  className="h-12 pl-10 text-base"
                  autoComplete="off"
                />
                {searching ? (
                  <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-muted" />
                ) : null}
              </div>

              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {CITY_FILTERS.map((option) => (
                  <button
                    key={option || "all"}
                    type="button"
                    onClick={() => setCity(option)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      city === option
                        ? "border-ink bg-ink text-canvas"
                        : "border-line-strong bg-surface text-ink-soft hover:bg-surface-muted",
                    )}
                  >
                    {option || "All Cyprus"}
                  </button>
                ))}
              </div>

              {searchError ? <Alert variant="error">{searchError}</Alert> : null}
              {providerNote ? <Alert variant="info">{providerNote}</Alert> : null}

              <div className="space-y-2">
                {searching && visibleResults.length === 0
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="flex gap-3 rounded-2xl border border-line p-3">
                        <Skeleton className="size-12 shrink-0" />
                        <div className="flex-1 space-y-2 py-1">
                          <Skeleton className="h-3.5 w-2/5" />
                          <Skeleton className="h-3 w-3/5" />
                        </div>
                      </div>
                    ))
                  : null}

                {!searching && query.trim().length >= 2 && visibleResults.length === 0 && !searchError ? (
                  <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">
                    Nothing matched “{query}”. Try a different spelling or add it manually.
                  </p>
                ) : null}

                {visibleResults.map((result) => (
                  <button
                    key={`${result.provider}-${result.providerPlaceId}`}
                    type="button"
                    onClick={() => selectResult(result)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-line-strong hover:bg-surface-muted/60"
                  >
                    <PlaceVisual
                      name={result.name}
                      category={result.category}
                      photoRef={result.photoRef}
                      size="thumb"
                      className="shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink">{result.name}</span>
                        {result.alreadySaved ? (
                          <Badge variant="olive" size="sm">
                            <Check className="size-3" /> Saved
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-muted">
                        <MapPin className="size-3" />
                        {result.address ?? result.city ?? "Cyprus"}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
                        {result.publicRating != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="size-3 fill-star text-star" />
                            {formatRating(result.publicRating)}
                          </span>
                        ) : null}
                        <span className="capitalize">{CATEGORY_LABELS[result.category]}</span>
                        {result.externalMeta?.priceRange ? null : null}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep("manual");
                  setDuplicate(null);
                }}
              >
                Can’t find it? Add the place manually
              </Button>
            </DialogBody>
          ) : null}

          {step === "details" && selected ? (
            <form onSubmit={handleDetailsSubmit}>
              <DialogBody className="space-y-4">
                <div className="rounded-2xl border border-line bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <PlaceVisual
                      name={selected.name}
                      category={selected.category}
                      photoRef={selected.photoRef}
                      size="thumb"
                    />
                    <div className="min-w-0 text-xs text-ink-muted">
                      <p className="truncate text-sm font-medium text-ink">
                        {selected.address ?? selected.city}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {selected.publicRating != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="size-3 fill-star text-star" />
                            {formatRating(selected.publicRating)}
                            {selected.publicRatingCount
                              ? ` (${selected.publicRatingCount})`
                              : ""}
                          </span>
                        ) : (
                          <span>No public rating</span>
                        )}
                        {selected.priceLevel ? (
                          <span>{"€".repeat(selected.priceLevel)}</span>
                        ) : null}
                        {selected.openingHours ? <span>Hours available</span> : null}
                      </p>
                    </div>
                  </div>
                </div>

                {duplicate ? (
                  <Alert variant="error" title="Possible duplicate">
                    You already saved <strong>{duplicate.name}</strong>. Submit again to save it as a
                    separate entry, or open the existing one from your places list.
                  </Alert>
                ) : null}
                {submitError ? <Alert variant="error">{submitError}</Alert> : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <Input name="name" defaultValue={selected.name} readOnly />
                  </Field>
                  <Field label="Category">
                    <Select name="category" defaultValue={selected.category}>
                      {PLACE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field label="Cuisines" hint="Comma separated — overrides the provider wording.">
                  <Input name="cuisines" defaultValue={selected.cuisines.join(", ")} />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="City">
                    <Input name="city" defaultValue={selected.city ?? ""} />
                  </Field>
                  <Field label="Area">
                    <Input name="area" defaultValue={selected.area ?? ""} />
                  </Field>
                </div>

                <Field label="Address">
                  <Input name="address" defaultValue={selected.address ?? ""} />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Expected spend from" hint="€ per person">
                    <Input
                      name="expectedSpendMin"
                      inputMode="decimal"
                      placeholder="e.g. 15"
                      defaultValue={estimateFromLevel(selected.priceLevel)?.min ?? ""}
                    />
                  </Field>
                  <Field label="Expected spend to" hint="€ per person">
                    <Input
                      name="expectedSpendMax"
                      inputMode="decimal"
                      placeholder="e.g. 25"
                      defaultValue={estimateFromLevel(selected.priceLevel)?.max ?? ""}
                    />
                  </Field>
                </div>

                <Field label="Personal tags" hint="Comma separated, e.g. date night, work lunch">
                  <Input name="tags" placeholder="date night, book ahead" />
                </Field>

                <Field label="Why I saved it">
                  <Input name="savedReason" placeholder="A friend recommended the gyoza" />
                </Field>

                <Field label="Note">
                  <Textarea name="note" rows={2} placeholder="Anything you want to remember" />
                </Field>

                <Field label="List">
                  <Select name="status" defaultValue="saved">
                    <option value="wishlist">Want to try</option>
                    <option value="saved">Saved</option>
                    <option value="favourite">Favourite</option>
                  </Select>
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setStep("search")}>
                  Back
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {duplicate ? "Save anyway" : "Save place"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}

          {step === "manual" ? (
            <form onSubmit={handleManualSubmit}>
              <DialogBody className="space-y-4">
                {duplicate ? (
                  <Alert variant="error" title="Possible duplicate">
                    You already saved <strong>{duplicate.name}</strong>. Submit again to add it
                    anyway.
                  </Alert>
                ) : null}
                {submitError ? <Alert variant="error">{submitError}</Alert> : null}

                <Field label="Name">
                  <Input name="name" required placeholder="e.g. Yiayia's Kitchen" autoFocus />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Category">
                    <Select name="category" defaultValue="restaurant">
                      {PLACE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="City">
                    <Select name="city" defaultValue="Nicosia">
                      {CYPRUS_CITIES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Area">
                  <Input name="area" placeholder="e.g. Strovolos" />
                </Field>
                <Field label="Address">
                  <Input name="address" placeholder="Street, number" />
                </Field>
                <Field label="Cuisines">
                  <Input name="cuisines" placeholder="Cypriot, Grill" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Expected spend from" hint="€ per person">
                    <Input name="expectedSpendMin" inputMode="decimal" />
                  </Field>
                  <Field label="Expected spend to" hint="€ per person">
                    <Input name="expectedSpendMax" inputMode="decimal" />
                  </Field>
                </div>
                <Field label="Personal tags">
                  <Input name="tags" placeholder="takeaway, cheap" />
                </Field>
                <Field label="Note">
                  <Textarea name="note" rows={2} />
                </Field>
                <Field label="List">
                  <Select name="status" defaultValue="saved">
                    <option value="wishlist">Want to try</option>
                    <option value="saved">Saved</option>
                    <option value="favourite">Favourite</option>
                  </Select>
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setStep("search")}>
                  Back to search
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save place
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
    </Dialog>
  );
}

function providerLabel(provider: ProviderInfo): string {
  return provider.mode === "demo" ? "the demo dataset" : provider.label;
}

function readString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function readNumber(value: FormDataEntryValue | null): number | null {
  const raw = readString(value);
  if (raw === null) return null;
  const parsed = Number(raw.replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function readList(value: FormDataEntryValue | null): string[] {
  const raw = readString(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function readCategory(value: FormDataEntryValue | null): PlaceCategory | undefined {
  const raw = readString(value);
  if (!raw) return undefined;
  return (PLACE_CATEGORIES as readonly string[]).includes(raw) ? (raw as PlaceCategory) : undefined;
}

function readStatus(value: FormDataEntryValue | null): PlaceStatus | undefined {
  const raw = readString(value);
  if (!raw) return undefined;
  return ["wishlist", "saved", "favourite", "archived"].includes(raw)
    ? (raw as PlaceStatus)
    : undefined;
}

function estimateFromLevel(level: number | null | undefined): { min: number; max: number } | null {
  if (!level) return null;
  const ranges: Record<number, { min: number; max: number }> = {
    1: { min: 8, max: 14 },
    2: { min: 15, max: 25 },
    3: { min: 26, max: 45 },
    4: { min: 46, max: 80 },
  };
  return ranges[level] ?? null;
}

export { formatBudgetRange };
