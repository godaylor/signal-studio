# M18 verification — 2026-09-12

Status: implementation verified locally; provider setup/public acceptance pending.
No paid resources or plan changes were made. Budget target remains $0.

## Changed behavior

- `src/server/exports/supabase-storage.ts`: private bounded encrypted object adapter;
  3 MiB cap, integrity verification before returning plaintext, exact-key deletion.
- Existing storage adapter selects Supabase by configuration; local streaming
  exports remain supported. Queue worker supports exact-job claiming and bounded
  serverless limits; existing auth, lease, expiry and revocation checks remain.
- `src/server/jobs/serverless.ts` and `/api/internal/jobs`: request-after-response
  execution plus authenticated cron batches. No worker daemon in the free profile.
- `scripts/setup-supabase.js` / `supabase-lockdown.js`: explicit project matching,
  RLS and revoked Data API access, private bucket, Vault-backed cron configuration.
- Pooled runtime connections, direct migration URL, startup configuration validation,
  Vercel build command/configuration and a separate CI serverless/browser job.
- UI explains export limit failures and how to split work with existing filters.

No application schema migration, auth replacement or new dependency was added.
Supabase setup enables provider extensions/cron and tightens application-table
privileges only in a dedicated, explicitly matched project after migrations.
It is never run by build or startup.

## Evidence

Environment: Windows, Node 22.22.2, pnpm 10.15.1, independent PostgreSQL 17.5
listening only on 127.0.0.1:32168. Data directory `.local/free-postgres-20260912`,
database `signal_studio_test_free_20260912`; no existing services were modified.
Docker was unavailable and was not started globally.

| Check | Result |
|---|---|
| Unit suite at first complete run | 162 files / 1042 tests passed |
| Storage and scheduler auth tests | Encryption, corruption, oversized data, scoped deletion, unauthorized cron passed |
| PostgreSQL integration | 12 files / 57 tests passed |
| RLS negative test | A separately owned test role with explicit SELECT grant sees zero protected rows |
| Vercel-mode production build | Passed; no standalone output or daemon required |
| Browser tests with request-triggered jobs | 10 passed, including queued export, physical replay deletion, source onboarding, login/logout, RU mobile and axe |
| TypeScript | Passed |
| Lint | No errors; existing and test-style warnings remain |
| Legal inventory | 1029 components, 478 license texts, no missing notice texts |

Storage tests use an explicitly reserved `.invalid` origin/protocol fixture. They
do not claim a live Supabase upload. There was no separate export worker during
the serverless browser run. Queue concurrency/stale recovery and permissions are
also covered by PostgreSQL integration tests.

The initial native PostgreSQL cluster inherited Europe/Moscow timezone, causing
two pre-existing analytics golden tests to fail. Setting only the isolated test
database to UTC restored the documented reference contract; all 57 tests passed.
Provider setup explicitly checks UTC. No analytical expected result was changed.

No new 1M-event performance claim is made, and no Free-tier throughput guarantee
is inferred from the small test fixtures. Manual screen-reader testing and actual
Supabase pooler/TLS, Data API, Storage, Vault, cron, Vercel bundle/provider acceptance
remain open. Current CI for the published source must be checked separately.

LICENSE and the full Umami MIT attribution remain unchanged. Read
[free deployment and compromises](FREE_DEPLOYMENT.md) before publishing a live link.
