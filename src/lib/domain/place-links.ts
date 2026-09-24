import type { Place } from "./types";

type LinkablePlace = Pick<
  Place,
  "name" | "address" | "area" | "city" | "latitude" | "longitude" | "googleMapsUrl"
> & Partial<Pick<Place, "provider" | "providerPlaceId">>;

export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Reads the coordinates embedded in shareable Google Maps place URLs. Short
 * links deliberately return null: resolving them would require a network call.
 */
export function googleMapsCoordinatesFromUrl(value: string | null | undefined): MapCoordinates | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const source = `${url.pathname}${url.search}`;
    const exactPin = source.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    const visibleMap = source.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const match = exactPin ?? visibleMap;
    if (!match) return null;

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

/** Universal Google Maps links do not require an API key. */
export function googleMapsPlaceUrl(place: LinkablePlace): string {
  if (place.googleMapsUrl) return place.googleMapsUrl;
  const location = place.address ?? [place.area, place.city, "Cyprus"].filter(Boolean).join(", ");
  const query = location ? `${place.name}, ${location}` : coordinates(place) ?? place.name;
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  if (place.provider === "google" && place.providerPlaceId) {
    url.searchParams.set("query_place_id", place.providerPlaceId);
  }
  return url.toString();
}

export function googleMapsDirectionsUrl(place: LinkablePlace): string {
  const destination =
    coordinates(place) ??
    [place.name, place.address, place.area, place.city, "Cyprus"].filter(Boolean).join(", ");
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", destination);
  if (place.provider === "google" && place.providerPlaceId) {
    url.searchParams.set("destination_place_id", place.providerPlaceId);
  }
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function coordinates(place: LinkablePlace): string | null {
  if (place.latitude == null || place.longitude == null) return null;
  return `${place.latitude},${place.longitude}`;
}
