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
import { Switch } from "@/components/ui/switch";
import {
  FOOD_ITEM_CATEGORIES,
  FOOD_ITEM_CATEGORY_LABELS,
  OCCASION_LABELS,
  VISIT_OCCASIONS,
  type FoodItemCategory,
  type VisitOccasion,
  type VisitWithItems,
} from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { todayIsoDate } from "@/lib/utils/format";
import { Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { deleteVisitAction, logVisitAction, updateVisitAction } from "@/app/actions/visits";

interface DraftItem {
  key: string;
  name: string;
  category: FoodItemCategory | "";
  rating: number | null;
  price: string;
  comment: string;
  isHighlight: boolean;
}

function emptyItem(): DraftItem {
  return {
    key: Math.random().toString(36).slice(2),
    name: "",
    category: "",
    rating: null,
    price: "",
    comment: "",
    isHighlight: false,
  };
}

export function LogVisitDialog({
  placeId,
  placeName,
  visit,
  lastSpend,
  trigger,
}: {
  placeId: string;
  placeName: string;
  visit?: VisitWithItems;
  lastSpend?: number | null;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [visitedAt, setVisitedAt] = React.useState(
    visit ? visit.visitedAt.slice(0, 10) : todayIsoDate(),
  );
  const [occasion, setOccasion] = React.useState<VisitOccasion | "">(visit?.occasion ?? "");
  const [rating, setRating] = React.useState<number | null>(visit?.rating ?? null);
  const [spend, setSpend] = React.useState(
    visit?.spendPerPerson != null
      ? String(visit.spendPerPerson)
      : lastSpend
        ? String(lastSpend)
        : "",
  );
  const [partySize, setPartySize] = React.useState(visit?.partySize ? String(visit.partySize) : "");
  const [thoughts, setThoughts] = React.useState(visit?.thoughts ?? "");
  const [wouldReturn, setWouldReturn] = React.useState(visit?.wouldReturn ?? true);
  const [tags, setTags] = React.useState(visit?.tags.join(", ") ?? "");
  const [items, setItems] = React.useState<DraftItem[]>(
    visit && visit.items.length > 0
      ? visit.items.map((item) => ({
          key: item.id,
          name: item.name,
          category: (item.category ?? "") as FoodItemCategory | "",
          rating: item.rating,
          price: item.price != null ? String(item.price) : "",
          comment: item.comment ?? "",
          isHighlight: item.isHighlight,
        }))
      : [emptyItem()],
  );

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      placeId,
      visitedAt,
      occasion: occasion || null,
      partySize: partySize ? Number(partySize) : null,
      rating,
      thoughts: thoughts.trim() || null,
      spendPerPerson: spend ? Number(spend.replace(",", ".")) : null,
      wouldReturn,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      items: items
        .filter((item) => item.name.trim().length > 0)
        .map((item) => ({
          name: item.name.trim(),
          category: item.category || null,
          rating: item.rating,
          comment: item.comment.trim() || null,
          isHighlight: item.isHighlight,
          price: item.price ? Number(item.price.replace(",", ".")) : null,
        })),
    };

    try {
      const result = visit
        ? await updateVisitAction(visit.id, payload)
        : await logVisitAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
      if (!visit) {
        setItems([emptyItem()]);
        setThoughts("");
        setRating(null);
      }
    } catch {
      setError(
        "This page was updated while the visit form was open. Your details are still here — reload the page, then submit again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const dishes = items.filter((item) => item.name.trim().length > 0);
  const estimatedTotal = dishes.reduce((sum, item) => {
    const price = Number(item.price.replace(",", "."));
    return sum + (Number.isFinite(price) ? price : 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm">Log visit</Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{visit ? "Edit visit" : "Log a visit"}</DialogTitle>
          <p className="text-sm text-ink-muted">{placeName}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-5">
            {error ? <Alert variant="error">{error}</Alert> : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Date">
                <Input
                  type="date"
                  value={visitedAt}
                  max={todayIsoDate()}
                  onChange={(event) => setVisitedAt(event.target.value)}
                  required
                />
              </Field>
              <Field label="Occasion">
                <Select
                  value={occasion}
                  onChange={(event) => setOccasion(event.target.value as VisitOccasion | "")}
                >
                  <option value="">Not specified</option>
                  {VISIT_OCCASIONS.map((value) => (
                    <option key={value} value={value}>
                      {OCCASION_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="People">
                <Input
                  inputMode="numeric"
                  placeholder="2"
                  value={partySize}
                  onChange={(event) => setPartySize(event.target.value)}
                />
              </Field>
            </div>

            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                  Overall rating
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <button
                      key={step}
                      type="button"
                      aria-label={`${step} star${step === 1 ? "" : "s"}`}
                      onClick={() => setRating(rating === step ? null : step)}
                      className="rounded-full p-0.5 transition hover:scale-110"
                    >
                      <Star
                        className={cn(
                          "size-7",
                          rating !== null && step <= rating
                            ? "fill-star text-star"
                            : "text-line-strong",
                        )}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Spend per person" hint="€ — feeds your budget estimates">
                  <Input
                    inputMode="decimal"
                    placeholder="e.g. 24"
                    value={spend}
                    onChange={(event) => setSpend(event.target.value)}
                  />
                </Field>
                <Field label="Tags" hint="Comma separated">
                  <Input
                    placeholder="date night, worth the drive"
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Would I go back?</p>
                  <p className="text-xs text-ink-muted">Helps the engine separate one-offs</p>
                </div>
                <Switch
                  checked={wouldReturn}
                  onCheckedChange={setWouldReturn}
                  aria-label="Would return"
                />
              </div>
            </div>

            <Field label="Thoughts">
              <Textarea
                rows={3}
                placeholder="What was good, what would you change, would you order the same again?"
                value={thoughts}
                onChange={(event) => setThoughts(event.target.value)}
              />
            </Field>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">What did you eat?</h3>
                  <p className="text-xs text-ink-muted">
                    Rating individual dishes is what makes recommendations personal.
                  </p>
                </div>
                {estimatedTotal > 0 ? (
                  <Badge variant="default" size="sm">
                    Items ≈ €{estimatedTotal.toFixed(0)}
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={item.key}
                    className="space-y-3 rounded-2xl border border-line bg-surface p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={index === 0 ? "e.g. Ribeye steak" : "Another dish"}
                        value={item.name}
                        onChange={(event) => updateItem(item.key, { name: event.target.value })}
                        className="flex-1"
                      />
                      {items.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove dish"
                          onClick={() =>
                            setItems((current) => current.filter((entry) => entry.key !== item.key))
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Type">
                        <Select
                          value={item.category}
                          onChange={(event) =>
                            updateItem(item.key, {
                              category: event.target.value as FoodItemCategory | "",
                            })
                          }
                        >
                          <option value="">Not specified</option>
                          {FOOD_ITEM_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {FOOD_ITEM_CATEGORY_LABELS[category]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Price" hint="€ optional">
                        <Input
                          inputMode="decimal"
                          placeholder="12"
                          value={item.price}
                          onChange={(event) => updateItem(item.key, { price: event.target.value })}
                        />
                      </Field>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                          Rating
                        </span>
                        <div className="flex items-center gap-0.5 pt-1.5">
                          {[1, 2, 3, 4, 5].map((step) => (
                            <button
                              key={step}
                              type="button"
                              aria-label={`${step} star${step === 1 ? "" : "s"}`}
                              onClick={() =>
                                updateItem(item.key, { rating: item.rating === step ? null : step })
                              }
                            >
                              <Star
                                className={cn(
                                  "size-5",
                                  item.rating !== null && step <= item.rating
                                    ? "fill-star text-star"
                                    : "text-line-strong",
                                )}
                                strokeWidth={1.5}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <Input
                      placeholder="Short comment (optional)"
                      value={item.comment}
                      onChange={(event) => updateItem(item.key, { comment: event.target.value })}
                    />

                    <label className="flex items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        checked={item.isHighlight}
                        onChange={(event) =>
                          updateItem(item.key, { isHighlight: event.target.checked })
                        }
                        className="size-4 rounded border-line-strong accent-[var(--color-clay-600)]"
                      />
                      Standout highlight
                    </label>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((current) => [...current, emptyItem()])}
                className="w-full"
              >
                <Plus className="size-4" />
                Add another dish
              </Button>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} size="lg" className="sm:min-w-40">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {visit ? "Save changes" : "Save visit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteVisitButton({ visitId, placeId }: { visitId: string; placeId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete visit"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await deleteVisitAction(visitId, placeId);
          setPending(false);
          setConfirming(false);
          router.refresh();
        }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Delete"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </span>
  );
}
