import type { Place } from "./types";

type LinkablePlace = Pick<
  Place,
  "name" | "address" | "area" | "city" | "latitude" | "longitude" | "googleMapsUrl"
> & Partial<Pick<Place, "provider" | "providerPlaceId">>;

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
