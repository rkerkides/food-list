---
title: 'Test the shared-content permission gate'
type: 'chore'
created: '2026-11-06'
status: 'done'
baseline_revision: '440383595242407db92f1dc31ac047aff37c9536'
review_loop_iteration: 1
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `resolveEditablePlace` and `resolveEditableVisit` gate every shared place/visit edit, refresh, status change and visit log, but no test calls them, so a regression would silently open or close shared editing.

**Approach:** Add a service-level test file that exercises both resolvers across every access case, plus the owner-only delete guarantee, against in-memory SQLite.

## Boundaries & Constraints

**Always:** Use `createTestContext()` / `createSecondUser()` and pass `ctx.repos` to every service call. Create circles and members through the circle services (`createSharedCircle`, `addCircleMember`, `removeCircleMember`), opt-in through `setSharedContentEditableByGroup`, places through `createManualPlace`, visits through `logVisit`.

**Never:** Change production code unless a test exposes a real bug (if so, fix minimally and note it in the commit message). No changes to action files, no new helpers in `tests/helpers.ts` unless shared by 2+ tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Owner | actor = owner of the place/visit | `access: "allowed"`, `ownerUserId` = owner, entity returned | none |
| Member, no opt-in | actor shares a circle; owner flag off | `access: "forbidden"`, `ownerUserId` = owner | none |
| Member, opt-in | actor shares a circle; owner flag on | `access: "allowed"`, `ownerUserId` = owner (≠ actor) | none |
| Non-member | actor shares no circle with owner | `access: "not_found"`, no `ownerUserId` | none |
| Removed member | actor was in circle, owner removed them (flag on) | `access: "not_found"` | none |
| Unknown id | id that exists for nobody | `access: "not_found"` | none |
| Delete scoping | member with opt-in calls `deletePlace(memberId, ownerPlaceId)` | owner's place still exists | none |

</intent-contract>

## Code Map

- `src/lib/services/sharing.ts:37-69` -- `resolveEditablePlace` / `resolveEditableVisit`: iterate `circles.accessibleUserIds(actor)` (includes actor), find entity under each owner, then `canEditSharedContent`.
- `src/lib/services/sharing.ts:23-35` -- `canEditSharedContent`: owner always true; member needs owner opt-in AND `sharesCircle`.
- `src/lib/services/sharing.ts:13-20` -- `setSharedContentEditableByGroup(userId, enabled, repos)`.
- `src/lib/services/circles.ts:41-68` -- `createSharedCircle(userId, name, repos)` returns circle id; `addCircleMember(userId, circleId, email, repos)` returns `{ status }`; `removeCircleMember(userId, circleId, memberUserId, repos)`.
- `src/lib/services/places.ts:131` -- `createManualPlace(userId, input, repos)` returns `{ status: "created", place }`.
- `src/lib/services/places.ts:414-421` -- `deletePlace(userId, placeId, repos)` deletes scoped to `userId`.
- `src/app/actions/places.ts:238-251` -- `deletePlaceAction`: the only enforcement of owner-only delete (`access.ownerUserId !== user.id` → `{ ok: false }`); then `deletePlace(access.ownerUserId, …)`. Test it directly (see Design Notes).
- `src/app/actions/visits.ts:65-80` -- `deleteVisitAction(visitId, placeId)`: same owner-only guard for visits; then `deleteVisit(access.ownerUserId, …)`.
- `src/lib/services/library.ts:141-145` -- `defaultRepositories()`: every service falls back to it when no `repos` is passed (actions never pass one) — mock it to return `ctx.repos`.
- `src/lib/services/circles.ts:70` -- `deleteSharedCircle(userId, circleId, repos)`; member rows go via `on delete cascade` (`migrations.ts` shared_circle_members), SQLite has `foreign_keys = ON`.
- `src/lib/services/visits.ts:13` -- `logVisit(userId, { placeId, visitedAt, rating, items }, repos)` returns the visit.
- `tests/services.circles.test.ts:1-60` -- golden example of setup with two users, a circle and opt-in.
- `tests/helpers.ts` -- `createTestContext`, `createSecondUser`.

## Tasks & Acceptance

**Execution:**
- `tests/services.sharing.test.ts` -- create: `describe("resolveEditablePlace")` and `describe("resolveEditableVisit")` covering every matrix row, plus the service-level delete-scoping test (named for what it proves: deletes are scoped to the given user id) -- locks the resolvers' behaviour. Every `not_found` assertion checks the full shape (no `ownerUserId`, no entity). Also cover, for places: owner revokes opt-in (on → off) → member `forbidden`; member's own opt-in on while owner's is off → member `forbidden`; owner deletes the circle → member `not_found`.
- `tests/actions.shared-delete.test.ts` -- create: action-level tests with mocks (see Design Notes): opted-in member calling `deletePlaceAction` gets `{ ok: false }` and the owner's place still exists; owner calling it deletes the place; opted-in member calling `deleteVisitAction` gets `{ ok: false }` and the owner's visit still exists -- proves the owner-only guard itself, which no service test can reach.

**Acceptance Criteria:**
- Given the new test files, when `npm test` runs, then every matrix scenario is asserted for both places and visits and passes.
- Given the owner-only check at `src/app/actions/places.ts:244` (or `src/app/actions/visits.ts:74`) is removed, when the action tests run, then at least one fails.
- Given the full check suite, when `npm run typecheck && npm run lint && npm test` runs, then all pass with no production code changed (or, if a real bug was found, only the minimal fix changed).

## Spec Change Log

### 2026-11-06 — Loopback 1 (review pass 1)
- **Trigger:** 4 of 4 review layers found the "delete stays owner-only" test passes even if the owner-only guard in `deletePlaceAction` is removed — the plan had scoped delete to a service-level check, while SPEC CAP-1 requires owner-only delete to be proven.
- **Amended:** Code Map (action guard is the target; mocking route via `defaultRepositories`), Tasks (new `tests/actions.shared-delete.test.ts`; extra resolver cases: revoke opt-in, member's own flag, circle deletion; full not_found shape), Acceptance Criteria (guard-removal must fail a test), Design Notes (mock pattern).
- **Known-bad state avoided:** a test named "owner-only" that cannot fail when the owner-only guard regresses.
- **KEEP:** the `setup({ editableByGroup })` helper (owner + place + visit, member in a circle, outsider in no circle); the 13 resolver tests' structure and assertions; no production code changes; nothing added to `tests/helpers.ts`.

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 20 findings — high 0, medium 5, low 14, false 1, maybe-false 0
- findings:
  - `[medium]` `[bad_spec]` (intent-alignment) Delete clause tested at service scoping, not at the owner-only guard in `deletePlaceAction` — amended Code Map/Tasks/AC/Design Notes to add action-level tests.
  - `[low]` `[bad_spec]` (intent-alignment) Visit delete owner-only untested — folded into the action test task (`deleteVisitAction`).
  - `[medium]` `[bad_spec]` (verification-gap, pre-verified) Removing `src/app/actions/places.ts:244` guard leaves all tests green — same root cause; same amendment.
  - `[medium]` `[bad_spec]` (blind-hunter) "keeps delete owner-only" never exercises the action guard — same root cause; same amendment, plus rename the service test.
  - `[low]` `[bad_spec]` (blind-hunter) No visit delete-scoping test — folded into action test task.
  - `[low]` `[bad_spec]` (blind-hunter) Opt-in revocation untested — added revoke case to Tasks.
  - `[false]` `[reject]` (blind-hunter) Reading the actor's flag instead of the owner's would pass every test — refuted: the opt-in test has owner flag on, member flag off, so an actor-flag reading returns `forbidden` and fails it.
  - `[low]` `[reject]` (blind-hunter) Outsider never shares a circle with the member (transitive leak) — `accessibleUserIds` is a single one-hop join (`repositories.ts:438-447`); a transitive regression is implausible and adds scenario setup for little gain.
  - `[low]` `[bad_spec]` (blind-hunter) Multi-circle / deleted-circle removal untested — deleted-circle case added to Tasks; multi-circle part rejected as low (`sharesCircle` any-circle semantics are a single SQL join).
  - `[low]` `[reject]` (blind-hunter) `forbidden` payload shape not pinned — no caller reads the entity on `forbidden`; pinning incidental shape adds churn without guarding behaviour.
  - `[low]` `[bad_spec]` (blind-hunter) Uneven `not_found` assertions — Tasks now require full shape on every `not_found`.
  - `[low]` `[reject]` (blind-hunter) No test that a member's visit log lands on the owner — `logVisitAction` behaviour beyond CAP-1's enumerated access cases; everyday regression unlikely and needs another action harness case.
  - `[medium]` `[bad_spec]` (edge-case-hunter) Removing the action check still passes `tests/services.sharing.test.ts:95-106` — same root cause as the delete-guard group.
  - `[low]` `[bad_spec]` (edge-case-hunter) No owner-only visit delete test — folded into action test task.
  - `[low]` `[bad_spec]` (edge-case-hunter) Member's own flag while owner's is off (either-flag bug) — real gap (an OR bug passes); case added to Tasks.
  - `[low]` `[bad_spec]` (edge-case-hunter) Opt-in revoke untested — same as blind-hunter revoke row; case added.
  - `[low]` `[bad_spec]` (edge-case-hunter) `deleteSharedCircle` revocation path untested — case added (cascade verified in migrations, `foreign_keys = ON`).
  - `[low]` `[reject]` (edge-case-hunter) Reverse direction (owner acting on member content) — circle membership join is role-agnostic (`repositories.ts:438-447`); role-asymmetric regression implausible.
  - `[low]` `[bad_spec]` (edge-case-hunter) Removed-member `not_found` doesn't assert absent entity — covered by full-shape requirement.
  - `[medium]` `[bad_spec]` (edge-case-hunter, claim) Tests miss several opening regressions vs the intent claim — grouped with the amendments above.

### 2026-11-06 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 15, false 4, maybe-false 0 (verification-gap reported no gaps)
- findings:
  - `[low]` `[reject]` (intent-alignment) Non-delete actions (update/status/refresh/log/update-visit) not exercised at the action surface — CAP-1 success enumerates resolver outcomes, which are tested; each action branch is a one-line status check and covering six actions is new harness scope, unlikely to regress in everyday use.
  - `[low]` `[patch]` (intent-alignment) Owner-success delete tested for places only — added "lets the owner delete their visit".
  - `[false]` `[reject]` (intent-alignment) UI edit gate `canEditSharedContent` unexercised — refuted: covered by `tests/services.circles.test.ts` ("uses one owner setting…").
  - `[low]` `[reject]` carried — (intent-alignment) Non-member in a different circle not tested — same as pass-1 transitive-leak row; `accessibleUserIds` is a one-hop join.
  - `[low]` `[reject]` (intent-alignment) Extra cases (revoke, member's flag, circle delete) only for places — those cases exercise `canEditSharedContent`/circle membership, which both resolvers share verbatim (`sharing.ts:37-69`).
  - `[low]` `[reject]` (intent-alignment) Story Approach text still says "service-level test file" — fix would edit this build's spec.
  - `[low]` `[patch]` (blind-hunter) Refusal tests assert only `ok: false` — now assert exact owner-only error results.
  - `[low]` `[patch]` (blind-hunter) No `deleteVisitAction` owner-success test — same fix as intent-alignment row.
  - `[low]` `[patch]` (blind-hunter) `deletePlace` scoping test passes for a no-op — test now also deletes as owner and asserts removal.
  - `[low]` `[patch]` (blind-hunter) No visit/food-item delete scoping test — added `describe("deleteVisit")` with an item; owner's visit and item survive a member call.
  - `[low]` `[reject]` (blind-hunter) In-memory SQLite clients never closed — matches most existing test files; process exits per run; fix adds hooks for no user-visible harm.
  - `[false]` `[reject]` (blind-hunter) Action tests could reach `.data/food-list.db` — refuted: every path from both actions resolves repos via `defaultRepositories` (`sharing.ts`, `places.ts:414`, `visits.ts:111`), which is mocked; implementer confirmed DB mtimes unchanged.
  - `[low]` `[reject]` (blind-hunter) `revalidatePath` calls not asserted — cache invalidation is outside CAP-1's permission intent.
  - `[low]` `[reject]` (blind-hunter) Action-level not_found branch untested — resolver not_found shape is pinned; the branch is a direct pass-through check.
  - `[low]` `[reject]` (blind-hunter) `setup()` duplicated across two files — setups differ (outsider, opt-in default); story allows but does not require a shared helper.
  - `[false]` `[reject]` (blind-hunter) Redundant `not.toBe(memberId)` assertion — no named harm; it states the property the action relies on.
  - `[low]` `[patch]` (edge-case-hunter) Place refusal accepts not_found branch — same fix as blind-hunter exact-error row.
  - `[low]` `[patch]` (edge-case-hunter) Visit refusal accepts not_found branch — same fix.
  - `[low]` `[patch]` (edge-case-hunter) `deleteVisitAction` owner success never exercised — same fix as intent-alignment row.
  - `[low]` `[patch]` (edge-case-hunter) `deleteVisit` scoping untested — same fix as blind-hunter visit-scoping row.

## Design Notes

Server actions call `requireUser()` and services without `repos`, so action tests mock three modules before importing the action (no `vi.mock` exists in the repo yet; this is the first):

```ts
const state = vi.hoisted(() => ({ repos: null as unknown as Repositories, userId: "" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(async () => ({ id: state.userId })) }));
vi.mock("@/lib/services/library", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/library")>()),
  defaultRepositories: vi.fn(async () => state.repos),
}));
```

Set `state.repos = ctx.repos` and `state.userId` per test; never touch `.data/food-list.db`.

## Verification

**Commands:**
- `npm test -- tests/services.sharing.test.ts tests/actions.shared-delete.test.ts` -- expected: all new tests pass
- `npm run typecheck && npm run lint && npm test` -- expected: all succeed

## Auto Run Result

Status: done

**Summary:** Added service- and action-level tests that lock the shared-content permission gate: both resolvers across every CAP-1 access case (plus revoke, member's own flag, circle deletion, unknown id), delete scoping for places and visits (incl. food items), and the owner-only guard in `deletePlaceAction` / `deleteVisitAction` via the repo's first `vi.mock` harness. No production code changed; no bug found.

**Files changed:**
- `tests/services.sharing.test.ts` -- new, 17 tests: resolver access matrix and service-level delete scoping.
- `tests/actions.shared-delete.test.ts` -- new, 4 tests: owner-only delete guard for places and visits, with mocked session/cache/repositories.

**Review:** pass 1 → 1 bad_spec loopback (20 findings: 5 medium, 14 low, 1 false; owner-only delete was tested at the wrong surface). Pass 2 → 20 findings: 10 patch rows (6 distinct low fixes, applied), 0 deferred, 10 rejected (reasons in triage log), verification-gap layer found no gaps.

**Follow-up review recommended:** false — patched entries this pass: high 0, medium 0, low 6.

**Verification:** `npm run typecheck` ok; `npm run lint` ok; `npm test` 17 files / 101 tests pass. Implementer confirmed removing the owner-only guard in either action fails a test, and `.data/food-list.db` mtimes were unchanged.

**Residual risks:** action tests rely on services resolving repositories via `defaultRepositories`; a future service that calls `getDb()` directly would bypass the mock.
