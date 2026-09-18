# Trapezi

A personal food discovery and restaurant tracking app for Cyprus: save the
places you want to try, log the visits and dishes you actually liked, and get
explained recommendations for tonight.

Next.js 16 (App Router) · React 19 · Tailwind 4 · TypeScript · SQLite or Postgres.

## Quick start

```bash
npm install
npm run setup       # applies migrations and seeds the demo account
npm run dev         # http://localhost:3000
```

`npm run setup` uses a local SQLite file at `.data/food-list.db` and needs no
credentials. Sign in with the demo account (`demo@food-list.app` / `demo1234`)
or use the one-click demo button on the login page.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm test` | Vitest suite |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed/reseed the demo account |
| `npm run db:reset` | Reset the demo account's data |
| `npm run db:sql` | Emit `supabase/migrations/*.sql` from the TS migrations |
| `npm run docker:up` / `npm run docker:down` | Local Postgres + app stack |

## Data store

The app talks to a small dialect-neutral SQL layer with two drivers, so the same
repository code runs on both:

- **SQLite** (default): `.data/food-list.db` via better-sqlite3. Zero
  credentials, used for local development and tests.
- **Postgres / Supabase**: set `DATABASE_DRIVER=postgres` and `DATABASE_URL`.
  This is required for any hosted deployment.

Migrations live in `src/lib/db/migrations.ts` and are applied automatically on
the first request (tracked in `schema_migrations`), so a fresh clone works with
no manual step. On Postgres they run under a transaction-scoped advisory lock so
concurrent serverless cold starts cannot race. You can also apply them ahead of
time with `npm run db:migrate`, which is what the Docker stack does.

For Supabase: Project → Connect → Connection string (session pooler, port 5432),
then set `DATABASE_URL` and `DATABASE_SSL=true`.

## Place data

Two providers sit behind one interface, selected by `PLACES_PROVIDER`:

- `auto` (default): Google Places API (New) when `GOOGLE_PLACES_API_KEY` is set,
  otherwise the bundled demo dataset.
- `google`: always Google; errors surface to the user.
- `demo`: always the bundled dataset of 44 fictional Cyprus venues.

Google results are normalised into the app's own model and stored as a snapshot
per saved place. "Refresh" on a place re-fetches that one place, merges changes,
and never overwrites fields the user edited by hand (tracked in `places.overrides`).

Only aggregate ratings and rating counts are read from Google. Review text is
not fetched or stored; the review-like data in the app is your own visit notes
and dish ratings.

> **Before going public with Google data:** the Maps Platform terms restrict
> copying or saving business names, addresses and reviews, cap most Places
> content caching at 30 days (`place_id` excepted), and forbid using Places
> content with a non-Google map. This app stores Places content indefinitely and
> renders it on its own map. Use the bundled dataset or your own data source for
> a public launch unless you have reviewed those terms.

## Docker

```bash
SESSION_SECRET="$(openssl rand -base64 32)" docker compose up --build
```

That starts Postgres 16 (host port 5433), applies migrations in a one-shot
`migrate` service, then serves the app on http://localhost:3000 with a
healthcheck on `/api/health`. Configuration lives in `.env` next to
`docker-compose.yml` (compose reads it automatically):

```ini
SESSION_SECRET=...
POSTGRES_PASSWORD=...          # optional, defaults to foodlist
GOOGLE_PLACES_API_KEY=...      # optional
DATABASE_SSL=false             # default; set true for Supabase and other managed providers
```

The image is a multi-stage build: dependencies, then a standalone Next.js
server, then a slim runtime running as a non-root user.

## Netlify

`netlify.toml` is committed, so connecting the repo is enough. Netlify's Next.js
runtime deploys the routes, server actions and API handlers as functions — this
is a full-stack deploy against your Postgres database, not a static export.

Set these in **Site configuration → Environment variables**:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Supabase/Postgres connection string |
| `SESSION_SECRET` | yes | 32+ random characters; the app refuses to start sessions without it in production |
| `DATABASE_SSL` | yes | `true` for Supabase |
| `GOOGLE_PLACES_API_KEY` | no | omit to run on the bundled dataset |

`DATABASE_DRIVER=postgres` is set in `netlify.toml` so a missing `DATABASE_URL`
fails loudly instead of quietly writing to a file Netlify cannot persist.

Because migrations run on first request, the very first request after a deploy
applies the schema. To do it ahead of time, run `npm run db:migrate` locally
against the production `DATABASE_URL`, or `supabase db push` using the emitted
SQL in `supabase/migrations/`.

## Configuration

See `.env.example` for the full list. The important ones:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_DRIVER` | `sqlite` (or `postgres` if `DATABASE_URL` is set) | Selects the driver |
| `DATABASE_URL` | — | Postgres connection string |
| `DATABASE_SSL` | `true` | TLS for Postgres |
| `SQLITE_PATH` | `.data/food-list.db` | Local database file |
| `SESSION_SECRET` | dev fallback | Session token salt; **required** in production |
| `PLACES_PROVIDER` | `auto` | `auto` / `google` / `demo` |
| `GOOGLE_PLACES_API_KEY` | — | Enables live Google Places |
| `PLACES_REGION_CODE` | `CY` | Region bias for place search |
| `MOCK_PLACES_LATENCY_MS` / `MOCK_PLACES_FAILURE_RATE` | `120` / `0` | Demo-provider simulation |

## Health check

`GET /api/health` returns `200` with the database driver, provider mode and
configuration state, or `503` with a `problems` list (unreachable database,
missing `SESSION_SECRET`). It never exposes secret values.
