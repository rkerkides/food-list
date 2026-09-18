import { CATEGORY_LABELS, type PlaceCategory } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { Coffee, Croissant, IceCream2, Martini, Pizza, Sandwich, Soup, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_ICON: Record<PlaceCategory, LucideIcon> = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  bar: Martini,
  bakery: Croissant,
  brunch: Soup,
  dessert: IceCream2,
  takeaway: Sandwich,
  street_food: Pizza,
  other: UtensilsCrossed,
};

const PALETTES = [
  "from-clay-100 via-clay-50 to-canvas-deep",
  "from-olive-100 via-olive-50 to-canvas-deep",
  "from-amber-50 via-clay-50 to-canvas-deep",
  "from-sky-50 via-olive-50 to-canvas-deep",
  "from-rose-50 via-clay-50 to-canvas-deep",
];

/**
 * Deterministic "photo" for places without one. Provider photos are used when
 * available (proxied through /api/places/photo); otherwise every venue gets a
 * stable, warm, category-aware visual so the UI never looks broken.
 */
export function PlaceVisual({
  name,
  category,
  photoRef,
  size = "card",
  className,
}: {
  name: string;
  category: PlaceCategory;
  photoRef?: string | null;
  size?: "thumb" | "card" | "hero" | "map";
  className?: string;
}) {
  const Icon = CATEGORY_ICON[category] ?? UtensilsCrossed;
  const hash = hashString(name);
  const palette = PALETTES[hash % PALETTES.length];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

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
        "relative overflow-hidden bg-gradient-to-br",
        palette,
        sizeClasses,
        className,
      )}
    >
      {photoRef ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/places/photo?ref=${encodeURIComponent(photoRef)}`}
          alt={name}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <>
          <span
            aria-hidden="true"
            className="absolute -right-6 -top-8 size-32 rounded-full bg-white/40 blur-2xl"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-10 -left-6 size-28 rounded-full bg-white/30 blur-2xl"
          />
          <span className="absolute inset-0 grid place-items-center">
            {size === "thumb" ? (
              <Icon className="size-5 text-ink-soft/70" strokeWidth={1.6} />
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-ink-soft/70">
                <Icon className={size === "hero" ? "size-8" : "size-6"} strokeWidth={1.5} />
                <span
                  className={cn(
                    "font-display tracking-tight text-ink/60",
                    size === "hero" ? "text-2xl" : "text-base",
                  )}
                >
                  {initials}
                </span>
              </span>
            )}
          </span>
        </>
      )}
      <span className="sr-only">{CATEGORY_LABELS[category]}</span>
    </div>
  );
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}
