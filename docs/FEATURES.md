# Haven — Features

This file lists every user-facing and staff-facing feature in Haven. For each one it says what the
feature does, how it works, where the code is, and its status. Update it in the same change as the
feature itself (see `CLAUDE.md`, Working rules).

Status: **live** (works end to end), **partial** (code is there, something is missing — see the
note), **planned** (not built yet).

Step-by-step implementation specs live in `docs/path-a-implementation.md`. This file is the
overview.

---

## Architecture overview

```
apps/mobile (Expo 54, Expo Router, react-query)      apps/backoffice (Vite + React)
        │  Better Auth session cookie via apiFetch            │  cookie (credentials: include), Vite proxy
        ▼                                                     ▼
apps/api — Cloudflare Worker (Hono + @hono/zod-openapi)  ── cron trigger (simulation tick)
        │  modules/<feature>/{routes,schemas,service,repository}.ts
        │  src/lib/* = pure domain logic (scoring, cadence, view shaping)
        ├──────────────► ChatRoom Durable Object (EU jurisdiction, one per conversation, sockets only)
        ▼
Neon Postgres (aws-eu-central-1, pgvector) via drizzle-orm/neon-http
```

- **API layering.** Each module has four files:
  - `routes.ts`: OpenAPI route definitions.
  - `schemas.ts`: zod request and response shapes, which are validated at the edge.
  - `service.ts`: the use case.
  - `repository.ts`: Drizzle queries only.

  Handlers stay thin. Rules that can be tested on their own live in `src/lib/` and have no
  database imports.
- **Database access.** The API uses the HTTP driver (`neon-http`), which has no interactive
  transactions. Writes that must happen together go through `db.batch([...])`.
- **Two ids.** The profile id (`user_profiles.id`, an int) is used for everything domain-related.
  The auth id (Better Auth `user.id`, text) is used only for sessions.
  `findViewerByUserId` converts the auth id into a profile.
- **Pools.** `looking_for` is 0 for friends and 1 for dating. Every candidate query filters by it,
  so the two pools never mix.
- **Mobile.** Server state goes through react-query and the typed clients in `lib/api/*`. All
  text lives in `locales/en.json`.
- **Realtime.** Chat sockets go to the `ChatRoom` Durable Object (`CHAT` binding), always created
  with `jurisdiction("eu")`. It holds no data: Neon stays the only store.
- **Synthetic vs real.** The `is_synthetic` flag marks the 2000 dataset profiles. They get a
  deterministic mood, daily answer, name and avatar so that every card looks complete.

---

## Mobile app (`apps/mobile`)

### Accounts and sign-in — live
Users sign up and log in with email and password.

**How it works:**
- Better Auth runs on the Worker at `/auth`, with the `emailAndPassword`, `admin`, `expo` and
  `openAPI` plugins. Its tables come from `modules/auth/auth-schema.ts`.
- On mobile, `createAuthClient` with `expoClient` stores the session in `expo-secure-store`.
- React Native has no cookie jar, so `lib/api/client.ts > apiFetch` reads the cookie with
  `authClient.getCookie()` and sets the `Cookie` header itself.
- A 401 response while a cookie exists triggers `signOutOnUnauthorized`, which signs out and
  resets navigation to the login screen.
- On the API, `getSessionUserId` resolves the session from the request headers.

**Where:**
- Screens: `app/(auth)/login.tsx`, `app/(auth)/register.tsx`
- Code: `lib/auth/`; API `src/lib/auth.ts`, `src/lib/session.ts`

### Email verification and password reset — partial
New users must confirm their email before they can sign in. Opening the link on the phone signs
them in. Users who forget their password can reset it by email.

**How it works:**
- Better Auth runs with `requireEmailVerification`, `sendOnSignUp`, `sendOnSignIn` and
  `autoSignInAfterVerification`. Sign-up returns no session. A sign-in by an unverified user fails
  with `EMAIL_NOT_VERIFIED` and sends a fresh link, so there is no separate resend endpoint.
- Emails go through the Cloudflare Email Sending Worker binding `EMAIL` (`send_email` in
  `wrangler.jsonc`), from the `EMAIL_FROM` var (`no-reply@pirogotter.dev`). No API key is involved.
  A failed send logs the binding's `E_*` code, never the link.
- Templates live in code (`src/lib/email-templates.ts`), not in the DB. They are pure functions
  that return `{ subject, html, text }`, and they HTML-escape the user's name. Keeping them in code
  makes them versioned and typed, and sending needs no DB read.
- **Verify link:** email clients need https links, so the email points to `GET /links/verify-email`
  (`modules/links`). That route redirects to `haven://verify-email?token=…` without using up the
  token. The app's `verify-email` screen then redeems it with `authClient.verifyEmail`. The
  response's session cookie is stored by the Expo client, so the user lands on home or onboarding
  already signed in. If the token is bad, the user goes to login with an error notice.
  The token is redeemed in the app rather than the browser because a browser session would never
  reach the app.
- **Password reset:** `forgot-password` calls `requestPasswordReset` with
  `redirectTo: haven://reset-password`. It shows the same message whether or not the account
  exists. The emailed link uses Better Auth's `/auth/reset-password/:token`, which redirects to
  `haven://reset-password?token=…` (or `?error=INVALID_TOKEN`). `reset-password` calls
  `resetPassword`. `revokeSessionsOnPasswordReset` signs out the user's other devices.
- Migration `0016_verify_existing_users` marks accounts created before this change as verified.
  `seed-demo-account.ts` verifies the demo account directly in the DB.

**Missing:** links only work on a phone with the app installed; on desktop the `haven://` redirect
does nothing. Not yet tested end to end on a device.

**Where:**
- Screens: `app/(auth)/login.tsx` (forgot-password link, create-account button),
  `register.tsx`, `verify-email.tsx`, `forgot-password.tsx`, `reset-password.tsx`
- Code: `lib/auth/client.ts` (`RESET_PASSWORD_REDIRECT_URL`), `lib/auth/errors.ts`; API
  `src/lib/auth.ts`, `src/lib/email-templates.ts`, `src/modules/links/index.ts`,
  `drizzle/0016_verify_existing_users.sql`

### Onboarding — live
A step-by-step profile setup:
1. Basics.
2. Bio.
3. Interests (17 Likert interests plus custom ones).
4. Partner preferences (6 dimensions).
5. Self-ratings (6 dimensions).
6. Location.
7. Privacy.

**How it works:**
- The step order comes from the `OnboardingSteps` array in `lib/onboarding/steps.ts`, which also
  drives the progress bar and next/back navigation. To add a step, add it to that array.
- Answers collect in a React context (`ProfileDraftContext` in `profile-draft.tsx`) and are saved
  once at the end with `PATCH /me`.
- On the server, `profile/service.ts > patchProfile` does three things:
  1. Takes the display name from the first word of the Better Auth name.
  2. Cleans up and de-duplicates custom interests, and checks them against a blocked-words list
     (`src/lib/custom-interests.ts`).
  3. Calls `maybeGenerateOnProfileComplete` when the profile has just become complete, so the
     first recommendation batch is ready right away.

**Where:**
- Screens: `app/(onboarding)/*`
- API: `GET/PATCH/DELETE /me`, `GET/POST /interests/custom`

### Profile and settings — live
Users can view and edit their profile, including a preview of how others see it. Settings cover:
- **Visibility:** discoverable, show age, career, bio and interests.
- **Location:** approximate only; it can be hidden.
- **Appearance:** system, light or dark theme.

**How it works:**
- **Privacy flags** are columns on `user_profiles`.
  - What other users see goes through one function on the server,
    `profile-view.ts > publicProfileFields(viewer, candidate)`, which removes any hidden field.
  - Setting `discoverable = false` removes the profile from new recommendation pools.
- **Location:**
  - The phone reads a low-accuracy position (`expo-location`, `Accuracy.Low`) and turns it into a
    place label.
  - Exact coordinates are only used on the server, for distance. Other users get
    `candidateLocationLabel`: the user's own display location, "Setúbal, Portugal" under 5 km, or
    "N km away". They get nothing if `shareLocation` is off.
- **Photo:** resized on the device to at most 512 px (`expo-image-manipulator`) and stored on the
  Better Auth `user.image`. When there is no photo, the API serves a deterministic portrait from a
  hash of the profile id (`src/lib/avatar-url.ts`).
- **Theme:** a device-only preference (`lib/theme/preference.tsx`).
- **Delete account:** `DELETE /me` removes the profile and the auth user. Sessions and accounts are
  removed with it.

**Where:**
- Screens: `app/(profile)/profile/*`
- Code: `components/profile/`, `lib/profile/` (privacy, location, photo, display)

### Recommendations feed ("connections") — live
An exposure-limited **daily drop**: a small batch of 4 candidates. A new batch comes only after
the current one is fully acted on **and** the cooldown has passed. When you're caught up, the
screen shows when the next batch arrives.

Each candidate has a detail screen with:
- shared interests,
- approximate distance or area,
- mood,
- their daily-question answer,
- a "crossed paths" card.

Accept or decline plays a decision animation.

**How it works:**
- **Lazy generation.** `GET /recommendations` calls `service.ensureBatch`. It generates a new batch
  only when all of these hold:
  - nothing is pending,
  - `isProfileComplete` passes,
  - `isCooldownElapsed` passes.

  The cooldown is counted from `max(recommendations.shown_at)`, so no extra column is needed.
  `REC_COOLDOWN_HOURS` overrides the default 24 h for study sessions.
- **Caught-up state.** The response then includes `nextRefreshAt`.
- **Decisions.** `POST /recommendations/{id}/decision` calls `recordDecision`, which upserts one
  `interactions` row per pair:
  - the first person to act becomes `user_a`,
  - the reply fills `dec_b`,
  - `match` is true when both sides accepted.

  The recommendation is then marked `acted_on`.
- **Audit log.** Acted-on recommendations are never deleted. They are the record used for the
  exposure and fairness metrics.
- **Synthetic candidates.** Their mood and daily answer are generated deterministically from
  `hash(profileId, date)` (`candidate-mood.ts`, `candidate-daily-answer.ts`), so they stay
  consistent within a day.

**Where:**
- Screens: `app/connections/index.tsx`, `app/connections/[candidateId].tsx`
- Code: `components/connections/`, `lib/api/recommendations.ts`
- API: `GET /recommendations`, `GET /recommendations/{candidateId}`,
  `POST /recommendations/{candidateId}/decision`, `POST /recommendations/regenerate` (study reset)

### Matches — live
A match is two people who both accepted each other. The Matches screen is an inbox: one row per
match with photo, name, last message preview, time and unread count, most recent activity first.
The home dock's messages button shows the total unread count across matches (summed from the same
`GET /matches` query, hidden at 0, capped at "99+"). Chat sockets are per-conversation, so home
refetches that query on focus and polls it every 30 s while focused.
Opening a match from the chat header shows their profile in **match mode**:
- the accept/decline dock is replaced by a "Send message" button,
- a **Why you matched** card shows compatibility %, the matched date, up to five reasons and the
  shared interests,
- report and block stay. Either one ends the match and returns to the inbox.

The chat header also has report and block buttons. They work for every peer, including synthetic
(demo) profiles. Either one ends the match and returns to the inbox.

**How it works:**
- `GET /matches` reads `interactions` rows with `match = true` on either side. Interactions are
  undirected pairs, so a match exists exactly once. Each row also gets `lastMessage`,
  `unreadCount` and `lastActivityAt` from `listInboxStats` (one `DISTINCT ON` and one grouped
  count over `messages`).
- `GET /recommendations/{candidateId}` adds `match: { matchedAt, compatibility, reasons }` when the
  pair is matched. `describeMatch` reloads both scoring profiles and calls `scoreBreakdown`
  (`scoring.ts`, pure). That function splits `reciprocalScore` into interest, geo, bio and the two
  directed preference terms. `matchReasons` (`src/lib/match-reasons.ts`) turns the components into
  slugs with fixed thresholds:
  - `sharedInterests`: at least one shared active interest, or interest ≥ 0.75,
  - `theirType`: they fit your preferences (pref u→v ≥ 0.8),
  - `yourType`: you fit theirs (pref v→u ≥ 0.8),
  - `nearby`: geo ≥ 0.6, **only** if the candidate shares location,
  - `crossedPaths`: count > 0, already gated by `shouldShowCrossPaths`,
  - `compatible`: the fallback, so the list is never empty.
- `matchedAt` is the interaction's `created_at` (the first like). There is no separate matched-at
  column.

**Where:**
- Screens: `app/matches/index.tsx`, `app/connections/[candidateId].tsx` (match mode in
  `components/connections/connection-candidate-screen.tsx`, `why-matched-card.tsx`)
- Code: `components/chat/conversation-row.tsx`, `lib/api/recommendations.ts`
- API: `GET /matches`, `GET /recommendations/{candidateId}`

### Chat — live
Matched users message each other in real time, with a typing indicator. A synthetic match sends
one opener and then shows a "demo profile, can't reply" notice.

**How it works:**
- **Storage.** `messages` (`interaction_id`, `sender_id`, `body`, `created_at`, `read_at`). The
  conversation is the matched interaction. Every chat endpoint resolves the pair with
  `findInteractionBetween` and returns 403 `NOT_MATCHED` unless `match = true`. Messages are kept
  after a block, so staff can review them for a report.
- **Sending.** `POST /matches/{candidateId}/messages` trims the body (1–1000 chars,
  `normalizeMessageBody`), inserts it into Neon, then calls `ChatRoom.broadcast` over RPC. A failed
  broadcast is logged and does not fail the send. Clients catch up on reconnect.
- **Realtime.** `GET /matches/{candidateId}/ws` checks the session and the match, then forwards the
  upgrade to `env.CHAT.jurisdiction("eu").idFromName(interactionId)`. The Worker sets the
  `X-Haven-Profile-Id` header server-side and overrides any value the client sent.
  `ChatRoom` (`src/chat-room.ts`) uses hibernatable WebSockets:
  - it pushes `{ type: "message" }` frames,
  - it relays `{ type: "typing" }` pings to the other participant only,
  - it never touches the database.
- **Ending.** Block and report call `ChatRoom.close()`, which closes sockets with code 4003. The
  client does not reconnect after that code.
- **Reading.** `GET /matches/{candidateId}/messages?before=<id>` returns 50 messages per page,
  newest first. `POST /matches/{candidateId}/read` sets `read_at` on the other side's messages.
- **Synthetic opener.** The first time a synthetic match is listed or opened with no messages, it
  inserts `syntheticOpener(sharedInterests, interactionId)` (`src/lib/chat.ts`, deterministic).
  This is a check-then-insert, so two concurrent first opens could double-post (marked as a
  shortcut).
- **Mobile.** `useChatSocket` (`lib/chat/use-chat-socket.ts`) opens the RN WebSocket with the
  Better Auth cookie in a header (RN has no cookie jar). It reconnects with backoff (1 s → 30 s)
  and when the app comes back to the foreground. New messages are written into the react-query
  cache. Sends are optimistic: a temporary negative id is replaced by the server row, and on
  failure the draft is restored.

**Where:**
- Screens: `app/matches/[candidateId].tsx`
- Code: `components/chat/`, `lib/api/chat.ts`, `lib/chat/`
- API: `modules/chat/`, `src/chat-room.ts`, `src/lib/chat.ts`

**Missing:** push notifications for new messages (D5), attachments, edit/delete, read receipts shown
to the sender, unmatch without blocking.

### Daily question — live
One question per day, the same for everyone. You answer once per day, and your answer can appear
on your card for other users.

**How it works:**
- The question is `DAILY_QUESTIONS[dayOfYearUtc(date) % n]`, so it is the same for everyone with
  no database lookup.
- Answers go in `daily_question_answers`, with a unique index on `(user_profile_id, answer_date)`.
- `PUT` upserts the answer, so editing on the same day overwrites it.
- Dates always come from `utcToday()`.

**Where:**
- Screens: `app/daily-question.tsx`, `components/home/daily-question-card.tsx`
- API: `GET/PUT /daily-question/today`; code `src/lib/daily-questions.ts`

### Mood check-in — live
One mood per day, shown as context on candidate cards.

**How it works:**
- Moods are stored as smallint codes in `mood_checkins`, one per user per day (unique index), and
  upserted. `src/lib/mood.ts` maps codes to slugs.
- A real candidate shows only today's check-in, or nothing if there isn't one. A synthetic
  candidate gets a deterministic mood.

**Where:**
- Code: `components/home/mood-card.tsx`, `lib/mood/`
- API: `GET/PUT /mood/today`

### Safety: block and report — live
- **Block:** hides two users from each other.
- **Report:** flags a user, with a reason (inappropriate photo, harassment, spam or fake, underage,
  other). Reporting also blocks.

**How it works:**
- `blockPair` runs one `db.batch` that does two things:
  1. Sets the blocker's decision to 0 (and `match = false`), or inserts a rejecting interaction if
     there was none. Because the pool excludes any pair with an interaction, the two never
     reappear for each other.
  2. Deletes any pending recommendations between them.
- Reports are stored in `reports`. `reporter_id` is set to null if the reporter deletes their
  account, so the report stays available to staff.

**Where:** API `POST /users/{candidateId}/block`, `POST /users/{candidateId}/report`. Mobile
`components/connections/safety-dialogs.tsx`, used by the candidate/match profile screen and the chat
thread `app/matches/[candidateId].tsx`.

### Match notifications — planned
Push notification on a new match (BACKLOG D5).

---

## Matching engine (`apps/api`)

### Compatibility scoring — live
Scores how well two profiles fit each other.

**How it works:**
- **One-way score.** `unilateral(u→v)` is a weighted sum, clamped to [0, 1]. The weights are
  `DEFAULT_WEIGHTS = { bio: 0.35, interest: 0.3, geo: 0.2, pref: 0.15 }`:
  - **interest:** cosine over the 17 interests plus one extra dimension per custom interest.
  - **pref:** cosine between u's preferences and v's self-ratings. This is the only term where
    u→v differs from v→u.
  - **geo:** `exp(−km / 25)`, or 0.5 when coordinates are missing.
  - **bio:** cosine of the bio embeddings. When either side has no embedding, this term is dropped
    and the other weights are rescaled to sum to 1.
- **Missing data** counts as neutral: interests default to 5 and preferences to the midpoint.
- **Two-way score.** `reciprocalScore` is the harmonic mean `2pq / (p + q)`, so a one-sided fit
  scores low.
- The code is pure (no database imports) so the offline evaluation can reuse it.

**Where:** `src/lib/scoring.ts` (+ tests)

### Recommendation generator — live
Builds one batch of recommendations for a viewer.

**How it works:**
- `generateRecommendations(db, viewerId, opts)`:
  1. Loads the viewer's scoring profile.
  2. Loads the candidate pool (`listCandidatePool`). Candidates must:
     - not be the viewer,
     - be discoverable,
     - be in the same `looking_for` pool,
     - have no interaction with the viewer in either direction,
     - be inside an optional bounding box.
  3. Scores and ranks the pool with `rankCandidates`.
  4. Writes the top k with `replaceRecommendations`. This deletes the pending rows and upserts on
     `(user_id, candidate_id)` in one batch.
- The pool is capped at 500. When the viewer has a bio embedding, an HNSW `bio <=> viewer`
  shortlist of 200 runs before exact rescoring.
- Options: `k`, `maxKm`, `weights`, `crossPathsLambda`, `syntheticOnly`.

**Where:** `src/modules/recommendations/generator.ts`, `repository.ts`,
`src/lib/recommendation-cadence.ts`

### "You've crossed paths" boost — partial
A small extra score for people you have crossed paths with. The data is simulated (seeded), not
tracked.

**How it works:**
- The `crossings` table stores each pair once (`user_a < user_b`), with a count, last place and
  last time.
- After the two-way score, the boost is applied:
  `score × (1 + λ · (1 − e^(−count / K)))`, with `λ = 0.2` and `K = 3`.
- The boost counts only when both users have `shareCrossPaths` on (`shouldShowCrossPaths`).
- Setting `λ = 0` reproduces the plain ranking, which is the thesis ablation.

**Where:** `applyCrossPathsBoost` in `scoring.ts`, `listCrossings` in the repository,
`scripts/seed-crossings.ts`

**Missing:** `pnpm db:migrate`, `pnpm db:seed-crossings`, and an on-device check.

### Bio embeddings — planned
Bio embeddings will be computed locally with `all-MiniLM-L6-v2` (the data stays in the EU) and
stored in `user_embeddings.bio`, a pgvector column with an HNSW index. Once they exist, the bio
term turns on automatically (W2.1, W2.2).

### Simulation engine and synthetic agents — partial
The 2000 synthetic profiles act as agents. On each tick they:
1. reply to likes they have received,
2. get new batches and decide on them (accepting more often when their own score is higher),
3. leave every real user with their daily drop when it is due.

Real users can therefore match synthetic profiles.

**How it works:**
- **Decision rule** (`src/lib/agent-decision.ts`, pure). An agent accepts with probability
  `σ((unilateral(agent→other) − 0.55) / 0.08)`. The random draw is seeded by
  `tickId:agentId:otherId`, so a tick is reproducible.
- **`runTick`** (`modules/simulation/engine.ts`):
  1. **Replies.** Agents answer `dec_b IS NULL` likes, but only likes that came from an acted-on
     recommendation, so historical dataset rows are left alone.
  2. **Acting.** About 50 random agents get a batch with `syntheticOnly: true` and decide on it.
     Agents only see other agents. Otherwise an agent liking a real user first would remove itself
     from that user's pool for good.
  3. **Real users.** `ensureBatch` runs for every real user.
- **Shared code.** `recordDecision` is the same write the mobile decision endpoint uses.
- **Limits.** A tick is a bounded sample of about 20 Neon requests per agent, which keeps it
  inside the Worker's request budget.

**Where:**
- Triggers: Worker cron `*/30 * * * *` (runs only when `SIMULATION_ENABLED="true"` in
  `wrangler.jsonc`), and `POST /staff/simulation/tick`.

**Missing:** a tick run against the dev DB, and an on-device check of an agent replying to a real
user.

---

## Backoffice (`apps/backoffice`)

### Staff login and access control — live
Only staff accounts with the admin role can open the backoffice.

**How it works:**
- Login uses the same Better Auth instance, with the cookie sent via `credentials: "include"`.
  The Vite dev proxy forwards `/auth` and `/staff` to the Worker.
- In the browser, `RequireStaff` guards the routes.
- On the server, every `/staff/*` service calls `requireStaffAdmin`, which checks `role === "admin"`.

**Where:** page `LoginPage`

### User management — live
Staff can:
- search and list profiles,
- view the full record,
- edit profile and account fields,
- delete a user.

**How it works:**
- Search, edit and delete go through `modules/staff`. Search runs `ilike` on display name, email
  and auth id, and also matches a profile id typed as a number.
- An edit can change profile columns and the Better Auth name and email.

**Where:** pages `UsersPage`, `UserDetailPage`; API `/staff/users`, `/staff/users/{profileId}`

### Staff accounts — live
List and create staff admins.

**How it works:** uses the Better Auth `admin` plugin client (`authClient.admin.listUsers` /
`createUser`) directly. No custom endpoint is involved.

**Where:** page `StaffPage`

### Interaction graph — partial
A force-directed graph of one pool:
- real users and agents in different colours,
- a line for a match, an arrow for a one-way like.

Hover or click a node to focus its neighbourhood. You can filter by pool, edge type and time
window. A "Run tick" button runs the simulation and shows the tick's stats.

**How it works:**
- `GET /staff/graph` returns at most `limit` interactions (newest first), filtered by:
  - pool (`looking_for` on `user_a`),
  - edge type (`match`, `like` or `all`),
  - `since`.

  Nodes are the endpoints of those edges, with their degree computed on the server. Only ids and
  display names are returned, never coordinates.
- The page renders with `react-force-graph-2d` on a canvas:
  - links are faint by default,
  - the focused node's neighbours are highlighted,
  - repulsion is stronger than the default so the nodes spread out,
  - colours come from theme CSS variables.
- Historical dataset interactions keep their seed `created_at`, so `since` separates simulated
  activity from historical activity.

**Where:** page `GraphPage` (`/graph`)

**Missing:** a check against the dev DB, and clustering if the full view is still too dense.

---

## Platform and data

- **Legal pages — live.** `GET /privacy` and `GET /support` serve static HTML from the Worker
  (`src/modules/legal/`).
- **Seed scripts — live.**
  - `pnpm db:seed` loads the synthetic dataset from CSV: 2000 users and their historical
    interactions and friendships, inserted in batches of 500.
  - `db:seed-demo` creates the demo account.
  - `db:seed-crossings` seeds the crossed-paths data.
- **Schema changes.** Edit `src/db/schema.ts`, then run `pnpm db:generate` and `pnpm db:migrate`.
  Never hand-edit an applied migration.
- **Data residency.** The Neon database is in `aws-eu-central-1`. Embeddings are computed locally.
  No personal data leaves the EU.
