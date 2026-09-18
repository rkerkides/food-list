import { DemoPlaceProvider } from "./demo-provider";
import { GooglePlacesProvider } from "./google-provider";
import { PlaceProviderError, type PlaceProvider, type ProviderInfo } from "./types";

export * from "./types";
export { DemoPlaceProvider } from "./demo-provider";
export { GooglePlacesProvider } from "./google-provider";
export { DEMO_PLACES } from "./demo-data";

export function resolveProviderId(): "google" | "demo" {
  const configured = (process.env.PLACES_PROVIDER ?? "auto").trim().toLowerCase();
  if (configured === "google") return "google";
  if (configured === "demo") return "demo";
  return process.env.GOOGLE_PLACES_API_KEY ? "google" : "demo";
}

export function getPlaceProvider(id?: "google" | "demo"): PlaceProvider {
  const resolved = id ?? resolveProviderId();
  if (resolved === "google") {
    return new GooglePlacesProvider(process.env.GOOGLE_PLACES_API_KEY);
  }
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
 * Search with graceful degradation: if the live provider fails we fall back to
 * the bundled dataset and tell the UI why, instead of showing an error screen.
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
  providerId: "google" | "demo",
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
