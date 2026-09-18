import { normalizeName } from "@/lib/utils/ids";
import type { PlaceSearchResult } from "@/lib/domain/types";
import { DEMO_PLACES } from "./demo-data";
import { PlaceProviderError, type PlaceProvider, type PlaceSearchQuery } from "./types";

/**
 * Offline provider backed by the bundled Cyprus dataset. Search behaves like a
 * real text search: multi-token AND matching over name, cuisine, category, area
 * and city, ranked by field weight and public rating.
 */
export class DemoPlaceProvider implements PlaceProvider {
  readonly id = "demo" as const;
  readonly label = "Demo Cyprus dataset";
  readonly mode = "demo" as const;
  readonly configured = true;

  async search(query: PlaceSearchQuery): Promise<PlaceSearchResult[]> {
    await this.simulateLatency();
    this.simulateFailure();

    const tokens = normalizeName(query.text)
      .split(" ")
      .filter((token) => token.length > 0);

    if (tokens.length === 0) {
      return DEMO_PLACES.slice(0, query.limit ?? 8);
    }

    const scored = DEMO_PLACES.map((place) => ({ place, score: scorePlace(place, tokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || (b.place.publicRating ?? 0) - (a.place.publicRating ?? 0))
      .slice(0, query.limit ?? 8);

    return scored.map((entry) => ({ ...entry.place }));
  }

  async getDetails(providerPlaceId: string): Promise<PlaceSearchResult | null> {
    await this.simulateLatency();
    this.simulateFailure();
    const found = DEMO_PLACES.find((place) => place.providerPlaceId === providerPlaceId);
    return found ? { ...found } : null;
  }

  private async simulateLatency(): Promise<void> {
    const latency = Number(process.env.MOCK_PLACES_LATENCY_MS ?? 120);
    if (latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, latency));
    }
  }

  private simulateFailure(): void {
    const rate = Number(process.env.MOCK_PLACES_FAILURE_RATE ?? 0);
    if (rate > 0 && Math.random() < rate) {
      throw new PlaceProviderError("unavailable", "The demo place provider is simulating an outage.");
    }
  }
}

function scorePlace(place: PlaceSearchResult, tokens: string[]): number {
  const name = normalizeName(place.name);
  const cuisines = place.cuisines.map(normalizeName).join(" ");
  const area = normalizeName(place.area ?? "");
  const city = normalizeName(place.city ?? "");
  const category = normalizeName(place.category);
  const address = normalizeName(place.address ?? "");

  let score = 0;
  for (const token of tokens) {
    let tokenScore = 0;
    if (name.startsWith(token)) tokenScore = 6;
    else if (name.includes(token)) tokenScore = 5;
    else if (cuisines.includes(token)) tokenScore = 4;
    else if (area.includes(token)) tokenScore = 3.5;
    else if (city.includes(token)) tokenScore = 3;
    else if (category.includes(token)) tokenScore = 3;
    else if (address.includes(token)) tokenScore = 1.5;
    if (tokenScore === 0) return 0; // every token must match something
    score += tokenScore;
  }

  return score + (place.publicRating ?? 0) * 0.1;
}
