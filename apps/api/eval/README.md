# Evaluation (thesis Chapter 6)

Scripts that produced the evaluation results of the thesis. They run offline on a read-only export of the database and call the engine's own pure functions from `src/lib` (scoring, fairness, preference learning, agent decision and utility) through the `@/lib/...` alias. They never query the database.

Data exports, results and logs are not in the repository; only the weight-sensitivity figure (`figures/sens.png`, Figure 22) is. Put them in `apps/api/eval-out/`, which is git-ignored.

## Files

| File | What it does |
|---|---|
| `../scripts/export-eval-data.ts` | Exports the database to `eval-out/eval-data.json` (`pnpm --filter api db:export-eval`) |
| `sim.ts` | Offline ranking metrics and the 14-day agent simulation |
| `ablations.ts` | Same harness with one scoring component removed at a time |
| `weight-sensitivity.ts` | Top-k overlap and Spearman correlation when one weight changes, plus random weight vectors |
| `run-seed.sh` | One independent repetition of `sim.ts` with `SIM_SEED` set |
| `extra-variants.ts` | Geometric mean, precision@20 and NDCG@50, and impression cap without penalty (`SIMV` picks the simulated variants) |
| `run-extra.sh` | One run of `extra-variants.ts` for a seed (`orig` or `s1`..`s4`) and pool |
| `aggregate-seeds.py` | Mean, standard deviation and paired differences over the five runs |
| `live-study.py` | Participants' activity during the live study (reads `dev.json` in the working directory) |
| `questionnaires.py` | Statistics from the two Google Forms CSV exports |
| `charts.py` | Thesis figures from the result files |

## Data privacy

The export contains no names, e-mail addresses, photos, bio texts, answers or messages, and real users' coordinates are rounded to two decimals. It still holds the pseudonymous activity of the study participants, so do not commit or publish it. The same applies to `questionnaires.json` (free-text answers) and to the questionnaire CSV files (names).

## Running

Run the TypeScript scripts from `apps/api` so that `tsconfig.json` resolves the `@/` alias:

```bash
pnpm --filter api db:export-eval                     # writes eval-out/eval-data.json
cd apps/api
npx tsx eval/sim.ts eval-out/eval-data.json eval-out/out.json 14 300 1
```

The export used in the thesis was taken on 7 November 2026 from the development database (`dev.json`). An export of the production database (`data.json`) was used only for the comparison runs `sim-prod` and `sens-prod`.

## Which command produced which result

Commands use `dev.json` for the thesis export. The pool argument is `0` (friendship) or `1` (dating).

| Thesis result | Command | Result files |
|---|---|---|
| Tables 10, 11, 12, Figures 21, 23, 24 | `THETA=0.79 npx tsx eval/sim.ts dev.json simc-<pool>.json 14 300 <pool>` | `simc-0.json`, `simc-1.json` and logs |
| Results at the deployed threshold θ = 0.71 (section 6.3) | `npx tsx eval/sim.ts dev.json sim-dev-<pool>.json 14 300 <pool>` | `sim-dev-0.json`, `sim-dev-1.json` |
| Choice of θ = 0.79 (section 6.1) | `QUICK=1 THETA=<θ> npx tsx eval/sim.ts dev.json - 3 300 1` | `q0.74.log`, `q0.76.log`, `q0.78.log` |
| Component ablations in Tables 10 and 11 | `THETA=0.79 npx tsx eval/ablations.ts dev.json abl.json` | `abl.json`, `abl.log` |
| Weight sensitivity, Figure 22 | `npx tsx eval/weight-sensitivity.ts dev.json sens-dev.json [viewersPerPool=100] [randomDraws=20]` | `sens-dev.json`, `sens-dev.log` |
| Live study activity (section 6.4) | `python3 eval/live-study.py` (with `dev.json` in the working directory) | console output |
| Questionnaires, Tables 13 and 14, Figure 25 | `python3 eval/questionnaires.py <first-session.csv> <follow-up.csv> questionnaires.json` | `questionnaires.json` |
| Five-seed repetitions (Table 12, Figure 23) | `eval/run-seed.sh <s1..s4> <pool>` | `seeds/sim-s<n>-<pool>.json`, `.log` |
| Geometric mean, precision@20, NDCG@50 (Tables 10, 11, section 6.2.2), impression cap without penalty (Table 12, section 6.3.2) | `eval/run-extra.sh <orig or s1..s4> <pool>` | `extra/extra-<seed>-<pool>.json`, `.log` |
| Mean, SD and paired differences over the five runs | `python3 aggregate-seeds.py` in the results folder | `seeds/agg.json` |
| All figures | `python3 charts.py` in the results folder (Figure 23 uses `seeds/agg.json` if present) | `fig/*.png` |

`charts.py` expects, in its working directory, `simc-0.json`, `simc-1.json`, `sens-dev.json`, `u/u.json` (the questionnaire output), optionally `seeds/agg.json`, and an existing `fig/` folder.

## Randomness and seeds

Every random draw is seeded (`seededRandom` in `src/lib/simulation/agent-decision.ts`), so each run is reproducible: the sample of 300 viewers, the hidden preference profiles, the random part of the candidate pool and each accept or reject decision.

`sim.ts` reads an optional `SIM_SEED`. Without it, the run is identical to the original single-seed results. With it, for example `SIM_SEED=s1`, every draw shifts and the run is an independent repetition. `eval/run-seed.sh <seed> <pool>` runs one repetition into `eval-out/seeds/`. The multi-seed results in the thesis use seeds `s1` to `s4` plus the original run.

## Keeping results reproducible

The scripts import the live engine code. A change to `scoring.ts`, `fairness.ts`, `preference-learning.ts` or the agent files changes their output. To reproduce the thesis numbers exactly, check out the commit the thesis was evaluated on.
