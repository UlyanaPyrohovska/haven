# Haven — Path A implementation spec

Technical build notes for each task in the 3-week test-readiness plan. Grounded in the
current code: `apps/api` (Hono + Drizzle on Cloudflare Workers, Neon/pgvector) and
`apps/mobile` (Expo Router + react-query + Better Auth). File paths are relative to the
repo root.

Conventions used below:
- **Profile id** = `user_profiles.id` (serial int). **Auth id** = Better Auth `user.id` (text).
  Recommendations/interactions key on profile id; sessions key on auth id. `findViewerByUserId`
  bridges the two.
- Interests are 17 Likert columns (`interest_*`, 1–10). `selectedInterestKeys` treats ≥ 8 as
  "active" (`INTEREST_ACTIVE_THRESHOLD`).
- Preferences `prefAttr/Sinc/Intel/Fun/Amb/Shar` (real, what you want) vs self-ratings
  `selfAttr…selfShar` (smallint, how you rate yourself). Both 6-dim.
- `lookingFor` 0 = friends, 1 = dating; **pools never cross**.

---

## [x] W1.1 — Location wording in consent + info sheet  ·  ethics · P0

Not code. Two Word files in `Thesis/Ethics_CE/`: `04_Informed_Consent_EN.docx` and
`03_Participant_Information_Sheet_EN.docx`. Both currently omit location entirely while the
registo declares "localização aproximada" and the app uses it (haversine distance +
cross-paths).

Add one sentence to each, consistent with the registo (approximate location only, no
continuous tracking):

> *"The app uses your approximate location to estimate distance to other people and to
> suggest nearby profiles. Your precise coordinates are never shown to other users — only a
> coarse distance or area label — and you can hide your location at any time in Settings."*

In the consent form this belongs as its own checkbox purpose (no bundled consent). Keep both
in the same plain-Portuguese/English register as the rest of the document.

---

## [x] W1.2 — Compatibility scoring module  ·  api · P0  ·  ↔ E2

**File:** `apps/api/src/lib/scoring.ts` (pure, no DB imports). Putting it in `lib/` lets both
the Worker and the offline eval script (W3.2) import the *same* function, so thesis numbers
match the deployed engine.

**Input shape** — a plain, DB-agnostic struct so the eval script can feed it rows too:

```ts
export type ScoringProfile = {
  id: number;
  interests: number[];          // 17 values in column order, nulls → neutral (see below)
  pref: number[];               // [attr,sinc,intel,fun,amb,shar]
  self: number[];               // [attr,sinc,intel,fun,amb,shar]
  latitude: number | null;
  longitude: number | null;
  bioEmbedding: number[] | null; // 384-d, null until W2.1
};
```

**Component functions** (each returns [0,1]):

- `interestSimilarity(a, b)` — cosine over the two 17-dim Likert vectors. Richer than Jaccard
  because it uses intensity, not just the ≥ 8 cutoff. Fill null interests with the neutral
  midpoint (5) before cosine. Clamp negative cosines to 0.
- `preferenceMatch(fromPref, toSelf)` — **directional.** Normalize both 6-dim vectors to unit
  length and take the dot product (cosine). This is "does the candidate actually have the
  qualities the viewer weights highly." Null → neutral midpoint.
- `geoProximity(a, b)` — `d = haversineKm(...)` (reuse `lib/profile-view.ts`). Decay
  `exp(-d / TAU)`, `TAU ≈ 25` km (config). Missing coordinates → neutral `0.5`, never 0, so a
  user who hid location isn't buried.
- `bioSimilarity(a, b)` — cosine of the two 384-d embeddings, or `null` when either is absent.

**Unilateral score** (directional, u → v):

```
unilateral(u→v) = α·bioSimilarity(u,v)
                + β·interestSimilarity(u,v)
                + γ·geoProximity(u,v)
                + δ·preferenceMatch(u.pref, v.self)
```

Only `preferenceMatch` is asymmetric; that asymmetry is what makes the reciprocal step
non-trivial. When `bioSimilarity` is null, drop α and **renormalize** the remaining weights to
sum to 1 (so a real viewer with no embedding still gets a sensible score against synthetic
candidates that do have one).

**Reciprocal score:**

```ts
export function reciprocalScore(u, v, w = DEFAULT_WEIGHTS) {
  const p = unilateral(u, v, w);     // u → v
  const q = unilateral(v, u, w);     // v → u
  const reciprocal = p + q === 0 ? 0 : (2 * p * q) / (p + q); // harmonic mean
  return { reciprocal, pUToV: p, qVToU: q };
}
```

**Weights:** `export const DEFAULT_WEIGHTS = { bio: 0.35, interest: 0.30, geo: 0.20, pref: 0.15 }`.
Keep them in one config object so W3.2 can sweep them.

**Tests:** `apps/api/src/lib/scoring.test.ts` (match the repo's runner — check
`apps/api/package.json`; likely `vitest` or `bun test`). Hand-computed cases: identical
profiles → ~1.0; orthogonal interests → low; one-sided preference (u wants what v lacks, v
wants what u has) → harmonic mean well below the arithmetic mean; missing-embedding path
renormalizes and still returns [0,1]. Acceptance = ticket E2.

---

## [x] W1.3 — Recommendation generator  ·  api · P0  ·  ↔ C5

**File:** `apps/api/src/modules/recommendations/generator.ts`
**Export:** `generateRecommendations(db, viewerId, opts?) → Promise<number>` (count written).

**Repository additions** (`recommendations/repository.ts`):

- `findScoringProfileById(db, profileId)` — selects the scoring columns (interests, pref*,
  self*, lat/lon, lookingFor) **left-joined** with `user_embeddings.bio`, mapped into a
  `ScoringProfile`.
- `listCandidatePool(db, viewer, { maxKm, limit })` — the pool query (below).
- `replaceRecommendations(db, viewerId, rows)` — transactional write (below).

**Pool query** — `user_profiles` left join `user_embeddings`, where:

- `id <> viewerId`
- `discoverable = true`
- `looking_for = viewer.lookingFor` (pools don't cross)
- **no existing interaction** either direction — `NOT EXISTS (select 1 from interactions where
  (user_a=viewer and user_b=cand) or (user_a=cand and user_b=viewer))`
- optional bounding-box prefilter on `latitude/longitude` when `maxKm` is set (cheap, before
  exact haversine)
- `LIMIT` a sane cap (e.g. 500). **Scale path:** when the viewer has an embedding, pre-rank the
  pool with the HNSW index (`ORDER BY bio <=> $viewerEmbedding ASC LIMIT 200`) to shortlist,
  then exact-rescore. At 2000 users a full scan is fine; document the ANN path for the thesis.

**Algorithm:** map pool rows → `ScoringProfile`, compute `reciprocalScore(viewer, cand)` for
each, sort desc, take top `k` (default 10).

**Persist** (one transaction):
1. `DELETE FROM recommendations WHERE user_id = viewer AND acted_on = false` (keep acted-on
   history for the audit/fairness metrics).
2. Insert the top-k with `score = reciprocal`, `rank = 1..k`. Use
   `onConflictDoUpdate` on the `(user_id, candidate_id)` unique index to avoid colliding with
   an acted-on row for a candidate seen before (updates score/rank, leaves `acted_on`).

**Opts:** `{ k = 4, maxKm = null, weights = DEFAULT_WEIGHTS }`. The feed is an **exposure-limited
daily drop**, not an endless scroll — a small batch (3–5) per day. The generator just produces one
batch of size `k`; *when* a new batch is allowed is the trigger's job (W1.4). A small `k` also
spreads candidate exposure across the pool, which helps the Gini fairness number in W3.2.

**Note:** also stash the directional scores when an interaction is later created — see W1.4; the
`interactions` table already has `score_a_to_b` / `score_b_to_a` columns sitting null.

---

## [x] W1.4 — Generation triggers  ·  api · P0

The cadence is a **daily drop**: a new batch is generated only when the current one is fully
acted on **and** a cooldown has elapsed — never an endless feed. Config in one place next to
`DEFAULT_WEIGHTS`: `export const CADENCE = { batchSize: 4, cooldownHours: 24 }` (the hours value
is the test knob — see below).

**Cooldown signal — no migration needed.** Derive "when the last batch was shown" from
`max(shown_at)` over the viewer's recommendations; add
`getLastBatchShownAt(db, viewerId) → Date | null` to the repo. (A dedicated `last_batch_at`
column is cleaner but not worth a migration here.)

**Lazy (primary, no mobile change).** In `recommendations/service.ts > getRecommendations`:

```ts
const pending = await repository.countPendingRecommendations(db, viewer.id);
if (pending === 0 && isProfileComplete(viewer)) {
  const lastShown = await repository.getLastBatchShownAt(db, viewer.id);
  const ready = !lastShown || Date.now() - lastShown.getTime() >= CADENCE.cooldownHours * 3_600_000;
  if (ready) await generateRecommendations(db, viewer.id, { k: CADENCE.batchSize });
}
```

`isProfileComplete` = has interests + pref + self populated (guards a half-onboarded profile). If
the pool is exhausted and generation yields 0, return empty normally — do **not** loop.

**Caught-up state.** When `pending === 0` and the cooldown has *not* elapsed, return the empty
list plus `nextRefreshAt = lastShown + cooldown` (ISO). Add an optional `nextRefreshAt: string`
to `RecommendationsListSchema` so the mobile empty state (W2.5) can say "new people on [date]".

**Test knob.** A participant can't wait 24 h in a session. Read `cooldownHours` from an env var
(e.g. `REC_COOLDOWN_HOURS`) so it can be set to minutes/zero for the study, and/or let the
moderator reset-endpoint (below) force the next drop. Default stays 24 in production.

Because `fetchRecommendations` on the mobile home screen already calls `GET /recommendations`,
this makes a freshly-onboarded account self-populate with its first daily batch, with no client
change.

**On onboarding completion (optional, belt-and-suspenders).** `(onboarding)/self.tsx` ends with
`saveProfile(draft)` → `PATCH/POST /me`. In `profile/service.ts > patchProfile`, after the
upsert, if the profile just became complete and has no pending recs, call
`generateRecommendations`. Keep it fire-and-forget-safe (await, but swallow/log errors so a
generation hiccup doesn't fail the profile save).

**Reset endpoint.** Add `postRegenerateRoute` (`POST /recommendations/regenerate`) in
`routes.ts`, wire in `index.ts`, implement `service.regenerate` = delete the viewer's un-acted
recs then `generateRecommendations`. (Full participant wipe incl. interactions is W3.1.)

Retire `scripts/seed-recommendations.ts` and the hardcoded `TARGET_AUTH_USER_ID` once the lazy
path works.

---

## [x] W1.5 — De-demo the presentation layer  ·  api · P1

The feed currently leans on `lib/recommendation-demo-data.ts` (5 fixed candidate ids with
names + answers). Three changes so **any** candidate renders:

**Display names.** `user_profiles` has no name column; synthetic rows have none and real names
live on Better Auth `user.name`. Add a column and a name source:
- Migration: `display_name varchar(80)` on `user_profiles` (`pnpm db:generate && db:migrate`).
- Real users: on profile create (`profile/service.ts`), set `displayName` = first token of
  `user.name`.
- Synthetic users: in `scripts/seed.ts`, assign a gender-aware first name deterministically by
  id (ship a small first-names list, or add a `name` column to the synthetic CSV). 2000 rows.
- `displayNameForCandidate(profile)` → `profile.displayName ?? "Someone"` (drop the demo map).

**Daily question.** Replace `DEMO_DAILY_QUESTION` with `dailyQuestion(date)` → index into a
constant `DAILY_QUESTIONS[]` by day-of-year, so it's deterministic and the same for everyone
that day. No per-candidate dependency.

**Candidate answer / cross-paths.** Synthetic candidates have no real answer: in
`getRecommendationDetail`, omit `questionAnswer` when absent (make it optional in
`RecommendationDetailSchema`), and set `crossPathsCount` from `shouldShowCrossPaths` or `null`
(the mobile `RecommendationDetail` type already allows `number | null`). Confirm
`resolveProfilePhotoUrl` yields a valid URL for every candidate so
`RecommendationSummarySchema.photoUrl` (url) never fails validation.

---

## [~] W1.6 — "You've crossed paths" boost  ·  api/db · P2  ·  extends W1.2 + W1.3

> Status: code, migration `0014` and seed script are done and tests pass. Still to do: `pnpm db:migrate`, then `pnpm db:seed-crossings`, then an on-device check of the detail count.

Serendipity re-ranking layer on top of the reciprocal score: candidates you keep crossing
paths with get surfaced again. **Simulated (seeded), not tracked** — no encounter logging of
participants, so it stays within the registo's "approximate location, no continuous tracking."
A real version would be new processing and need a DPO/ethics update; out of scope for the test.

Depends on W1.2 (`scoring.ts`) and W1.3 (generator). Do it after W1.4 so the baseline ranking is
proven first; it's a bounded nudge, not a core factor.

**Data model** — new table + migration (`pnpm db:generate && db:migrate`):

```ts
export const crossings = pgTable("crossings", {
  userA: integer("user_a").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  userB: integer("user_b").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  count: smallint("count").notNull().default(0),
  lastCrossedAt: timestamp("last_crossed_at"),
  lastPlace: varchar("last_place", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userA, t.userB] }), index("crossings_user_b_idx").on(t.userB)]);
```

Undirected — always store with `user_a < user_b`.

**Scoring extension** (`apps/api/src/lib/scoring.ts`, on top of the W1.2 functions). Crossings
are symmetric, so this does **not** go inside the directional `unilateral()` — it's applied once
to the reciprocal result. Keep `ScoringProfile` unchanged and pass the count in separately, so
`scoring.ts` stays pure and DB-agnostic:

```ts
export function crossPathsNorm(count: number, K = 3): number {
  return count > 0 ? 1 - Math.exp(-count / K) : 0;   // saturating in [0,1): norm(3)≈0.63
}
export function applyCrossPathsBoost(reciprocal: number, count: number, lambda = 0.2): number {
  return reciprocal * (1 + lambda * crossPathsNorm(count));
}
```

Add the constants to the config object next to `DEFAULT_WEIGHTS`:
`export const CROSS_PATHS = { lambda: 0.2, K: 3 }`.

**Generator integration** (W1.3). Add a repo fn
`listCrossingCounts(db, viewerId, candidateIds) → Map<number, number>` that looks up the
undirected pair (min/max of viewer and candidate). In the generator, after computing
`reciprocalScore` for each candidate, apply `applyCrossPathsBoost(reciprocal, count)` and rank by
the boosted value. Store the boosted number in `recommendations.score` (ranking only; it may
exceed 1 — fine, or clamp to 1 for tidiness).

**Privacy gating.** Only apply the boost (and only show a count) when
`shouldShowCrossPaths(viewer, candidate)` is true — i.e. both sides have `shareCrossPaths`. If
either opted out, treat the count as 0 for scoring and hide it in the detail view.

**Display.** Already wired: `RecommendationDetail.crossPathsCount` exists. In
`getRecommendationDetail`, feed the real count from the same lookup, gated by
`shouldShowCrossPaths`. Drop the demo `crossPathsCount` from W1.5's de-demo pass.

**Seed** (`scripts/seed-crossings.ts`, idempotent — truncate first):
- Synthetic pairs within ~10 km (`haversineKm`): take a subset (~15–25% of near pairs) and assign
  `count = 1 + Poisson(λ)` weighted by closeness; `last_crossed_at` within the last ~14 days;
  `last_place` a real nearby label ("Avenida Luísa Todi", "Praça do Bocage", "Mercado do Livramento").
- For each participant account, seed 2–3 crossings with specific nearby discoverable synthetic
  profiles so the feature is visibly present in-session.

**Edge cases:** no row → count 0 → boost factor 1 (no change); privacy opt-out → 0; keep
`lambda ≤ 0.25` so it doesn't double-count with the geo term; crossings are mutual so there's one
row per pair.

**Tests** (`scoring.test.ts`): `crossPathsNorm(0) === 0`, monotonic and saturating; a count-0
boost returns the reciprocal unchanged; a crossed-paths candidate outranks an equal-reciprocal
candidate with no crossings. Generator test: a seeded crossing lifts that candidate's rank; an
opted-out candidate is not boosted.

**Thesis note:** trivially ablatable — report rankings and the Gini/exposure numbers at
`λ = 0` (pure reciprocal baseline) vs `λ = 0.2`, and present it as a serendipity re-ranking layer
over the baseline. Acceptance: table migrated + seeded; helpers + tests pass; generator applies
the boost with privacy gating; detail screen shows a real count; `λ = 0` reproduces the W1.2
ranking exactly.

---

## [~] W1.7 — Simulation engine + synthetic agents + interaction graph  ·  api/backoffice · P2

> Status: code done, unit tests pass. Still to do: run a tick against the dev DB from `/graph`, and check an agent's reply to a real user's like on device.

The 2000 synthetic profiles become **agents** that act on their own recommendations, so the
network grows and real participants can actually match a synthetic candidate. Previously, when a
real user accepted a synthetic candidate, `interactions.dec_b` stayed null forever.

**Decision rule** (`src/lib/agent-decision.ts`, pure). An agent accepts with probability
`σ((unilateral(agent→other) − threshold) / temperature)`. The draw is seeded by
`tickId:agentId:otherId`, so a tick is reproducible. `AGENT = { threshold: 0.55, temperature: 0.08 }`
are ablation knobs. Only the agent's own directional score is used.

**Tick** (`src/modules/simulation/engine.ts > runTick`), one simulated day:
1. Agents reply to likes waiting on them (`dec_b IS NULL`). Only likes that came from an acted-on
   recommendation are answered, so the one-sided dataset rows are left alone.
2. A random sample of agents (`AGENT.defaultTickLimit`) gets a fresh batch if none is pending,
   then decides on it. Agent pools are **synthetic-only** (`syntheticOnly` pool option). If an
   agent liked a real user first, the pair would leave that user's pool for good (the pool excludes
   any existing interaction). Real users reach agents through their own feed.
3. Every real, discoverable user gets their daily drop if it is due (`ensureBatch`, the same rule as
   the lazy `GET /recommendations` path).

`recordDecision` (the interaction write and match rule) is shared by `postDecision` and the engine.

**Triggers.** Worker cron `*/30 * * * *` (`wrangler.jsonc`) runs a tick only when the
`SIMULATION_ENABLED` var is `"true"`. The default is `"false"`. Staff can run a tick on demand with
`POST /staff/simulation/tick`.

**Backoffice.** `/graph` page (`react-force-graph-2d`), fed by `GET /staff/graph?lookingFor&edges&since&limit`.
Real users and agents are coloured differently. A solid edge is a match and an arrow is a one-way
like. Node size is degree. The view can be filtered by pool, edge type and time window, and a click
opens the user detail page. The endpoint returns only ids and display names, never coordinates.

**Thesis note:** agents are synthetic and never count as participants in the evaluation. Report
their threshold and temperature with the results. Since the dataset interactions keep their seed
`created_at`, the `since` filter separates simulated activity from historical activity.

---

## [x] W2.1 — Bio embeddings  ·  research · P1  ·  ↔ E1
> Status: run on dev on 2026-10-24: 2002 bios, 21 s encode+write (32 s total). Re-run on prod and after participants onboard.

**File:** `research/embeddings/generate_embeddings.py` (new `research/` tree). Local only — do
**not** call external embedding APIs (DPO: bios stay in the EU / on-device). `all-MiniLM-L6-v2`
is 384-d and matches `user_embeddings.bio vector(384)`.

Steps: load `DATABASE_URL` from `apps/api/.env` (or `ENV_FILE=.env.dev|.env.prod`, as drizzle does); `psycopg` + `pgvector.psycopg.register_vector`;
`SELECT id, bio FROM user_profiles WHERE bio IS NOT NULL AND id NOT IN (SELECT user_profile_id
FROM user_embeddings)` (idempotent); encode in batches with `sentence-transformers`; upsert
`(user_profile_id, bio, updated_at)` into `user_embeddings`. Record runtime. Acceptance = all
synthetic users with a bio have a vector; `SELECT … LIMIT 5` returns valid vectors.

**Real users:** their bio has no embedding at onboarding. For the evaluation window, let the
backbone score (interest + geo + pref, α renormalized away) carry real viewers — W1.2 already
handles the null path. Options to note in the thesis, not block on: a scheduled re-embed job,
or Cloudflare Workers AI `@cf/baai/bge-small-en-v1.5` (adds a subprocessor → DPO update).

---

## [x] W2.2 — Switch on the cosine term  ·  api · P1

> Status: `bio` weight was already on (0.35). The mixed-pairing test is in `scoring.test.ts`. The HNSW shortlist order (c) was checked in code, not measured.

With embeddings present, `findScoringProfileById` / `listCandidatePool` already left-join
`user_embeddings`, so `bioEmbedding` is populated. No scoring change needed beyond W1.2 — just
verify: (a) viewer-with-embedding × candidate-with-embedding uses α; (b) either side missing →
α renormalized; (c) the HNSW shortlist path (W1.3) returns candidates in cosine order. Flip the
default `bio` weight on once synthetic embeddings exist. Add one integration test covering the
mixed (embedding / no-embedding) pairing.

---

## [ ] W2.3 — Make the candidate pool realistic  ·  db · P1

Each participant must see a varied, plausible top-10. Audit `scripts/seed.ts` for how synthetic
rows get coords/photos, then ensure a believable nearby set (e.g. 150 profiles):
- `discoverable = true`; non-null `photo_url`, `bio`, and several interests ≥ 8.
- Coordinates clustered on Setúbal (≈ 38.52, −8.89) with jitter so distances span 0–40 km (the
  `candidateLocationLabel` helper shows "Setúbal, Portugal" < 5 km, else "N km away").
- `looking_for` spread across both 0 and 1 so a friends viewer *and* a dating viewer each get a
  pool.
- `display_name` populated (W1.5).

Deliver as a repeatable `scripts/seed-nearby.ts` (or extend `seed.ts`) so a reset rebuilds the
same pool.

---

## [ ] W2.4 — Full end-to-end run on device  ·  mobile · P0  ·  ↔ D4

Build the dev client (`apps/mobile`: `pnpm ios` / `pnpm android`), run API + Metro
(`pnpm dev`), set `EXPO_PUBLIC_API_URL` to the LAN URL of the Worker dev server. Walk the whole
loop on a physical phone: register → onboarding (basics→bio→interests→partner→self) → home
(connection count) → connections card → accept/decline → match → Matches tab.

Verify specifically: the lazy generator fires for the new account (home shows a real feed);
Better Auth session persists via SecureStore across cold start; `apiFetch` sends the session
cookie/token and the Worker CORS allows the Expo origin. Triage the ~46 `TODO/demo/mock`
markers (`grep -rinE "TODO|FIXME|mock|demo" apps/mobile apps/api/src`) and fix those on this
path; defer the rest.

---

## [~] W2.5 — Polish the UX states  ·  mobile · P1  ·  ↔ D5

> Status: caught-up state and match dialog done; match is an inline dialog, not the `app/match/[candidateId].tsx` modal route.

`connections/index.tsx` already branches on `isPending` / `isError` — fill in a proper loading
skeleton, an error state with retry, and the **caught-up** state — when the batch is done for the day, show
"You're all caught up — new people on [date]" using `nextRefreshAt` from the list response (W1.4),
not an infinite feed. Wire
the match celebration: `postRecommendationDecision` returns `{ matched }`; on `true`, present a
full-screen modal (`app/match/[candidateId].tsx` as a modal route) then drop into the Matches
list (`fetchMatches`). Queue multiple matches in one session.

---

## [x] W2.6 — Daily Question redesign (engagement)  ·  mobile (+ small api) · P1

**Problem.** Today the daily question is a lonely multiline `TextInput` embedded in the home feed
(`apps/mobile/components/home/daily-question-card.tsx`) with 800ms debounced autosave. It has no
purpose or reward, and the inline text box on the busy home screen is one source of the
keyboard-overlap bug (W2.7). The **backend is good and stays**: `lib/daily-questions.ts`'s
`dailyQuestion(date)` rotates `DAILY_QUESTIONS` (same for everyone per UTC day);
`GET`/`PUT /daily-question/today` persist one answer per profile per day in `daily_question_answers`;
and every candidate already exposes a `questionAnswer` for today via `resolveCandidateDailyAnswer`
(`lib/candidate-daily-answer.ts`).

**Goal.** A calm, purposeful daily moment with a *reciprocal* reward: you answer today's question,
and in return you unlock seeing how the people in today's batch answered the same question; your
answer shows on your own card to others. Bounded to once a day — no endless feed, no hard streaks
(deliberately, to stay on the wellbeing side).

### Frontend

1. **Home card becomes a tappable summary, not an input** (`daily-question-card.tsx`). Remove the
   `TextInput` and all autosave/timer logic. Two states, driven by `fetchTodayDailyQuestion`
   (`{ question, answer }`):
   - *Unanswered* — the question shown prominently, a primary `Button` "Share your answer", and
     subtext "Answer to see what others said today." Tapping routes to the modal below.
   - *Answered* — a done state: the question, your answer as a quote, a check icon, and a secondary
     CTA "See today's answers →" routing into the connections feed. Tapping the answer reopens the
     modal to edit.
   The card is a `Pressable`; **no keyboard is ever involved on the home screen.**

2. **New focused answer screen** `apps/mobile/app/daily-question.tsx`, presented as a **modal**.
   Register in `app/_layout.tsx`: `<Stack.Screen name="daily-question" options={{ presentation: "modal" }} />`.
   Build it on the existing `FormScreen` scaffold (safe-area + keyboard avoidance + sticky footer;
   fully keyboard-safe after W2.7) so this input is never covered:
   - Title = today's question. Body = the existing `TextField` component, `multiline`,
     `maxLength={150}`, `showCounter`, `autoFocus`, with a rotating placeholder.
   - Recommended: 2–3 `ChipGroup` "starters" that prefill a sentence opener ("Today I…",
     "I'm grateful for…") to beat the blank page.
   - Sticky `footer` = `Button` "Share", disabled until the text is non-empty and changed from the
     loaded answer. On press → `saveTodayDailyQuestion(text)` then `invalidateQueries` on
     `todayDailyQuestionQueryKey` **and** the recommendation detail keys (so unlocked answers
     refetch). On success show a brief confirmation (reuse `decision-animation` or a simple check +
     "Shared — see who else answered"), then `router.back()`. Errors via `ErrorBanner`.
   - This replaces the debounced autosave with one explicit save — clearer and removes the race-prone
     timer.

3. **Reveal/unlock (the reciprocal hook).** On the connection detail, show a candidate's
   `questionAnswer` only if the viewer has answered today; otherwise a locked state ("Answer today's
   question to see theirs", tap opens the modal). `connection-candidate-screen.tsx` branches on the
   new `answerLocked` flag below.

### API (small, no migration)

- In `recommendations/service.ts > getRecommendationDetail`: call
  `dailyQuestionRepository.findAnswerForDate(db, viewer.id, utcToday())`. If the viewer has **not**
  answered, return `questionAnswer: null` and `answerLocked: true`; otherwise resolve the candidate's
  answer and `answerLocked: false`.
- Add `answerLocked: boolean` to `RecommendationDetailSchema` and the mobile `RecommendationDetail`
  type. Reuses `resolveCandidateDailyAnswer` + `findAnswerForDate`; no new tables.

### i18n & guardrails

Add the new copy under a `dailyQuestion.*` namespace in `locales/en.json` (and other locales), in
Haven's warm voice. Non-goals: no infinite feed, no nagging notifications, no prominent streak
counter (a subtle "you've reflected N days" is the absolute most, only if it reads as gentle).

### Acceptance

Home shows both states with no text input; tapping opens the modal; the field is fully visible above
the keyboard (via W2.7); counter works; Share is gated; saving flips the home card to answered;
candidate answers are locked before answering and revealed after; no autosave timers remain;
`pnpm lint` and types pass.

---

## [x] W2.7 — Keyboard-safe inputs, app-wide  ·  mobile · P0 (test-blocking)

**Problem.** Inputs hide behind the keyboard. Root cause: text inputs render in plain scroll
containers that don't lift the focused field. The home `DailyQuestionCard` input sits in the home
scroll view with no keyboard avoidance (W2.6 removes that one, but the bug affects any input screen),
and `FormScreen` uses the minimal `KeyboardAvoidingView` (`behavior="padding"` on iOS, `undefined`
on Android, no offset), which still mis-sizes with a multiline field plus a sticky footer. Any text
entry in onboarding or the daily question can land under the keyboard — a hard blocker for the
usability test, so **P0**.

**Fix.** Adopt `react-native-keyboard-controller` (the current standard; works with a custom Expo
dev client, which this app already uses) and standardize every input screen on its
`KeyboardAwareScrollView`, which auto-scrolls the focused input above the keyboard on both platforms.

### Steps

1. **Install + config.** Add `react-native-keyboard-controller` (pin a version matching the project's
   Expo SDK — check `apps/mobile/package.json`). Add its Expo config plugin to `app.json` `plugins`.
   Set `expo.android.softwareKeyboardLayoutMode: "resize"` in `app.json` and verify the generated
   `AndroidManifest.xml` activity has `android:windowSoftInputMode="adjustResize"`.
2. **Provider.** Wrap the app root in `<KeyboardProvider>` in `app/_layout.tsx`, inside the
   theme/query providers and above the router stack.
3. **Standardize the scaffold.** In `components/ui/form-screen.tsx`, replace
   `KeyboardAvoidingView` + `ScrollView` with the library's `KeyboardAwareScrollView`
   (`bottomOffset={Spacing.xl}` so the focused field clears the sticky footer), keeping
   `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="interactive"`. Make the sticky
   footer rise with the keyboard using the library's `KeyboardStickyView` (or a translate driven by
   `useReanimatedKeyboardAnimation`) so the primary button stays reachable while typing.
4. **Audit other input screens.** `grep -rl "TextInput\|TextField" apps/mobile/app apps/mobile/components`
   (ignore `ios/`, `android/`, `node_modules`). Every screen with inputs outside `FormScreen`
   (profile edit, bio, settings) must use `KeyboardAwareScrollView` too. After W2.6 the home screen
   has no input — confirm nothing else is left in a plain `ScrollView`.
5. **Rebuild the dev client.** Native module — a JS reload is not enough. Rebuild via `pnpm ios` /
   `pnpm android` (with `pod install` / prebuild as the config plugin requires).

### Acceptance (test on a physical iOS **and** Android device)

Focusing any input (onboarding bio, auth, profile edit, the daily-question modal) scrolls it fully
above the keyboard with a small gap; the sticky button stays reachable; tap-outside and drag dismiss
the keyboard; no layout jump on open/close; verified with the multiline bio (tallest) field. Pull
this earlier if W2.4's on-device onboarding run hits the bug first.

## [~] W2.8 — Push notifications  ·  api/mobile · P2

Code, Android setup and APNs secrets are done. iOS still needs a rebuild and a device test.

Remote push for a new message, a new match and a fresh recommendations batch, plus one local daily
reminder. The Worker sends straight to FCM/APNs (`src/lib/push.ts`), with no relay service; details
are in `docs/FEATURES.md` → Notifications. iOS needs no Firebase SDK or `GoogleService-Info.plist`.

### iOS setup (todo)

Bundle id: `com.ulianapyrohovska.haven`.

**Account Holder / Admin** (needs access to Certificates, Identifiers & Profiles):
- [x] Enable push on the app id: https://developer.apple.com/account/resources/identifiers/list →
  `com.ulianapyrohovska.haven` → tick **Push Notifications** → **Save**. No certificates needed.
- [x] Create an APNs key: **Keys** → **+** → "Haven APNs" → tick **Apple Push Notifications service
  (APNs)** (**Sandbox & Production** if asked) → **Register** → download `AuthKey_XXXXXXXXXX.p8`.
  It can be downloaded only once.
- [x] Send privately: the `.p8` file, its **Key ID** (10 chars) and the **Team ID** (Membership
  details). Never through the repo.

**Then us:**
- [x] Store the key outside the repo, e.g. `~/haven-secrets/`.
- [x] Set the Worker secrets from `apps/api`:

  ```
  npx wrangler secret put APNS_PRIVATE_KEY < ~/haven-secrets/AuthKey_XXXXXXXXXX.p8
  npx wrangler secret put APNS_KEY_ID      # the Key ID
  npx wrangler secret put APNS_TEAM_ID     # the Team ID
  npx wrangler secret put APNS_BUNDLE_ID   # com.ulianapyrohovska.haven
  ```

  No sandbox flag: the API sends to production APNs and retries sandbox once on `BadDeviceToken`,
  so development and TestFlight/ad hoc builds both work.
- [ ] Rebuild so prebuild adds the `aps-environment` entitlement:
  `cd apps/mobile && pnpm prebuild && pnpm ios --device`, or `pnpm build:dev:ios` (let EAS update
  the provisioning profile).
- [ ] Test on a real iPhone against the deployed API. APNs needs HTTP/2, which may fail under local
  `wrangler dev`. Run `pnpm --filter api deploy:prod`, then `pnpm --filter haven-app dev:prod`.
  Allow notifications, keep `npx wrangler tail` open, close the app, and message it from a matched
  second account.

If nothing arrives: `BadDeviceToken` on both hosts means the token is dead;
`InvalidProviderToken` means a wrong Key ID, Team ID or `.p8`; `TopicDisallowed` means a wrong
`APNS_BUNDLE_ID`. Rejected sends are logged as `apns rejected` with the status and reason.

---

## [ ] W3.1 — Participant logistics  ·  ops · P0

**Accounts.** Better Auth needs a unique email + password ≥ 8. Pre-create participant accounts
(`P01…P15`) with throwaway institutional-style emails and known passwords via the sign-up API
(or a seed script), one fresh profile each — no real names/emails, satisfying pseudonymization.
Hand each participant their login. A fresh account per participant avoids mid-study resets.

**Reset (if reusing an account).** `scripts/participant-reset.ts <profileId>`: delete
interactions touching the profile, delete its recommendations and mood check-ins, and (for an
onboarding re-test) clear the profile fields back to pre-onboarding. Document the command.

**Compliance checklist (not code):** Neon in Frankfurt (done); consent recorded in MS Forms
before each session; a documented deletion path for a participant's data on request.

---

## [ ] W3.2 — Offline baseline evaluation  ·  research · P1  ·  ↔ E3

**File:** `research/eval/run.ts` (TypeScript, so it imports the *production*
`apps/api/src/lib/scoring.ts` — the thesis then reports the deployed engine, not a re-implementation).

Pull profiles + `user_embeddings` + `interactions` from Neon; compute `reciprocalScore` for the
relevant pairs; report, written to `research/results/baseline.json`:
- **Reciprocal hit@k** — for each user, do their actual mutual matches (`match = true`) land in
  their top-k.
- **Precision@k / recall@k** against the match labels.
- **Gini index** of candidate exposure (how often each profile appears across everyone's
  top-k) — the fairness number for §2.6.
- A **random-recommender baseline** to beat.

Run a small weight sweep over `DEFAULT_WEIGHTS` and record the best. These feed RQ1–RQ4.

---

## [ ] W3.3 — Pilot + freeze  ·  ops · P0

Dry-run the complete session with 1–2 people on the real device, fix the friction they hit,
then freeze — no new features after the pilot, only crash fixes.

## [ ] W3.4 — Instruments + moderator script  ·  ops · P1

SUS (10 items), UEQ-S (8 items) and SEQ set up as forms; the participant task list written; a
one-page moderator script so every session is run identically. (These were drafted earlier in
`06_Data_Collection_Instruments` — align them with the final flow.)

---

## Migrations summary

- **W1.5:** `display_name varchar(80)` on `user_profiles`.
- **W1.6:** new `crossings` table.
- **W2.8:** new `push_tokens` table (`0018`).
- Everything else uses existing tables (`user_embeddings` already defined with the HNSW index).

Run `pnpm db:generate && pnpm db:migrate` after the W1.5 / W1.6 schema edits.

## Suggested build order

W1.1 (parallel, 30 min) → W1.2 scoring + tests → W1.3 generator → W1.4 lazy trigger (feed goes
live) → W1.5 de-demo → W1.6 cross-paths boost → **M1**. Then W2.1 embeddings → W2.2 cosine →
W2.3 pool → W2.7 keyboard fix (test-blocking) → W2.4 device → W2.5 states → W2.6 daily question → **M2**. Then W3.1 accounts/reset → W3.2 eval → W3.3 pilot
→ W3.4 instruments → **M3**.
