---
title: 'Lock down the Google photo proxy'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
baseline_revision: '02fe342c93e85c6d4dee4667dfbfcf6b6337b982'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
warnings: []
deferred:
  - summary: >-
      Any signed-in session, including the one-click demo sign-in, can still spend Google Places photo quota through the proxy.
    evidence: |-
      Session gate passes any user; demoSignInAction (src/app/actions/auth.ts ~77) issues a session without credentials and signup is open; no rate limit or check that the ref belongs to a place the user can see.
    location: >-
      src/app/api/places/photo/route.ts
    severity: medium
---

<intent-contract>

## Intent

**Problem:** `GET /api/places/photo` appends the server's `GOOGLE_PLACES_API_KEY` to any `ref` and fetches it without checking for a session, so anyone on the internet can spend the owner's Places API quota through it, and Google responses are cached publicly.

**Approach:** In the Google branch only, require a signed-in user, accept only genuine Google photo resource names, and mark successful responses as privately cacheable; leave the `upload:` and `commons:` branches as they are.

## Boundaries & Constraints

**Always:** Session check via `getSessionUser()` (no middleware exists). Validate the ref before any outbound fetch. Keep the existing success path for signed-in users (image body + `Content-Type`), and existing 404/502/504 upstream error mapping.

**Never:** Change the `upload:` branch (story 4 owns it) or the `commons:` branch. Change `place-visual.tsx`. Add dependencies. Put the API key or upstream URL in any response.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Signed-in, valid ref | session; `ref=places/ChIJ_a-1/photos/AbC-_9`; key set; upstream image | 200 image, `Cache-Control` starts with `private` | none |
| No session | no session; valid ref; key set | 401, no outbound fetch | none |
| Malformed ref | session; ref like `places/x`, `places/x/photos/y/z`, `foo/x/photos/y`, `places/x/photos/y?alt=1`, `places/../photos/y` | 404, no outbound fetch | none |
| No API key | session; valid ref; key unset | 404, no outbound fetch | none |
| Upstream non-image / failure | session; valid ref; upstream 500 or `text/html` | 502 (or 404 if upstream 404), as today | existing mapping |
| Upload / commons refs | `upload:…` or `commons:…` | behaviour unchanged | unchanged |

</intent-contract>

## Code Map

- `src/app/api/places/photo/route.ts:9-49` -- `GET`: Google branch builds `https://places.googleapis.com/v1/${ref}/media` and sets `key`; currently no session check; `Cache-Control: public…` at :43. `serveUploadedPhoto` (:51-69) already uses `getSessionUser()` → 401 (pattern to copy). `proxyCommonsPhoto` (:71-103) out of scope.
- `src/lib/places/google-provider.ts:195` -- `photoRef` comes from Google's `photos[].name`, the resource name `places/{placeId}/photos/{photoId}`; both ids are URL-safe base64-ish (`[A-Za-z0-9_-]`).
- `src/components/app/place-visual.tsx:37,68` -- only caller: same-origin `<img src="/api/places/photo?ref=…">` rendered inside the signed-in app (read-only; its `onError` already falls back on a failed load).
- `src/lib/auth/session.ts:51` -- `getSessionUser()` returns `SessionUser | null`.
- `src/lib/services/place-images.ts` -- imported by the route; imports `server-only`, which throws under vitest, so tests must `vi.mock("@/lib/services/place-images", …)`.
- `tests/actions.shared-delete.test.ts` -- golden example of `vi.hoisted` + `vi.mock` setup in this repo.

## Tasks & Acceptance

**Execution:**
- `src/app/api/places/photo/route.ts` -- in the Google branch: return 401 when `getSessionUser()` is null; return 404 unless `ref` matches `^places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+$`; change the Google success `Cache-Control` to `private, max-age=86400`. Order: ref shape → session → key → fetch, all before any fetch -- closes quota abuse and public caching.
- `tests/api.places-photo.test.ts` -- create: route tests calling `GET(new NextRequest("http://localhost/api/places/photo?ref=…"))` with `getSessionUser`, `@/lib/services/place-images` and `globalThis.fetch` mocked (`vi.stubGlobal`/`vi.spyOn`), `process.env.GOOGLE_PLACES_API_KEY` set per test and restored -- covers every matrix row, asserting fetch call count where the row says "no outbound fetch".

**Acceptance Criteria:**
- Given a signed-in user and a valid ref, when the image loads, then the response is 200 with the upstream content type and a `private` cache directive, and the outbound URL is `https://places.googleapis.com/v1/<ref>/media?maxWidthPx=1200&key=…`.
- Given the full check suite, when `npm run typecheck && npm run lint && npm test` runs, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 16 findings — high 0, medium 1, low 13, false 2, maybe-false 0 (verification-gap reported no gaps)
- findings:
  - `[low]` `[patch]` (blind-hunter) Comment claims the proxy "cannot be used to spend Places quota" though signed-in users still can — comment reworded to anonymous callers / non-photo refs.
  - `[low]` `[patch]` (blind-hunter) Google success response lacks `X-Content-Type-Options: nosniff` — header added and asserted.
  - `[low]` `[reject]` (blind-hunter) No length cap on ref — the regex limits to `[A-Za-z0-9_-]`; a long ref costs the same single upstream call as a short one, so no harm beyond the deferred quota item.
  - `[low]` `[patch]` (blind-hunter) Check order not pinned by tests — added signed-out + malformed ref → 404 with `getSessionUser` not called and no fetch.
  - `[low]` `[reject]` (blind-hunter) 504 test doesn't assert `AbortSignal.timeout` — pre-existing behaviour, unchanged by this story.
  - `[low]` `[reject]` (blind-hunter) Upstream `ok && !body` and 401/403/429 paths untested — pre-existing mapping, unchanged; all map to 502 without leaking detail.
  - `[low]` `[reject]` (blind-hunter) More malformed near-misses (empty segment, spaces, `%2e%2e`, non-ASCII) — all already rejected by the anchored `[A-Za-z0-9_-]+` class (searchParams decodes `%2e` to `.`, outside the class).
  - `[low]` `[patch]` (blind-hunter) `GET` JSDoc stale — updated to describe the session and resource-name requirements.
  - `[false]` `[reject]` (blind-hunter) Stored legacy/manual refs now 404 silently — refuted: before this change any non-matching ref went to Google and failed (404/502) or 404'd without a key, so the visible outcome (fallback image via `onError`) is unchanged.
  - `[low]` `[reject]` (blind-hunter) Private browser cache keeps photos 24h after sign-out — same-device, same-user browser cache of a public venue photo; no cross-user exposure.
  - `[low]` `[patch]` (intent-alignment) Signed-out + malformed ref case unexercised — same fix as the check-order row.
  - `[low]` `[reject]` (intent-alignment) Shared caches may still hold entries from the old `public` header — transient (max-age 1 day), self-expiring.
  - `[false]` `[reject]` (intent-alignment) "Photos still render" untested in the real UI — refuted as a defect: `place-visual.tsx` is unchanged, its `<img>` is same-origin so cookies are sent, and real `photos[].name` values are `places/{id}/photos/{id}`; the route-level success test covers the handler.
  - `[low]` `[reject]` (edge-case-hunter) `getSessionUser` throwing yields a generic 500 — identical to the existing `upload:` branch; a DB outage surfacing as 500 is acceptable.
  - `[low]` `[reject]` (edge-case-hunter) Unbounded segment length — same as blind-hunter length row.
  - `[medium]` `[defer]` (edge-case-hunter, claim) Any session — including the one-click unauthenticated demo sign-in and open signup — can still spend quota; no rate limit or visibility check — needs a rate-limit/ownership design decision outside CAP-2.

## Verification

**Commands:**
- `npm test -- tests/api.places-photo.test.ts` -- expected: all matrix rows pass
- `npm run typecheck && npm run lint && npm test` -- expected: all succeed

## Auto Run Result

Status: done

**Summary:** The Google branch of `/api/places/photo` now rejects refs that are not `places/{placeId}/photos/{photoId}` (404), requires a session (401), and serves successes with `Cache-Control: private, max-age=86400` and `nosniff`; upload and commons branches unchanged.

**Files changed:**
- `src/app/api/places/photo/route.ts` -- ref-shape and session gates before the keyed fetch; private caching; nosniff; doc comments.
- `tests/api.places-photo.test.ts` -- new, 18 route tests covering every matrix row, check order, upstream error mapping and unchanged upload/commons behaviour.

**Review:** 16 findings — 5 patch rows (4 distinct low fixes, applied), 1 deferred (medium: quota still spendable by any session incl. demo — needs rate limiting), 10 rejected (reasons in triage log); verification-gap found no gaps.

**Follow-up review recommended:** false — patched entries: high 0, medium 0, low 4.

**Verification:** `npm run typecheck` ok; `npm run lint` ok; `npm test` all pass. Implementer confirmed 9 new tests fail against the original route.

**Residual risks:** see deferred item; real-browser rendering not exercised (component unchanged).
