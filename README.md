# Haven

Haven is a reciprocal matching app, built as a thesis project. People create a profile (basics, self-ratings, partner preferences, interests, bio, privacy), get a daily batch of recommended people in a Friends or a Dating pool, match, and chat. They also answer a daily question and a mood check-in. A staff backoffice manages users and the matching rules.

## Repository layout

pnpm workspace with Turborepo. Run every command from the repo root unless noted.

| Path | What it is |
| --- | --- |
| `apps/api` | Cloudflare Worker: Hono + Drizzle, Better Auth, Neon Postgres with pgvector via Hyperdrive, chat over Durable Objects |
| `apps/mobile` | Expo app (Expo Router, react-query). Uses a custom dev client, not Expo Go |
| `apps/backoffice` | Staff web app: Vite + React, deployed as static assets on Cloudflare |

## Requirements

- Node.js and pnpm 12 (`corepack enable` picks up the pinned version).
- A Cloudflare account with access to the `haven-api` Worker (`pnpm --filter api exec wrangler login`).
- A Neon Postgres database in the EU region (see [Database](#database)).
- For the mobile app: Xcode (iOS) or Android Studio (Android).

## Setup

```bash
pnpm install
```

### Environment files

All `.env*` files are git-ignored. Never commit them.

| File | Used by | Variables |
| --- | --- | --- |
| `apps/api/.env` | `db:*` commands and seed scripts | `DATABASE_URL`, `DATASET_DIR` (seed only) |
| `apps/api/.env.dev` | `pnpm dev` (local Worker) | `DATABASE_URL`, `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` (same dev URL), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| `apps/api/.env.prod` | `pnpm deploy:api` (migrates prod) | `DATABASE_URL` (prod) |
| `apps/mobile/.env.dev`, `.env.production` | Mobile `dev` / `dev:prod` | `EXPO_PUBLIC_API_URL` |
| `apps/backoffice/.env` | Backoffice dev server | `VITE_API_URL`, `VITE_AUTH_BASE_URL`, `VITE_API_PROXY_TARGET` |

`apps/api/.env.example`, `apps/mobile/.env.example` and `apps/backoffice/.env.example` are templates.

Worker secrets in production (`wrangler secret put`): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and for push `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`. Without the push secrets, push is skipped.

### Database

The database **must** be in the EU (`aws-eu-central-1`, Frankfurt) for data protection.

1. Create a Neon project in AWS Europe (Frankfurt).
2. Enable pgvector in the Neon SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Put the pooled connection string (host contains `-pooler`) into `apps/api/.env` as `DATABASE_URL`.
4. Apply the migrations: `pnpm db:migrate`.
5. Optional: load the 2,000 synthetic profiles with `pnpm db:seed -- /path/to/Dataset` (or set `DATASET_DIR`). It only replaces synthetic profiles and leaves real users alone.

In production the Worker reaches the database through the `HYPERDRIVE` binding in `apps/api/wrangler.jsonc`, which points at the prod database.

### Mobile dev client

The first time, and after any native dependency change, build and install the dev client:

```bash
cd apps/mobile
pnpm ios       # iOS Simulator
pnpm android   # Android emulator
```

See [`apps/mobile/README.md`](apps/mobile/README.md) for physical devices and EAS builds.

## Daily development

```bash
pnpm dev              # API on localhost:8787 + Metro
pnpm dev:prod         # Metro against the production API
pnpm dev:backoffice   # backoffice on localhost:5173
```

Open the Haven dev client on the simulator or emulator, not Expo Go.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | Type-checks all apps |
| `pnpm test` | Runs the API tests (Vitest) |
| `pnpm check` | Biome lint + format, writes fixes |
| `pnpm db:generate` | Creates a migration from changes in `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Applies migrations to the database in `apps/api/.env` |
| `pnpm db:studio` | Opens Drizzle Studio |
| `pnpm db:seed` | Reloads synthetic profiles from the dataset |
| `pnpm db:seed-demo` | Creates the App Review demo account (see the script header) |
| `pnpm --filter api db:seed-matches -- <email> [count]` | Gives one account a few synthetic matches |
| `pnpm --filter api db:export-eval` | Exports anonymised data for the thesis evaluation to `apps/api/eval-out/` (see `apps/api/eval/README.md`) |

Schema changes: edit `schema.ts`, run `pnpm db:generate`, then `pnpm db:migrate`. Never edit applied migrations.

## Deploy

| Command | Target |
| --- | --- |
| `pnpm deploy:api` | Migrates the prod database (`apps/api/.env.prod`), then deploys the Worker to `haven.pirogotter.dev` |
| `pnpm deploy:backoffice` | Builds against the prod API and deploys to `admin.pirogotter.dev` |
| `pnpm release:ios` | Local EAS production build of the iOS app, then submits it to App Store Connect |

There is one Worker and it serves production, so every API deploy goes live.
