import type { Visit } from "./types";

/** Marks a prior visit that was imported without a trustworthy visit date. */
export const IMPORTED_HISTORY_TAG = "imported-history";

export function isImportedHistory(visit: Pick<Visit, "tags">): boolean {
  return visit.tags.includes(IMPORTED_HISTORY_TAG);
}
