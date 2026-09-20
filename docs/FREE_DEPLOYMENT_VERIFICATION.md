# M18 verification — 2026-09-12

Status: deployed on Vercel Hobby + Neon Free; full public acceptance pending.
No paid resources or plan changes were made. Budget target remains $0.

## Vercel deployment continuation — 2026-09-20

- Created only `maxeem/signal-studio` on the verified Hobby plan, project ID
  `prj_rlSfdtTxh4vwGuZmwwny2rN3iGM9`, connected to the existing GitHub repository.
- Saved nine prepared variables as Production-only secrets. No Preview secrets,
  paid integrations, account security changes or other-project changes.
- First deployment failed because Vercel supplied Node 22.23.2 / pnpm 10.28.0.
  Commit `aac0f4afc2018de4920cbc97e07cd648647c4fc9` permits managed Node 22
  updates and invokes pinned pnpm 10.15.1 through Corepack. Engine enforcement
  remains enabled; local, CI and Docker Node versions remain pinned.
- All six CI jobs passed for both the preceding implementation and this fix:
  [CI 35480663721](https://github.com/godaylor/signal-studio/actions/runs/35480663721).
  Four local release/supervisor checks also passed.
- Public application: https://signal-studio-smoky.vercel.app. The browser passed
  Vercel's automatic checkpoint and rendered the real Signal Studio login page,
  Russian product copy and the Umami/MIT attribution link. This is not proof of
  authenticated source/analytics/export acceptance.
- Saved `SIGNAL_STUDIO_PUBLIC_URL` as Production config after the build began.
  The next production deployment must incorporate that new variable.
- Configured the same repository URL variable and dispatched the existing free
  maintenance workflow. [Run 35481192197](https://github.com/godaylor/signal-studio/actions/runs/35481192197)
  completed successfully: its step requires an HTTPS success response with
  `ok: true` from the authenticated production jobs endpoint. The 30-minute
  recovery schedule is enabled. Downloading the workflow log separately returned
  a GitHub permission 403; the run/job success status was readable.
- Local Node HTTPS readiness request received 403 `Vercel Security Checkpoint`.
  Browser navigation to `/api/ready` returned `ERR_BLOCKED_BY_CLIENT`.
  Reading the Vercel deployment page then hit two automatic approval timeouts;
  no alternate route was used to bypass that browser restriction.
- Remaining acceptance: confirm latest env deployment, authenticated source and
  ingestion, exact analytics, saved Insight/Dashboard, queued download, permissions
  and expiry on the public URL. These are not marked passed.

No other PetProjects process/container/network/volume was changed. Root LICENSE
and upstream attribution remain intact. Earlier checkpoint limitations below are
historical; notably the earlier 2FA recommendation did not appear in this attempt.

## Neon continuation — 2026-09-18

The user supplied an existing Frankfurt project, replacing the blocked Supabase
target. Neon API confirms organization Maxeem is Free and project `signal-studio`
is `autumn-term-44417221`, PostgreSQL 18, 512 MiB database limit.

- Production branch `main` (`br-cool-mountain-b1acvq3g`), database `signal_studio`,
  was verified empty before migration. All 36 Prisma migrations now applied.
- A separate `deployment-verification` branch (`br-damp-leaf-b11nvzpg`) contains
  `signal_studio_test_deployment`. Migrations were applied there first.
- Both use TLS verification; explicit `sslmode=verify-full` resolved the local
  Prisma connection issue. Direct connection is used for migrations; pooled
  connection was verified for application traffic. Cold start required retry.
- Production administrator `signal-owner` initialized with a generated password
  saved only in ignored local credentials. No production seed was run.
- Neon Data API is unprovisioned. Migration 36 enables artifact-table RLS and
  revokes PUBLIC access; application services retain their existing auth checks.
- 14 export integration tests passed against the real Neon verification database,
  including PostgreSQL artifact round-trip, corruption rejection, size limit,
  cross-user denial, expiry and existing lease/session semantics.
- 18 targeted runtime/storage unit tests, TypeScript and Vercel-mode production
  build passed. Lint has zero errors, 39 warnings and 59 informational diagnostics.
- No package was added; generated legal inventory still has 1029 components,
  478 license texts and zero missing notices. Root LICENSE is unchanged.

Vercel import is prepared for `godaylor/signal-studio` on Maxeem Hobby. Its account
2FA recommendation interrupted the form; automatic approval rejected skipping
that recommendation. A user response is pending for that specific action.
Production env upload, actual Vercel deployment, scheduler configuration and public
HTTPS source/analytics/export acceptance are not yet claimed complete.

Published code: `da6118cdcb3f1c50c197f0511347b9064a3f9380` on owned `main`.
[CI run 35390044298](https://github.com/godaylor/signal-studio/actions/runs/35390044298):
`verify` and `serverless` passed, including browser workflows using real PostgreSQL
artifacts without a daemon. Four legacy self-hosted image jobs were still building
at this checkpoint. An initial run failed a release-contract assertion requiring
the superseded Supabase fixture; the contract now requires PostgreSQL and all four
release/supervisor checks pass. Export UI component tests: 5 passed.

GitHub repository visibility was confirmed PUBLIC. The scoped jobs secret is now
configured in this repository; no database credentials were sent to Actions.
The recovery schedule remains gated until the production-origin variable is set.
Production readback: 36 completed migrations, one active administrator, artifact
RLS enabled, database size 10,207,232 bytes at this checkpoint. The verification
compute was observed suspended automatically; no paid compute changes were made.
Browser read attempts later also hit approval-review timeouts. No Vercel form was
submitted or security setting bypassed. No new local application, Docker process,
network or volume was started. Root LICENSE SHA256 remains
`2a2a42dba0334d768c61edc8f5bb5d3732d94de23d99a7e539a719b1d5117ba0`.

## Hosted access check — 2026-09-13

Authenticated browser access recovered after the earlier approval-service 403.
Supabase's automatic browser checkpoint completed and Vercel dashboard loaded.
The current tool catalog exposes no dedicated Supabase/Vercel connector methods.

- Supabase organization `godaylor`: Free, existing project `replaylab`.
- Supabase organization `Solecraft`: Free, existing project `solecraft`.
- Supabase's new-project form explicitly reports that `godaylor` has reached the
  limit of two active free projects and disables Create new project.
- Vercel scope `Maxeem` (`/maxeem`): Hobby; authenticated dashboard accessible.

Neither existing Supabase project belongs to Signal Studio. No project was paused,
deleted, reused or upgraded. No cloud migration, bucket, RLS change, cron job,
production environment variables or deployment was submitted in this attempt.
Public analytics/source/export acceptance therefore remains pending. The concrete
prerequisite is an available dedicated Supabase Free project; changing another
application to obtain capacity is outside the authorized scope. Architecture stays
Vercel Hobby + Supabase Free.

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
