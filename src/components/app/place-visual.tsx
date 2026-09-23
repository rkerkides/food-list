"use client";

import { CATEGORY_LABELS, type PlaceCategory } from "@/lib/domain/types";
import {
  placeFallbackImage,
  placeStockImageFromRef,
  placeStockImageSrc,
} from "@/lib/domain/place-fallback-image";
import { cn } from "@/lib/utils/cn";
import * as React from "react";

/**
 * Deterministic "photo" for places without one. Provider photos are used when
 * available (proxied through /api/places/photo); otherwise every venue gets a
 * stable, warm, category-aware visual so the UI never looks broken.
 */
export function PlaceVisual({
  name,
  category,
  cuisines = [],
  photoRef,
  size = "card",
  className,
}: {
  name: string;
  category: PlaceCategory;
  cuisines?: string[];
  photoRef?: string | null;
  size?: "thumb" | "card" | "hero" | "map";
  className?: string;
}) {
  const selectedStockImage = placeStockImageFromRef(photoRef);
  const automaticFallback = placeFallbackImage({ name, category, cuisines });
  const fallbackSrc = selectedStockImage
    ? placeStockImageSrc(selectedStockImage)
    : automaticFallback.src;
  const remotePhotoRef = selectedStockImage ? null : photoRef;
  const [failedPhotoRef, setFailedPhotoRef] = React.useState<string | null>(null);
  const providerImageFailed = Boolean(remotePhotoRef && failedPhotoRef === remotePhotoRef);

  const sizeClasses =
    size === "thumb"
      ? "size-11 rounded-xl"
      : size === "hero"
        ? "aspect-[16/10] w-full sm:aspect-[21/9]"
        : size === "map"
          ? "size-14 rounded-2xl"
          : "aspect-[4/3] w-full";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-surface-muted",
        sizeClasses,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fallbackSrc}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
      />
      {remotePhotoRef && !providerImageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/places/photo?ref=${encodeURIComponent(remotePhotoRef)}`}
          alt={name}
          loading="lazy"
          onError={() => setFailedPhotoRef(remotePhotoRef)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      {!remotePhotoRef || providerImageFailed ? (
        <>
          <span className="absolute inset-0 bg-gradient-to-t from-ink/20 via-transparent to-transparent" />
          {size !== "thumb" && size !== "map" ? (
            <span className="absolute right-2 bottom-2 rounded-full bg-ink/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              {selectedStockImage ? "Selected image" : "Cuisine image"}
            </span>
          ) : null}
        </>
      ) : null}
      <span className="sr-only">{CATEGORY_LABELS[category]}</span>
    </div>
  );
}
