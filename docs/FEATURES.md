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
        │  Better Auth session cookie via apiFetch            │  cookie (credentials: include); Vite proxy in dev,
        │                                                     │  CORS from admin.pirogotter.dev when deployed
        ▼                                                     ▼
apps/api — Cloudflare Worker (Hono + @hono/zod-openapi)  ── cron trigger (simulation tick)
        │  modules/<feature>/{routes,schemas,service,repository}.ts
        │  src/lib/* = pure domain logic (scoring, cadence, view shaping)
        ├──────────────► ChatRoom Durable Object (EU jurisdiction, one per conversation, sockets only)
        ▼
Neon Postgres (aws-eu-central-1, pgvector) via drizzle-orm/neon-http
```

- **Hosting.** The API Worker serves `haven.pirogotter.dev` (custom domain in `apps/api/wrangler.jsonc`;
  the old `haven-api.haven-app.workers.dev` URL stays live for older builds). The backoffice is a
  separate static-assets Worker (`apps/backoffice/wrangler.jsonc`, SPA fallback) on
  `admin.pirogotter.dev`, built with `VITE_API_URL` pointing at the API. Both hosts share the site
  `pirogotter.dev`, so the `SameSite=Lax` session cookie travels on credentialed requests; the API allows
  that one origin through Hono `cors` and Better Auth `trustedOrigins` (`BACKOFFICE_ORIGIN` in `lib/auth.ts`).
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
  so the two pools never mix. The mobile app turns the same flag into two visual modes (teal friends,
  rose dating) by merging a per-mode accent palette in `useTheme`; see "App modes".
- **Mobile.** Server state goes through react-query and the typed clients in `lib/api/*`. All
  text lives in `locales/en.json`.
- **Realtime.** Chat sockets go to the `ChatRoom` Durable Object (`CHAT` binding), always created
  with `jurisdiction("eu")`. It holds no data: Neon stays the only store.
- **Push.** The Worker sends straight to FCM/APNs (`src/lib/push.ts`), with generic copy only.
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
4. Partner step: "Show me" and age-range filters (see Partner filters), then the 6 preference dimensions.
5. Self-ratings (6 dimensions).
6. Location.
7. Profile photo (optional, "Skip for now" continues without one).
8. Privacy.

**How it works:**
- The step order comes from the `OnboardingSteps` array in `lib/onboarding/steps.ts`, which also
  drives the progress bar and next/back navigation. To add a step, add it to that array.
- Answers collect in a React context (`ProfileDraftContext` in `profile-draft.tsx`) and are saved
  once at the end with `PATCH /me`.
- The photo step reuses `lib/profile/photo.ts` (`pickProfilePhotoDataUrl`: square crop, 512 px JPEG)
  and keeps the data URL in `draft.photo`, so nothing is uploaded mid-flow. The privacy step's
  preview shows it, and on Finish `saveProfilePhoto` writes it to Better Auth `user.image` before
  `PATCH /me`. Skipping leaves `user.image` empty, so the API's generated portrait is used.
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
    `candidateLocationLabel`: the user's city-level display location, or a coarse distance
    (`coarseDistanceLabel`: "Less than 1 km away", whole km up to 10, then 5 km steps). They get
    nothing if `shareLocation` is off.
- **Photo:** resized on the device to at most 512 px (`expo-image-manipulator`) and stored on the
  Better Auth `user.image`. When there is no photo, the API serves a deterministic portrait from a
  hash of the profile id (`src/lib/avatar-url.ts`), drawn from a gender-matched pool (gender 1 →
  male pool, otherwise female pool) of hand-checked Unsplash slugs. If an image fails to load, the
  mobile app shows a placeholder: initials in `UserAvatar`, a person icon on the candidate card.
- **Theme:** a device-only preference (`lib/theme/preference.tsx`).
- **Public preview:** `components/profile/profile-public-preview.tsx` mirrors the candidate screen
  layout (4:5 photo with name and "age · career", mood badge, today's question and answer, about,
  interests). Fields come from `lib/profile/privacy.ts > publicProfilePreview`, so hidden fields
  are left out; mood and answer come from the `GET /mood/today` and `GET /daily-question/today`
  queries.
- **Delete account:** `DELETE /me` removes the profile and the auth user. Sessions and accounts are
  removed with it.

**Where:**
- Screens: `app/(profile)/profile/*`
- Code: `components/profile/`, `lib/profile/` (privacy, location, photo, display)

### App modes: friends and dating — live
Friends and dating feel like two separate apps. Each mode has its own colors, icons and wording, and
users switch between them from Home.
- **Friends:** teal accent, people icon, "Say hi" (hand icon) to accept, "New friend!" on a match,
  inbox titled "Friends".
- **Dating:** rose accent, heart icon, "Like" (heart icon) to accept, "It's a match!" on a match,
  inbox titled "Matches".
- Candidate photos and the own profile preview carry a "Here for friends / dating" ribbon.

**How it works:**
- **Mode source:** `hooks/use-mode.ts > useMode()` reads `lookingFor` from the cached profile query
  (cache-only observer, it never fetches). It is null before onboarding and after sign-out, which
  clears the query cache, so auth and onboarding keep the honey brand palette.
- **Palette:** `constants/app-config.ts > ModeAccents` overrides only the accent keys (`tint`,
  `surface`, `field`, `border`, `accentSoft`, …) per mode and scheme. `useTheme()` and
  `useThemeColor()` merge them over `Colors[scheme]`, so every screen recolors without changes.
  Tints keep ≥ 4.5:1 contrast against `onTint`.
- **Switching:** `components/home/mode-switch.tsx` (segmented Friends | Dating control under the
  Home header) asks for confirmation, then sends `PATCH /me` with the new `lookingFor`. If the
  stored `goal` belongs to the other mode it also sends `goal: null`, because the API rejects a
  mismatched pair. On success it writes the returned profile into the cache and invalidates
  recommendations and matches, so the new pool loads.
- **Copy:** per-mode strings use i18next context (`t(key, { context: mode })` →
  `key_friends`/`key_dating`, falling back to the plain key). `components/ui/mode-badge.tsx` holds
  the ribbon and the per-mode icon map.

**Where:**
- Code: `hooks/use-mode.ts`, `hooks/use-theme.ts`, `components/home/mode-switch.tsx`,
  `components/ui/mode-badge.tsx`, `components/connections/{connection-dock,connection-candidate-screen,new-match-dialog}.tsx`
- Backoffice: `components/ModeBadge.tsx` on `UsersPage` and `UserDetailPage`

**Missing:** matches made in the other mode stay in the inbox (not filtered by mode); one profile
per user, so bio and interests are shared across modes.

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

**Regenerate.** While the user hasn't accepted or declined anyone in the current batch (for example
right after changing filters), a "Show me different people" button swaps the batch for a fresh one.
It shows on the candidate screen and on the empty / caught-up screen, and disappears after the first
decision.

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
- **Regenerate.** `POST /recommendations/regenerate` calls `service.regenerate`. It refuses with
  409 `REGENERATE_NOT_ALLOWED` when `hasDecidedInCurrentBatch` finds a viewer decision in the current
  batch: rows at the latest `shown_at` (ms precision) that are acted on and have a matching
  `interactions` decision by the viewer. Rows retired by `dismissPendingFilterMisfits` are acted on but
  have no decision, so they don't block it. The new batch goes through the normal generator (current
  filters, same `lookingFor` pool, same batch size) but reuses the old batch's `shown_at`, so the
  cooldown doesn't move. `GET /recommendations` returns `canRegenerate` for the UI. Not capped: an
  untouched batch can be regenerated repeatedly, and the replaced pending rows are deleted.
- **Audit log.** Acted-on recommendations are never deleted. They are the record used for the
  exposure and fairness metrics.
- **Synthetic candidates.** Their mood and daily answer are generated deterministically from
  `hash(profileId, date)` (`candidate-mood.ts`, `candidate-daily-answer.ts`), so they stay
  consistent within a day.

**Where:**
- Screens: `app/connections/index.tsx`, `app/connections/[candidateId].tsx`
- Code: `components/connections/`, `lib/api/recommendations.ts`
- API: `GET /recommendations`, `GET /recommendations/{candidateId}`,
  `POST /recommendations/{candidateId}/decision`, `POST /recommendations/regenerate` (user regenerate, guarded)

### Matches — live
A match is two people who both accepted each other. The Matches screen is an inbox: one row per
match with photo, name, approximate location (city-level area or coarse distance, hidden when they
turned off `shareLocation`), last message preview, time and unread count, most recent activity first.
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

**New-match popup.** Agents answer likes on the simulation tick, so most matches appear while the
user is away. When Home or Matches loads a match the user hasn't seen yet, a "You have a new match!"
celebration opens for the newest one, with **Send a message** (opens the chat) and **Later**. Closing it
marks every current match as seen. When the user liked first and the other person likes back later,
the celebration opens right away on whichever of Home or Matches is open (otherwise on the next visit).
When the user's own like completes the match, the connection screen celebrates it on the spot, and that
match is not announced a second time.

**How it works:**
- `GET /matches` reads `interactions` rows with `match = true` on either side. Interactions are
  undirected pairs, so a match exists exactly once. Each row also gets `lastMessage`,
  `unreadCount` and `lastActivityAt` from `listInboxStats` (one `DISTINCT ON` and one grouped
  count over `messages`). `locationLabel` comes from `candidateLocationLabel`, the same helper the
  connection screen uses; coordinates and exact distances are never returned.
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
- The popup (`NewMatchDialog`) compares `GET /matches` with the match ids already seen, which are
  stored in SecureStore (`haven.seenMatchIds`). The seen list is per device, not per account, and
  SecureStore can't reliably hold more than about 2 KB (about 350 ids).
- The seen set lives in the react-query cache (`["seenMatchIds"]`), so every mounted dialog shares it;
  `markMatchesSeen` updates the cache and SecureStore together. The dialog only shows on the focused
  screen, so Home underneath Matches never opens a second copy.
- Instant delivery: the API pushes `{ type: "match" }` to the user who liked first
  (`recommendations/service.ts`, simulation `engine.ts`). In the foreground, `useNotifications`
  (`lib/notifications/index.ts`, mounted on Home, which stays mounted under Matches) listens with
  `addNotificationReceivedListener` and invalidates `["matches"]`. As a fallback (push denied or
  late), Home and Matches poll `GET /matches` every 30 s while focused.
- `MatchCelebration` (`components/connections/match-celebration.tsx`) is the animated modal: the
  avatar springs in, a ring and a burst of mode icons (heart for dating, people for friends) fly out,
  a mode badge pops onto the avatar, then the copy rises in, with a success haptic. Reanimated's
  `useReducedMotion` skips straight to the final frame.

**Where:**
- Screens: `app/matches/index.tsx`, `app/connections/[candidateId].tsx` (match mode in
  `components/connections/connection-candidate-screen.tsx`, `why-matched-card.tsx`)
- Code: `components/chat/conversation-row.tsx`, `components/connections/new-match-dialog.tsx`,
  `components/connections/match-celebration.tsx`,
  `lib/api/recommendations.ts`
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

**Missing:** attachments, edit/delete, read receipts shown
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
- Today's answer also feeds the `dailyAnswer` term of compatibility scoring (see Compatibility scoring).
- **Matches' answers.** After answering, "See today's answers" on the home card opens
  `app/daily-answers.tsx`, which lists what the user's matches answered today (tap a row to open the
  match). `GET /matches/answers/today` (`getMatchAnswersToday` in `recommendations/service.ts`) walks
  `listMatchInteractions`, keeps only matches in the viewer's current `lookingFor` pool, and resolves
  each answer with `resolveCandidateDailyAnswer` (synthetic matches get `syntheticDailyAnswer`). Only
  matches who answered are returned, with id, display name, photo and answer; never other users. Until
  the viewer answers today the response is `locked` with no answers, and the screen offers the answer
  modal. Saving an answer invalidates this query. It does not depend on recommendations, so it works
  when none are left; an empty list shows an empty state.

**Where:**
- Screens: `app/daily-question.tsx`, `app/daily-answers.tsx`, `components/home/daily-question-card.tsx`
- API: `GET/PUT /daily-question/today`, `GET /matches/answers/today`; code `src/lib/daily-questions.ts`

### Mood check-in — live
One mood per day, shown as context on candidate cards.

**How it works:**
- Moods are stored as smallint codes in `mood_checkins`, one per user per day (unique index), and
  upserted. `src/lib/mood.ts` maps codes to slugs.
- A real candidate shows only today's check-in, or nothing if there isn't one. A synthetic
  candidate gets a deterministic mood.
- Today's check-in also feeds the `mood` term of compatibility scoring (see Compatibility scoring).
- Both home cards (mood and daily question) have an info icon (`components/ui/info-button.tsx`, a
  `Dialog`) that explains in plain words why the data is collected and how it shapes recommendations.

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

### Notifications — partial
Remote push for a new chat message, a new match and a fresh recommendations batch, plus one local
reminder for the daily question and mood check-in.

**How it works:**
- **Delivery.** The Worker calls Google FCM (Android) and Apple APNs (iOS) directly; no relay such as
  Expo Push sits in between. `src/lib/push.ts` signs the provider tokens with WebCrypto (RS256
  service-account JWT exchanged for a Google OAuth token; ES256 APNs provider JWT) and caches them
  per isolate. With the secrets unset, `sendPush` returns `skipped`, so local dev runs without push.
- **Privacy.** Copy is generic ("One of your matches wrote to you"): no names, message text or
  location, because the payload passes through Google/Apple. The data only carries `type` and the
  sender's profile id `candidateId`, for routing the tap. On APNs the data sits under `body`,
  the only key expo-notifications reads on iOS.
- **Tokens.** `push_tokens` (unique `token`, `user_profile_id` cascade) stores the native device
  token. `PUT /push-token` upserts, so a device that signs into another account moves to it.
  `DELETE /push-token` runs on sign-out. Tokens that FCM/APNs report dead (404/410, invalid
  token) are pruned after a send. An APNs `BadDeviceToken` from production is first retried once on
  sandbox, because Xcode dev-client builds get sandbox tokens and
  ad-hoc/TestFlight builds get production ones, while one Worker serves both. Every APNs rejection
  is logged as `apns rejected` (status, reason, last 6 token chars), visible in `wrangler tail`.
- **Triggers.** `notify(env, db, profileId, notice)` (`modules/notifications/service.ts`) is best
  effort and never throws. Request paths run it in `waitUntil`:
  - `postMessage` notifies the other side of the conversation.
  - `postDecision` notifies the candidate when the viewer's accept creates a match.
  - `runTick` (cron and staff tick) notifies a real liker when an agent accepts them back, and a
    real user when their daily batch was generated.
- **Mobile.** `useNotifications()` (`lib/notifications/index.ts`) is mounted on home. It asks for
  permission once, registers `getDevicePushTokenAsync()`, follows token refreshes, and routes taps:
  message to `/matches/{id}`, match to `/connections/{id}`, recommendations to `/connections`,
  reminder to `/daily-question`. The reminder is a single local notification at 19:00, today if the
  question or mood is still open, else tomorrow. It is re-planned on each home visit, so someone who
  stays away gets one nudge, not a daily stream.

**Where:**
- API: `src/lib/push.ts`, `modules/notifications/`, hooks in `modules/chat/service.ts`,
  `modules/recommendations/service.ts`, `modules/simulation/engine.ts`
- Mobile: `lib/notifications/index.ts`, `lib/api/notifications.ts`, `app.json` (`expo-notifications`
  plugin, `googleServicesFile`)

**Setup:** Worker secrets `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` (Firebase service
account), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (.p8), `APNS_BUNDLE_ID`. No
sandbox flag: production APNs is tried first, sandbox only after `BadDeviceToken`. Mobile needs `apps/mobile/google-services.json` from the
Firebase project, then a native rebuild.

**Missing:** an iOS device test (secrets are set; remaining steps in `docs/path-a-implementation.md` W2.8), an in-app on/off switch per kind (the OS setting is the only control), no push while
the recipient is already in that chat, the in-app match modal (BACKLOG D5), and no APNs check
under local `wrangler dev` (APNs needs HTTP/2, which deployed Workers use).

---

## Matching engine (`apps/api`)

### Partner filters — live
Users pick who they want to meet: a "Show me" multi-select (women, men, non-binary people) and an
age range. These are hard filters, unlike the 6 preference sliders, which only rank people.

**How it works:**
- Columns on `user_profiles`: `interested_in smallint[]` (same codes as `gender`: 0 woman,
  1 man, 2 non-binary), `pref_age_min`, `pref_age_max` (migration `0017`). Null means no filter.
- Filters are mutual. `poolConditions` in `recommendations/repository.ts` adds SQL so a candidate
  must fit the viewer's filters and the viewer must fit the candidate's. Age is checked against
  `birth_date` through a date window from `birthDateWindow`, computed in TS so the SQL is
  deterministic.
- `src/lib/partner-filters.ts > mutualFilterMatch` is the pure version of the same rule, covered
  by `partner-filters.test.ts`.
- Missing data passes: a candidate with no gender or birth date is not hidden. This follows the
  same "missing is neutral" rule as scoring.
- The app stores "every gender" and the full 18–99+ span as null, so they mean the same as no
  filter. The top of the age slider means "and older".
- Onboarding starts the age range at the user's own age ±5. After that, users change filters
  with the filter icon inside the New connections card on home (highlighted when a filter is
  active). It opens the `filters` modal, which saves with `PATCH /me`.
- The daily limit is kept. When a filter field (or gender or birth date) changes,
  `patchProfile` calls `dismissPendingFilterMisfits`. This marks pending recommendations that
  no longer pass the mutual filters as acted on, in both directions, without generating new
  ones. The rows are kept, not deleted, so `shown_at` still drives the cooldown and the batch
  is never refilled early. The new filters fully apply from the next daily batch.
- Seeded synthetic profiles (seed script and the backfill in migration `0017`) get their own
  age ±10 (minimum 18). Dating-pool ones are interested in the opposite gender, matching the
  source speed-dating dataset. Friends-pool ones are open to every gender (`interested_in` null,
  migration `0019`).
- The scoring code (`scoring.ts`) is unchanged, so the offline evaluation is unaffected.
- Other users never see `interested_in`. Candidate views go through `publicProfileFields`.

**Where:**
- Screens: `app/(onboarding)/partner.tsx`, `app/filters.tsx` (modal), filter icon in `app/home.tsx`
- Components: `components/profile/partner-filters.tsx` (also `partnerFiltersSummary`),
  `components/ui/range-slider.tsx`
- App code: `lib/api/profile.ts > buildPartnerFiltersPayload`,
  `lib/profile/draft-from-record.ts > readInterestedIn, readAgeRange`
- API: `src/lib/partner-filters.ts`, `recommendations/repository.ts > partnerFilterConditions,
  dismissPendingFilterMisfits`, `profile/service.ts > patchProfile`,
  `profile/schemas.ts` (validation, min ≤ max)

### Compatibility scoring — live
Scores how well two profiles fit each other.

**How it works:**
- **One-way score.** `unilateral(u→v)` is a weighted mean, clamped to [0, 1]. The default weights are
  `DEFAULT_WEIGHTS = { bio: 0.3, interest: 0.25, geo: 0.15, pref: 0.15, mood: 0.05, dailyAnswer: 0.1 }`
  (staff can change them in Matching rules):
  - **interest:** cosine over the 17 interests plus one extra dimension per custom interest.
  - **pref:** cosine between u's preferences and v's self-ratings. This is the only term where
    u→v differs from v→u.
  - **geo:** `exp(−km / 25)`, or 0.5 when coordinates are missing.
  - **bio:** cosine of the bio embeddings. When either side has no embedding, this term is dropped
    and the other weights are rescaled to sum to 1.
  - **mood:** `moodCompatibility` looks up today's two check-ins in a symmetric 6×6 matrix over
    `MoodSlugs` (calm pairs well with anything; low↔low is weak), not plain equality.
  - **dailyAnswer:** `dailyAnswerSimilarity` is the word-overlap (Jaccard, stopwords removed) of
    today's two answers, mapped to [0.5, 1] so no overlap is neutral. This is a stand-in for
    embedding cosine until bios/answers are embedded in the Worker (T9).
  - Mood and dailyAnswer, like bio, are dropped and the rest renormalized when either side has no
    data today. Only today's (UTC) check-in and answer count: `recommendations/repository.ts` loads
    them with the scoring profile for `utcToday()`; synthetic profiles use `syntheticMoodForProfile`
    and `syntheticDailyAnswer`. They are read when a batch is generated, so the daily-drop cadence
    picks up each day's data without extra rescoring.
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
     - not have been decided on by the viewer, and not have passed on or blocked the viewer.
       A candidate's unanswered like on the viewer stays in the pool,
     - pass the mutual partner filters (gender and age, see Partner filters),
     - be inside an optional bounding box.
  3. Scores and ranks the pool with `rankCandidates`. Pending likers (`listPendingLikerIds`) go
     first, so a one-sided like always reaches the other user and can become a match.
  4. Writes the top k with `replaceRecommendations`. This deletes the pending rows and upserts on
     `(user_id, candidate_id)` in one batch.
- The pool is capped at 500. When the viewer has a bio embedding, an HNSW `bio <=> viewer`
  shortlist of 200 runs before exact rescoring. Pending likers are ordered first in both cases, so
  the cap never drops them.
- Options: `k`, `maxKm`, `weights`, `crossPathsLambda`, `syntheticOnly`. When `k`, `weights` or
  `crossPathsLambda` are not passed they come from the staff-editable matching config
  (`loadMatchingConfig`, see Matching rules), which falls back to the code constants.

**Where:** `src/modules/recommendations/generator.ts`, `repository.ts`,
`src/lib/recommendation-cadence.ts`

### "You've crossed paths" — partial
Counts how often two people were near each other, shows it on the connection screen and gives a
small ranking boost.

**How it works:**
- Detection is foreground-only. When home is open, `useCrossingsLocation` reads a coarse device fix
  (`Accuracy.Low`) on mount and whenever the app becomes active, at most every 10 min. It sends
  `latitude`, `longitude` and the city-level label through `PATCH /me`. It runs only when the user
  shares device location and cross paths, and permission was already granted. It never prompts and
  never runs in the background.
- `patchProfile` stamps `user_profiles.location_updated_at` on new coordinates (cleared with them)
  and calls `recordCrossingsOnLocationUpdate`. `recordCrossings` finds people in the same
  `looking_for` pool with `share_cross_paths` on, location not hidden, a location update in the last
  30 min, and within 1 km (`src/lib/crossings.ts`: bounding-box prefilter, then haversine).
- The `crossings` table stores each pair once (`user_a < user_b`): count, last time and the
  viewer's city-level label as the place. A pair counts again only after 6 h, so staying near each
  other is one crossing. No location history and no coordinates of the other person are stored or
  returned.
- After the two-way score, the boost is applied:
  `score × (1 + λ · (1 − e^(−count / K)))`, with `λ = 0.2` and `K = 3`.
- The boost and the count count only when both users have `shareCrossPaths` on
  (`shouldShowCrossPaths`, and `listCrossings` filters both sides).
- Setting `λ = 0` reproduces the plain ranking, which is the thesis ablation.
- Migration `0022` drops the previously seeded (simulated) rows.

**Where:** `src/lib/crossings.ts`, `recordCrossings` / `listCrossings` in
`src/modules/recommendations/repository.ts`, `applyCrossPathsBoost` in `scoring.ts`,
`apps/mobile/hooks/use-crossings-location.ts`, `components/connections/cross-paths-card.tsx`

**Missing:** `pnpm db:migrate`, an on-device check, and a DPO/ethics update for the new encounter
processing. Synthetic profiles only report locations while staff make them walk (see Location
walkers in the backoffice); otherwise they never cross.

### Bio embeddings — partial
Bios are embedded so that similar bios raise the compatibility score (the `bio` term, weight 0.3).

**How it works.** The API Worker embeds bios with Cloudflare Workers AI `@cf/baai/bge-small-en-v1.5`
(binding `AI` in `wrangler.jsonc`) and stores the 384-d vectors in `user_embeddings.bio`, a pgvector
column with an HNSW cosine index.
- **On write.** `patchProfile` (`modules/profile/service.ts`) covers both profile create and edit;
  staff bio edits in the backoffice (`updateUser` in `modules/staff/service.ts`) do the same. When
  the request changes `bio`, it schedules `syncBioEmbedding` (`src/lib/bio-embedding.ts`) in
  `executionCtx.waitUntil`, so the response does not wait. A non-blank bio is embedded and upserted
  (`upsertBioEmbeddings`); a cleared bio deletes the row (`deleteBioEmbedding`). Failures are logged and
  never fail the save: the scorer already treats a missing vector as neutral.
- **Backfill.** Staff-only `POST /staff/embeddings/backfill` (`backfillBioEmbeddings` in
  `modules/staff/service.ts`) deletes vectors of cleared bios, then re-embeds every non-blank bio in
  batches of 100 (the model's per-call limit) and returns `{ embedded, removed }`. Staff run it
  with **Re-embed all bios** on the backoffice Matching rules page (`BioEmbeddingsCard` in
  `apps/backoffice/src/pages/MatchingRulesPage.tsx`). Run it once per
  environment after deploy and after every `pnpm db:seed` (the seed truncates `user_embeddings`). One
  request does all rows; add a cursor if the pool outgrows Worker subrequest or time limits.
- **One model only.** `embedTexts` rejects anything but 384-d vectors. bge-small and the former local
  `all-MiniLM-L6-v2` vectors are both 384-d but not comparable, so the backfill re-embeds every row and
  the local script (`research/embeddings/generate_embeddings.py`) is removed.
- **Scoring.** The recommendation repository left-joins `user_embeddings`, so `bioEmbedding` is
  populated with no API change. `unilateral` uses the bio term only when both sides have a vector;
  otherwise it drops the term and renormalizes the other weights (tested in `scoring.test.ts`). When
  the viewer has a vector, the candidate pool is an HNSW `bio <=> viewer` shortlist (200).

Tests: `src/lib/bio-embedding.test.ts` (mocked `env.AI`: upsert, delete, AI failure, wrong dimension).

**Missing:** the backfill has not been run on dev or prod yet, so existing rows still hold MiniLM
vectors until it runs. Daily-question answers still use the lexical stand-in (T7), not embeddings.

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
- Triggers: Worker cron `0 8,20 * * *` (08:00 and 20:00 UTC) (runs only when `SIMULATION_ENABLED="true"` in
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

### Branding — live
The Haven app icon (amber `#F5B942` with the white roof mark) is the favicon and appears in the sidebar
header and on the login card.

**How it works:** `components/HavenLogo.tsx` is an inline SVG redrawn from the mobile
`assets/images/icon.png`; `public/favicon.svg` is the same drawing. Update both if the icon changes.

**Where:** `HavenLogo`, `app-sidebar.tsx`, `LoginPage`, `public/favicon.svg`

### Dashboard — live
The landing page after sign-in (`/` and unknown routes redirect here). Shows:
- tiles: profiles (and how many are real), matches (and messages), today's mood check-ins (and
  daily answers), reports,
- bar charts of new real sign-ups and new matches per UTC day over the last 30 days; hovering a bar
  shows that day's count,
- pool split (friends / dating) and real vs agent split,
- mood distribution over the last 30 days.

**How it works:**
- `GET /staff/stats` (`modules/staff`, `requireStaffAdmin`) returns aggregates only, never per-user
  rows. The repository runs the counts in parallel (`profileTotals`, `activityTotals`,
  `realSignupsByDay`, `matchesByDay`, `moodCounts`), grouping by `to_char(created_at, 'YYYY-MM-DD')`.
- `lib/daily-series.ts` (`fillDailySeries`, tested) fills days with no rows as 0 so the charts have
  one bar per day. "Today" is `utcToday()` from `lib/mood.ts`.
- Sign-ups count only real profiles, because synthetic agents are created in bulk by the seed.
  Matches count all pools and both real and synthetic participants.
- Charts are plain divs styled with the theme tokens (no chart library). Friends/dating use the same
  teal/rose as `ModeBadge`.

**Where:** page `DashboardPage` (`/dashboard`); API `/staff/stats`

**Missing:** a date-range selector, and a table view of the chart data.

### User management — live
Staff can:
- search and list profiles,
- view the full record,
- edit profile and account fields,
- delete a user,
- see every recommendation shown to the user, with all score components.

**How it works:**
- Search, edit and delete go through `modules/staff`. Search runs `ilike` on display name, email
  and auth id, and also matches a profile id typed as a number.
- An edit can change profile columns and the Better Auth name and email.

- A teal "Friends" / rose "Dating" badge (`components/ModeBadge.tsx`) shows each profile's mode in
  the list and on the detail page.
- Recommendation scores: `GET /staff/users/{profileId}/recommendations` lists every
  `recommendations` row for the user (pending and acted on, newest batch first) with the stored
  `score` and `rank`. For each candidate it reruns `scoreBreakdown` and `reciprocalScore` from
  `scoring.ts` with the current matching-config weights and applies `applyCrossPathsBoost` (config λ) with the crossing count
  from `listCrossings`. The row shows bio, interest, geo, pref u→v, pref v→u, mood, answer, p u→v, q v→u,
  reciprocal, crossings and the final score. These components use current profile data, so they can
  differ from the stored score if either profile changed after the batch was generated. Only ids,
  names and scores are returned; no coordinates.
- A "Regenerate" button (with a confirm) calls `POST /staff/users/{profileId}/recommendations/regenerate`,
  which runs `generateRecommendations` with `CADENCE.batchSize`, the same batch the feed builds. It
  replaces pending rows and keeps acted-on ones. The new rows get a fresh `shown_at`, so the user's
  feed cooldown restarts. The response is the updated list.

**Where:** pages `UsersPage`, `UserDetailPage` (`components/RecommendationScores.tsx`); API
`/staff/users`, `/staff/users/{profileId}`, `/staff/users/{profileId}/recommendations` (+ `/regenerate`)

### Matching rules — live
Staff can edit the recommendation rules from the "Matching rules" page:
- batch size and cooldown (hours) between batches,
- the six score weights (bio, interest, geo, pref, mood, daily answer), which must sum to 1,
- the crossed-paths boost strength λ.

The page shows each default, has "Reset to defaults", and says when the rules were last saved.

**How it works:**
- One-row table `matching_config` (`id = 1`, migration `0020`; `weight_mood` and
  `weight_daily_answer` added in `0024` with default 0, so a row saved earlier keeps summing to 1). No row means code defaults:
  `CADENCE`, `DEFAULT_WEIGHTS` and `CROSS_PATHS.lambda` from `scoring.ts`, with the cooldown still
  overridable by `REC_COOLDOWN_HOURS`. A saved row wins over the env var.
- `lib/matching-config.ts` (pure, tested): `resolveMatchingConfig`, `toMatchingConfigRow`,
  `weightsSumToOne`. `recommendations/repository.ts` has `loadMatchingConfig` and
  `saveMatchingConfig` (upsert, stores the staff auth id in `updated_by`).
- Readers: `generateRecommendations` (batch size, weights, λ), the feed cooldown in
  `recommendations/service.ts`, the simulation tick (cron and staff), and the staff recommendation
  breakdown.
- `GET /staff/matching-config` returns the config, the defaults and the last update.
  `PUT` validates with zod (batch size 1–50, cooldown 0–720 h, weights 0–1 summing to 1, λ 0–1).
- Changes apply to the next batch. Stored recommendation scores are not rewritten.

**Where:** page `MatchingRulesPage` (`/matching`); API `/staff/matching-config`

**Missing:** the geo decay (25 km) and the crossed-paths K are still code constants. There is no
history of changes, only the last one.

### Location walkers — partial
A staff test tool for crossed paths: synthetic profiles walk around a user's area, so crossings can be
tested with one phone. Shown as the **Location simulation** card on user detail.

**How it works:**
- `location_walkers` has one row per walking synthetic profile (`walker_id` PK): the target, walk
  center, radius (default 800 m), step (default 150 m), active flag, last step, and the walker's seeded
  location (`original_*`), which is restored when the walk is removed.
- Assigning (`POST /staff/users/{id}/walkers`) takes explicit ids or picks `count` random synthetic
  profiles that are discoverable, in the target's pool, have cross paths on and location visible. Only
  synthetic profiles can walk, so a real user's location is never overwritten. The center defaults to
  the target's location. Each walker starts at a random point in the circle and takes the target's area
  label, which becomes the crossing's place.
- A step (`stepWalkers` in `src/modules/simulation/walkers.ts`) moves each active walker one step of a
  random walk that stays in the circle (`src/lib/location-walk.ts`, pure, tested). It stamps
  `location_updated_at` and calls the same `recordCrossingsOnLocationUpdate` the app uses, so the
  pool, privacy, 1 km / 30 min and 6 h cooldown rules are identical.
- Steps run on a `*/10 * * * *` cron (`WALKER_CRON` in `src/index.ts`, gated by
  `SIMULATION_ENABLED`) and on **Step now** (`POST /staff/users/{id}/walkers/step`).
  **Mark target present** first stamps the target's `location_updated_at` (coordinates unchanged),
  as if their app had just reported, so a crossing doesn't need the app open.
- `GET /staff/users/{id}/walkers` returns the target's location and freshness, each walker's
  position, distance to the target, `blockers` (`crossingBlockers` in `src/lib/crossings.ts`: why a
  step can't cross right now), its crossing with the target, and every crossing of the user. If the
  profile is itself a walker, it says for whom. The card refreshes every 30 s.
- The card draws an SVG plot in meters around the target (crossing radius, walk areas, walkers). There
  are no map tiles, so no coordinates go to a third party. Staff see exact coordinates here, as on user
  detail; the app never does.
- `PATCH /staff/walkers/{id}` pauses, resumes or tunes a walker. `DELETE` restores its seeded
  location; crossings it made stay.

**Where:** `src/modules/simulation/walkers.ts`, `src/modules/simulation/repository.ts`, staff routes
in `src/modules/staff/`, `apps/backoffice/src/components/LocationWalkers.tsx`

**Missing:** `pnpm db:migrate` (migration `0023`) and a run against a real device. If the target
is deleted, its walk rows go with it (cascade), but the walkers keep their walked location.

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
    interactions, inserted in batches of 500.
  - `db:seed-demo` creates the demo account.
- **Schema changes.** Edit `src/db/schema.ts`, then run `pnpm db:generate` and `pnpm db:migrate`.
  Never hand-edit an applied migration.
- **Data residency.** The Neon database is in `aws-eu-central-1`. Two exceptions send data to
  subprocessors:
  - Bio text goes to Cloudflare Workers AI for embedding (DPO sign-off obtained, T9). Workers AI does
    not guarantee EU-only inference, so a bio may be processed outside the EU; only the bio text is
    sent, with no name, id or other profile field, and only the vector is stored (in Neon).
  - Push: device tokens and generic notification text go to Google FCM and Apple APNs, which is
    unavoidable for remote push. No profile data, names or message text are sent.
