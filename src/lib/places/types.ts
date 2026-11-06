import type { PlaceProviderId, PlaceSearchResult } from "@/lib/domain/types";

export interface PlaceSearchQuery {
  text: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  limit?: number;
  /** Bias results to Cyprus by default. */
  regionCode?: string;
}

export type PlaceProviderErrorCode =
  | "rate_limited"
  | "unavailable"
  | "not_found"
  | "invalid_request"
  | "unknown";

export class PlaceProviderError extends Error {
  readonly code: PlaceProviderErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    code: PlaceProviderErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "PlaceProviderError";
    this.code = code;
    this.retryable = options.retryable ?? (code === "rate_limited" || code === "unavailable");
    this.cause = options.cause;
  }
}

/**
 * Everything the app needs from a place data source. Swapping Google Places for
 * another provider means implementing this interface and registering it.
 */
export interface PlaceProvider {
  readonly id: PlaceProviderId;
  readonly label: string;
  /** "local" searches imported real data without making a request. */
  readonly mode: "live" | "local" | "demo";
  readonly configured: boolean;
  search(query: PlaceSearchQuery): Promise<PlaceSearchResult[]>;
  getDetails(providerPlaceId: string): Promise<PlaceSearchResult | null>;
}

export interface ProviderInfo {
  id: PlaceProviderId;
  label: string;
  mode: "live" | "local" | "demo";
  configured: boolean;
  /** Set when the requested provider was unavailable and we degraded. */
  fallbackReason?: string | null;
}
