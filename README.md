# Haven

Monorepo for the Haven project — a Cloudflare Workers API (`apps/api`) and Expo mobile app (`apps/mobile`).

## Database (Neon)

Haven uses [Neon](https://neon.tech) serverless Postgres. The database **must** be provisioned in the **EU region** (`aws-eu-central-1`, Frankfurt) for data-protection compliance.

### Provision the project

1. Create a Neon project and select **AWS Europe (Frankfurt) /** `aws-eu-central-1` as the region.
2. Enable the **pgvector** extension — in the Neon SQL editor, run:
  ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
  ```
3. Copy the **pooled** connection string from the Neon dashboard (Connection details → *Pooled connection*).



### Local setup

1. Copy the example env file at the api root:
  ```bash
   cd apps/api
   cp .env.example .env
  ```
2. Paste your pooled connection string into `.env`:
  ```env
   DATABASE_URL=postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
  ```
   Use the pooled host (contains `-pooler`) rather than the direct connection string. Direct connections and [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) will be wired up later for production Workers.
3. `.env` is git-ignored — never commit connection strings or credentials.



### Drizzle commands

Database tooling reads `DATABASE_URL` from the root `.env`:

```bash
pnpm db:generate   # generate migration files from schema changes
pnpm db:migrate    # apply migrations to Neon
pnpm db:studio     # open Drizzle Studio
```

For local Worker development, copy `apps/api/.env.dev.example` to `apps/api/.env.dev` (git-ignored).

## Mobile (development build)

The Expo app uses a **custom dev client**, not Expo Go. See [`apps/mobile/README.md`](apps/mobile/README.md) for full setup.

**First time** — build and install the dev client:

```bash
cd apps/mobile
pnpm ios       # iOS Simulator
pnpm android   # Android emulator
```

**Daily dev** — API + Metro from the repo root:

```bash
pnpm dev
```

Open the Haven dev client app on your simulator/emulator (not Expo Go).