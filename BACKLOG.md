# Haven — Backlog

**Status:** `[ ]` todo · `[~]` in progress · `[x]` done

---

## Issues found during testing (2026-10-25)

### `[ ]` T1 — fix(mobile): push notifications not delivered on iOS

- **Labels**: `type:bug` `area:mobile` `prio:P1`
- **Description**: Daily reminders and new-match pushes arrive on Android but not on iOS. Cause unknown.

**Acceptance criteria**
- [ ] Root cause identified and documented
- [ ] Daily reminder and new-match pushes arrive on a physical iOS device
- [ ] Android delivery unchanged

**Notes**
- Check first: APNs key/credentials in EAS, `aps-environment` entitlement and Push capability in the native build, permission prompt result, token registered via `PUT` push-token route with platform `ios`, Expo push receipts for errors.
- iOS simulator does not receive remote pushes; test on a real device.

---

### `[ ]` T2 — fix(mobile): match popup not shown on matches screen

- **Labels**: `type:bug` `area:mobile` `prio:P1`
- **Description**: When a match happens while the user is on the matches screen, no popup appears. It only appears after navigating back to home.

**Acceptance criteria**
- [ ] Match popup shows immediately on the matches screen when a match occurs
- [ ] Popup is not shown twice (once on matches, again on home)

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
