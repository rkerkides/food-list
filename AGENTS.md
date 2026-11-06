<!-- bmad:context -->
<!-- Verified 2026-11-06 against 563898c (plus the uncommitted working tree). Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## food-list (Trapezi)

Personal food discovery and restaurant tracking PWA for Cyprus, branded "Trapezi" in the UI (`food-list` is only the repo/package name). Next.js 16 App Router, React 19, Tailwind 4, TypeScript; SQLite locally and in tests, Postgres/Supabase when hosted. User-facing setup and configuration docs are in `README.md`; BMAD planning artifacts go in `_bmad-output/planning-artifacts/`.

## Policy

- Commit messages use Conventional Commits (`feat:`, `fix:`, `chore:` …).
- Never hand-edit `supabase/migrations/*.sql` — they are generated from `src/lib/db/migrations.ts` by `npm run db:sql`, which writes files but never deletes them; remove a stale file yourself after renaming a migration.
- Never edit or renumber a migration that is already on `main` — applied ids are recorded in `schema_migrations`; append a new migration instead.

## Where things are

- Mutation path: `src/app/actions/*` → `src/lib/services/*` → `src/lib/data/repositories.ts`, the only place SQL lives (exceptions: `services/place-images.ts`, `places/osm-*.ts`, `app/api/health`).
- Shared-circle edit permissions: `src/lib/services/sharing.ts`.
- Schema: `src/lib/db/migrations.ts`; row ↔ domain mapping: `src/lib/data/rows.ts`.

## Running and verifying

- Before calling work done, run `npm run typecheck && npm run lint && npm test` — there is no CI, and `npm test` does not typecheck. All three finish in seconds.
- Tests only ever run on in-memory SQLite, so the `postgres` half of a migration is untested; to exercise it, run `SESSION_SECRET=$(openssl rand -base64 32) npm run docker:up`, which migrates a Postgres 16 container.
- In service tests use `createTestContext()` from `tests/helpers.ts` and pass `ctx.repos` as the last argument; never let a test reach the default `.data/food-list.db`.

## Conventions that differ from defaults

- All SQL must run on both SQLite and Postgres:
  - `?` placeholders only — the Postgres driver rewrites every `?` to `$n`, so never write `$1` or a literal `?` in SQL text.
  - Booleans are integer 0/1 (`toSqlBool`/`fromSqlBool`); JSON lives in `text` columns (`encodeJson`/`decodeJson`); timestamps are ISO strings from `new Date().toISOString()` — never `now()`, `datetime()` or timestamp/json column types.
  - Wrap `count(*)` results in `Number()` (pg returns bigint as a string); avoid `RETURNING` and `ILIKE` — generate the id with `newId(prefix)` and re-read, use `lower(x) = lower(?)`.
- A new migration is a `{ id, name, sqlite, postgres }` entry appended to `MIGRATIONS` with both dialects written (SQLite has no `add column if not exists`), then `npm run db:sql`.
- Inside `db.transaction(async (tx) => …)` run every query through `tx`, via `createRepositories(tx)` as in `services/admin.ts`; repositories bound to the root client run outside the transaction on Postgres.
- Every service function takes an optional last `repos?: Repositories` argument — keep it on new ones, tests inject through it.
- Services return status strings (`"forbidden"`, `"not_found"`, …) for expected failures instead of throwing; actions map them to `{ ok: false, error }`.
- Every server action and API route calls `requireUser()` or `getSessionUser()` itself — there is no middleware, and the `(app)` layout guard does not cover actions or routes. Then validate with a zod schema from `src/lib/domain/schemas.ts` and `revalidatePath` every route that shows the changed data.
- To edit a place or visit, resolve access with `resolveEditablePlace`/`resolveEditableVisit` and call services with `access.ownerUserId`, never `user.id`; deleting a place stays owner-only.
- A new place column needs the migration plus `PlaceRow`, `PLACE_FIELD_MAP`, `toPlace` and the `Place` type (and `PLACE_JSON_FIELDS` for JSON); a provider-sourced field also goes in `EXTERNAL_FIELDS` (`domain/place-merge.ts`) and `OVERRIDABLE_FIELDS` (`services/places.ts`) so user edits survive refresh.
- The demo account (`users.is_demo = 1`) is one login shared by every visitor and is not read-only — exclude it from anything that grants privileges or exposes other users.
- Bump `CACHE` in `public/sw.js` when changing the app shell, offline page or icons.

<!-- /bmad:context -->
