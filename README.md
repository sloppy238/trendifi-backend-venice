# TRENDIFI Backend

Backend export for the TRENDIFI infrastructure-intelligence proof engine.

## Setup

Requires Node.js 22+, pnpm, and a MySQL/TiDB database.

```bash
cp .env.example .env
# Fill in .env values
pnpm install
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
pnpm check
pnpm test
pnpm build
pnpm dev
```

## API

- tRPC endpoint: `/api/trpc`
- Public proof query: `proof.snapshot`
- Admin signal publication: `proof.publish`
- Public analytics: `analytics.track`
- Public email capture: `newsletter.subscribe`
- OAuth callback: `POST /api/oauth/callback`
- Daily refresh: `POST /api/scheduled/refresh-signals`
- Weekly report: `POST /api/scheduled/weekly-report`

## Security

Never commit `.env`, database credentials, JWT secrets, Manus API keys, or OAuth tokens. Scheduled endpoints require Manus cron authentication and an enabled matching `scheduledJobs.taskUid` row.

## Included

This package includes the full `server/`, `drizzle/`, and `shared/` source trees, database migrations, tests, package lockfile, and runtime configuration. It intentionally excludes the React client, `node_modules`, `dist`, Vite caches, logs, and secrets.
