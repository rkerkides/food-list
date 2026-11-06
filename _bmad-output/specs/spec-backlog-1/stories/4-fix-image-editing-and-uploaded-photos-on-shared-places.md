---
title: 'Fix image editing and uploaded photos on shared places'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
baseline_revision: '2489a8e36680254ad769fc729ce3a1f1974bc2c4'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The place Edit dialog is shown to circle members allowed to edit a shared place, but `POST /api/places/[id]/image` looks the place up under the signed-in user, so they always get 404; and `/api/places/photo` serves an uploaded photo only to the uploader, so every other circle member sees a broken image on a shared place with an upload.

**Approach:** Route image changes through the shared-content gate and act as the place owner when allowed; serve an uploaded photo to any viewer whose accessible libraries include the upload's owner. Make the image service injectable so both paths are tested.

## Boundaries & Constraints

**Always:** Resolve edit access with `resolveEditablePlace(user.id, placeId)` and call the image services with `access.ownerUserId`. Uploaded-photo visibility = owner ∈ `circles.accessibleUserIds(viewerId)` (which includes the viewer). Keep the `upload:` 401 for no session. Every image service function gains an optional last `repos?: Repositories` (use `repos.db` for raw SQL and `repos.db.transaction`, with `createRepositories(tx)` inside). Keep `import "server-only"` in `place-images.ts`; tests mock it.

**Never:** Change the Google or `commons:` branches of the photo route (story 2 owns them). Change upload size/type/signature validation. Change the Edit dialog UI. Allow a `forbidden` editor to change an image.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Owner changes image | owner; stock/upload/automatic | 200 `{ ok: true }`; place `photoRef` updated under owner | none |
| Allowed shared editor | member, owner opted in; stock or upload | 200; owner's place updated; upload row `user_id` = owner | none |
| Forbidden member | member, owner not opted in | 403 `{ ok: false, error }`; nothing changes | none |
| Unrelated / unknown place | outsider or unknown id | 404 `{ ok: false, error }` | none |
| Viewer is owner | `ref=upload:<placeId>:<ts>` by owner | 200 image bytes | none |
| Viewer in owner's circle | circle member (no opt-in needed) | 200 image bytes | none |
| Viewer outside circle | user sharing no circle with owner | 404 | none |
| No upload / no session | no row for place; or no session | 404; 401 | none |

</intent-contract>

## Code Map

- `src/lib/services/place-images.ts:18-123` -- `setStockPlaceImage`, `setUploadedPlaceImage`, `resetPlaceImage`, `getUploadedPlaceImage`: all call `getDb()` directly and scope by the passed `userId`; `place_image_uploads.place_id` is the primary key (`migrations.ts:312-319`), so an upload can be found by place id alone. Imports `server-only` (throws under vitest → `vi.mock("server-only", () => ({}))`).
- `src/app/api/places/[id]/image/route.ts:14-73` -- `POST`: session → form parse → mode switch calling services with `user.id`; `null` result → 404 "That place is not in your list." Insert the `resolveEditablePlace` gate after the session check and before reading the form body.
- `src/app/api/places/photo/route.ts:51-69` -- `serveUploadedPhoto`: parses `placeId` from `upload:<placeId>:<ts>`, requires session, calls `getUploadedPlaceImage(user.id, placeId)`. Replace with a viewer-aware lookup.
- `src/lib/services/sharing.ts:37-52` -- `resolveEditablePlace(actor, placeId, repos?)` → `{ access, ownerUserId, place }`.
- `src/lib/data/repositories.ts:438-447` -- `circles.accessibleUserIds(userId)` includes the user.
- `src/lib/services/library.ts:141` -- `defaultRepositories()`.
- `tests/api.places-photo.test.ts` -- existing photo-route tests mock `@/lib/services/place-images` with `getUploadedPlaceImage`; update the mock to whatever function the route now calls, keeping all existing tests passing.
- `tests/actions.shared-delete.test.ts` -- golden mock pattern (`vi.hoisted` state, `requireUser`/`defaultRepositories` mocks).

## Tasks & Acceptance

**Execution:**
- `src/lib/services/place-images.ts` -- add `repos?: Repositories` to every exported function (fallback `defaultRepositories()`); add `getViewableUploadedPlaceImage(viewerId, placeId, repos?)` that reads the upload row by `place_id` and returns it only when its `user_id` ∈ `accessibleUserIds(viewerId)` -- testable, viewer-aware reads.
- `src/app/api/places/[id]/image/route.ts` -- gate with `resolveEditablePlace`: `not_found` → 404 "That place could not be found.", `forbidden` → 403 "You can't change this shared place's image.", `allowed` → call services with `access.ownerUserId` -- shared editors can change images.
- `src/app/api/places/photo/route.ts` -- `serveUploadedPhoto` uses `getViewableUploadedPlaceImage(user.id, placeId)` -- circle members see uploads.
- `tests/services.place-images.test.ts` -- create: service tests with `ctx.repos` for owner/shared-editor writes (upload row owner) and every viewer row of the matrix.
- `tests/api.places-image.test.ts` -- create: route tests for owner, allowed editor, forbidden (403, unchanged), unknown (404), mocking `getSessionUser`, `next/cache`, `server-only` and `defaultRepositories` (→ `ctx.repos`); build `FormData` with `mode=stock` and a valid `stockImage` key (`isPlaceStockImage`), plus one `mode=upload` case with a minimal valid PNG signature.
- `tests/api.places-photo.test.ts` -- update the place-images mock for the new function name.

**Acceptance Criteria:**
- Given a circle member allowed to edit a shared place, when they save a new image in the Edit dialog, then the request succeeds and the owner's place shows the new image.
- Given the full check suite, when `npm run typecheck && npm run lint && npm test` runs, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 17, false 3, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind-hunter) Photo-route test labels describe the old owner-only rule; no upload null → 404 route test — renamed and added the 404 test.
  - `[low]` `[patch]` (blind-hunter) `getUploadedPlaceImage` now unused — deleted.
  - `[low]` `[reject]` (blind-hunter) Viewable lookup loads the blob before the access check — refs carry random UUID place ids, so outsiders cannot enumerate them; members fetch the blob anyway.
  - `[low]` `[reject]` (blind-hunter) Year-long private cache outlives circle removal — only the former member's own browser holds an image they already saw.
  - `[low]` `[patch]` (blind-hunter) Route tests miss shared-editor `automatic` and forbidden `upload` — added both.
  - `[low]` `[reject]` (blind-hunter) 401 test doesn't assert nothing was written — the route returns before any read or write.
  - `[low]` `[reject]` (blind-hunter) `resolveEditablePlace` return type is not a discriminated union — pre-existing API used by every action; refactor is outside CAP-4.
  - `[low]` `[reject]` (blind-hunter) Post-write not-found check lacks a comment — reachable on a delete race; self-explanatory.
  - `[low]` `[patch]` (verification-gap, pre-verified) Shared-editor `automatic` reset untested at the route — added test.
  - `[low]` `[patch]` (verification-gap, other) Dead `getUploadedPlaceImage` — same fix as blind-hunter row.
  - `[low]` `[patch]` (edge-case-hunter) Gate outside `try` gives a non-JSON 500 on DB error — moved inside the existing `try`.
  - `[low]` `[reject]` (edge-case-hunter) Opt-in revoked between gate and write — millisecond window shared by every gated action in the app.
  - `[low]` `[reject]` (edge-case-hunter) Cached copy after leaving a circle — same as blind-hunter cache row.
  - `[low]` `[patch]` (edge-case-hunter) Dead export — same fix as blind-hunter row.
  - `[low]` `[reject]` (intent-alignment) Edit dialog journey not tested — no component test harness; dialog unchanged and both of its requests use the same gate.
  - `[low]` `[patch]` (intent-alignment) Route mode coverage gap — same fix as verification-gap row.
  - `[low]` `[patch]` (intent-alignment) Photo route's upload 404 mapping not asserted — same fix as the first blind-hunter row.
  - `[false]` `[reject]` (intent-alignment) No session gets 401 rather than 404 — not a defect: a signed-out request is not "a user"; 401 matches the session convention in AGENTS.md.
  - `[false]` `[reject]` (intent-alignment) Disallowed users split into 403/404 — both refuse, satisfying "cannot".
  - `[false]` `[reject]` (intent-alignment) Cached copies vs "404 for everyone else" — the server returns 404 on every live request from a non-member; browser cache is not a served response.

## Verification

**Commands:**
- `npm test -- tests/services.place-images.test.ts tests/api.places-image.test.ts tests/api.places-photo.test.ts` -- expected: all pass
- `npm run typecheck && npm run lint && npm test` -- expected: all succeed

## Auto Run Result

Status: done

**Summary:** Image changes now go through `resolveEditablePlace` and act as the place owner, so allowed circle editors can set stock, upload or automatic images (403 for members without opt-in, 404 otherwise); uploaded photos are served to any viewer whose accessible libraries include the upload's owner. `place-images.ts` takes `repos?` and is unit-tested.

**Files changed:**
- `src/lib/services/place-images.ts` -- `repos?` injection, `getViewableUploadedPlaceImage`, removed unused `getUploadedPlaceImage`.
- `src/app/api/places/[id]/image/route.ts` -- shared-content gate (inside the JSON error path), owner-scoped writes.
- `src/app/api/places/photo/route.ts` -- upload branch uses the viewer-aware lookup.
- `tests/services.place-images.test.ts` -- new, 8 service tests.
- `tests/api.places-image.test.ts` -- new, 9 route tests.
- `tests/api.places-photo.test.ts` -- mock renamed, labels updated, upload 404 test.

**Review:** 20 findings — 9 patch rows (5 distinct low fixes, applied), 0 deferred, 11 rejected (reasons in triage log).

**Follow-up review recommended:** false — patched entries: high 0, medium 0, low 5.

**Verification:** `npm run typecheck` ok; `npm run lint` ok; `npm test` all pass.

**Residual risks:** Edit dialog not exercised in a browser; uploaded photos stay in a removed member's browser cache.
