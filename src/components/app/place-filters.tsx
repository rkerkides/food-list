"use client";

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
import { Field, Input, Select } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_PLURAL_LABELS, type PlaceCategory } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

export interface FilterOptions {
  cities: string[];
  areas: string[];
  cuisines: string[];
  tags: string[];
  categories: PlaceCategory[];
}

const RATING_OPTIONS = [
  { label: "Any", value: null },
  { label: "4.0+", value: 4 },
  { label: "4.3+", value: 4.3 },
  { label: "4.5+", value: 4.5 },
];

const PERSONAL_RATING_OPTIONS = [
  { label: "Any", value: null },
  { label: "3.5+", value: 3.5 },
  { label: "4.0+", value: 4 },
  { label: "4.5+", value: 4.5 },
];

const VISIT_STATES = [
  { label: "All", value: "any" },
  { label: "Not visited", value: "unvisited" },
  { label: "Visited", value: "visited" },
] as const;

export function PlaceFilters({
  options,
  total,
  shown,
}: {
  options: FilterOptions;
  total: number;
  shown: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

  const update = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
      router.push(`/places?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const toggleList = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = (params.get(key) ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      if (next.length === 0) params.delete(key);
      else params.set(key, next.join(","));
      router.push(`/places?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    const timer = setTimeout(() => update("q", search || null), 320);
    return () => clearTimeout(timer);
  }, [search, searchParams, update]);

  const activeCount = countActive(searchParams);

  const controls = (
    <FilterControls
      options={options}
      searchParams={searchParams}
      search={search}
      setSearch={setSearch}
      update={update}
      toggleList={toggleList}
    />
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-24 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Filters</h2>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={() => router.push("/places")}
                className="text-xs font-medium text-clay-700 hover:underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">{controls}</div>
          <p className="border-t border-line pt-3 text-xs text-ink-muted">
            Showing {shown} of {total} places
          </p>
        </div>
      </aside>

      <div className="lg:hidden">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="size-4" />
              Filters
              {activeCount > 0 ? (
                <Badge variant="clay" size="sm">
                  {activeCount}
                </Badge>
              ) : null}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl">Filter places</DialogTitle>
              <p className="text-sm text-ink-muted">
                {shown} of {total} places match
              </p>
            </DialogHeader>
            <DialogBody className="space-y-6">{controls}</DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => router.push("/places")}>
                Clear all
              </Button>
              <Button onClick={() => setOpen(false)}>Show {shown} places</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

function FilterControls({
  options,
  searchParams,
  search,
  setSearch,
  update,
  toggleList,
}: {
  options: FilterOptions;
  searchParams: URLSearchParams;
  search: string;
  setSearch: (value: string) => void;
  update: (key: string, value: string | null) => void;
  toggleList: (key: string, value: string) => void;
}) {
  const selectedCu = (searchParams.get("cuisine") ?? "").split(",").filter(Boolean);
  const selectedCats = (searchParams.get("category") ?? "").split(",").filter(Boolean);
  const selectedTags = (searchParams.get("tag") ?? "").split(",").filter(Boolean);
  const visitState = searchParams.get("visitState") ?? "any";
  const maxSpend = Number(searchParams.get("maxSpend") ?? 0) || null;

  return (
    <>
      <Field label="Search">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, dish, area…"
        />
      </Field>

      <Field label="City">
        <Select
          value={searchParams.get("city") ?? ""}
          onChange={(event) => update("city", event.target.value || null)}
        >
          <option value="">All Cyprus</option>
          {options.cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </Select>
      </Field>

      <Group label="Visited">
        {VISIT_STATES.map((state) => (
          <Chip
            key={state.value}
            active={visitState === state.value}
            onClick={() => update("visitState", state.value === "any" ? null : state.value)}
          >
            {state.label}
          </Chip>
        ))}
      </Group>

      <Group label="Venue type">
        {options.categories.slice(0, 8).map((category) => (
          <Chip
            key={category}
            active={selectedCats.includes(category)}
            onClick={() => toggleList("category", category)}
          >
            {CATEGORY_PLURAL_LABELS[category]}
          </Chip>
        ))}
      </Group>

      {options.cuisines.length > 0 ? (
        <Group label="Cuisine">
          {options.cuisines.slice(0, 14).map((cuisine) => (
            <Chip
              key={cuisine}
              active={selectedCu.includes(cuisine)}
              onClick={() => toggleList("cuisine", cuisine)}
            >
              {cuisine}
            </Chip>
          ))}
        </Group>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            Max budget
          </span>
          <span className="text-xs font-medium text-ink">
            {maxSpend ? `€${maxSpend}/person` : "Any"}
          </span>
        </div>
        <Slider
          min={5}
          max={120}
          step={5}
          value={[maxSpend ?? 120]}
          onValueChange={([value]) => update("maxSpend", value >= 120 ? null : String(value))}
          aria-label="Maximum spend per person"
        />
      </div>

      <Group label="Public rating">
        {RATING_OPTIONS.map((option) => (
          <Chip
            key={option.label}
            active={(Number(searchParams.get("minPublic")) || null) === option.value}
            onClick={() => update("minPublic", option.value === null ? null : String(option.value))}
          >
            {option.label}
          </Chip>
        ))}
      </Group>

      <Group label="My rating">
        {PERSONAL_RATING_OPTIONS.map((option) => (
          <Chip
            key={option.label}
            active={(Number(searchParams.get("minPersonal")) || null) === option.value}
            onClick={() =>
              update("minPersonal", option.value === null ? null : String(option.value))
            }
          >
            {option.label}
          </Chip>
        ))}
      </Group>

      {options.tags.length > 0 ? (
        <Group label="Tags">
          {options.tags.slice(0, 10).map((tag) => (
            <Chip
              key={tag}
              active={selectedTags.includes(tag)}
              onClick={() => toggleList("tag", tag)}
            >
              {tag}
            </Chip>
          ))}
        </Group>
      ) : null}

      <div className="space-y-3 border-t border-line pt-4">
        <ToggleRow
          label="Favourites only"
          checked={searchParams.get("fav") === "1"}
          onChange={(checked) => update("fav", checked ? "1" : null)}
        />
        <ToggleRow
          label="Want to try"
          checked={searchParams.get("wishlist") === "1"}
          onChange={(checked) => update("wishlist", checked ? "1" : null)}
        />
        <ToggleRow
          label="Open now"
          checked={searchParams.get("openNow") === "1"}
          onChange={(checked) => update("openNow", checked ? "1" : null)}
        />
      </div>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition",
        active
          ? "border-ink bg-ink text-canvas"
          : "border-line-strong bg-surface text-ink-soft hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-ink-soft">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function countActive(searchParams: URLSearchParams): number {
  return [
    "city",
    "maxSpend",
    "minPublic",
    "minPersonal",
    "visitState",
    "fav",
    "wishlist",
    "openNow",
    "cuisine",
    "category",
    "tag",
    "area",
  ].filter((key) => {
    const value = searchParams.get(key);
    return value !== null && value !== "" && value !== "any";
  }).length;
}

export function ActiveFilterChips({
  options,
}: {
  options: FilterOptions;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chips: { label: string; onRemove: () => void }[] = [];

  const push = (params: URLSearchParams) => {
    router.push(`/places?${params.toString()}`, { scroll: false });
  };
  const removeSingle = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    push(params);
  };
  const removeFromList = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const next = (params.get(key) ?? "")
      .split(",")
      .filter((entry) => entry && entry !== value);
    if (next.length === 0) params.delete(key);
    else params.set(key, next.join(","));
    push(params);
  };

  if (searchParams.get("q")) chips.push({ label: `“${searchParams.get("q")}”`, onRemove: () => removeSingle("q") });
  if (searchParams.get("city")) {
    const value = searchParams.get("city") as string;
    chips.push({ label: value, onRemove: () => removeSingle("city") });
  }
  for (const value of (searchParams.get("cuisine") ?? "").split(",").filter(Boolean)) {
    chips.push({ label: value, onRemove: () => removeFromList("cuisine", value) });
  }
  for (const value of (searchParams.get("category") ?? "").split(",").filter(Boolean)) {
    chips.push({
      label: CATEGORY_PLURAL_LABELS[value as PlaceCategory] ?? value,
      onRemove: () => removeFromList("category", value),
    });
  }
  for (const value of (searchParams.get("tag") ?? "").split(",").filter(Boolean)) {
    chips.push({ label: `#${value}`, onRemove: () => removeFromList("tag", value) });
  }
  if (searchParams.get("maxSpend")) {
    chips.push({
      label: `≤ €${searchParams.get("maxSpend")}`,
      onRemove: () => removeSingle("maxSpend"),
    });
  }
  if (searchParams.get("minPublic")) {
    chips.push({
      label: `${searchParams.get("minPublic")}★ public`,
      onRemove: () => removeSingle("minPublic"),
    });
  }
  if (searchParams.get("minPersonal")) {
    chips.push({
      label: `${searchParams.get("minPersonal")}★ mine`,
      onRemove: () => removeSingle("minPersonal"),
    });
  }
  if (searchParams.get("fav") === "1") {
    chips.push({ label: "Favourites", onRemove: () => removeSingle("fav") });
  }
  if (searchParams.get("wishlist") === "1") {
    chips.push({ label: "Want to try", onRemove: () => removeSingle("wishlist") });
  }
  if (searchParams.get("openNow") === "1") {
    chips.push({ label: "Open now", onRemove: () => removeSingle("openNow") });
  }
  const visitState = searchParams.get("visitState");
  if (visitState === "visited" || visitState === "unvisited") {
    chips.push({
      label: visitState === "visited" ? "Visited" : "Not visited",
      onRemove: () => removeSingle("visitState"),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip, index) => (
        <button
          key={`${chip.label}-${index}`}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-surface-muted"
        >
          {chip.label}
          <X className="size-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => router.push("/places")}
        className="text-xs font-medium text-clay-700 hover:underline"
      >
        Clear all
      </button>
      {options.cities.length === 0 ? null : null}
    </div>
  );
}
