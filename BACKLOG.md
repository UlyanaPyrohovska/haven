# Haven — Backlog

**Status:** `[ ]` todo · `[~]` in progress · `[x]` done

---

## Issues found during testing (2026-10-25)

### `[x]` T1 — fix(mobile): push notifications not delivered on iOS

Root cause found: the phone build has a production APNs token, but `APNS_SANDBOX=true` sent it to sandbox. Apple answered `BadDeviceToken` and the token was pruned. Fix: the `APNS_SANDBOX` flag is gone; the API always tries production APNs first and retries sandbox once on `BadDeviceToken` (`apps/api/src/lib/push.ts`). Verified on a physical iPhone. Also: the Android notification icon was the Expo template logo; replaced with the Haven glyph (`apps/mobile/assets/images/notification-icon.png`).

- **Labels**: `type:bug` `area:mobile` `prio:P1`
- **Description**: Daily reminders and new-match pushes arrive on Android but not on iOS. Cause unknown.

**Acceptance criteria**
- [x] Root cause identified and documented
- [x] Daily reminder and new-match pushes arrive on a physical iOS device
- [x] Android delivery unchanged

**Notes**
- Check first: APNs key/credentials in EAS, `aps-environment` entitlement and Push capability in the native build, permission prompt result, token registered via `PUT` push-token route with platform `ios`, Expo push receipts for errors.
- iOS simulator does not receive remote pushes; test on a real device.

---

### `[x]` T2 — fix(mobile): match popup not shown on matches screen

Root cause: the matches screen fetched `GET /matches` only on focus (home polls every 30 s), so a match made while it was open never arrived there. Each `NewMatchDialog` also kept its own copy of the seen ids, so home, still mounted underneath, announced the same match again. Fix: a match push received in the foreground (the other person liked back) invalidates `GET /matches`, so the popup opens right away on the open screen, home or matches. Matches also polls every 30 s as a fallback. The seen set is shared through the react-query cache (`markMatchesSeen`), and the dialog only shows on the focused screen. A match completed by the user's own like is celebrated on the connection screen and marked seen there. Both popups now use the animated `MatchCelebration`.

- **Labels**: `type:bug` `area:mobile` `prio:P1`
- **Description**: When a match happens while the user is on the matches screen, no popup appears. It only appears after navigating back to home.

**Acceptance criteria**
- [x] Match popup shows immediately on the matches screen when a match occurs (via the match push; 30 s poll if push is off)
- [x] Popup is not shown twice (once on matches, again on home)

**Notes**
- Popup trigger likely lives only in the home screen; move it to a shared place (layout-level or a hook used by both screens).

---

### `[ ]` T3 — feat(api,mobile): implement crossings for real (replace mocks)

- **Labels**: `type:feature` `area:api` `area:mobile` `prio:P1`
- **Description**: All "crossing" data is mocked. Implement it end to end and use approximate location on the matches page.

**Acceptance criteria**
- [ ] Crossings computed from real data, no mock data left in API or mobile
- [ ] Matches page shows approximate location / coarse distance only
- [ ] Never exposes raw coordinates; respects users' hide-location privacy flags
- [ ] Respects `lookingFor` pools

---

### `[ ]` T4 — fix(mobile): yellow home flashes after registration before selected mode

- **Labels**: `type:bug` `area:mobile` `prio:P2`
- **Description**: After finishing registration, home briefly renders in the yellow (default) theme, then switches to the mode the user selected.

**Acceptance criteria**
- [ ] Home renders in the user's selected mode on first paint after onboarding
- [ ] No theme flash on cold start either

**Notes**
- Mode probably resolves from the profile query after first render; seed it from the onboarding draft or hold render until it is known.

---

### `[ ]` T5 — feat(mobile): optional profile picture step in onboarding

- **Labels**: `type:feature` `area:mobile` `prio:P2`
- **Description**: Add a profile picture step to onboarding. It must be skippable.

**Acceptance criteria**
- [ ] New step added via `lib/onboarding/steps.ts` + `profile-draft.tsx`
- [ ] Reuses existing photo upload logic in `lib/profile/photo`
- [ ] "Skip" completes onboarding without a photo
- [ ] Copy in `locales/en.json`

---

### `[ ]` T6 — fix(api,mobile): AI-agent candidates show wrong or missing profile picture

- **Labels**: `type:bug` `area:api` `area:mobile` `prio:P2`
- **Description**: Users shown in recommendations that are AI agents (synthetic/seeded profiles) often have a profile picture that doesn't match the profile, or no picture at all.

**Acceptance criteria**
- [ ] Root cause identified and documented
- [ ] Every AI-agent candidate in recommendations shows a picture
- [ ] Picture matches the profile (e.g. gender) and stays the same across sessions
- [ ] Real users' uploaded photos unchanged

**Notes**
- Fallback avatars come from `apps/api/src/lib/avatar-url.ts` (curated Unsplash portraits picked by profile id and gender, used when `user_profiles.photo_url` is null). Check that recommendation responses actually apply this fallback, that the portrait lists are correctly split by gender, and that every Unsplash URL still resolves.
- Check the mobile candidate card handles a failed image load (placeholder instead of blank).

---

### `[ ]` T7 — feat(api): use mood and daily-question answers in recommendation scoring

- **Labels**: `type:feature` `area:api` `prio:P1`
- **Description**: Mood check-ins and daily-question answers are only displayed on the candidate detail screen (`getRecommendationDetail` in `modules/recommendations/service.ts`). They have no effect on scoring or ranking. They should contribute to recommendations.

**Acceptance criteria**
- [ ] `scoring.ts` gets a mood component and a daily-answer component, kept pure (no DB imports)
- [ ] Missing data is neutral: no check-in or no answer today gives a neutral score, and the weights renormalize like the null-bio case
- [ ] Weights for the new components are in `MatchingConfig`, so staff can edit them
- [ ] Only today's data counts (use the helpers in `mood.ts` / `daily-questions.ts`); synthetic profiles use `syntheticMoodForProfile` / `syntheticDailyAnswer`
- [ ] Staff score breakdown shows the new components
- [ ] Unit tests in `scoring.test.ts`; `docs/FEATURES.md` updated

**Notes**
- Mood idea: a small compatibility matrix over `MoodSlugs` (e.g. calm↔stressed is fine, low↔low is weak), not plain equality.
- Daily-answer idea: embed answers the same way as bios and use cosine similarity; drop the term when either side has no embedding.
- Both change daily, so check how this fits the batch cadence in `recommendation-cadence.ts` (rescore at batch time is probably enough).

---

### `[ ]` T7 — fix(mobile): "See today's answers" opens recommendations instead of answers

- **Labels**: `type:bug` `area:mobile` `area:api` `prio:P2`
- **Description**: After answering the daily question, "See today's answers" on the home card navigates to `/connections` (recommendations). That is confusing, especially when no recommendations are left. It should show what the user's matches answered today.

**Acceptance criteria**
- [ ] Button opens a view of today's answers from the user's matches
- [ ] Works when the user has no recommendations left
- [ ] Empty state when no match has answered yet (or the user has no matches)
- [ ] Only matches' answers are shown, never other users'; respects `lookingFor` pools
- [ ] Copy in `locales/en.json`

**Notes**
- Navigation is in `apps/mobile/components/home/daily-question-card.tsx` (`router.push("/connections")`).
- `app/daily-question.tsx` already has a "Shared" section (`dailyQuestion.sharedTitle` / `sharedSubtitle`, `lockedPrompt`, `noAnswerYet`); consider reusing it or pointing the button there.
- Check whether an API route already returns matches' answers for today; if not, add one using the helpers in `daily-questions.ts`.

---

### `[ ]` T8 — feat(api,mobile): let users regenerate recommendations if they haven't acted on today's batch

- **Labels**: `type:feature` `area:api` `area:mobile` `prio:P2`
- **Description**: Users wait about 24 hours (recommendation cooldown) for new recommendations, even after changing their filters. Let them regenerate the batch, but only while they haven't acted (like/pass) on any recommendation from the current daily batch, so the daily limit can't be bypassed.

**Acceptance criteria**
- [ ] User can regenerate recommendations from the app while no recommendation in the current batch has been acted on
- [ ] Regenerate is hidden or disabled once the user has acted on at least one recommendation; the normal cooldown applies again
- [ ] API enforces the rule (not only the UI); returns a clear error when not allowed
- [ ] New batch uses the current filters and respects `lookingFor` pools
- [ ] Regenerating does not reset the daily limit or the cooldown timer
- [ ] Copy in `locales/en.json`

**Notes**
- `POST /recommendations/regenerate` already exists (`regenerate()` in `apps/api/src/modules/recommendations/service.ts`), but it's a study knob that ignores the cooldown and has no guard. Add the "no action taken in current batch" check there, or add a separate user-facing route.
- Changing filters currently only calls `dismissPendingFilterMisfits()`, which drops misfits without refilling. Offering regenerate right after a filter change is a natural entry point.
- Cooldown helpers are in `apps/api/src/lib/recommendation-cadence.ts`.
- Open question: should regenerating be capped (e.g. once per day) even without actions?

---

### `[ ]` T9 — feat(api): embed bios on write with Cloudflare Workers AI

- **Labels**: `type:feature` `area:api` `prio:P2`
- **Description**: Bio embeddings come only from the local script `research/embeddings/generate_embeddings.py` (all-MiniLM-L6-v2). Real users' new or edited bios get no vector until someone re-runs it, so their bio term stays off. Embed bios in the Worker on profile write with Workers AI `@cf/baai/bge-small-en-v1.5` (384-d, fits `user_embeddings.bio vector(384)`).

**Acceptance criteria**
- [ ] DPO sign-off obtained for Workers AI as a subprocessor; Cloudflare's Workers AI data-locality terms checked and documented. Do not start the rest without this.
- [ ] `AI` binding added to the API wrangler config; types regenerated
- [ ] Embedding helper in `apps/api/src/lib/`, returns a 384-length `number[]`
- [ ] Profile create and PATCH embed the bio when it changes, in `executionCtx.waitUntil`, and upsert `user_embeddings`; clearing the bio deletes the row
- [ ] An embedding failure is logged and never fails the profile save (the scorer already handles a null embedding)
- [ ] All existing vectors re-embedded with bge-small (one-off backfill); no MiniLM vectors left
- [ ] `generate_embeddings.py` switched to bge-small or removed; schema comment on `user_embeddings.bio` updated
- [ ] Tests with a mocked `env.AI` for upsert, delete and failure paths
- [ ] `docs/FEATURES.md` (Bio embeddings section, data-residency note) and W2.1 in `docs/path-a-implementation.md` updated

**Notes**
- bge-small and MiniLM vectors are not comparable even though both are 384-d. Never mix the two models in `user_embeddings`.
- Running MiniLM inside the Worker (transformers.js/ONNX) is not practical: the model (~23 MB) exceeds the Worker size limit and inference hits CPU limits.
- Backfill options: a staff-only route that loops in batches, or a script that calls the Workers AI REST API.
- The same helper could embed daily-question answers for T7 (mood and daily answers in scoring).

---

### `[ ]` T10 — bonus: graph neural network (GNN) for better recommendations

- **Labels**: `type:feature` `area:api` `area:research` `prio:P3` `bonus`
- **Description**: Today, scoring uses only profile features: bio, interests, geo and preferences. It does not learn from behaviour. A GNN trained on the `interactions` graph (users as nodes, likes and passes as directed edges) could learn user embeddings that capture who actually likes whom, and add a collaborative term to the compatibility score.

**Acceptance criteria**
- [ ] Offline training in `research/` (for example LightGCN or GraphSAGE with PyTorch Geometric), run locally so data stays in the EU
- [ ] Node features reuse what scoring already uses (interests, self/pref vectors, bio embedding), so new users with no edges still get an embedding (inductive, handles cold start)
- [ ] Graphs are split by `lookingFor`, or edges never cross pools
- [ ] Learned vectors stored in pgvector (a new column or table via `schema.ts` + `db:generate`), refreshed by a re-run, like the bio script
- [ ] New `scoring.ts` term (cosine of the GNN vectors), pure, null-safe, renormalized like the null-bio case; weight in `MatchingConfig`
- [ ] Offline evaluation against the current scorer (for example recall@k / NDCG on held-out likes, and reciprocal-match rate); the term ships only if it wins
- [ ] `docs/FEATURES.md` and the thesis docs updated

**Notes**
- Risk: most edges come from synthetic agents, so the GNN may learn the simulator's rules rather than real taste. Report results separately for real and synthetic users.
- Reciprocity matters: a like is only useful when it is mutual. Consider training on mutual matches, or scoring both directions and taking the harmonic mean, as `scoring.ts` already does.
- Too little real data makes this unreliable. Treat it as a thesis extension, not a launch blocker.

---

### `[ ]` T11 — fix(mobile): long location name overflows the home header

- **Labels**: `type:bug` `area:mobile` `prio:P2`
- **Description**: When the location label is long (for example a long city plus country from reverse geocoding), the home header still tries to fit the whole label and the pill crowds the settings and avatar buttons.

**Acceptance criteria**
- [ ] A long location label is truncated with an ellipsis inside the pill
- [ ] Settings and avatar buttons keep their size and position
- [ ] Short labels look the same as now

**Notes**
- `LocationPill` (`apps/mobile/components/location/location-pill.tsx`) already sets `numberOfLines={1}`, so the cause is probably layout. `headerCenter` and `headerPillPressable` in `apps/mobile/app/home.tsx` likely need `flexShrink: 1` / `minWidth: 0` so the text can shrink and truncate.
- The label comes from `resolveLocationLabel` in `apps/mobile/lib/profile/device-location.ts` (city or region, then country).

---
