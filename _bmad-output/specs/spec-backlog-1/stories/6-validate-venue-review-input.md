---
title: 'Validate venue review input'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
baseline_revision: '336be26bf975db006c97f6c851cf24182b222789'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
warnings: []
deferred:
  - summary: >-
      reviewVenueLinkAction accepts status "completed", so a direct call can mark a submission complete without validated details or a created place.
    evidence: |-
      VENUE_LINK_SUBMISSION_STATUSES includes "completed" and reviewVenueLinkAction only checks membership; completion should go through completeVenueLinkReviewAction. Pre-existing, not introduced by this story.
    location: >-
      src/app/actions/places.ts
    severity: medium
  - summary: >-
      Venue review form inputs (name, cuisines, address, area) have no maxLength matching the new server limits.
    evidence: |-
      Only the review-note Textarea has maxLength={1000} in venue-link-review-queue.tsx; limits surface only on submit.
    location: >-
      src/components/app/venue-link-review-queue.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** `completeVenueLinkReviewAction` hand-checks only name, category and budget: a non-string `name` crashes on `.trim()`, `reviewNote`, `address` and `area` have no length limits, and `details.cuisines` reach `createManualPlace` and the merge without catalogue validation, so cuisines outside the owner's catalogue get saved — unlike every other place-write path.

**Approach:** Replace the hand-written checks with a `venueReviewSchema` (all fields, with length limits) and validate cuisines against the submission owner's catalogue inside `completeVenueReview`, storing the normalised names, exactly as other place writes do.

## Boundaries & Constraints

**Always:** Schema lives in `src/lib/domain/schemas.ts` and reuses `optionalNumber(0, 2000)` and the existing spend-range rule / `SPEND_RANGE_MESSAGE`. Keep today's user-facing messages: "Add the venue name before completing the review." (name < 2 after trim, or missing / non-string), "Choose a valid venue type.", "Enter a valid per-person budget.", "Minimum can't exceed maximum". Cuisine validation uses `validateCuisines(submission.userId, details.cuisines, repo)` after the permission check and before any write; on failure nothing is written and the action returns that function's error text. Apply the same `reviewNote` limit to `reviewVenueLinkAction`.

**Never:** Change who may review (circle members without the owner's opt-in remain allowed — `tests/services.venue-link-submissions.test.ts:44`). Change the merge/contradiction logic beyond passing normalised cuisines. Change UI components. Add dependencies or migrations.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid review | name "Meze House", known cuisines, short texts | completes as today; cuisines stored normalised | none |
| Missing / non-string name | `name: undefined`, `123`, `"A"` | nothing written | `{ ok: false, error: "Add the venue name before completing the review." }` (no throw) |
| Too-long fields | name > 120, address > 200, area > 100, reviewNote > 1000 chars | nothing written | `{ ok: false, error: <field-specific message> }` |
| Bad category | `"spaceship"` | nothing written | "Choose a valid venue type." |
| Bad budget | `-1`, `3000`, `NaN` | nothing written | "Enter a valid per-person budget." |
| Inverted budget | min 40, max 20 | nothing written | "Minimum can't exceed maximum" |
| Unknown cuisine | `["Martian"]` not in owner's catalogue | nothing written, submission still pending | `validateCuisines` error text |
| Owner's custom cuisine, reviewer is circle member | cuisine in owner's (not reviewer's) catalogue | accepted | none |
| Too many cuisines | > 12 entries | nothing written | `{ ok: false, error }` |
| reviewVenueLinkAction long note | note > 1000 chars | nothing written | `{ ok: false, error }` |

</intent-contract>

## Code Map

- `src/app/actions/places.ts:56-99` -- `reviewVenueLinkAction(id, status, reviewNote)` and `completeVenueLinkReviewAction(id, details, reviewNote)`: hand-written checks at :74-85 (from story 5, incl. the range check) to replace with `venueReviewSchema.safeParse`.
- `src/lib/services/venue-review.ts:8-16` -- `VenueReviewDetails`; `:31-79` `completeVenueReview(reviewerId, submissionId, details, reviewNote, repos?)`: permission via `sharesCircle` at :40-43, then create (`createManualPlace`, :57-71) or merge (`mergeIntoExisting`, :74-79). Insert cuisine validation after :43; add a `{ status: "invalid_cuisines"; error: string }` outcome.
- `src/lib/services/cuisines.ts:27-43` -- `validateCuisines(userId, values, repos?)` → `{ ok, cuisines }` (normalised) or `{ ok: false, error }`.
- `src/lib/domain/schemas.ts:17-34,~45-55` -- `optionalNumber`, `spendRange`, `SPEND_RANGE_MESSAGE`; `PLACE_CATEGORIES` imported from `./types`; `venueLinkSubmissionSchema` note limit uses `.max(1000)` (match it).
- `src/components/app/venue-link-review-queue.tsx:~120-130` -- caller sends `cuisines` as a comma-split string list and trimmed address/area (read-only).
- `tests/actions.place-validation.test.ts` -- existing venue-review action tests (inverted and equal range) must keep passing; reuse its mock pattern and submission setup.
- `tests/services.venue-link-submissions.test.ts` -- existing service tests incl. the circle-member review case.

## Tasks & Acceptance

**Execution:**
- `src/lib/domain/schemas.ts` -- add `venueReviewSchema` (name trimmed 2–120; category `z.enum(PLACE_CATEGORIES).nullable()`; cuisines `z.array(z.string().trim().min(1).max(50)).max(12)`; address ≤ 200 / area ≤ 100 nullable trimmed strings; spends `optionalNumber(0, 2000)` with the range rule) and `reviewNoteSchema` (nullable string ≤ 1000) -- one source of truth.
- `src/app/actions/places.ts` -- both venue actions validate with the schemas and map issues to the messages in the matrix; map `invalid_cuisines` to its error -- no crash, bounded input.
- `src/lib/services/venue-review.ts` -- validate cuisines against `submission.userId`'s catalogue and use the normalised list for create and merge -- matches other place writes.
- `tests/services.venue-review.test.ts` -- create: service tests for unknown cuisine (nothing written, submission pending), owner's custom cuisine accepted for a circle-member reviewer, normalised names stored.
- `tests/actions.place-validation.test.ts` -- extend: action tests for every other matrix row.

**Acceptance Criteria:**
- Given a reviewer submits a venue review with any malformed field, when the action runs, then it returns `{ ok: false, error }` without throwing and the submission and places are unchanged.
- Given the full check suite, when `npm run typecheck && npm run lint && npm test` runs, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 25 findings — high 0, medium 4, low 18, false 3, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind-hunter) String budgets silently coerced ("abc" → 0) — regression vs the old non-number rejection; spends now accept only number/null before `optionalNumber`; tests added.
  - `[low]` `[reject]` (blind-hunter) Cuisine error says "your catalogue" for circle reviewers — the intent contract specifies `validateCuisines`' text; circle reviewers are rare and the message still names the unknown cuisine.
  - `[low]` `[reject]` (blind-hunter) 12-cuisine cap counted before de-duplication — 13 case variants is not realistic input.
  - `[low]` `[reject]` (blind-hunter) `VenueReviewDetails` and `venueReviewSchema` defined separately — no caller diverges today; unifying types is a refactor beyond CAP-6.
  - `[low]` `[reject]` (blind-hunter) Service trusts caller except cuisines — single caller (the action) validates everything.
  - `[low]` `[patch]` (blind-hunter) No accept-side boundary tests — added 120/200/100-char and budget 0/2000 acceptance.
  - `[low]` `[patch]` (blind-hunter) Malformed-input cases untested — added `details: null` and whitespace→null tests.
  - `[low]` `[reject]` (blind-hunter) Zero-width/control characters pass the name minimum — unlikely input; stripping adds normalisation beyond the intent.
  - `[low]` `[reject]` (blind-hunter) `queueSubmission` helper duplicated in tests — test-only duplication, no behaviour impact.
  - `[low]` `[defer]` (blind-hunter) Review form inputs lack `maxLength` matching the new server limits — UI change outside this story.
  - `[medium]` `[patch]` (edge-case-hunter) String budgets coerced — same fix as first row.
  - `[low]` `[reject]` (edge-case-hunter) Owner-aware cuisine message — same as the wording row.
  - `[low]` `[reject]` (edge-case-hunter) Catalogue entry removed between check and write — millisecond race, same pattern as every place write.
  - `[medium]` `[defer]` (edge-case-hunter) `reviewVenueLinkAction` accepts status "completed", marking a submission complete with no validated details or place — pre-existing behaviour not introduced by this story.
  - `[medium]` `[patch]` (edge-case-hunter, claim) "Any malformed field returns an error" false for string budgets — same fix as first row.
  - `[low]` `[patch]` (verification-gap, pre-verified) Cuisine check after permission check not pinned — added forbidden-reviewer test.
  - `[low]` `[patch]` (verification-gap, pre-verified) Blank-to-null normalisation untested — filed as defer; patched with the whitespace→null test.
  - `[low]` `[patch]` (verification-gap, other) Budget strings coerced — same fix as first row.
  - `[low]` `[reject]` (verification-gap, other) Circle-reviewer cuisine wording — same as the wording row.
  - `[low]` `[reject]` (intent-alignment) Schema only at the action, not the service — same as the service-trust row.
  - `[false]` `[reject]` (intent-alignment) Limits stricter than sibling schemas — the CAP-6 success line requires length limits.
  - `[low]` `[reject]` (intent-alignment) UI path untested (comma-split cuisines) — no component harness; UI unchanged.
  - `[false]` `[reject]` (intent-alignment) Circle-reviewer message as a reading divergence — covered by the wording row; not a separate defect.
  - `[false]` `[reject]` (intent-alignment) Aliases normalised rather than rejected — consistent with every other place write.
  - `[low]` `[patch]` (intent-alignment) Budgets accept numeric strings — same fix as first row.

## Verification

**Commands:**
- `npm test -- tests/services.venue-review.test.ts tests/actions.place-validation.test.ts tests/services.venue-link-submissions.test.ts` -- expected: all pass
- `npm run typecheck && npm run lint && npm test` -- expected: all succeed

## Auto Run Result

Status: done

**Summary:** Venue review input is validated by `venueReviewSchema`/`reviewNoteSchema` (length limits on every text field, category enum, ≤12 cuisines, number-only budgets with bounds and range) instead of hand-written checks, so malformed input returns `{ ok: false, error }` without throwing; `completeVenueReview` validates cuisines against the submission owner's catalogue after the permission check and stores normalised names.

**Files changed:**
- `src/lib/domain/schemas.ts` -- `venueReviewSchema`, `reviewNoteSchema`, message constants, number-only `venueBudget`.
- `src/app/actions/places.ts` -- both venue-review actions validate with the schemas; `invalid_cuisines` mapping.
- `src/lib/services/venue-review.ts` -- owner-catalogue cuisine validation and normalisation.
- `tests/services.venue-review.test.ts` -- new, service tests incl. forbidden ordering.
- `tests/actions.place-validation.test.ts` -- matrix, boundary and normalisation tests.

**Review:** 25 findings — 10 patch rows (5 distinct fixes: 1 medium, 4 low, applied), 2 deferred (medium: "completed" status via `reviewVenueLinkAction`; low: UI maxLength), 13 rejected (reasons in triage log).

**Follow-up review recommended:** false — patched entries: high 0, medium 1, low 4.

**Verification:** `npm run typecheck` ok; `npm run lint` ok; `npm test` all pass.

**Residual risks:** circle-member reviewers see "your cuisine catalogue" wording for the owner's catalogue; deferred items above.
