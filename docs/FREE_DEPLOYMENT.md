# Vercel Hobby + Supabase Free

Target budget: **$0/month**. No paid plans, trials that auto-convert, paid compute,
custom Supabase domains, PITR or paid worker. Railway is not the current target.
This is a deployment profile of the full application, not a demo replacement.

## Architecture

| Component | Location | Recurring cost within quotas |
|---|---|---:|
| Next.js UI, authenticated API, tracker ingestion | Vercel Hobby, Node functions | $0 |
| PostgreSQL, queue state, existing application auth | Dedicated Supabase Free project | $0 |
| Encrypted export artifacts | Private Supabase Storage bucket | $0 |
| Immediate exports and lifecycle batches | Next `after()` inside a bounded invocation | $0 |
| Recovery and expired-file cleanup | Supabase Cron + pg_net → protected Vercel endpoint | $0 |
| HTTPS hostname | Provider-generated `.vercel.app` | $0 |

Existing authentication, 2FA, sessions, roles, analytics, Insights, Dashboards,
Audiences, Experience and Live stay in the application. Supabase Auth is not needed.
The scheduler invokes existing Node services directly; duplicating Prisma/domain
code into Deno Edge Functions would add unnecessary complexity and tighter limits.

## Real free-tier compromises

Checked 2026-09-12 against [Supabase pricing](https://supabase.com/pricing),
[Vercel Hobby](https://vercel.com/docs/plans/hobby),
[function limits](https://vercel.com/docs/functions/limitations) and
[cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

- Supabase Free: 500 MB database, 1 GB object storage, 5 GB ordinary egress.
  Large continuous replay collection and indefinite event retention do not fit.
  Use selective recording, existing retention/deletion controls and short datasets.
  No automatic deletion policy is silently enabled by deployment.
- An export is at most **3 MiB / 100,000 rows**, with a bounded execution deadline.
  Larger exports fail explicitly; narrow date/audience filters and download parts.
  Rows are not silently truncated. This keeps authenticated downloads under Vercel's
  4.5 MB response limit without granting public object access.
- Jobs start after creation; interrupted jobs resume on a five-minute cron tick.
  Lifecycle jobs advance in bounded batches and may need several ticks. Existing
  maintenance behavior can temporarily reject ingestion during deletion.
- Supabase may pause inactive Free projects after a week. Resume in its dashboard;
  guaranteed always-on availability is not offered at this budget. Cron only checks
  real pending work; it is not an artificial keep-alive workaround.
- Vercel Hobby is for personal, noncommercial usage, which fits this portfolio use.
  Free quotas are shared with other projects in the account. Do not upgrade when
  exhausted; reduce workload or wait for reset. Heavy public production traffic
  and a commercial analytics SaaS are outside this free deployment's scope.
- Automated managed backups/PITR are not included. Use manual encrypted PostgreSQL
  dumps to operator-owned storage and rehearse restore to a separate database.

## Provider prerequisites

Use existing **Hobby** and **Free** accounts. Supabase must have an available free
project slot (the published limit is two active Free projects). Do not delete,
pause or modify another PetProjects project to free a slot. If unavailable, stop
and report that concrete constraint. No provider projects have yet been provisioned
or verified by this release work.

Create a dedicated Supabase project for Signal Studio. Before migrating, disable
its **Data API** in provider settings; this app uses PostgreSQL directly. Never
reuse another application's schema. Keep database TLS verification enabled.

Use the provider's Connect panel:

- Runtime `DATABASE_URL`: Supavisor transaction pooler, port 6543, SSL verified.
- Local/operator `DIRECT_DATABASE_URL`: direct IPv6 connection or session pooler
  port 5432 for migrations. This variable overrides DATABASE_URL only for Prisma CLI.
- Database timezone must be UTC (Supabase default); verify `SHOW timezone`.
- Runtime pools use max 2 connections per client; ingestion locks have their
  separately bounded pool. Do not raise limits without measuring total concurrency.

## Configuration

All values are server-only. Never prefix a secret with `NEXT_PUBLIC_`.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Transaction pooler connection from Supabase |
| `APP_SECRET` | Independent random secret, at least 32 characters |
| `TWO_FACTOR_ENCRYPTION_KEY` | Independent 32-byte key as 64 hex characters |
| `SIGNAL_STUDIO_SERVERLESS` | `1` |
| `EXPORT_STORAGE_BACKEND` | `supabase` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role credential |
| `SUPABASE_EXPORT_BUCKET` | `signal-exports` |
| `JOBS_CRON_SECRET` | Independent random secret, at least 32 characters |
| `SIGNAL_STUDIO_PUBLIC_URL` | Verified production HTTPS origin |
| `DISABLE_TELEMETRY` | `1` |
| `SKIP_BUILD_GEO` | `1` |

Operator-only setup also needs `DIRECT_DATABASE_URL` and
`SIGNAL_STUDIO_SUPABASE_PROJECT_REF`. Keep these in ignored local configuration,
not command arguments/history. Do not copy production credentials into preview builds.
Disable preview deployments until an isolated database can be provided for them.

## Provisioning sequence

1. Confirm Free/Hobby plans and a dedicated empty Supabase project. Disable Data API.
2. Run `pnpm build-db` then `pnpm db:migrate` against that project explicitly.
   Build and startup never migrate. Back up before subsequent migrations.
3. Run `pnpm supabase:setup --lockdown-only`. It refuses unknown tables, enables RLS,
   revokes anon/authenticated Data API grants and verifies table protection. Rerun
   this after future migrations; keep Data API disabled. App services use their
   existing server-side authorization, not a fabricated Supabase auth.uid policy.
4. Bootstrap the administrator with `pnpm admin:bootstrap` and the documented
   bootstrap variables; never publish admin credentials. Use existing saved-data
   import only if it fits Free capacity. Sample seed data is optional and synthetic.
5. Import `godaylor/signal-studio` main into Vercel **Hobby**, framework Next.js,
   Node 22.x. `vercel.json` sets `pnpm build:vercel`; no Docker image is deployed.
   Choose a region near the Supabase project; keep Fluid Compute enabled.
6. Set server-only variables and generated production origin. Deploy the validated
   commit. Do not enable Vercel Agent, paid integrations or plan upgrades.
7. Run `pnpm supabase:setup` locally with matching project ref and public origin.
   This creates/validates the private bucket, enables pg_cron/pg_net, stores the
   origin/cron secret in Vault and installs the named `signal-studio-jobs` schedule.
   Existing public buckets are rejected, not silently reused or modified.
8. Cron calls `/api/internal/jobs` via POST with its bearer secret. No Supabase
   service key leaves Supabase in that request. No Vercel cron configuration is
   required: Hobby's once-daily schedule is insufficient for export recovery.

Setup documentation: [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions),
[pooling](https://supabase.com/docs/guides/database/connecting-to-postgres),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Acceptance before claiming live

- Confirm provider plan badges and zero paid add-ons; inspect quota usage.
- Public readiness succeeds; an anonymous cron call returns 401.
- Create source → ingest real event → Explore → save Insight → Dashboard → reload.
- Queue export → complete without a daemon → download → expire → delete object.
- Revoke access/session and confirm old export download is denied.
- Interrupt a lease and verify the next scheduler invocation recovers it.
- Submit scoped retention/deletion and verify completion over bounded batches.
- Anonymous/Data API access cannot read any application table or private bucket.
- Verify actual function bundle sizes, pooler/TLS connectivity, cron execution,
  public tracker CORS, mobile/RU/EN and login/logout on the production origin.

Local tests use PostgreSQL plus a clearly labeled Storage protocol fixture; this
does not certify the hosted Storage service, Vault or pg_net. Provider acceptance
and the final URL remain pending actual account access.
