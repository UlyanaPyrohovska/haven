# Haven — Project Backlog

Suggested tickets for the remaining work on Haven, organised by track.
Each entry maps 1:1 to a GitHub issue: paste the ticket body into the
issue form (title + labels + description + criteria + out of scope +
notes). Delete any ticket that isn't relevant, split any that feel too
large, and reorder priorities freely.

**Status legend** (edit as work progresses)
- `[ ]` — not started
- `[~]` — in progress
- `[x]` — done

---

## Track A — Ethics (time-critical, parallel to code)

The DPO reply is the longest-latency item on the whole project. Send
the email before anything else this week.

### `[ ]` A1 — chore(ethics): send DPO email with data registry

- **Labels**: `type:chore` `area:ethics` `prio:P0`
- **Description**: Send the completed *Registo de Atividades de Recolha e Tratamento de Dados* to `protecaodados@ips.pt`, opening the 10-working-day DPO clock and unblocking the CE-IPS submission that follows.

**Acceptance criteria**
- [ ] Data registry docx finalised with sections 1–5 filled
- [ ] Supervisor's name / signature on the responsibility declaration
- [ ] Email sent to `protecaodados@ips.pt` with supervisor CC'd
- [ ] Confirmation of receipt from the DPO archived

**Out of scope**
- The Comissão de Ética submission (separate ticket, follows DPO reply)
- Draft of the participant information sheet (ticket A2)

**Notes**
- 10-working-day statutory DPO response window
- 2–4 weeks realistic worst case
- Every day this waits shifts the whole evaluation window forward

---

### `[ ]` A2 — chore(ethics): draft participant information sheet

- **Labels**: `type:chore` `area:ethics` `prio:P1`
- **Description**: Draft the *Informação aos Participantes* document that will accompany the CE-IPS submission and be presented to participants at the start of each evaluation session.

**Acceptance criteria**
- [ ] All 12 Article 13 GDPR elements present
- [ ] Automated profiling clause (Art. 22) worded for an AI system
- [ ] Written in accessible Portuguese, ≤ 2 A4 pages
- [ ] Supervisor review completed

**Out of scope**
- Consent form itself (A3)
- Recruitment communication (later)

**Notes**
- Article 22 profiling clause is the most-scrutinised bit
- Reuse boilerplate from IPS thesis exemplars where available

---

### `[ ]` A3 — chore(ethics): draft informed consent form

- **Labels**: `type:chore` `area:ethics` `prio:P1`
- **Description**: Draft the *Declaração de Consentimento Informado* with separate checkboxes for each distinct purpose (data processing, video/audio recording, retention beyond evaluation, use in publications).

**Acceptance criteria**
- [ ] One checkbox per purpose (no bundled consent)
- [ ] No pre-ticked boxes
- [ ] Right-to-withdraw clause visible
- [ ] CNPD complaint contact included

**Out of scope**
- The Microsoft Forms implementation (A4)

**Notes**
- Consent must be affirmative and specific under GDPR

---

### `[ ]` A4 — chore(ethics): build Microsoft Forms consent flow

- **Labels**: `type:chore` `area:ethics` `prio:P1`
- **Description**: Implement the informed consent form in Microsoft Forms under the institutional `@estudantes.ips.pt` tenant. Every consent action gets a form response as its written record.

**Acceptance criteria**
- [ ] Form created in Microsoft Forms institutional account
- [ ] All A3 checkboxes reproduced as required fields
- [ ] Receipt to respondent enabled
- [ ] Anonymous mode configured, pseudonym field mandatory
- [ ] Link tested end-to-end with a dry-run submission
- [ ] Link added to the data registry (`Link para registo de consentimento`)

**Out of scope**
- Retention policy for responses (implicit — same as the DPO registry)

**Notes**
- Point 3.4 of the CE-IPS guide requires the full form content also as PDF attachment

---

## Track B — Database foundation

Sequential path from empty project to a seeded database with tables.

### `[~]` B1 — chore(db): create Neon project + DATABASE_URL in .env

- **Labels**: `type:chore` `area:db` `prio:P0`
- **Description**: Provision a Neon Postgres project in EU region and record the connection string.

**Acceptance criteria**
- [ ] Neon project provisioned in `aws-eu-central-1` (Frankfurt)
- [ ] `pgvector` extension enabled
- [ ] Pooled connection string in `.env` at repo root
- [ ] `.env.example` documents `DATABASE_URL` variable shape
- [ ] `.env` git-ignored, verified
- [ ] README updated with *Database (Neon)* section

**Out of scope**
- Schema (B3), seeding (B4), Hyperdrive (later)

**Notes**
- EU region non-negotiable for DPO
- Use pooled connection for now; switch to direct + Hyperdrive later

---

### `[ ]` B2 — chore(db): set up Drizzle ORM with migrations

- **Labels**: `type:chore` `area:db` `prio:P0`
- **Description**: Install and configure Drizzle ORM against Neon, with a factory client for use inside Cloudflare Workers.

**Acceptance criteria**
- [ ] `drizzle-orm` + `@neondatabase/serverless` in `apps/api`
- [ ] `drizzle-kit` as dev dependency
- [ ] `drizzle.config.ts` reading `DATABASE_URL` from root `.env`
- [ ] `src/db/index.ts` exports a typed `createDb()` factory
- [ ] `src/db/schema.ts` present (stub OK)
- [ ] `apps/api/.dev.vars` set locally, git-ignored
- [ ] `/healthz/db` endpoint returns `{ok:true}` against Neon
- [ ] `db:generate`, `db:migrate`, `db:studio` scripts working

**Out of scope**
- Actual table definitions (B3)
- Production secret rotation

**Notes**
- Use `drizzle-orm/neon-http`, not the pg driver (Workers-compatible)
- Prefer `generate` + `migrate` over `push` for traceable schema history

---

### `[ ]` B3 — feat(db): design initial schema

- **Labels**: `type:feature` `area:db` `prio:P0`
- **Description**: Define the core tables that mirror the synthetic CSV structure plus a table for embeddings.

**Acceptance criteria**
- [ ] `users` table (all CSV columns typed correctly)
- [ ] `interactions` table with `user_a`, `user_b`, decisions, scores
- [ ] `friendships` table
- [ ] `user_embeddings` table with `vector(384)` column
- [ ] Foreign keys and B-tree indexes on join columns
- [ ] `pnpm db:generate` produces a migration file
- [ ] `pnpm db:migrate` applies cleanly to Neon
- [ ] Migration file committed to git

**Out of scope**
- HNSW index on embeddings (add after seeding, faster that way)
- Sessions/auth tables (separate ticket)

**Notes**
- 384-dim vectors match `sentence-transformers/all-MiniLM-L6-v2`
- Bump to 768 later if switching to a larger model

---

### `[ ]` B4 — chore(db): seed database from synthetic CSVs

- **Labels**: `type:chore` `area:db` `prio:P0`
- **Description**: Load the three CSVs (users, interactions, friendships) into Neon in one script.

**Acceptance criteria**
- [ ] `apps/api/scripts/seed.ts` reads all three CSVs
- [ ] Uses batch inserts (or `COPY`) for performance
- [ ] Post-seed row counts match source (2000, 98780, 7936)
- [ ] Idempotent: running twice doesn't duplicate
- [ ] Script runnable via `pnpm db:seed`

**Out of scope**
- Embedding generation (separate ticket in Track E)

**Notes**
- Use `papaparse` or similar for CSV parsing
- Consider `TRUNCATE` at start for a clean-slate policy

---

## Track C — Backend

### `[ ]` C1 — chore(infra): set up packages/shared with zod schemas

- **Labels**: `type:chore` `area:infra` `prio:P1`
- **Description**: Create the shared package that hosts zod schemas for API request/response types, importable by both `apps/api` and `apps/mobile`.

**Acceptance criteria**
- [ ] `packages/shared/` with `package.json`, `tsconfig.json`, `src/index.ts`
- [ ] Zod installed as dep
- [ ] `apps/api` and `apps/mobile` add the workspace dep and import successfully
- [ ] Types re-exported cleanly (`import { UserSchema } from "@haven/shared"`)

**Out of scope**
- Populating it with real schemas — that happens per feature

---

### `[ ]` C2 — feat(api): first end-to-end wire (GET /users/:id)

- **Labels**: `type:feature` `area:api` `prio:P0`
- **Description**: Prove the full stack works — mobile → API → DB → mobile — by exposing one read-only endpoint that returns a user by ID.

**Acceptance criteria**
- [ ] `GET /users/:id` endpoint returns 200 with user row from DB
- [ ] 404 on missing ID
- [ ] Response shape validated with zod schema in `packages/shared`
- [ ] Endpoint reachable from Expo dev build on physical phone

**Out of scope**
- Auth (C3)
- Pagination, filtering (later)

**Notes**
- This is the "first light" milestone — the moment the stack is real

---

### `[ ]` C3 — feat(api): set up Better Auth

- **Labels**: `type:feature` `area:api` `prio:P1`
- **Description**: Install and configure Better Auth with the Drizzle adapter. Let Better Auth own the auth tables (`user`, `session`, `account`, `verification`), generated via its CLI. Wire the auth handler into Hono at `/api/auth/**`. Enable email + password by default; leave magic-link config drafted but disabled until the email-delivery decision (C3b) is made.

**Acceptance criteria**
- [ ] `better-auth` installed in `apps/api`
- [ ] `apps/api/src/auth.ts` exports a `createAuth(databaseUrl)` factory
- [ ] Hono forwards `/api/auth/**` to Better Auth's handler
- [ ] `npx @better-auth/cli generate --database drizzle` produces auth tables in `schema.ts`
- [ ] Migration applied to Neon; `user`, `session`, `account`, `verification` tables visible
- [ ] `POST /api/auth/sign-up/email` creates a row in `user`
- [ ] `POST /api/auth/sign-in/email` returns a valid session cookie/token
- [ ] `GET /api/auth/session` returns the current session for authenticated requests
- [ ] Profile fields (bio, interests, prefs) live as extra columns on Better Auth's `user` table

**Out of scope**
- Magic-link email delivery (C3b)
- OAuth providers (later)
- Passkeys (later)

**Notes**
- Adapter provider is `pg`
- Better Auth manages session storage — no manual sessions table
- Keep `BETTER_AUTH_SECRET` in `.env` (long random string)
- Schema change: remove manual `passwordHash` field and the `sessions` table from `schema.ts` before this ticket

---

### `[ ]` C3b — feat(api): enable magic-link delivery

- **Labels**: `type:feature` `area:api` `prio:P2`
- **Description**: Turn on Better Auth's magic-link plugin and wire up email delivery via IPS Outlook SMTP (no third-party subprocessor added). Users can sign in by receiving a one-time link at their email address.

**Acceptance criteria**
- [ ] `magicLink()` plugin enabled in `apps/api/src/auth.ts`
- [ ] `sendMagicLink` implementation uses `nodemailer` with IPS SMTP credentials from `.env`
- [ ] End-to-end flow tested with a real IPS-institutional email address
- [ ] Link deep-links back to the Expo app (custom scheme registered)
- [ ] Token expiry configured (10 minutes default)

**Out of scope**
- Third-party ESP (Resend, Postmark) — not needed for evaluation scale
- Domain purchase / DNS setup — not needed with IPS SMTP

**Notes**
- No domain purchase required if using `@estudantes.ips.pt` as the sender
- Alternative: Resend + a cheap `.dev` domain if you want polished "from" address, but adds a subprocessor to DPO

---

### `[ ]` C4 — feat(api): user profile CRUD endpoints

- **Labels**: `type:feature` `area:api` `prio:P1`
- **Description**: Endpoints for the authenticated user to read and update their own profile (bio, interests, location).

**Acceptance criteria**
- [ ] `GET /me` returns the current user's profile
- [ ] `PATCH /me` updates bio, interests, location
- [ ] All fields validated against zod schema
- [ ] Unauthorized requests rejected with 401

---

### `[ ]` C5 — feat(api): recommendation endpoint (baseline)

- **Labels**: `type:feature` `area:api` `prio:P1`
- **Description**: `GET /recommendations` returns the top-k reciprocal candidates for the authenticated user, computed from embeddings + interests + geo distance.

**Acceptance criteria**
- [ ] Endpoint accepts optional `?k=<n>` (default 10)
- [ ] Returns candidates in descending compatibility order
- [ ] Excludes candidates already interacted with
- [ ] Excludes candidates too far away (configurable `max_km`)

**Out of scope**
- GNN-based ranking (extension track)
- Fairness reranking (later)

**Notes**
- Uses the compatibility function from Track E (research)

---

### `[ ]` C6 — feat(api): interaction endpoint (accept/reject)

- **Labels**: `type:feature` `area:api` `prio:P1`
- **Description**: Record the current user's decision (accept/reject) on a recommended candidate.

**Acceptance criteria**
- [ ] `POST /interactions` accepts `{ target_id, decision }`
- [ ] Persists to `interactions` table
- [ ] Triggers match detection if the other side has already accepted
- [ ] Idempotent per (user_a, user_b)

---

## Track D — Mobile

### `[ ]` D1 — feat(mobile): set up Expo Router tab navigation

- **Labels**: `type:feature` `area:mobile` `prio:P1`
- **Description**: Configure the tab-based navigation shell that will host all main screens.

**Acceptance criteria**
- [ ] Bottom tab navigator with (at least) *Discover*, *Matches*, *Profile*
- [ ] Placeholder screen per tab
- [ ] Auth guard: unauthenticated users redirected to `/login`
- [ ] Works in Expo Go on physical device

---

### `[ ]` D2 — feat(mobile): auth screens (signup, login)

- **Labels**: `type:feature` `area:mobile` `prio:P1`
- **Description**: Login and signup forms that call the C3 endpoints and store the JWT in Expo SecureStore.

**Acceptance criteria**
- [ ] Form validation (email format, password length)
- [ ] Loading state while waiting for API
- [ ] Errors displayed clearly
- [ ] Token persisted across app restarts

---

### `[ ]` D3 — feat(mobile): profile creation flow

- **Labels**: `type:feature` `area:mobile` `prio:P1`
- **Description**: First-run flow where the user fills in bio, selects interests from the 17-category taxonomy, and grants location permission.

**Acceptance criteria**
- [ ] Multi-step form (bio → interests → location)
- [ ] Progress indicator
- [ ] Location permission requested with clear rationale
- [ ] On completion, `PATCH /me` sync succeeds

---

### `[ ]` D4 — feat(mobile): recommendation feed

- **Labels**: `type:feature` `area:mobile` `prio:P1`
- **Description**: Card-stack UI that shows candidates one at a time with accept/reject buttons.

**Acceptance criteria**
- [ ] Fetches from `GET /recommendations`
- [ ] Renders one candidate's bio, interests, avatar
- [ ] Accept and reject buttons call `POST /interactions`
- [ ] Prefetches next candidate while the current one is visible
- [ ] Empty state when no candidates remain

**Out of scope**
- Swipe gestures (bonus, add later)
- Undo action

**Notes**
- Use FlatList only if you eventually paginate; card-stack works with plain state

---

### `[ ]` D5 — feat(mobile): match notification

- **Labels**: `type:feature` `area:mobile` `prio:P2`
- **Description**: When the API returns "match": true from the interaction endpoint, show a celebratory screen and add the pair to the Matches tab.

**Acceptance criteria**
- [ ] Full-screen modal on match event
- [ ] Match appears in the Matches list
- [ ] Dismiss returns to feed
- [ ] Multiple matches during a session queue correctly

---

## Track E — Research baseline (Python)

Runs in `research/` folder, uses the same Neon DB.

### `[ ]` E1 — research(embeddings): generate sentence-transformer embeddings for bios

- **Labels**: `type:research` `area:research` `prio:P1`
- **Description**: Notebook that loads all synthetic users, runs `all-MiniLM-L6-v2` over each bio, and writes the resulting 384-d vector to the `user_embeddings` table.

**Acceptance criteria**
- [ ] Notebook idempotent
- [ ] All 2000 users have embeddings post-run
- [ ] Runtime measured and recorded
- [ ] `SELECT * FROM user_embeddings LIMIT 5` returns valid vectors

**Notes**
- Do not send bios to external APIs during evaluation (DPO reasons)
- Local sentence-transformers avoids third-country transfer

---

### `[ ]` E2 — research(baseline): reciprocal compatibility function

- **Labels**: `type:research` `area:research` `prio:P1`
- **Description**: Implement the weighted-sum compatibility score plus harmonic-mean bilateral aggregation.

**Acceptance criteria**
- [ ] Function computes `α·cosine(emb_a, emb_b) + β·interest_overlap + γ·geo_proximity + δ·pref_match`
- [ ] Bilateral score = harmonic mean of two unilateral scores
- [ ] Weights configurable
- [ ] Unit-tested on hand-computed examples

---

### `[ ]` E3 — research(baseline): evaluate against synthetic match labels

- **Labels**: `type:research` `area:research` `prio:P1`
- **Description**: For each pair in the interactions table, compare predicted compatibility against actual match label. Report precision, recall, reciprocal hit-rate.

**Acceptance criteria**
- [ ] Metrics: reciprocal hit@10, precision@k, recall@k, Gini index (exposure fairness)
- [ ] Baseline beats random recommendation by clear margin
- [ ] Numbers written to `research/results/baseline.json` for thesis inclusion

**Notes**
- This is the empirical basis for RQ1–RQ4 (Core research questions)

---

## Track F — Thesis report (parallel, ongoing)

### `[ ]` F1 — docs(thesis): finish §2.5 Context-Aware Recommendation

- **Labels**: `type:docs` `area:thesis` `prio:P2`
- **Description**: Draft section covering geographic and temporal context in RRS, following the §2.4 template established previously.

**Acceptance criteria**
- [ ] Opens with thesis claim, closes with forward pointer to Chapter 4
- [ ] Adomavicius & Tuzhilin cited
- [ ] Named-author attribution for foundational works

---

### `[ ]` F2 — docs(thesis): finish §2.6 Fairness in Recommender Systems

- **Labels**: `type:docs` `area:thesis` `prio:P2`
- **Description**: Cover exposure fairness, popularity bias, multistakeholder, fairness-aware reranking.

**Acceptance criteria**
- [ ] Singh & Joachims, Burke, Abdollahpouri cited
- [ ] Two-sided fairness (Patro FairRec) discussed
- [ ] Forward pointer to Chapter 4's ranker design

---

### `[ ]` F3 — docs(thesis): finish §2.7 Evaluation in Reciprocal Recommendation

- **Labels**: `type:docs` `area:thesis` `prio:P2`
- **Description**: Cover match success, coverage, stability, ranking and fairness metrics, simulation-based evaluation.

**Acceptance criteria**
- [ ] RecSim (Ie et al.) cited for simulation
- [ ] Reciprocal-specific metrics distinguished from classical accuracy

---

### `[ ]` F4 — docs(thesis): complete §3.2 Academic RRS systems + comparison table

- **Labels**: `type:docs` `area:thesis` `prio:P2`
- **Description**: Compare Pizzato/RECON, Neve & Palomares, Kleinerman, DPGNN, Tomita 2024, Yang 2024. Table with Haven as the final row.

**Acceptance criteria**
- [ ] 6+ academic systems reviewed in prose
- [ ] Comparison table across 6+ dimensions
- [ ] Discussion identifies gaps Haven addresses

---

### `[ ]` F5 — docs(thesis): refresh §2.8 Discussion after §2.5–§2.7 land

- **Labels**: `type:docs` `area:thesis` `prio:P2`
- **Description**: Reflect the final state of §2.5, §2.6, §2.7 back into the chapter's closing synthesis so intro and discussion mirror each other.

---

## Cross-cutting maintenance (add as they surface)

### `[ ]` M1 — chore(infra): tighten `.gitignore` (secrets audit)

- **Labels**: `type:chore` `area:infra` `prio:P2`
- **Description**: Sweep the tree for accidentally-committed secrets (.env, .dev.vars, connection strings in code, API keys in comments).

**Acceptance criteria**
- [ ] `git secrets --scan` (or manual audit) shows no leaks
- [ ] `.gitignore` covers `.env*`, `.dev.vars*`, `!*.example`, `.turbo`, `node_modules`, `.expo`, `dist`
- [ ] Neon password rotated if any exposure detected

---

### `[ ]` M2 — chore(infra): GitHub Actions CI (lint + typecheck)

- **Labels**: `type:chore` `area:infra` `prio:P3`
- **Description**: Minimal CI: on every push, run `pnpm typecheck` and `pnpm lint` across the workspace.

**Acceptance criteria**
- [ ] Workflow file in `.github/workflows/ci.yml`
- [ ] Fails PR merge if either step fails
- [ ] Green badge visible on repo home

**Notes**
- Skip until the codebase has stabilised — CI on an evolving stub codebase is noise

---

## Suggested first two evenings

**Evening 1 (60 min)**
- A1 (send DPO email) — 20 min
- B1 (create Neon project) — 15 min
- B2 (Drizzle setup) — 25 min

**Evening 2 (90 min)**
- B3 (schema design) — 45 min
- B4 (seed from CSVs) — 30 min
- C2 (first end-to-end wire) — 15 min

At the end of Evening 2, your Expo Go app displays a synthetic user's
bio pulled from Neon Frankfurt through your Hono API. That's the
"first light" milestone.

## Suggested branch naming

`<type>/<issue-number>-<short-kebab-description>`, e.g. `chore/12-drizzle-setup`, `feat/23-recommendation-endpoint`, `docs/F1-context-aware-section`.
