---
title: 'Keep the demo account out of circles'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
baseline_revision: '2bf66ee6717cff5fbb8d52888a0f2a92f52cd52a'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
warnings: []
deferred:
  - summary: >-
      Demo-account circle memberships created before this fix still share libraries through accessibleUserIds and sharesCircle, and demo reset does not clear them.
    evidence: |-
      The fix gates only new writes (createSharedCircle, addCircleMember). Read paths in repositories.ts (accessibleUserIds ~438, sharesCircle ~448) and resetDemoData/clearUserData in services/seed.ts ignore is_demo. Needs a decision: one-off cleanup, read-side filtering, or both.
    location: >-
      src/lib/data/repositories.ts
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The demo account (`users.is_demo = 1`) is one login shared by every anonymous visitor, yet it can create a circle and add any registered email, and real users can add the demo email to their circles; either way every demo visitor can then read a real user's library through `circles.accessibleUserIds`.

**Approach:** Refuse, in the circle services, any circle creation or member addition where the actor is a demo account or the added email belongs to a demo account, and show a friendly message from the actions.

## Boundaries & Constraints

**Always:** Enforce in `src/lib/services/circles.ts` (services are the gate; actions only map outcomes). Look demo status up from the `users` row (`Number(is_demo) === 1`), never from client input. `addCircleMember` keeps returning a `{ status }` union; `createSharedCircle` keeps its existing throw-on-invalid style (its action already shows `error.message`).

**Never:** Change circle listing, removal or deletion; migrate or delete existing memberships; change the demo account's other abilities; touch `repositories.ts` beyond what a lookup needs (existing `users.findById` / `users.findByEmail` suffice).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Demo creates circle | actor `is_demo = 1`, valid name | no circle row created | throws `Error("The demo account can't create or join circles.")` |
| Demo adds member | demo actor owns a circle (seeded directly via repos), adds a real email | no member row added | returns `{ status: "demo_account" }` |
| Real user adds demo email | real owner adds the demo account's email (any case) | no member row added | returns `{ status: "demo_account" }` |
| Real user adds real email | as today | `{ status: "added" }`, library shared | none |
| Real user creates circle | as today | circle id returned | none |
| Action maps demo refusal | `addCircleMemberAction` gets `demo_account` | `{ ok: false, error: "The demo account can't create or join circles." }` | none |

</intent-contract>

## Code Map

- `src/lib/services/circles.ts:41-58` -- `createSharedCircle(userId, name, repos)` (validates name, then `repo.circles.create`); `addCircleMember(userId, circleId, email, repos)` (validates email, then `repo.circles.addMemberByEmail`). Add the demo checks here, after input validation, before the repo write.
- `src/lib/data/repositories.ts:30-35` -- `users.findByEmail(email)` (case-insensitive) and `users.findById(id)` return `UserRow` incl. `is_demo` (`src/lib/data/rows.ts:20`).
- `src/lib/data/repositories.ts:383-397` -- `circles.addMemberByEmail` returns `not_found | forbidden | user_not_found | added`; unchanged.
- `src/app/actions/circles.ts:30-68` -- `createSharedCircleAction` shows `error.message` on throw (no change needed); `addCircleMemberAction` maps statuses to messages — add the `demo_account` mapping.
- `src/lib/auth/session.ts:64` -- precedent: demo derived as `Number(user.is_demo) === 1`.
- `tests/services.circles.test.ts` -- existing circle tests and setup pattern; `repos.users.create({ ..., isDemo: true })` creates a demo user (`repositories.ts:51-57`).
- `tests/actions.shared-delete.test.ts` -- golden example for mocking `requireUser`/`defaultRepositories`/`next/cache` if testing the action mapping.

## Tasks & Acceptance

**Execution:**
- `src/lib/services/circles.ts` -- add a shared demo-check helper; `createSharedCircle` throws the message above for a demo actor; `addCircleMember` returns `{ status: "demo_account" as const }` when the actor or the email's user is a demo account -- closes both leak directions at the service gate.
- `src/app/actions/circles.ts` -- map `demo_account` to `{ ok: false, error: "The demo account can't create or join circles." }` -- friendly message.
- `tests/services.circles.test.ts` -- add tests for every service matrix row (demo actor setup: create the demo user with `isDemo: true`; for "demo adds member" create the circle via `repos.circles.create(demoId, name)` directly) asserting no rows were written (`listSharedCircles` / `accessibleUserIds`).
- `tests/actions.circles-demo.test.ts` -- create: action mapping test for `demo_account` using the mock pattern from `tests/actions.shared-delete.test.ts`.

**Acceptance Criteria:**
- Given a demo visitor and a real user, when either tries to connect them through a circle, then neither library becomes visible to the other (`circles.accessibleUserIds` unchanged for both).
- Given the full check suite, when `npm run typecheck && npm run lint && npm test` runs, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 16 findings — high 0, medium 4, low 10, false 2, maybe-false 0 (verification-gap reported no gaps)
- findings:
  - `[low]` `[reject]` (edge-case-hunter) Demo check runs before ownership/not_found, letting a caller probe whether an email is the demo account — the demo email is published (README, one-click login); nothing secret is revealed.
  - `[medium]` `[defer]` (edge-case-hunter) Demo memberships created before this change still share libraries — pre-existing state, not caused by this story; cleanup or read-side filtering needs an owner decision.
  - `[medium]` `[defer]` (blind-hunter) Existing demo memberships leak via `accessibleUserIds`/`sharesCircle` — same root cause as the row above.
  - `[medium]` `[defer]` (blind-hunter) No test seeds an existing demo membership — same root cause; belongs with the deferred cleanup.
  - `[medium]` `[defer]` (blind-hunter) `resetDemoData` does not clear demo circle rows — same root cause; same deferred item.
  - `[low]` `[reject]` (blind-hunter) Demo message overrides not_found/forbidden errors — same as the probe row; precedence is harmless.
  - `[low]` `[reject]` (blind-hunter) Two extra sequential lookups per add — rare user action, indexed single-row lookups.
  - `[low]` `[reject]` (blind-hunter) `is_demo` predicate now in three places — one-line expression; session/admin read different shapes; extracting adds surface beyond this story.
  - `[low]` `[reject]` (blind-hunter) Demo visitors still see the circle forms — intent is satisfied by refusal plus friendly message; hiding forms adds UI branching.
  - `[low]` `[patch]` (blind-hunter) Create action test doesn't assert no circle written; no action-level real-user control — added both.
  - `[low]` `[reject]` (blind-hunter) Tests hard-code the message literal — deliberate: locks the user-facing copy.
  - `[low]` `[reject]` (intent-alignment) Refusal named `demo_account`/thrown Error rather than `forbidden` — the action surface returns the same `{ ok: false, error }` refusal shape as every other circle refusal; naming is cosmetic.
  - `[low]` `[reject]` (intent-alignment) Friendly message never verified in the rendered UI — `shared-circles.tsx` already renders `result.error`; component unchanged.
  - `[false]` `[reject]` (intent-alignment) Demo-owned-circle test uses an unreachable state — refuted: demo-owned circles can pre-exist this change, so the guard on that state is meaningful.
  - `[medium]` `[defer]` (intent-alignment) Broad reading: existing demo participation unchanged — same deferred item.
  - `[false]` `[reject]` (intent-alignment) Outcome ordering untested as a defect — refuted as a defect: ordering only changes which refusal message is shown; covered by the probe row.

## Verification

**Commands:**
- `npm test -- tests/services.circles.test.ts tests/actions.circles-demo.test.ts` -- expected: all pass
- `npm run typecheck && npm run lint && npm test` -- expected: all succeed

## Auto Run Result

Status: done

**Summary:** Circle services now refuse demo participation: `createSharedCircle` throws "The demo account can't create or join circles." for a demo actor, and `addCircleMember` returns `demo_account` when the actor or the added email is a demo account; `addCircleMemberAction` maps it to the same friendly message.

**Files changed:**
- `src/lib/services/circles.ts` -- `DEMO_CIRCLE_MESSAGE`, `isDemoUser` helper, demo checks in create/add.
- `src/app/actions/circles.ts` -- map `demo_account` to the friendly error.
- `tests/services.circles.test.ts` -- 4 new tests (both directions, case-insensitive email, real-user control).
- `tests/actions.circles-demo.test.ts` -- new, 4 action tests incl. real-owner control.

**Review:** 16 findings — 1 patch (low, applied), 5 rows deferred as one item (medium: pre-existing demo memberships), 10 rejected (reasons in triage log); verification-gap found no gaps.

**Follow-up review recommended:** false — patched entries: high 0, medium 0, low 1.

**Verification:** `npm run typecheck` ok; `npm run lint` ok; `npm test` all pass. Implementer confirmed refusal tests fail without the source change.

**Residual risks:** the deferred item — any demo membership already in a database keeps sharing until cleaned up.
