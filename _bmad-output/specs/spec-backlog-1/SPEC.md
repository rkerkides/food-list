---
id: SPEC-backlog-1
companions:
  - defect-evidence.md
  - ../../../AGENTS.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# food-list hardening backlog 1

## Why

Pain to solve. A code review on 2026-11-06 found verified defects in Trapezi: shared-circle users and the anonymous shared demo login can see or break data they should not, a public endpoint spends the owner's Google Places quota, some inputs are stored unvalidated, and a few visible copy and map bugs mislead users. Each fix is small and needs no product decision. Evidence per capability is in `defect-evidence.md`.

## Capabilities

- **CAP-1**
  - **intent:** The shared-content permission gate for places and visits is protected by tests.
  - **success:** Tests prove: owner allowed; circle member without the owner's opt-in forbidden; member with opt-in allowed; non-member not_found; removed member not_found; deleting a place stays owner-only. Production code changes only if a test exposes a real bug.
- **CAP-2**
  - **intent:** Only signed-in users can fetch Google place photos, and only for genuine Google photo references.
  - **success:** A Google photo request without a session gets 401; a ref not matching `places/<id>/photos/<id>` gets 404; successful responses are privately cacheable only; photos still render for signed-in users.
- **CAP-3**
  - **intent:** The shared demo account cannot take part in circles.
  - **success:** The demo user cannot create a circle or add members, and no one can add a demo account's email; each attempt is refused with a forbidden outcome and a friendly message. Tests cover both directions.
- **CAP-4**
  - **intent:** Image changes and uploaded photos work on shared places for users who are allowed to see or edit them.
  - **success:** An allowed shared editor can change a shared place's image; a disallowed user cannot. An uploaded photo is served to any user who can access the owner's library, and is 404 for everyone else. Covered by tests.
- **CAP-5**
  - **intent:** Place status and spend range are validated before they are stored.
  - **success:** An unknown place status is rejected. A minimum spend greater than the maximum is rejected with "Minimum can't exceed maximum" on every path that writes a spend range (add, manual add, update, venue review). Covered by tests.
- **CAP-6**
  - **intent:** Venue review input is fully validated like every other place write.
  - **success:** Every field of a venue review is schema-validated with length limits; a non-string name is rejected rather than crashing; cuisines outside the submission owner's catalogue are rejected. Covered by tests.
- **CAP-7**
  - **intent:** Relative dates read as natural English.
  - **success:** One day reads "yesterday" / "tomorrow" (never "yesterday ago" / "in yesterday"); month wording starts only at 30 days, including in recommendation reasons. Covered by tests.
- **CAP-8**
  - **intent:** The places map view plots only places that have coordinates.
  - **success:** Places without both latitude and longitude are not plotted, using the same rule as the main map page; when none have coordinates, the map's empty state shows. Covered by a unit test.

## Constraints

- Follow every rule in `AGENTS.md` (dual-dialect SQL, `repos?` injection, status-string outcomes, session checks in every action and route, shared edits via `resolveEditable*` with `access.ownerUserId`).
- One commit per story; each commit passes `npm run typecheck && npm run lint && npm test`.
- No new dependencies; no schema migrations unless unavoidable; never push.

## Non-goals

- A circle invite/consent flow (owner decision pending).
- Changing venue-review sharing semantics — circle members without the owner's opt-in may review on purpose.
- UI redesign.
- Storing more Google Places content.

## Success signal

- All 8 stories are committed on `improve/backlog-1`, each fix is demonstrated by a test, and the full check suite is green.
