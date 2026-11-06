---
title: 'Plot only places with coordinates on the places map'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
baseline_revision: '8dff0941558e9c746107b1791143e6d2932332f0'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
warnings: []
deferred:
  - summary: >-
      Map empty overlay says "No saved places match these filters" when places match but none have coordinates, and omitted places are not mentioned on /places.
    evidence: |-
      MapCanvas overlay text (map-canvas.tsx ~432) is fixed; /places toolbar counts sorted.length while markers come from toMapPoints. /map header also divides filtered points by the whole-library total. Needs page-level copy.
    location: >-
      src/app/(app)/places/page.tsx
    severity: low
  - summary: >-
      No test checks that /places and /map pass toMapPoints output to MapCanvas.
    evidence: |-
      Only the helper is unit-tested; restoring an inline `as number` mapping would still typecheck and pass. The repo has no page/component rendering harness.
    location: >-
      src/app/(app)/places/page.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** The map view on `/places` passes every filtered place to `MapCanvas`, casting `latitude`/`longitude` with `as number`; places without coordinates are plotted at 0,0 (off the coast of Africa), the map zooms out to fit them, and its "no places" overlay never appears.

**Approach:** Build map points from places that have both coordinates, using one shared helper for `/places` and `/map` so both pages apply the same rule.

## Boundaries & Constraints

**Always:** Use the existing `hasCoordinates` type guard (`src/lib/domain/geo.ts:73`) as the single coordinates rule. Keep each point's fields exactly as both pages build them today. Keep the `/places` empty-state branches ("Your list is empty", "No places match those filters") as they are.

**Never:** Change `MapCanvas`, the `/map` page header count text, list/card views, filtering or sorting. Add dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mixed list | 3 prepared places, one with `latitude: null` | 2 points, order preserved | none |
| Missing longitude only | `latitude` set, `longitude: null` | excluded | none |
| Zero coordinate | `latitude: 0, longitude: 33` | included (0 is a number) | none |
| None have coordinates | all null | `[]` → `MapCanvas` shows its empty overlay | none |
| Point fields | a place with coordinates | id, name, category, latitude, longitude, area, city, publicRating, personalRating, budgetText, distanceKm, status — same values as today | none |

</intent-contract>

## Code Map

- `src/app/(app)/places/page.tsx:110-130` -- map view: `sorted.map(prepared => ({ …, latitude: prepared.place.latitude as number, … }))` — the bug.
- `src/app/(app)/map/page.tsx:45-47,89-105` -- `withCoords` filter (`!= null`) then the identical point mapping; `withCoords.length` is also used in the header (keep that count working).
- `src/lib/domain/geo.ts:73-82` -- `hasCoordinates(place)` type guard (number and finite).
- `src/components/app/map-canvas.tsx:23` -- `MapPoint` interface (import as a type only); empty overlay at :432 when `points.length === 0`.
- `src/lib/domain/place-view.ts:11` -- `PreparedPlace` (`place`, `budget`, `distanceKm`, …); `preparePlace` builds it.
- `src/lib/utils/format.ts` -- `formatBudgetRange(min, max, { approximate })`.
- `tests/fixtures.ts` -- `makePlace`; `tests/scoring.test.ts:9-21` shows building `PreparedPlace` via `preparePlace` + `buildUserPreferences`.

## Tasks & Acceptance

**Execution:**
- `src/lib/domain/map-points.ts` -- create `toMapPoints(prepared: PreparedPlace[]): MapPoint[]`: filter with `hasCoordinates(p.place)`, map to the point shape -- one rule for both pages.
- `src/app/(app)/places/page.tsx` -- map view uses `toMapPoints(sorted)` -- fixes the 0,0 plotting.
- `src/app/(app)/map/page.tsx` -- use `toMapPoints(filtered)` for `points` and its length for the header count -- same rule on both pages.
- `tests/map-points.test.ts` -- create: one test per matrix row.

**Acceptance Criteria:**
- Given a library where some places lack coordinates, when the user opens `/places?view=map`, then only places with coordinates appear as markers and the map fits those; if none have coordinates, the map's empty overlay shows.
- Given the full check suite, when `npm run typecheck && npm run lint && npm test` runs, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 16, false 4, maybe-false 0
- findings:
  - `[low]` `[defer]` (edge-case-hunter) /places map overlay says "No saved places match these filters" when places match but lack coordinates — the intent contract keeps MapCanvas and its overlay; page-level copy is a follow-up.
  - `[low]` `[defer]` (edge-case-hunter) Places without coordinates are dropped from /places map with no note — same UX follow-up.
  - `[low]` `[defer]` (edge-case-hunter) /map header mixes filtered count with whole-library total — pre-existing; header text out of scope.
  - `[low]` `[defer]` (edge-case-hunter) /map overlay wording when filtered places lack coordinates — same UX follow-up.
  - `[low]` `[defer]` (blind-hunter) Overlay gives the wrong reason on /places — same UX follow-up.
  - `[low]` `[defer]` (blind-hunter) No note about omitted places — same UX follow-up.
  - `[low]` `[patch]` (blind-hunter) Stricter rule untested for NaN/Infinity — tests added.
  - `[low]` `[patch]` (blind-hunter) Zero-coordinate test covers latitude only — longitude 0 case added.
  - `[low]` `[patch]` (blind-hunter) Point-fields test restates the implementation — rewritten with literal values, personal rating, approximate budget and distance.
  - `[low]` `[reject]` (blind-hunter) Domain module imports a type from a UI component — type-only import, erased at compile; moving the type would change MapCanvas, which the contract forbids.
  - `[low]` `[reject]` (blind-hunter) No page-level test of the wiring — no page-rendering harness exists; covered by the deferred verification item.
  - `[low]` `[defer]` (blind-hunter) /map header mixed bases — same as the edge-case header row.
  - `[low]` `[reject]` (blind-hunter) /map side list shows places without markers — pre-existing list behaviour, out of scope.
  - `[false]` `[reject]` (blind-hunter) Story bookkeeping empty / warnings missing — logs are filled at triage; the `/map` rule change is the contract's "single coordinates rule", not a warning.
  - `[low]` `[defer]` (verification-gap, pre-verified) Page wiring of `toMapPoints` untested — filed as defer: needs page/component test infrastructure.
  - `[low]` `[reject]` (verification-gap, other) Place detail page still uses `!= null` — different point shape; outside the two pages the contract names; differs only for NaN/Infinity.
  - `[false]` `[reject]` (intent-alignment) Rule replaced rather than reused — the contract requires one shared rule (`hasCoordinates`); /map's behaviour only differs for non-finite values.
  - `[low]` `[defer]` (intent-alignment) UI-surface links (page wiring, overlay rendering) untested — same deferred verification item.
  - `[low]` `[defer]` (intent-alignment) Empty state is the canvas overlay with filter wording — same UX follow-up.
  - `[false]` `[reject]` (intent-alignment) /map edited beyond the places view — required by the contract's shared-rule task; behaviour-preserving except non-finite values.

## Verification

**Commands:**
- `npm test -- tests/map-points.test.ts` -- expected: all pass
- `npm run typecheck && npm run lint && npm test` -- expected: all succeed

## Auto Run Result

Status: done

**Summary:** A shared `toMapPoints` helper builds map markers only for places passing `hasCoordinates`; `/places?view=map` uses it (no more markers at 0,0, empty overlay when none have coordinates) and `/map` uses it for its markers and header count.

**Files changed:**
- `src/lib/domain/map-points.ts` -- new `toMapPoints(prepared)`.
- `src/app/(app)/places/page.tsx` -- map view uses `toMapPoints(sorted)`.
- `src/app/(app)/map/page.tsx` -- markers and header count from `toMapPoints(filtered)`.
- `tests/map-points.test.ts` -- new, 6 tests.

**Review:** 20 findings — 3 patch rows (low, applied), 9 rows deferred as 2 low items (overlay copy; page wiring tests), 8 rejected (reasons in triage log).

**Follow-up review recommended:** false — patched entries: high 0, medium 0, low 3.

**Verification:** `npm run typecheck` ok; `npm run lint` ok; `npm test` all pass. Not checked in a browser.

**Residual risks:** deferred items above.
