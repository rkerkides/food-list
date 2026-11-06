import type { MapPoint } from "@/components/app/map-canvas";
import { formatBudgetRange } from "@/lib/utils/format";
import { hasCoordinates } from "./geo";
import type { PreparedPlace } from "./place-view";

/**
 * Map markers for the places that have both coordinates, in input order.
 * Places without coordinates are left off rather than plotted at 0,0.
 */
export function toMapPoints(prepared: PreparedPlace[]): MapPoint[] {
  return prepared.flatMap(({ place, budget, distanceKm }) => {
    if (!hasCoordinates(place)) return [];
    return [
      {
        id: place.id,
        name: place.name,
        category: place.category,
        latitude: place.latitude,
        longitude: place.longitude,
        area: place.area,
        city: place.city,
        publicRating: place.publicRating,
        personalRating: place.stats.personalRating,
        budgetText: formatBudgetRange(budget.min, budget.max, {
          approximate: budget.approximate,
        }),
        distanceKm,
        status: place.status,
      },
    ];
  });
}
