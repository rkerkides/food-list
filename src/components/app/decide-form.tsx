"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_PLURAL_LABELS, OCCASION_LABELS, VISIT_OCCASIONS } from "@/lib/domain/types";
import type { PlaceCategory, VisitOccasion } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { Crosshair, Loader2, MapPin, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface DecideFormOptions {
  cities: string[];
  areas: string[];
  cuisines: string[];
  categories: PlaceCategory[];
}

export interface DecideFormState {
  area: string;
  originLatitude: number | null;
  originLongitude: number | null;
  originLabel: string;
  maxDistanceKm: number;
  cuisines: string[];
  foodQuery: string;
  maxSpend: number;
  categories: PlaceCategory[];
  occasion: VisitOccasion | "";
  vibe: "any" | "quick" | "casual" | "nicer";
  visitState: "any" | "unvisited" | "visited";
  minPublicRating: number | null;
  openNow: boolean;
  favouritesOnly: boolean;
}

export function DecideForm({
  options,
  initial,
}: {
  options: DecideFormOptions;
  initial: DecideFormState;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<DecideFormState>(initial);
  const [pending, setPending] = React.useState(false);
  const [locationState, setLocationState] = React.useState<"idle" | "finding" | "ready" | "error">(
    initial.originLatitude != null && initial.originLongitude != null ? "ready" : "idle",
  );
  const [locationMessage, setLocationMessage] = React.useState<string | null>(null);
  const [address, setAddress] = React.useState("");

  const submit = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra);
    if (state.area) params.set("area", state.area);
    if (state.originLatitude != null && state.originLongitude != null) {
      params.set("lat", String(state.originLatitude));
      params.set("lng", String(state.originLongitude));
      if (state.originLabel) params.set("origin", state.originLabel);
    }
    if (state.maxDistanceKm < 60) params.set("maxDistance", String(state.maxDistanceKm));
    if (state.cuisines.length) params.set("cuisine", state.cuisines.join(","));
    if (state.foodQuery.trim()) params.set("food", state.foodQuery.trim());
    if (state.maxSpend < 120) params.set("maxSpend", String(state.maxSpend));
    if (state.categories.length) params.set("category", state.categories.join(","));
    if (state.occasion) params.set("occasion", state.occasion);
    if (state.vibe !== "any") params.set("vibe", state.vibe);
    if (state.visitState !== "any") params.set("visitState", state.visitState);
    if (state.minPublicRating) params.set("minPublic", String(state.minPublicRating));
    if (state.openNow) params.set("openNow", "1");
    if (state.favouritesOnly) params.set("fav", "1");

    setPending(true);
    router.push(`/decide?${params.toString()}`, { scroll: false });
    setTimeout(() => setPending(false), 600);
  };

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const useDeviceLocation = React.useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState("error");
      setLocationMessage("This browser cannot provide your location. Choose an area or enter an address instead.");
      return;
    }
    setLocationState("finding");
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState((current) => ({
          ...current,
          area: "",
          originLatitude: position.coords.latitude,
          originLongitude: position.coords.longitude,
          originLabel: "Current location",
        }));
        setLocationState("ready");
        setLocationMessage("Using your device location for distance and ranking.");
      },
      () => {
        setLocationState("error");
        setLocationMessage("Location was unavailable. Choose an area or enter an address instead.");
      },
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 8_000 },
    );
  }, []);

  React.useEffect(() => {
    if (initial.area || initial.originLatitude != null || initial.originLongitude != null) return;
    useDeviceLocation();
  }, [initial.area, initial.originLatitude, initial.originLongitude, useDeviceLocation]);

  async function useAddress() {
    const query = address.trim();
    if (query.length < 2) {
      setLocationState("error");
      setLocationMessage("Enter an address or neighbourhood first.");
      return;
    }
    setLocationState("finding");
    setLocationMessage(null);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const result = (await response.json().catch(() => null)) as {
        latitude?: number;
        longitude?: number;
        label?: string;
        error?: string;
      } | null;
      if (!response.ok || result?.latitude == null || result.longitude == null) {
        throw new Error(result?.error ?? "Could not find that address.");
      }
      setState((current) => ({
        ...current,
        area: "",
        originLatitude: result.latitude as number,
        originLongitude: result.longitude as number,
        originLabel: result.label ?? query,
      }));
      setLocationState("ready");
      setLocationMessage(`Using ${result.label ?? query} for distance and ranking.`);
    } catch (error) {
      setLocationState("error");
      setLocationMessage(error instanceof Error ? error.message : "Could not find that address.");
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where are you?" hint="Your device location is used by default; choose an override below.">
          <Select
            value={state.area}
            onChange={(event) => {
              const area = event.target.value;
              setState({ ...state, area, originLatitude: null, originLongitude: null, originLabel: area });
              setLocationMessage(area ? `Using ${area} as your location.` : null);
              setLocationState(area ? "ready" : "idle");
            }}
          >
            <option value="">Anywhere in Cyprus</option>
            {[...new Set([...options.cities, ...options.areas])].map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </Select>
          <div className="space-y-2 rounded-xl bg-surface-muted p-2.5">
            <Button type="button" variant="subtle" size="sm" onClick={useDeviceLocation} disabled={locationState === "finding"}>
              {locationState === "finding" ? <Loader2 className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />}
              Use my device location
            </Button>
            <div className="flex gap-2">
              <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Or enter an address" />
              <Button type="button" variant="outline" size="sm" onClick={useAddress} disabled={locationState === "finding" || !address.trim()}>
                <MapPin className="size-3.5" />
                Use
              </Button>
            </div>
            {locationMessage ? <p className={locationState === "error" ? "text-xs text-clay-800" : "text-xs text-olive-800"}>{locationMessage}</p> : null}
          </div>
        </Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Max distance
            </span>
            <span className="text-xs font-medium">
              {state.maxDistanceKm >= 60 ? "Any distance" : `${state.maxDistanceKm} km`}
            </span>
          </div>
          <Slider
            min={1}
            max={60}
            step={1}
            value={[state.maxDistanceKm]}
            onValueChange={([value]) => setState({ ...state, maxDistanceKm: value })}
            aria-label="Maximum distance in kilometres"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Max spend per person
            </span>
            <span className="text-xs font-medium">
              {state.maxSpend >= 120 ? "No limit" : `€${state.maxSpend}`}
            </span>
          </div>
          <Slider
            min={5}
            max={120}
            step={5}
            value={[state.maxSpend]}
            onValueChange={([value]) => setState({ ...state, maxSpend: value })}
            aria-label="Maximum spend per person"
          />
        </div>

        <Field label="In the mood for" hint="A dish, cuisine or craving">
          <Input
            value={state.foodQuery}
            onChange={(event) => setState({ ...state, foodQuery: event.target.value })}
            placeholder="sushi, steak, brunch…"
          />
        </Field>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
          Venue type
        </span>
        <div className="flex flex-wrap gap-1.5">
          {options.categories.map((category) => (
            <Chip
              key={category}
              active={state.categories.includes(category)}
              onClick={() => setState({ ...state, categories: toggle(state.categories, category) })}
            >
              {CATEGORY_PLURAL_LABELS[category]}
            </Chip>
          ))}
        </div>
      </div>

      {options.cuisines.length > 0 ? (
        <div className="space-y-2">
          <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            Cuisine
          </span>
          <div className="flex flex-wrap gap-1.5">
            {options.cuisines.slice(0, 14).map((cuisine) => (
              <Chip
                key={cuisine}
                active={state.cuisines.includes(cuisine)}
                onClick={() => setState({ ...state, cuisines: toggle(state.cuisines, cuisine) })}
              >
                {cuisine}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Occasion">
          <Select
            value={state.occasion}
            onChange={(event) =>
              setState({ ...state, occasion: event.target.value as VisitOccasion | "" })
            }
          >
            <option value="">Any occasion</option>
            {VISIT_OCCASIONS.map((occasion) => (
              <option key={occasion} value={occasion}>
                {OCCASION_LABELS[occasion]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="space-y-2">
          <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            Effort
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { value: "any", label: "Any" },
                { value: "quick", label: "Quick & casual" },
                { value: "casual", label: "Sit down" },
                { value: "nicer", label: "Something nicer" },
              ] as const
            ).map((option) => (
              <Chip
                key={option.value}
                active={state.vibe === option.value}
                onClick={() => setState({ ...state, vibe: option.value })}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            Visited before?
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { value: "any", label: "Anywhere" },
                { value: "unvisited", label: "Not yet tried" },
                { value: "visited", label: "Been before" },
              ] as const
            ).map((option) => (
              <Chip
                key={option.value}
                active={state.visitState === option.value}
                onClick={() => setState({ ...state, visitState: option.value })}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            Minimum public rating
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[null, 4, 4.3, 4.5].map((value) => (
              <Chip
                key={String(value)}
                active={state.minPublicRating === value}
                onClick={() => setState({ ...state, minPublicRating: value })}
              >
                {value === null ? "Any" : `${value}★+`}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-2">
        <ToggleRow
          label="Open now"
          checked={state.openNow}
          onChange={(checked) => setState({ ...state, openNow: checked })}
        />
        <ToggleRow
          label="Favourites only"
          checked={state.favouritesOnly}
          onChange={(checked) => setState({ ...state, favouritesOnly: checked })}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Find somewhere to eat
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => submit({ surprise: "1" })}
          className="sm:w-auto"
        >
          <Sparkles className="size-4 text-clay-600" />
          Surprise me
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => {
            setState({
              area: "",
              originLatitude: null,
              originLongitude: null,
              originLabel: "",
              maxDistanceKm: 60,
              cuisines: [],
              foodQuery: "",
              maxSpend: 120,
              categories: [],
              occasion: "",
              vibe: "any",
              visitState: "any",
              minPublicRating: null,
              openNow: false,
              favouritesOnly: false,
            });
            router.push("/decide");
          }}
        >
          Reset
        </Button>
      </div>
    </form>
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
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-clay-600 bg-clay-50 text-clay-800"
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
