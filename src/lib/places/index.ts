import { DemoPlaceProvider } from "./demo-provider";
import { GooglePlacesProvider } from "./google-provider";
import { OsmPlaceProvider } from "./osm-provider";
import { PlaceProviderError, type PlaceProvider, type ProviderInfo } from "./types";

export * from "./types";
export { DemoPlaceProvider } from "./demo-provider";
export { GooglePlacesProvider } from "./google-provider";
export { OsmPlaceProvider } from "./osm-provider";
export { DEMO_PLACES } from "./demo-data";

export type SearchProviderId = "osm" | "google" | "demo";

export function resolveProviderId(): SearchProviderId {
  const configured = (process.env.PLACES_PROVIDER ?? "auto").trim().toLowerCase();
  if (configured === "google") return "google";
  if (configured === "demo") return "demo";
  if (configured === "osm") return "osm";
  return process.env.GOOGLE_PLACES_API_KEY ? "google" : "osm";
}

export function getPlaceProvider(id?: SearchProviderId): PlaceProvider {
  const resolved = id ?? resolveProviderId();
  if (resolved === "google") {
    return new GooglePlacesProvider(process.env.GOOGLE_PLACES_API_KEY);
  }
  if (resolved === "osm") return new OsmPlaceProvider();
  return new DemoPlaceProvider();
}

export function describeProvider(provider: PlaceProvider = getPlaceProvider()): ProviderInfo {
  return {
    id: provider.id,
    label: provider.label,
    mode: provider.mode,
    configured: provider.configured,
    fallbackReason: null,
  };
}

/**
 * Search with graceful degradation: if the configured real-data provider is
 * unavailable we fall back to the bundled dataset and tell the UI why.
 */
export async function searchPlaces(
  query: Parameters<PlaceProvider["search"]>[0],
): Promise<{ results: Awaited<ReturnType<PlaceProvider["search"]>>; provider: ProviderInfo }> {
  const provider = getPlaceProvider();
  try {
    const results = await provider.search(query);
    return { results, provider: describeProvider(provider) };
  } catch (error) {
    if (provider.mode === "demo") throw error;
    const demo = new DemoPlaceProvider();
    const results = await demo.search(query);
    return {
      results,
      provider: {
        ...describeProvider(demo),
        fallbackReason:
          error instanceof PlaceProviderError
            ? `${provider.label} unavailable (${error.code}) — showing demo results`
            : `${provider.label} unavailable — showing demo results`,
      },
    };
  }
}

export async function getPlaceDetails(
  providerId: SearchProviderId,
  providerPlaceId: string,
): Promise<{ result: Awaited<ReturnType<PlaceProvider["getDetails"]>>; provider: ProviderInfo }> {
  const provider = getPlaceProvider(providerId);
  try {
    const result = await provider.getDetails(providerPlaceId);
    return { result, provider: describeProvider(provider) };
  } catch (error) {
    if (provider.mode === "demo") throw error;
    const demo = new DemoPlaceProvider();
    const result = await demo.getDetails(providerPlaceId);
    return {
      result,
      provider: {
        ...describeProvider(demo),
        fallbackReason:
          error instanceof PlaceProviderError
            ? `${provider.label} unavailable (${error.code})`
            : `${provider.label} unavailable`,
      },
    };
  }
}
