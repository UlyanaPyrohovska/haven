# CLAUDE.md — Haven

Read this first. Keep context small: read docs before code, and read code only for the specific symbol or file the task needs.

## Read order (before any code)
1. This file.
2. `docs/path-a-implementation.md` — implementation spec per task, with conventions and file paths.
3. `apps/mobile/README.md` when touching the mobile app.
4. `docs/FEATURES.md` for what already exists (one section per feature, with status and paths).
5. `BACKLOG.md` only when you need ticket context. Status markers: `[ ]` todo, `[~]` in progress, `[x]` done.

Do not scan the whole repo. Skip `node_modules/`, `.pnpm-store/`, `.turbo/`, `pnpm-lock.yaml`, `apps/backoffice/dist/`, `apps/mobile/ios|android/` (generated), and `drizzle/meta/*_snapshot.json` unless the task is about them.

## What Haven is
Reciprocal matching app (thesis project). Users create profiles (basics, self-ratings, partner preferences, 17 interests, bio, privacy/location), get recommendations, and answer a daily question and a mood check-in. A backoffice lets staff manage users.

## Structure
pnpm workspace + Turborepo. Root `package.json` runs everything from the root.
- `apps/api` — Cloudflare Worker, Hono + Drizzle, Neon Postgres (pgvector), Better Auth.
  - `src/index.ts` (entry, cron `scheduled`), `src/app.ts` (route wiring), `src/chat-room.ts` (chat Durable Object).
  - `src/modules/<feature>/{routes,schemas,service,repository}.ts` — one folder per feature (auth, chat, daily-question, legal, links, mood, notifications, profile, recommendations, safety, simulation, staff).
  - `src/lib/` — pure domain logic, one concern per file: `scoring.ts` (compatibility, pure, no DB), `fairness.ts` (exposure reranking, Gini), `preference-learning.ts`, `matching-config.ts`, `match-reasons.ts`, `partner-filters.ts`, `crossings.ts`, `agent-decision.ts` + `agent-utility.ts` (simulation agents, frozen scoring copy), `bio-embedding.ts`, `recommendation-cadence.ts`, `daily-questions.ts`, `candidate-daily-answer.ts`, `mood.ts`, `candidate-mood.ts`, `profile-view.ts` (haversine, view shaping), `candidate-display.ts`, `chat.ts`, `push.ts`, `looking-for.ts`, `age.ts`, `avatar-url.ts`, `session.ts`, `auth.ts`, `errors.ts`.
  - `src/db/schema.ts` (single source of schema), `src/db/index.ts`.
  - `drizzle/` — generated SQL migrations, numbered `0000`–`0026`.
  - `scripts/seed.ts`, `seed-demo-account.ts`, `seed-matches.ts`, `component-stats.ts` (read-only scoring calibration), `deploy.sh`.
  - Tests: `*.test.ts` next to the lib file, run with Vitest.
- `apps/mobile` — Expo SDK 54, Expo Router, react-query, Better Auth client. Custom dev client, not Expo Go.
  - `app/` — routes. `(auth)/`, `(onboarding)/` (self, basics, interests, partner, bio, privacy), `(profile)/`, `index.tsx`, `home.tsx`, `matches.tsx`, `connections/`, `daily-question.tsx`.
  - `lib/api/` — typed API clients (`client.ts` is the base). `lib/onboarding/` (steps, draft), `lib/profile/` (privacy, location, photo, display), `lib/auth/`, `lib/mood/`, `lib/i18n.ts`, `lib/config/env.ts`.
  - `components/ui/` — shared primitives (button, text-field, form-screen, dialog, chip-group, slider-scale, …). Reuse these before creating new ones.
  - `components/home/`, `components/profile/`, `components/connections/` — feature components.
  - `locales/en.json` — all user-facing strings go here.
  - `AGENTS.md` — Expo 54 docs link. Read the linked versioned docs before writing Expo/RN code; APIs have changed.
- `apps/backoffice` — Vite + React + TypeScript, shadcn-style `components/ui/`. Pages: `Login`, `Users`, `UserDetail`, `Staff`. `RequireStaff` guards routes. Talks to the API via `src/lib/api.ts`.
- `packages/` — empty. Shared zod schemas (ticket C1) are not built yet; don't assume a `@haven/shared` package exists.

## Commands (run from root unless noted)
- `pnpm dev` — API (wrangler, `localhost:8787`) + Metro via turbo.
- `pnpm dev:backoffice`, `pnpm --filter haven-app dev:prod` (prod API).
- `pnpm db:generate | db:migrate | db:studio | db:seed`
- Deploy API: `pnpm --filter api deploy:dev | deploy:prod` — migrates that env file's DB, then deploys the Worker with only its `DATABASE_URL` (`db:migrate:dev|prod` to migrate alone).
- Deploy backoffice: `pnpm deploy:backoffice` — builds with `VITE_API_URL=https://haven.pirogotter.dev`, deploys static assets to `admin.pirogotter.dev`.
- Tests: `pnpm --filter api test` (Vitest). Single file: `pnpm --filter api exec vitest run src/lib/scoring.test.ts`.
- Lint/format: `pnpm check` (Biome, writes fixes). Prefer running it on changed files only.
- Mobile native rebuild: `cd apps/mobile && pnpm ios|android` (needed after native dep changes; `prebuild` regenerates native folders).

## Conventions
- Formatting: Biome. Tabs, double quotes, line width 120, organized imports. Don't hand-format against it.
- TypeScript everywhere. Strict types; no `any` without a reason.
- API: domain logic goes in `src/lib/` as pure functions; route handlers stay thin. Keep `scoring.ts` free of DB imports so the offline eval script can reuse it.
- Schema changes: edit `src/db/schema.ts`, then `pnpm db:generate`, then `pnpm db:migrate`. Never hand-edit applied migrations; never edit snapshots by hand.
- Mobile server state via react-query; API calls go through `lib/api/*`, not raw `fetch` in screens.
- Onboarding steps are data-driven: `lib/onboarding/steps.ts` + `profile-draft.tsx`. Add a step there, not as ad-hoc navigation.
- Copy goes in `locales/en.json`; don't hardcode user-facing strings.

## Domain rules and nuances (easy to get wrong)
- Two ids: **profile id** = `user_profiles.id` (serial int) and **auth id** = Better Auth `user.id` (text). Recommendations and interactions key on profile id; sessions key on auth id. `findViewerByUserId` bridges them. Don't mix them.
- `lookingFor`: 0 = friends, 1 = dating. **Pools never cross.** Every candidate query must filter by it.
- Interests: 17 Likert columns `interest_*`, values 1–10. A value ≥ 8 counts as active (`INTEREST_ACTIVE_THRESHOLD`).
- Preferences vs self-ratings: `pref*` (what the user wants, real) and `self*` (how they rate themselves, smallint). Both are 6-dim: attractiveness, sincerity, intelligence, fun, ambition, shared-interests (`attr, sinc, intel, fun, amb, shar`).
- Missing values are neutral, not zero: null interests → 5; null preference vectors → midpoint; missing coordinates → geo score 0.5. Don't let missing data bury a user.
- Location is approximate only. Never expose raw coordinates to other users; only coarse distance or area. Users can hide location in settings, so respect the privacy flags in `lib/profile/privacy.ts` and `user_profiles` privacy columns.
- Scoring (`scoring.ts`): directional `unilateral(u→v)` combines bio, interest, geo, preference, mood and daily-answer components, each z-scored against `COMPONENT_CALIBRATION` and squashed with a sigmoid. Only the preference term is asymmetric. A missing component (e.g. null bio embedding) is z = 0, i.e. neutral; mood and daily answer never go below 0. The uncalibrated formula (`calibration = null`, thesis ablation) drops a null bio and renormalizes instead. Don't tune `agent-utility.ts` together with `scoring.ts`.
- Daily question and mood check-ins are one per user per day; use the helpers in `daily-questions.ts` and `mood.ts` rather than re-deriving dates.
- Data protection: the database must be in the EU (Neon `aws-eu-central-1`). Don't add a region or third-party service that moves personal data outside the EU without asking.

## Environment and secrets
- `.env` (root) holds `DATABASE_URL`. `apps/api/.env.dev` and `.env.production` hold Worker/app config. All are git-ignored.
- Never read, print, or commit `.env*` contents. Refer to variable names only.
- Mobile env per command: `dev` → `.env.dev` (localhost:8787), `dev:prod` → `.env.production`.

## Working rules
- Start from the package the task touches. Don't run root-wide `turbo` tasks unless the change spans packages.
- Before editing a file, read only the relevant function or range (grep first).
- Don't edit: generated `ios/`, `android/`, `dist/`, lockfile (unless adding deps), migration snapshots, `worker-configuration.d.ts`.
- Don't run destructive git commands (reset --hard, force push, checkout of others' changes). The working tree may already have staged work in progress; don't stage, reset, or revert files you didn't touch.
- When you finish a task from `docs/path-a-implementation.md`, mark its heading there in the same change: `## [x] W1.2 — …` (done), `[~]` (in progress or partial, with a one-line note under the heading saying what is missing), `[ ]` (todo). Also update the matching `BACKLOG.md` marker if the task is a ticket.
- When you add or change a user-facing or staff-facing feature, update `docs/FEATURES.md` in the same change: add or edit its section (what it does, a **How it works** technical explanation — data flow, tables, key functions and design decisions —, screens/routes/code paths, status live/partial/planned, and what is missing when partial). If the change affects the cross-cutting design, update the Architecture overview there too. Removing a feature removes its section.
- Keep answers short. Don't summarize the codebase back unless asked.
