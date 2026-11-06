---
title: 'Fix relative date wording'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
baseline_revision: 'b9e93da0756ec159f4310f136a43e7d0ad588d5b'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
warnings: []
deferred:
  - summary: >-
      relativeTime decides today/yesterday by 24-hour rounding, not calendar days, so a visit logged today can read "yesterday" late in the day and yesterday's visit "2 days ago".
    evidence: |-
      days = Math.round(|diff| / 86_400_000) in src/lib/utils/format.ts; visits are stored as date-only/noon timestamps (services/visits.ts normalizeDate). Pre-existing; the story kept the rounding on purpose. Fix needs calendar-day comparison in the user's time zone (app shows Asia/Nicosia).
    location: >-
      src/lib/utils/format.ts
    severity: medium
  - summary: >-
      relativeTime and the recommendation reason count months differently (round vs floor), so the home page and a reason can disagree for the same savedAt.
    evidence: |-
      relativeTime uses Math.round(days / 30); scoring.ts unvisited reason uses Math.floor. E.g. 75 days → "3 months" vs "2 months".
    location: >-
      src/lib/utils/format.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** `relativeTime` appends " ago" / "in " to the one-day label, producing "yesterday ago" and "in yesterday" on the home page, place pages, map and visit history; and the recommendation reason "Saved 1 month ago but never visited" appears after only 15 days because the month count is rounded.

**Approach:** Return "yesterday" / "tomorrow" as complete phrases for a one-day offset, and count whole months (floor) in the recommendation reason so month wording starts at 30 days.

## Boundaries & Constraints

**Always:** Keep `relativeTime`'s signature, its "—" for missing/invalid input, "today" for 0 days, and all other labels unchanged. Keep the existing day-rounding (`Math.round(|diff| / 86_400_000)`) in `relativeTime`. In scoring, keep the reason text formats; only change how the month count is derived.

**Never:** Change callers, introduce locale/Intl formatting, or change scoring weights or other reasons.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| One day past | now − 1 day | `"yesterday"` | none |
| One day future | now + 1 day | `"tomorrow"` | none |
| Same day | now − 3 hours | `"today"` | none |
| Several days | now − 5 days / + 5 days | `"5 days ago"` / `"in 5 days"` | none |
| Months / years | now − 45 days, − 400 days | `"1 month ago"`, `"1 year ago"` (unchanged) | none |
| Missing / invalid | `null`, `"not a date"` | `"—"` | none |
| Saved 15 days, no visits | scoring reason | `"Saved recently and not tried yet"` | none |
| Saved 30 / 59 days | scoring reason | `"Saved 1 month ago but never visited"` | none |
| Saved 60 days | scoring reason | `"Saved 2 months ago but never visited"` | none |

</intent-contract>

## Code Map

- `src/lib/utils/format.ts:65-88` -- `relativeTime(input, now = new Date())`: builds `label`, then `past ? \`${label} ago\` : \`in ${label}\``; :86 is a dead ternary (`past ? "today" : "today"`). Return early for `days === 1`.
- `src/lib/domain/scoring.ts:386-393` -- unvisited-place reason: `wait = Math.round(daysBetween(savedAt, now) / 30)`; `daysBetween` at :440.
- `src/lib/domain/scoring.ts:39` -- `scoreCandidate` (exported) produces the reasons; `src/lib/domain/place-view.ts` `preparePlace(place, history, preferences, { now })` passes `now` through.
- `tests/scoring.test.ts:9-21` -- `prepared(placeOverrides, history, { now })` helper using `makePlace` from `tests/fixtures.ts` (fixed NOW 2026-09-18, `daysAgo`); find how existing tests read reasons (search for `reasons`).
- Callers (read-only): `src/app/(app)/page.tsx:218,309`, `src/app/(app)/places/[id]/page.tsx:207,541`, `src/app/(app)/map/page.tsx:145`, `src/components/app/place-detail-sections.tsx:57-58`.

## Tasks & Acceptance

**Execution:**
- `src/lib/utils/format.ts` -- one-day offset returns "yesterday" / "tomorrow"; remove the dead ternary -- correct copy everywhere it renders.
- `src/lib/domain/scoring.ts` -- `Math.floor` for the month count in the unvisited reason -- month wording only from 30 days.
- `tests/format.test.ts` -- create: every `relativeTime` matrix row with an explicit `now`.
- `tests/scoring.test.ts` -- add tests for the 15 / 30 / 59 / 60-day reason rows.

**Acceptance Criteria:**
- Given a place visited yesterday, when the home page renders "last visit …", then it reads "last visit yesterday".
- Given the full check suite, when `npm run typecheck && npm run lint && npm test` runs, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 16 findings — high 0, medium 3, low 12, false 1, maybe-false 0 (verification-gap reported no gaps)
- findings:
  - `[low]` `[reject]` (intent-alignment) Rendered phrases untested; "1 visit · last yesterday" — reads acceptably; callers out of scope and no component harness.
  - `[low]` `[defer]` (intent-alignment) `relativeTime` month wording still starts at ~29.5 days and rounds months, unlike the reason's floor — story keeps relativeTime rounding; needs a shared helper.
  - `[low]` `[patch]` (intent-alignment) One-day tests only at exactly ±24h — boundary tests added.
  - `[medium]` `[defer]` (edge-case-hunter) Date-only/noon-stored visit dates compared by 24h rounding, so a same-day visit can read "yesterday" and yesterday's "2 days ago" — pre-existing rounding (the intent contract keeps it); needs calendar-day comparison in the user's time zone.
  - `[low]` `[reject]` (edge-case-hunter) Future `savedAt` reads as past via `Math.abs` — pre-existing, clock skew only.
  - `[low]` `[reject]` (edge-case-hunter) No year wording after 12 months in the reason — "Saved 12 months ago" is natural English.
  - `[low]` `[defer]` (edge-case-hunter) Floor (reason) vs round (relativeTime) month counts differ at 75–89 days — same deferred helper item.
  - `[medium]` `[defer]` (edge-case-hunter, claim) "last visit yesterday" wrong for about half of each day — same root cause as the calendar-day row.
  - `[medium]` `[defer]` (blind-hunter) "yesterday" decided by 24h rounding, not calendar day — same root cause.
  - `[low]` `[defer]` (blind-hunter) Two month counts disagree for the same `savedAt` — same deferred helper item.
  - `[low]` `[patch]` (blind-hunter) Format tests skip rounding boundaries and future months/years — added.
  - `[low]` `[patch]` (blind-hunter) Scoring floor not pinned from below — added 29d23h case.
  - `[low]` `[reject]` (blind-hunter) Acceptance criterion not render-tested — met by inspection: `src/app/(app)/page.tsx:309` renders `last visit {relativeTime(...)}`.
  - `[false]` `[reject]` (blind-hunter) Story file absent from diff / empty logs — by design: the spec is withheld from blind reviewers and logs are filled at triage.
  - `[low]` `[reject]` (blind-hunter) Future `savedAt` not clamped — same as the edge-case row.
  - `[low]` `[patch]` (blind-hunter) `unvisitedReason` helper fails unclearly when the reason is missing — now asserts presence.

## Verification

**Commands:**
- `npm test -- tests/format.test.ts tests/scoring.test.ts` -- expected: all pass
- `npm run typecheck && npm run lint && npm test` -- expected: all succeed

## Auto Run Result

Status: done

**Summary:** `relativeTime` returns "yesterday" / "tomorrow" for a one-day offset (no more "yesterday ago" / "in yesterday"), and the unvisited-place recommendation reason uses whole months, so "Saved 1 month ago" starts at 30 days.

**Files changed:**
- `src/lib/utils/format.ts` -- one-day early return; dead ternary removed.
- `src/lib/domain/scoring.ts` -- `Math.floor` month count in the unvisited reason.
- `tests/format.test.ts` -- new, matrix and boundary tests.
- `tests/scoring.test.ts` -- reason tests at 15 / 29d23h / 30 / 59 / 60 days.

**Review:** 16 findings — 5 patch rows (4 distinct low test fixes, applied), 6 rows deferred as 2 items (medium: calendar-day comparison; low: shared month helper), 5 rejected (reasons in triage log).

**Follow-up review recommended:** false — patched entries: high 0, medium 0, low 4.

**Verification:** `npm run typecheck` ok; `npm run lint` ok; `npm test` all pass.

**Residual risks:** see deferred items.
