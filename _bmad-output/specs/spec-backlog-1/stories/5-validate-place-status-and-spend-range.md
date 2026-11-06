---
title: 'Validate place status and spend range'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
baseline_revision: '201cb7a85c93f887e6cd4a39ed7b73321e6bf12b'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `setPlaceStatusAction` writes whatever `status` string the client sends (e.g. `"deleted"`), which silently drops the place out of every list; and a minimum spend above the maximum is accepted on every spend-writing path and rendered as "€40–€20/person".

**Approach:** Reject statuses outside `PLACE_STATUSES` before anything is written, and reject a spend range whose minimum exceeds its maximum with "Minimum can't exceed maximum" on the add, manual-add, update and venue-review paths.

## Boundaries & Constraints

**Always:** Validate with zod in `src/lib/domain/schemas.ts` where a schema exists (export a `placeStatusSchema = z.enum(PLACE_STATUSES)` and one shared spend-range refinement applied to `addPlaceSchema`, `manualPlaceSchema`, `updatePlaceSchema`). The range check applies only when both values are present (non-null after parsing). Status validation runs before `resolveEditablePlace` or any write. Return `{ ok: false, error }` from actions, as today.

**Never:** Add a DB CHECK constraint or migration. Change spend bounds (0–2000) or the `optionalNumber` parsing. Replace the venue-review action's hand-written checks with a schema (story 6 owns that) — only add the range check there. Change UI components.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid status | `"favourite"` | place status updated, `{ ok: true }` | none |
| Unknown status | `"deleted"`, `""`, `"Saved"` | nothing written | `{ ok: false, error: "Choose a valid status." }` |
| Range ok | min 15, max 25 | accepted | none |
| Equal | min 20, max 20 | accepted | none |
| One side only | min 15, max null (or reverse) | accepted | none |
| Inverted | min 40, max 20 on add / manual / update schema | rejected | first issue message "Minimum can't exceed maximum" (path `expectedSpendMax`) |
| Inverted in venue review | details min 40, max 20 | nothing written | `{ ok: false, error: "Minimum can't exceed maximum" }` |

</intent-contract>

## Code Map

- `src/lib/domain/types.ts:23-24` -- `PLACE_STATUSES = ["wishlist","saved","favourite","archived"]`, `PlaceStatus`.
- `src/lib/domain/schemas.ts:17-34` -- `optionalNumber` (string/number → number|null, bounds); `addPlaceSchema` :64-84, `manualPlaceSchema` :86-106, `updatePlaceSchema` :119-139 each have `expectedSpendMin/Max: optionalNumber(0, 2000)`. zod 4.6.5: `.superRefine`/`.check` on an object keeps `safeParse` usable and `z.infer` types unchanged.
- `src/app/actions/places.ts:115,158,194` -- actions call `addPlaceSchema/manualPlaceSchema/updatePlaceSchema.safeParse` and surface `parsed.error.issues[0]?.message`.
- `src/app/actions/places.ts:221-235` -- `setPlaceStatusAction(placeId, status)`: no validation today; calls `setPlaceStatus(access.ownerUserId, …)`.
- `src/app/actions/places.ts:72-80` -- `completeVenueLinkReviewAction`: hand-checks spend bounds via `values.some(...)`; add the range check after it.
- `src/lib/services/places.ts:401-412` -- `setPlaceStatus` service (unchanged).
- `tests/actions.shared-delete.test.ts` -- mock pattern for action tests (`requireUser`, `next/cache`, `defaultRepositories`).

## Tasks & Acceptance

**Execution:**
- `src/lib/domain/schemas.ts` -- export `placeStatusSchema`; add a shared spend-range refinement (issue `{ path: ["expectedSpendMax"], message: "Minimum can't exceed maximum" }`) to the three place schemas -- one rule, three paths.
- `src/app/actions/places.ts` -- `setPlaceStatusAction`: `placeStatusSchema.safeParse(status)` first, else `{ ok: false, error: "Choose a valid status." }`; `completeVenueLinkReviewAction`: return `{ ok: false, error: "Minimum can't exceed maximum" }` when both spends are non-null and min > max, before `completeVenueReview` -- closes both write paths.
- `tests/schemas.test.ts` -- create: schema tests for every range row against all three schemas, and `placeStatusSchema` for valid/unknown values.
- `tests/actions.place-validation.test.ts` -- create: action tests (mock pattern) for unknown status → error and place status unchanged, valid status → updated, inverted venue-review range → error and the submission still pending (nothing written).

**Acceptance Criteria:**
- Given the Edit dialog or Add dialog with min 40 and max 20, when the user saves, then the action returns `{ ok: false, error: "Minimum can't exceed maximum" }` and nothing is stored.
- Given the full check suite, when `npm run typecheck && npm run lint && npm test` runs, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 22 findings — high 0, medium 4, low 18, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind-hunter) Max-only partial update stores an inverted range (15–25 + max 10) — `updatePlaceAction` now compares a max-only update against the stored min; test added.
  - `[low]` `[patch]` (blind-hunter) `placeValidationError` shows only the range message when other fields also fail — now returns it only when it is the sole issue; mixed-case test added.
  - `[low]` `[patch]` (blind-hunter) `addPlaceAction` has no action-level test — added.
  - `[low]` `[patch]` (blind-hunter) Status-before-access order not pinned — added unknown-place test.
  - `[low]` `[reject]` (blind-hunter) Range predicate duplicated in venue review — story 6 replaces that hand-written block with a schema.
  - `[low]` `[reject]` (blind-hunter) Message lacks field context / path not surfaced — wording is fixed by SPEC CAP-5; UI changes out of scope.
  - `[low]` `[reject]` (blind-hunter) `setPlaceStatus` service still trusts status — single caller validates; typed `PlaceStatus` parameter.
  - `[low]` `[patch]` (blind-hunter) Smaller test gaps — added venue-review equal-range case; non-string statuses covered by schema tests; `beforeEach` reset harmless.
  - `[medium]` `[patch]` (edge-case-hunter) Partial update inversion — same fix as first row.
  - `[low]` `[patch]` (edge-case-hunter) Range message hides other issues — same fix as masking row.
  - `[low]` `[reject]` (edge-case-hunter) Unparseable/negative spend also yields a range issue — pre-existing `optionalNumber` parsing; with the masking fix the add flows show the generic message when both issues occur.
  - `[low]` `[reject]` (edge-case-hunter) zod may skip the object refinement on type-level errors — the range error then appears after the type error is fixed; acceptable sequencing.
  - `[medium]` `[patch]` (edge-case-hunter, claim) "Nothing is stored" on update not true for partial updates — same fix as first row.
  - `[low]` `[patch]` (verification-gap, pre-verified) `addPlaceAction` mapping untested — same fix as add-path row.
  - `[low]` `[patch]` (verification-gap, pre-verified) Venue-review equal range untested — added.
  - `[low]` `[patch]` (verification-gap, other) Add vs edit report mixed errors differently — masking fix makes add flows generic on mixed issues.
  - `[low]` `[patch]` (intent-alignment) Add path tested only at schema level — same fix as add-path row.
  - `[medium]` `[patch]` (intent-alignment) Stored-state reading: max-only update inverts — same fix as first row.
  - `[low]` `[reject]` (intent-alignment) Unknown status on add/manual/update untested — those inline enums pre-date this story and are unchanged.
  - `[low]` `[reject]` (intent-alignment) UI surface untested — no component harness; every dialog renders the returned error.
  - `[low]` `[patch]` (intent-alignment) Error-picking differs between add and update — same as masking fix.
  - `[low]` `[reject]` (intent-alignment) Other writers (provider budget, seed, starter list) unvalidated — outside the four paths SPEC CAP-5 names; values are derived, not user input.

## Verification

**Commands:**
- `npm test -- tests/schemas.test.ts tests/actions.place-validation.test.ts` -- expected: all pass
- `npm run typecheck && npm run lint && npm test` -- expected: all succeed

## Auto Run Result

Status: done

**Summary:** `setPlaceStatusAction` rejects statuses outside `PLACE_STATUSES` before any access check or write; a minimum spend above the maximum is rejected with "Minimum can't exceed maximum" on add, manual add, update (including max-only partial updates against the stored minimum) and venue review.

**Files changed:**
- `src/lib/domain/schemas.ts` -- `placeStatusSchema`, `SPEND_RANGE_MESSAGE`, shared `spendRange` refinement on the three place schemas.
- `src/app/actions/places.ts` -- status guard, venue-review range check, max-only update check, `placeValidationError` for add flows.
- `tests/schemas.test.ts` -- new, schema matrix tests.
- `tests/actions.place-validation.test.ts` -- new, 12 action tests across all four paths.

**Review:** 22 findings — 14 patch rows (6 distinct fixes: 1 medium, 5 low, applied), 0 deferred, 8 rejected (reasons in triage log).

**Follow-up review recommended:** false — patched entries: high 0, medium 1, low 5 (fewer than two medium).

**Verification:** `npm run typecheck` ok; `npm run lint` ok; `npm test` all pass.

**Residual risks:** `place-actions.tsx` ignores `setPlaceStatusAction` errors (only valid statuses are sent from the UI).
