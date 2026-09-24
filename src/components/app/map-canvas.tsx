"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { distanceKm, resolveAreaCoordinates } from "@/lib/domain/geo";
import { CATEGORY_LABELS, type PlaceCategory } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import type * as Leaflet from "leaflet";
import {
  ChevronDown,
  Crosshair,
  ExternalLink,
  LocateFixed,
  MapPinned,
  Search,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

export interface MapPoint {
  id: string;
  name: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  area: string | null;
  city: string | null;
  publicRating: number | null;
  personalRating: number | null;
  budgetText: string | null;
  distanceKm: number | null;
  status: string;
  googleMapsUrl?: string | null;
}

const CYPRUS_CENTER: Leaflet.LatLngExpression = [35.1264, 33.4299];
const CYPRUS_BOUNDS: Leaflet.LatLngBoundsExpression = [
  [34.53, 32.2],
  [35.72, 34.62],
];
const STARTING_POINT_STORAGE_KEY = "trapezi-map-starting-point";

interface MapLocation {
  latitude: number;
  longitude: number;
  label: string;
}

export function MapCanvas({
  points,
  className,
  height = "h-[420px] sm:h-[560px]",
  initialSelectedId,
  selectedAction = "place",
  locationControlInitiallyCollapsed = false,
}: {
  points: MapPoint[];
  className?: string;
  height?: string;
  initialSelectedId?: string;
  selectedAction?: "place" | "google";
  /** Small embedded maps should keep controls out of the way until requested. */
  locationControlInitiallyCollapsed?: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<Leaflet.Map | null>(null);
  const markerLayerRef = React.useRef<Leaflet.LayerGroup | null>(null);
  const locationLayerRef = React.useRef<Leaflet.LayerGroup | null>(null);
  const markerRefs = React.useRef(new Map<string, Leaflet.Marker>());
  const [mapReady, setMapReady] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialSelectedId ?? points[0]?.id ?? null,
  );
  const [deviceLocation, setDeviceLocation] = React.useState<MapLocation | null>(null);
  const [startingPoint, setStartingPoint] = React.useState<MapLocation | null>(null);
  const [locationQuery, setLocationQuery] = React.useState("");
  const [deviceLocating, setDeviceLocating] = React.useState(false);
  const [locationSearching, setLocationSearching] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [locationControlOpen, setLocationControlOpen] = React.useState(
    !locationControlInitiallyCollapsed,
  );
  const selectedIdRef = React.useRef(selectedId);
  const selected = points.find((point) => point.id === selectedId) ?? null;
  const baseline = startingPoint ?? deviceLocation;
  const selectedDistanceKm =
    baseline && selected
      ? distanceKm(baseline, { latitude: selected.latitude, longitude: selected.longitude })
      : null;

  const requestDeviceLocation = React.useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationError("This browser cannot share a device location.");
      return;
    }
    setDeviceLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeviceLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: "Your device location",
        });
        setDeviceLocating(false);
      },
      (error) => {
        setDeviceLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was not granted."
            : "Your device location is unavailable right now.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  React.useEffect(() => {
    // A saved point is restored quietly; device location always remains an explicit choice.
    const timer = window.setTimeout(() => {
      const saved = readStartingPoint();
      if (saved) setStartingPoint(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    let disposed = false;
    let map: Leaflet.Map | null = null;
    const markers = markerRefs.current;

    void import("leaflet").then((L) => {
      if (disposed || !containerRef.current) return;

      map = L.map(containerRef.current, {
        center: CYPRUS_CENTER,
        zoom: 9,
        minZoom: 7,
        maxZoom: 19,
        zoomControl: false,
      });
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      locationLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);

      window.requestAnimationFrame(() => map?.invalidateSize());
    });

    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      locationLayerRef.current = null;
      markers.clear();
    };
  }, []);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !markerLayerRef.current) return;
    let disposed = false;

    void import("leaflet").then((L) => {
      const map = mapRef.current;
      const layer = markerLayerRef.current;
      if (disposed || !map || !layer) return;

      layer.clearLayers();
      markerRefs.current.clear();

      for (const point of points) {
        const isSelected = point.id === selectedIdRef.current;
        const marker = L.marker([point.latitude, point.longitude], {
          icon: markerIcon(L, isSelected),
          keyboard: true,
          riseOnHover: true,
          title: point.name,
        })
          .bindTooltip(point.name, { direction: "top", offset: [0, -16] })
          .on("click", () => setSelectedId(point.id))
          .addTo(layer);
        marker.setZIndexOffset(isSelected ? 1000 : 0);
        markerRefs.current.set(point.id, marker);
      }

      if (points.length === 1) {
        map.setView([points[0].latitude, points[0].longitude], 15);
      } else if (points.length > 1) {
        const bounds = L.latLngBounds(
          points.map((point) => [point.latitude, point.longitude] as Leaflet.LatLngTuple),
        );
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
      } else {
        map.fitBounds(CYPRUS_BOUNDS, { padding: [12, 12] });
      }
    });

    return () => {
      disposed = true;
    };
  }, [mapReady, points]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !locationLayerRef.current) return;
    let disposed = false;

    void import("leaflet").then((L) => {
      const layer = locationLayerRef.current;
      if (disposed || !layer) return;
      layer.clearLayers();

      if (deviceLocation) {
        L.circleMarker([deviceLocation.latitude, deviceLocation.longitude], {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: "#2563eb",
          fillOpacity: 1,
        })
          .bindTooltip("Your device location", { direction: "top", offset: [0, -8] })
          .addTo(layer);
      }
      if (startingPoint) {
        L.circleMarker([startingPoint.latitude, startingPoint.longitude], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#563a2c",
          fillOpacity: 1,
        })
          .bindTooltip(`Starting point: ${startingPoint.label}`, {
            direction: "top",
            offset: [0, -8],
          })
          .addTo(layer);
      }
    });

    return () => {
      disposed = true;
    };
  }, [deviceLocation, mapReady, startingPoint]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !baseline) return;
    mapRef.current.flyTo([baseline.latitude, baseline.longitude], 13, {
      animate: true,
      duration: 0.6,
    });
  }, [baseline, mapReady]);

  React.useEffect(() => {
    selectedIdRef.current = selectedId;
    for (const [id, marker] of markerRefs.current) {
      const element = marker.getElement()?.querySelector<HTMLElement>(".trapezi-map-pin");
      element?.classList.toggle("is-selected", id === selectedId);
      marker.setZIndexOffset(id === selectedId ? 1000 : 0);
    }
  }, [mapReady, points, selectedId]);

  async function setTypedStartingPoint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = locationQuery.trim();
    if (!query) return;

    const coordinates = parseCoordinates(query) ?? resolveAreaCoordinates(query);
    if (coordinates) {
      saveStartingPoint({ ...coordinates, label: query });
      return;
    }

    setLocationSearching(true);
    setLocationError(null);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const result = (await response.json().catch(() => null)) as
        | { latitude?: number; longitude?: number; label?: string; error?: string }
        | null;
      if (
        !response.ok ||
        typeof result?.latitude !== "number" ||
        typeof result.longitude !== "number"
      ) {
        setLocationError(result?.error ?? "Could not find that location.");
        return;
      }
      saveStartingPoint({
        latitude: result.latitude,
        longitude: result.longitude,
        label: result.label ?? query,
      });
    } catch {
      setLocationError("Could not search for that location. Try again.");
    } finally {
      setLocationSearching(false);
    }
  }

  function saveStartingPoint(location: MapLocation) {
    setStartingPoint(location);
    setLocationQuery("");
    setLocationError(null);
    try {
      window.localStorage.setItem(STARTING_POINT_STORAGE_KEY, JSON.stringify(location));
    } catch {
      // The current session still works if storage is blocked by browser privacy settings.
    }
  }

  function useDeviceAsStartingPoint() {
    setStartingPoint(null);
    setLocationError(null);
    try {
      window.localStorage.removeItem(STARTING_POINT_STORAGE_KEY);
    } catch {
      // No action needed: device location remains the active session baseline.
    }
    if (!deviceLocation) requestDeviceLocation();
  }

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-muted",
        className,
      )}
    >
      <div
        ref={containerRef}
        className={cn("trapezi-leaflet-map w-full", height)}
        role="region"
        aria-label="Interactive map of Cyprus with your saved places"
      />

      {!mapReady ? (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-surface-muted text-sm text-ink-muted">
          Loading map…
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-3 top-3 z-[500] w-[min(19rem,calc(100%-1.5rem))]">
        {locationControlOpen ? (
          <div className="pointer-events-auto rounded-2xl border border-line bg-surface/95 p-3 shadow-[var(--shadow-float)] backdrop-blur">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-clay-50 text-clay-700">
                <MapPinned className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Starting point</p>
                <p className="line-clamp-2 text-xs text-ink-muted">
                  {startingPoint
                    ? `Using ${startingPoint.label}`
                    : deviceLocation
                      ? "Using your device location"
                      : deviceLocating
                        ? "Finding your device location…"
                        : "Set a location to see distances"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLocationControlOpen(false)}
                className="grid size-7 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                aria-label="Collapse starting point controls"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>

            <form onSubmit={setTypedStartingPoint} className="mt-3 flex gap-2">
              <Input
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                placeholder="Address, area, or 35.17, 33.36"
                className="h-9 min-w-0 px-3 text-xs"
                aria-label="Starting point"
              />
              <button
                type="submit"
                disabled={locationSearching || locationQuery.trim().length === 0}
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-clay-600 text-white transition hover:bg-clay-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Set starting point"
              >
                <Search className="size-4" />
              </button>
            </form>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={useDeviceAsStartingPoint}
                disabled={deviceLocating}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-clay-700 hover:underline disabled:opacity-50"
              >
                <LocateFixed className="size-3.5" />
                Use device location
              </button>
              {startingPoint ? (
                <button
                  type="button"
                  onClick={useDeviceAsStartingPoint}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink hover:underline"
                >
                  <Crosshair className="size-3.5" />
                  Clear custom point
                </button>
              ) : null}
            </div>
            {locationError ? <p className="mt-2 text-xs text-red-700">{locationError}</p> : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLocationControlOpen(true)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface/95 px-3 py-2 text-xs font-semibold text-ink shadow-[var(--shadow-float)] backdrop-blur transition hover:bg-surface"
          >
            <MapPinned className="size-3.5 text-clay-700" />
            Starting point
          </button>
        )}
      </div>

      {mapReady && points.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-canvas/60 px-6 text-center">
          <p className="max-w-xs text-sm text-ink-muted">
            No saved places match these filters yet.
          </p>
        </div>
      ) : null}

      {selected ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-7 z-[500] sm:inset-x-auto sm:left-4 sm:w-80">
          <div className="pointer-events-auto rounded-2xl border border-line bg-surface/95 p-3.5 shadow-[var(--shadow-float)] backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold">{selected.name}</p>
                <p className="truncate text-xs text-ink-muted">
                  {[CATEGORY_LABELS[selected.category], selected.area ?? selected.city]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setSelectedId(null)}
                className="rounded-full p-1 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              {selected.personalRating != null ? (
                <span className="inline-flex items-center gap-1 font-medium">
                  <Star className="size-3 fill-star text-star" />
                  {selected.personalRating.toFixed(1)} yours
                </span>
              ) : selected.publicRating != null ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3 fill-star text-star" />
                  {selected.publicRating.toFixed(1)}
                </span>
              ) : null}
              {selected.budgetText ? <span>{selected.budgetText}</span> : null}
              {selectedDistanceKm != null ? (
                <span>{selectedDistanceKm.toFixed(1)} km away</span>
              ) : null}
              <Badge variant="default" size="sm">
                {selected.status === "wishlist"
                  ? "Want to try"
                  : selected.status === "favourite"
                    ? "Favourite"
                    : "Saved"}
              </Badge>
            </div>
            <Button asChild size="sm" className="mt-3 w-full">
              {selectedAction === "google" ? (
                <a
                  href={selected.googleMapsUrl ?? googleMapsCoordinateUrl(selected)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps
                  <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <Link href={`/places/${selected.id}`}>Open place</Link>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseCoordinates(value: string): Pick<MapLocation, "latitude" | "longitude"> | null {
  const match = value.trim().match(
    /^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/,
  );
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function readStartingPoint(): MapLocation | null {
  try {
    const raw = window.localStorage.getItem(STARTING_POINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MapLocation>;
    if (
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number" ||
      typeof parsed.label !== "string" ||
      !Number.isFinite(parsed.latitude) ||
      !Number.isFinite(parsed.longitude) ||
      parsed.latitude < -90 ||
      parsed.latitude > 90 ||
      parsed.longitude < -180 ||
      parsed.longitude > 180
    ) {
      return null;
    }
    return parsed as MapLocation;
  } catch {
    return null;
  }
}

function googleMapsCoordinateUrl(point: MapPoint): string {
  const query = encodeURIComponent(`${point.latitude},${point.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function markerIcon(L: typeof Leaflet, selected: boolean): Leaflet.DivIcon {
  return L.divIcon({
    className: "trapezi-map-marker",
    html: `<span class="trapezi-map-pin${selected ? " is-selected" : ""}" aria-hidden="true"><span></span></span>`,
    iconSize: [36, 42],
    iconAnchor: [18, 39],
    tooltipAnchor: [0, -34],
  });
}
