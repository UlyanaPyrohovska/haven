# Haven Mobile

Expo app for Haven, using a **custom development build** (`expo-dev-client`) — not Expo Go.

## First-time setup

Install dependencies from the monorepo root:

```bash
pnpm install
```

### Option A — Local simulator / emulator (recommended for daily dev)

Build and install the dev client on your machine:

```bash
cd apps/mobile
pnpm ios       # iOS Simulator (macOS + Xcode)
pnpm android   # Android emulator (Android Studio)
```

These run `expo run:*`, which generates native projects and installs a dev client with the env from `.env.dev`.

### Option B — Physical device via EAS

```bash
cd apps/mobile
pnpm build:dev:ios       # or build:dev:android
```

Install the build from the EAS dashboard or QR link. You need an Expo account on the `pirogotters-team` org.

## Daily development

From the monorepo root, start API + Metro together:

```bash
pnpm dev
```

Or mobile only:

```bash
cd apps/mobile
pnpm dev
```

Open the **Haven dev client** app (not Expo Go). It connects to Metro automatically on the same network.

For the deployed API instead of localhost:

```bash
pnpm dev:prod
```

## Environment

| Command | Env file | API URL |
|---|---|---|
| `pnpm dev` | `.env.dev` | `http://localhost:8787` |
| `pnpm dev:prod` | `.env.production` | deployed Worker |
| `eas build` | `eas.json` | production Worker |

**Physical device + local API:** copy `.env.dev.local.example` to `.env.dev.local` and set your machine's LAN IP, then rebuild the dev client (`pnpm ios` / `pnpm android` / EAS).

**Android emulator:** `pnpm dev` auto-runs `adb reverse` so `localhost:8787` works.

## Build profiles

| Script | Profile | Use case |
|---|---|---|
| `build:dev:*` | `development` | Dev client with debug tooling |
| `build:preview:*` | `preview` | Internal testing |
| `build:prod:*` | `production` | Store release |

## Useful commands

```bash
pnpm prebuild          # regenerate ios/ and android/ (clean)
pnpm android:tunnel    # manually run adb reverse for port 8787
pnpm lint
```
