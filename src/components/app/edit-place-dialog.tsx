"use client";

import { Alert } from "@/components/ui/alert";
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
import { CATEGORY_LABELS, PLACE_CATEGORIES, type PlaceCategory } from "@/lib/domain/types";
import type { PlaceWithStats } from "@/lib/domain/types";
import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { updatePlaceAction } from "@/app/actions/places";

export function EditPlaceDialog({ place }: { place: PlaceWithStats }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const result = await updatePlaceAction(place.id, {
      name: String(form.get("name") ?? "").trim(),
      category: (form.get("category") as PlaceCategory) ?? place.category,
      city: valueOrNull(form.get("city")),
      area: valueOrNull(form.get("area")),
      address: valueOrNull(form.get("address")),
      website: valueOrNull(form.get("website")),
      phone: valueOrNull(form.get("phone")),
      cuisines: splitList(form.get("cuisines")),
      tags: splitList(form.get("tags")),
      expectedSpendMin: numberOrNull(form.get("expectedSpendMin")),
      expectedSpendMax: numberOrNull(form.get("expectedSpendMax")),
      note: valueOrNull(form.get("note")),
      savedReason: valueOrNull(form.get("savedReason")),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit place</DialogTitle>
          <p className="text-sm text-ink-muted">
            Anything you change here stops being overwritten by provider refreshes.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {error ? <Alert variant="error">{error}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input name="name" defaultValue={place.name} required />
              </Field>
              <Field label="Category">
                <Select name="category" defaultValue={place.category}>
                  {PLACE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Cuisines" hint="Comma separated">
              <Input name="cuisines" defaultValue={place.cuisines.join(", ")} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="City">
                <Input name="city" defaultValue={place.city ?? ""} />
              </Field>
              <Field label="Area">
                <Input name="area" defaultValue={place.area ?? ""} />
              </Field>
            </div>

            <Field label="Address">
              <Input name="address" defaultValue={place.address ?? ""} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Website">
                <Input name="website" defaultValue={place.website ?? ""} />
              </Field>
              <Field label="Phone">
                <Input name="phone" defaultValue={place.phone ?? ""} />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Expected spend from" hint="€ per person — marks the budget as yours">
                <Input
                  name="expectedSpendMin"
                  inputMode="decimal"
                  defaultValue={place.expectedSpendMin ?? ""}
                />
              </Field>
              <Field label="Expected spend to" hint="€ per person">
                <Input
                  name="expectedSpendMax"
                  inputMode="decimal"
                  defaultValue={place.expectedSpendMax ?? ""}
                />
              </Field>
            </div>

            <Field label="Tags" hint="Comma separated">
              <Input name="tags" defaultValue={place.tags.join(", ")} />
            </Field>

            <Field label="Why I saved it">
              <Input name="savedReason" defaultValue={place.savedReason ?? ""} />
            </Field>

            <Field label="Note">
              <Textarea name="note" rows={3} defaultValue={place.note ?? ""} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function valueOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const raw = valueOrNull(value);
  if (raw === null) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value: FormDataEntryValue | null): string[] {
  const raw = valueOrNull(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
