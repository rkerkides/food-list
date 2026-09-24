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
import {
  PLACE_STOCK_IMAGES,
  placeFallbackImage,
  placeStockImageFromRef,
  type PlaceFallbackImage,
} from "@/lib/domain/place-fallback-image";
import { CATEGORY_LABELS, PLACE_CATEGORIES, type PlaceCategory } from "@/lib/domain/types";
import type { PlaceWithStats } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { ImageIcon, Loader2, Pencil, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { updatePlaceAction } from "@/app/actions/places";
import { CuisinePicker } from "./cuisine-picker";

export function EditPlaceDialog({ place }: { place: PlaceWithStats }) {
  const router = useRouter();
  const originalImageMode = imageModeForRef(place.photoRef);
  const originalStockImage = placeStockImageFromRef(place.photoRef);
  const automaticStockImage = placeFallbackImage(place).key;
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [imageMode, setImageMode] = React.useState<ImageMode>(originalImageMode);
  const [stockImage, setStockImage] = React.useState<PlaceFallbackImage>(
    originalStockImage ?? automaticStockImage,
  );
  const [upload, setUpload] = React.useState<File | null>(null);
  const [uploadInputKey, setUploadInputKey] = React.useState(0);
  const [cuisines, setCuisines] = React.useState(place.cuisines);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setError(null);
    setImageMode(originalImageMode);
    setStockImage(originalStockImage ?? automaticStockImage);
    setUpload(null);
    setUploadInputKey((key) => key + 1);
    setCuisines(place.cuisines);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    if (imageSelectionChanged() && imageMode === "upload" && !upload) {
      setError("Choose an image file before using Upload.");
      setPending(false);
      return;
    }

    try {
      const result = await updatePlaceAction(place.id, {
        name: String(form.get("name") ?? "").trim(),
        category: (form.get("category") as PlaceCategory) ?? place.category,
        city: valueOrNull(form.get("city")),
        area: valueOrNull(form.get("area")),
        address: valueOrNull(form.get("address")),
        googleMapsUrl: valueOrNull(form.get("googleMapsUrl")),
        website: valueOrNull(form.get("website")),
        phone: valueOrNull(form.get("phone")),
        cuisines,
        tags: splitList(form.get("tags")),
        expectedSpendMin: numberOrNull(form.get("expectedSpendMin")),
        expectedSpendMax: numberOrNull(form.get("expectedSpendMax")),
        note: valueOrNull(form.get("note")),
        savedReason: valueOrNull(form.get("savedReason")),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (imageSelectionChanged()) {
        const imageError = await saveImageSelection();
        if (imageError) {
          setError(`Your other changes were saved. ${imageError}`);
          return;
        }
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not save your changes. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function imageSelectionChanged(): boolean {
    if (upload) return true;
    if (imageMode !== originalImageMode) return true;
    return imageMode === "stock" && stockImage !== originalStockImage;
  }

  async function saveImageSelection(): Promise<string | null> {
    const body = new FormData();
    body.set("mode", imageMode);
    if (imageMode === "stock") body.set("stockImage", stockImage);
    if (imageMode === "upload" && upload) body.set("image", upload);

    const response = await fetch(`/api/places/${encodeURIComponent(place.id)}/image`, {
      method: "POST",
      body,
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    return response.ok ? null : result?.error ?? "Could not save the image. Please try again.";
  }

  function chooseUpload(file: File | null) {
    if (!file) {
      setUpload(null);
      return;
    }
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
      setError("Use a JPEG, PNG, or WebP image.");
      setUpload(null);
      setUploadInputKey((key) => key + 1);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("The image must be 5 MB or smaller.");
      setUpload(null);
      setUploadInputKey((key) => key + 1);
      return;
    }
    setError(null);
    setUpload(file);
    setImageMode("upload");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

            <Field label="Cuisines" hint="Choose from your shared cuisine catalogue.">
              <CuisinePicker value={cuisines} onChange={setCuisines} disabled={pending} />
            </Field>

            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <div>
                <p className="font-medium text-ink">Image</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Keep the automatic venue image, choose a stock image, or upload your own.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["automatic", "Automatic", ImageIcon],
                    ["stock", "Stock", ImageIcon],
                    ["upload", "Upload", Upload],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={imageMode === mode}
                    onClick={() => setImageMode(mode)}
                    className={cn(
                      "flex h-10 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition",
                      imageMode === mode
                        ? "border-clay-500 bg-clay-50 text-clay-800"
                        : "border-line bg-canvas text-ink-soft hover:border-line-strong hover:text-ink",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {imageMode === "automatic" ? (
                <p className="rounded-xl bg-surface-muted px-3 py-2 text-xs text-ink-muted">
                  Uses the venue photo when available, then the best cuisine image.
                </p>
              ) : null}

              {imageMode === "stock" ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {PLACE_STOCK_IMAGES.map((image) => (
                    <button
                      key={image.key}
                      type="button"
                      aria-label={`Use ${image.label} image`}
                      aria-pressed={stockImage === image.key}
                      onClick={() => setStockImage(image.key)}
                      className={cn(
                        "overflow-hidden rounded-xl border bg-canvas text-left transition",
                        stockImage === image.key
                          ? "border-clay-500 ring-2 ring-clay-200"
                          : "border-line hover:border-line-strong",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.src} alt="" className="aspect-[4/3] w-full object-cover" />
                      <span className="block truncate px-2 py-1.5 text-[11px] font-medium text-ink">
                        {image.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {imageMode === "upload" ? (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong bg-canvas px-4 py-3 transition hover:bg-surface-muted">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-clay-50 text-clay-700">
                    <Upload className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {upload?.name ??
                        (originalImageMode === "upload" ? "Replace uploaded image" : "Choose image")}
                    </span>
                    <span className="block text-xs text-ink-muted">JPEG, PNG, or WebP · max 5 MB</span>
                  </span>
                  <input
                    key={uploadInputKey}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => chooseUpload(event.target.files?.[0] ?? null)}
                  />
                </label>
              ) : null}
            </div>

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

            <Field
              label="Google Maps link"
              hint="Paste a Google Maps place link. It takes priority over the generated map search."
            >
              <Input
                name="googleMapsUrl"
                type="url"
                inputMode="url"
                placeholder="https://www.google.com/maps/place/..."
                defaultValue={place.googleMapsUrl ?? ""}
              />
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
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
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

type ImageMode = "automatic" | "stock" | "upload";

function imageModeForRef(photoRef: string | null): ImageMode {
  if (photoRef?.startsWith("stock:")) return "stock";
  if (photoRef?.startsWith("upload:")) return "upload";
  return "automatic";
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
