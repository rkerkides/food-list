"use client";

import { updatePlaceAction } from "@/app/actions/places";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import {
  PLACE_STOCK_IMAGES,
  placeFallbackImage,
  type PlaceFallbackImage,
} from "@/lib/domain/place-fallback-image";
import { CATEGORY_LABELS, PLACE_CATEGORIES, type PlaceCategory, type PlaceWithStats } from "@/lib/domain/types";
import type { DataQualityIssue } from "@/lib/services/data-quality";
import { Check, ChevronDown, Loader2, MapPin, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { CuisinePicker } from "./cuisine-picker";

export function DataStatusEditor({
  place,
  issues,
}: {
  place: PlaceWithStats;
  issues: DataQualityIssue[];
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const latitudeRef = React.useRef<HTMLInputElement>(null);
  const longitudeRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [findingPin, setFindingPin] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pinMessage, setPinMessage] = React.useState<string | null>(null);
  const [stockImage, setStockImage] = React.useState<PlaceFallbackImage>(placeFallbackImage(place).key);
  const [cuisines, setCuisines] = React.useState(place.cuisines);
  const fields = new Set(issues.map((issue) => issue.field));
  const needs = (field: DataQualityIssue["field"]) => fields.has(field);
  const fixCount = issues.length;

  async function findMapPin() {
    const form = formRef.current;
    if (!form) return;
    const values = new FormData(form);
    const address = valueOrNull(values.get("address")) ?? place.address;
    const city = place.city ?? "Cyprus";
    const query = [place.name, address, city].filter(Boolean).join(", ");
    if (query.length < 2) {
      setError("Add an address or city first, then find the pin.");
      return;
    }

    setFindingPin(true);
    setError(null);
    setPinMessage(null);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const result = (await response.json().catch(() => null)) as {
        latitude?: number;
        longitude?: number;
        label?: string;
        error?: string;
      } | null;
      if (!response.ok || result?.latitude == null || result.longitude == null) {
        setError(result?.error ?? "Could not find a map pin. You can enter coordinates yourself.");
        return;
      }
      if (latitudeRef.current) latitudeRef.current.value = String(result.latitude);
      if (longitudeRef.current) longitudeRef.current.value = String(result.longitude);
      setPinMessage(`Pin found: ${result.label ?? query}`);
    } catch {
      setError("Could not find a map pin. You can enter coordinates yourself.");
    } finally {
      setFindingPin(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: Record<string, unknown> = {};

    if (needs("publicRating")) input.publicRating = numberOrNull(form.get("publicRating"));
    if (needs("publicRatingCount")) input.publicRatingCount = numberOrNull(form.get("publicRatingCount"));
    if (needs("budget")) {
      input.expectedSpendMin = numberOrNull(form.get("expectedSpendMin"));
      input.expectedSpendMax = numberOrNull(form.get("expectedSpendMax"));
    }
    if (needs("cuisines")) input.cuisines = cuisines;
    if (needs("category")) input.category = form.get("category") as PlaceCategory;
    if (needs("address")) input.address = valueOrNull(form.get("address"));
    if (needs("mapLocation")) {
      input.latitude = numberOrNull(form.get("latitude"));
      input.longitude = numberOrNull(form.get("longitude"));
    }

    setPending(true);
    setError(null);
    try {
      const result = await updatePlaceAction(place.id, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (needs("photo")) {
        const imageResult = await saveStockImage();
        if (!imageResult.ok) {
          setError(`The details were saved, but ${imageResult.error}`);
          return;
        }
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not save these details. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function saveStockImage(): Promise<{ ok: true } | { ok: false; error: string }> {
    const body = new FormData();
    body.set("mode", "stock");
    body.set("stockImage", stockImage);
    const response = await fetch(`/api/places/${encodeURIComponent(place.id)}/image`, {
      method: "POST",
      body,
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    return response.ok ? { ok: true } : { ok: false, error: result?.error ?? "the image could not be saved." };
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Fix details
        <ChevronDown className="size-3.5" />
      </Button>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-1 space-y-4 rounded-2xl border border-clay-100 bg-clay-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Complete {place.name}</p>
          <p className="mt-0.5 text-xs text-ink-muted">Only the missing fields are shown. Your entry is protected from future provider refreshes.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {(needs("publicRating") || needs("publicRatingCount")) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {needs("publicRating") ? (
            <Field label="Google rating" hint="0 to 5">
              <Input name="publicRating" inputMode="decimal" placeholder="e.g. 4.6" defaultValue={place.publicRating ?? ""} required />
            </Field>
          ) : null}
          {needs("publicRatingCount") ? (
            <Field label="Public reviews" hint="Google Maps review count">
              <Input name="publicRatingCount" inputMode="numeric" placeholder="e.g. 325" defaultValue={place.publicRatingCount ?? ""} required />
            </Field>
          ) : null}
        </div>
      ) : null}

      {needs("budget") ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Budget from" hint="€ per person">
            <Input name="expectedSpendMin" inputMode="decimal" placeholder="e.g. 15" defaultValue={place.expectedSpendMin ?? ""} required />
          </Field>
          <Field label="Budget to" hint="€ per person">
            <Input name="expectedSpendMax" inputMode="decimal" placeholder="e.g. 25" defaultValue={place.expectedSpendMax ?? ""} />
          </Field>
        </div>
      ) : null}

      {needs("cuisines") ? (
        <Field label="Cuisine" hint="Choose from your shared cuisine catalogue.">
          <CuisinePicker value={cuisines} onChange={setCuisines} disabled={pending} />
        </Field>
      ) : null}

      {needs("category") ? (
        <Field label="Venue type">
          <Select name="category" defaultValue="restaurant">
            {PLACE_CATEGORIES.filter((category) => category !== "other").map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {needs("photo") ? (
        <Field label="Food image" hint="A matching food-type image is selected for you">
          <Select value={stockImage} onChange={(event) => setStockImage(event.target.value as PlaceFallbackImage)}>
            {PLACE_STOCK_IMAGES.map((image) => (
              <option key={image.key} value={image.key}>
                {image.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {needs("address") ? (
        <Field label="Address">
          <Input name="address" placeholder="Street, area, city" defaultValue={place.address ?? ""} required />
        </Field>
      ) : null}

      {needs("mapLocation") ? (
        <div className="space-y-3 rounded-xl border border-line bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Map pin</p>
              <p className="text-xs text-ink-muted">Use the address above, then find it automatically.</p>
            </div>
            <Button type="button" variant="subtle" size="sm" onClick={findMapPin} disabled={findingPin}>
              {findingPin ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
              Find pin
            </Button>
          </div>
          {pinMessage ? <p className="flex items-center gap-1.5 text-xs text-olive-800"><Check className="size-3.5" />{pinMessage}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Latitude">
              <Input ref={latitudeRef} name="latitude" inputMode="decimal" placeholder="e.g. 35.17" defaultValue={place.latitude ?? ""} required />
            </Field>
            <Field label="Longitude">
              <Input ref={longitudeRef} name="longitude" inputMode="decimal" placeholder="e.g. 33.36" defaultValue={place.longitude ?? ""} required />
            </Field>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-clay-100 pt-3">
        <span className="inline-flex items-center gap-1 text-xs text-ink-muted"><Sparkles className="size-3 text-clay-600" /> Takes one save</span>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save {fixCount} {fixCount === 1 ? "fix" : "fixes"}
        </Button>
      </div>
    </form>
  );
}

function valueOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const raw = valueOrNull(value);
  if (raw === null) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value: FormDataEntryValue | null): string[] {
  const raw = valueOrNull(value);
  return raw
    ? raw.split(",").map((entry) => entry.trim()).filter(Boolean)
    : [];
}
