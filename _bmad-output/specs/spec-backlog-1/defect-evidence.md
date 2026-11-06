# Defect evidence (2026-11-06 review, verified against 294aee1)

Per-capability locations and implementation notes. Line numbers drift; re-locate by symbol.

## CAP-1 — permission gate
- `src/lib/services/sharing.ts:37-69` `resolveEditablePlace`, `resolveEditableVisit`; opt-in flag `users.shared_content_editable_by_group` via `setSharedContentEditableByGroup`.
- Place delete owner-only: `src/lib/services/places.ts` (~244-246).
- Test helpers: `createTestContext`, `createSecondUser` in `tests/helpers.ts`; pattern in `tests/services.circles.test.ts`.

## CAP-2 — Google photo proxy
- `src/app/api/places/photo/route.ts:9-45`: Google branch never calls `getSessionUser()`; key appended at ~27-29; `Cache-Control: public` at ~42.
- Real refs have the form `places/<id>/photos/<id>` (`src/lib/places/google-provider.ts` ~195).
- Only caller: `place-visual.tsx` (~68), a same-origin `<img>` inside the signed-in app. `upload:` and `commons:` branches are out of scope except as CAP-4 touches `upload:`.

## CAP-3 — demo account and circles
- `src/lib/services/circles.ts:41-58` `createSharedCircle`, `addCircleMember`; `src/app/actions/circles.ts:30-68`.
- `repositories.ts` `circles.addMemberByEmail` (~383-397) adds without consent; `accessibleUserIds` (~438) merges peer libraries.
- Demo flag: `users.is_demo`; `SessionUser` exposes demo status (see `src/lib/auth/session.ts`). Existing demo guard style: `src/app/actions/demo.ts`.

## CAP-4 — shared-place images
- `src/app/api/places/[id]/image/route.ts:33,39,55` look up under `user.id`.
- `src/lib/services/place-images.ts:27,47,84,117` take `userId` as owner; file imports `server-only` (fails under vitest) and has no `repos?` parameter.
- `src/app/api/places/photo/route.ts` `serveUploadedPhoto` (~57) checks `user.id` only; use circles' accessible user ids.
- Edit dialog shown to shared editors: `src/components/app/edit-place-dialog.tsx` (~132) under `canEdit` in `src/app/(app)/places/[id]/page.tsx` (~157-173).

## CAP-5 — status and spend range
- `src/app/actions/places.ts:221-230` `setPlaceStatusAction` → `src/lib/services/places.ts:401-412`; no CHECK constraint on status (migration 0001).
- Spend fields in `src/lib/domain/schemas.ts` addPlace (~72-73), manualPlace (~97-98), updatePlace (~131-132); review action `src/app/actions/places.ts` (~77). Rendered by `src/lib/utils/format.ts` (~23-24).

## CAP-6 — venue review validation
- `src/app/actions/places.ts:54-91` `completeVenueLinkReviewAction`; `src/lib/services/venue-review.ts:58-61, 134`.
- Other place writes validate cuisines: `src/app/actions/places.ts` (~120-125, ~163-165, ~205-209) via `validateCuisines` (`src/lib/services/cuisines.ts`).
- Keep `tests/services.venue-link-submissions.test.ts:44` semantics (members without opt-in may review).

## CAP-7 — relative time
- `src/lib/utils/format.ts:72-87` `relativeTime`: "yesterday" gets " ago"/"in " appended; line ~86 dead ternary.
- `src/lib/domain/scoring.ts:386-390`: `Math.round(days / 30)` gives "1 month" at 15 days.
- No `tests/format.test.ts` exists yet.

## CAP-8 — places map
- `src/app/(app)/places/page.tsx:108-114` maps all filtered places to `MapCanvas` with `latitude as number`.
- `src/app/(app)/map/page.tsx:45-47` already filters to places with coordinates.
- `MapCanvas` empty overlay (~432) and fit-bounds (~183, ~198-200) in the map canvas component.
