# M19 — Real guest workspace and Precision Violet redesign

Date: 2026-10-17. This report supersedes the 2026-09-23 page-local demo behavior;
the older acceptance remains historical evidence, not acceptance of M19.

## Delivery state

Local and public HTTPS guest acceptance passed on application revision
`194eab4bac15f6690d469a2029c23083890035dd`. All six remote CI jobs passed.
M19's end-to-end definition of done is satisfied within the limitations below.

## User-visible outcome

The login/demo entry offers **Попробовать без регистрации / Try without signing up**.
It opens the real Studio Explore page directly with a useful activation question.
The guest edits steps, filters, measures and dates; sees real computed answers;
saves/reopens Insights; assembles Dashboards; downloads bounded CSV/JSON. Work is
stored in PostgreSQL and survives reload/re-entry in the same browser for 24 hours.
There is no shared demo password, JS-readable guest token or page-local substitute.
The old tour remains at `/demo/tour` for historical reference.

Three imagegen concepts were generated and inspected. Precision Violet was selected:
aubergine navigation, ivory canvas, restrained white result surfaces, violet Query
Spine, readable tables and question-first headings. Coordinated Home/Explore/Dashboard
and mobile mockups were followed by all six main Studio screens. Mobile results appear
before a full-screen query editor; a bottom bar and drawer preserve all destinations.
Technical definitions and limits live in Help/details. Existing RU/EN and dark mode remain.

- [All concepts, mockups and actual screens](design/guest-redesign/REVIEW.html)
- [Before/after and mockup/implementation board](design/guest-redesign/comparison-board.png)
- [Design decision and provenance](design/guest-redesign/DESIGN.md)
- [Exact imagegen prompts](design/guest-redesign/PROMPTS.md)

Generated image numbers are illustrative, not acceptance data. Application screenshots
and tests use the actual fixture below. No generated image is used as an analytical result.

## Architecture and data semantics

Each guest owns a new temporary application User, Team membership and Website/Project.
The application User is distinct from the 336 synthetic TrackedUsers. Existing services
perform analytics, authorization, Insight/dashboard persistence and exports. A dedicated
opaque 256-bit cookie authenticates against a live primary-database GuestSession record;
only its SHA-256 digest is stored. Existing account bearer auth retains precedence.
An analyst role plus separate guest route allowlist narrows capabilities. Cross-tenant
IDs and body/query project mismatches are denied at the existing permission boundaries.

The deterministic first-party synthetic dataset covers 42 complete UTC days, a half-open
`[start,end)` range fixed when the guest starts. It contains 1,281 website events:
336 pageviews and 945 custom events, 441 sessions, 336 identified users and 84 accounts.
There are no real customer identities, raw IPs or replay payloads. No incoming events are
accepted into the guest source, so its fixture stays bounded and reproducible.

| Actual calculation | Expected result |
| --- | --- |
| Ordered signup → onboarding_completed → core_feature_used, identified actors, 24-hour conversion window | 336 → 252 → 168, 50% overall |
| Same funnel, desktop filter | 168 → 126 → 126, 75% |
| Same funnel, mobile filter | 168 → 126 → 42, 25% |
| Third step changed to subscription_started | 336 → 252 → 84, 25% |
| core_feature_used event count, including repeat use | 273 |
| Return events at least seven days after activation | 105 users across eligible daily cohorts |
| Home's mature 7-day signup cohort | 56 signup, 28 activated, 21 retained: activation 50%, retention 75% |

Funnel results count distinct identified actors, not repeated events. The existing query
contract represents advanced funnels with `aggregation=count`; the adapter supplies actor
semantics. Home keeps its existing 21-day observation horizon. Late event arrival is absent
from this frozen fixture; deletion at expiry removes the dataset. Normal projects keep
their existing late-arrival/deletion semantics. Only PostgreSQL exactness is claimed.

## Resource, security and persistence checks

The server enforces a fixed 24-hour TTL, maximum 50 active spaces, global/client entry
limits, 120 requests/minute, 5,000 lifetime requests, 500 query attempts, 30 Insight creates,
eight dashboards, 40 widgets, 15 segment/cohort creates, 12 exports and 150 other mutations.
The counters update atomically in PostgreSQL; race and direct-API bypass tests are included.
Authorized attempts consume budgets even if a later service validation fails.

Guest management bodies are capped at 64 KiB. Normal bearer sessions and public
ingestion with a leftover guest cookie retain their existing body behavior.
Cross-origin writes, fabricated cookies, public shares,
membership/security changes, source administration and background/identity exports are
denied. Logout remains possible after quota exhaustion. Expiry/revocation is checked live;
replaying a formerly valid cookie fails. The guest endpoint uses private/no-store headers.

CSV and JSON are actual authenticated downloads from existing export logic, with applied
query definitions, filters and exact rows. Limits: 1,000 rows / 1 MiB per synchronous guest
export. CSV formula protection remains covered by existing export regressions. Guest exports
create no persistent artifacts. Expired guest data is purged only from server-selected
expired guest records by existing worker/cron/new-entry maintenance. An unusable ID tombstone
outlives cached source metadata; unrelated users/projects are not cleanup targets.

## Changed files and configuration

- `prisma/schema.prisma`, `prisma/migrations/37_guest_workspaces/migration.sql`: two additive
  guest metadata tables, uniqueness/expiry constraints, RLS and PUBLIC privilege revocation.
- `src/server/guest/*`, `src/app/api/guest/route.ts`: lifecycle, deterministic fixture,
  primary-database auth, route/quota policy, bounded cleanup and safe errors.
- Common `src/lib/{auth,request,client,types}.ts`, auth logout, typed feature HTTP hooks:
  cookie-based guest auth while preserving normal bearer authentication.
- Export service/access, lifecycle ingestion, serverless jobs and self-host export worker:
  scoped export limits, guest-source ingestion denial and eventual cleanup.
- Studio shell/dialog, login/demo entry and Home/Explore/Dashboard/Audiences/Experience/Live,
  Insight library and export controls: coherent responsive visual system and state handling.
- Analytics adapter: chronological funnel buckets; any Neon retention plan correction and
  its evidence are recorded in the deployment section below.
- Unit/component/PostgreSQL/E2E tests and CI's guest browser suite; README, PLAN and deployment
  guide; design alternatives, prompts, before/after screenshots and local review gallery.

No dependency, auth provider or paid service was added. `GUEST_ACCESS_DISABLED=1` disables
entry; no new secret is needed. Build/start never apply migrations or seed the hosted DB.

## Verification

Canonical local runtime: Node 22.22.2, pnpm 10.15.1, Next.js 16.3.0, PostgreSQL 15.19 in
a task-owned Docker container. Local production app uses `127.0.0.1:32240`, DB `32241`.

| Command/check | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, zero errors; 38 nonblocking warnings and 60 informational diagnostics reported |
| `pnpm test` / final `vitest run` | 165 files / 1,056 tests passed |
| `vitest run --config vitest.studio.config.ts` | 9 files / 25 tests passed |
| Guest PostgreSQL integration | 6 / 6 passed on local isolated DB |
| Neon PostgreSQL 18 verification branch, guest integration | 6 / 6 passed after retention plan correction |
| Local Home golden metrics / adapter unit regressions | 6 / 6 and 4 / 4 passed |
| `pnpm build` including standalone preparation/legal inventory | PASS; 1,029 dependency components, 478 license texts, zero missing notices |
| Production guest + archived-tour Playwright suites | 6 / 6 passed, 11.3 s |
| All six flagship screens at 1440px and 390px | 12 views, zero serious/critical WCAG axe findings, zero document overflow |
| Mobile query editing, save dialog focus, 503 analysis error recovery | PASS |
| Dark Explore/editor and 834px navigation/focus restore | PASS |
| Actual synchronous guest CSV and JSON | 200 downloads; CSV 7,498 bytes, JSON 7,996 bytes, golden rows verified |
| Existing-account production browser regressions | 14 / 14 passed, 18.1 s; auth/RU-EN/Viewer/Home/Explore/Insights/Dashboards |
| Public-ingestion compatibility with leftover guest cookie | 72 / 72 focused auth/send/record/guest tests; public parsing retains existing bounds while guest management stays capped |
| Public HTTPS guest + archived-tour browser suites | 6 / 6 passed, 35.5 s, exact deployed revision verified |
| Public HTTPS Home, CSV, cookie, six desktop/mobile flagship screens | 28/56 activation (50%); 21/28 retention (75%); CSV 7,498 bytes; Secure/HttpOnly/Lax; 12 views with zero serious/critical axe findings and zero overflow |
| Exact-revision remote CI verification | 4 release-contract tests; 165 files / 1,056 unit tests; 9 files / 25 Studio tests; 13 files / 64 PostgreSQL integration tests; 33 / 33 browser cases (1.3 min) |
| Exact-revision remote serverless CI | PASS; build:vercel and 13 / 13 browser cases (23.4 s) |

The production browser suite proves entry, actual parameter changes, Insight save/reload,
dashboard assembly/reload, exports, two independent browser principals, foreign-resource
403s, the 13th export's 429/retry-after, cookie revocation and fabricated-cookie denial.
The account suite checks login/logout, validation, locale persistence, Viewer direct-API
denial, Home exactness and URL reproduction, account drill-down, trend/funnel/retention,
cohorts, Insight persistence/search/duplication/archive, dashboard layout/context/query
deduplication and mobile keyboard/axe. It uses a separate task-owned `_test_` database.
Hosted acceptance is recorded below.
Evidence logs and private runtime credentials stay under ignored `.local/guest-redesign/`;
only synthetic screenshots and review artifacts are included in the repository.

## Named performance measurement

Local production standalone, Windows Node 22.22.2 + task-owned PostgreSQL 15 Docker,
1,281 synthetic events / 336 identified users / 42 UTC days: one warm-up then ten identical
exact funnel requests, all server-cache hits. HTTP p50 **8.84 ms**, p95 **10.15 ms**.
JSON export **16.01 ms** / 7,996 bytes; guest allocation including actual seed **516.66 ms**.
This is not a hosted or 1M-event benchmark. Rows/bytes scanned were not collected, and no
reference-scale or ClickHouse performance claim is made.

## Deployment and additional acceptance record

Deployed to the existing Vercel Hobby plus Neon Free `signal-studio`, Frankfurt.
Migration 37 was first applied through Prisma to the
separate `m19-guest-migration-verification-20261017` branch (`br-cool-pond-b1fpmjpd`).
No existing provider project or user workspace was deleted. The branch exposed a
PostgreSQL 18 planner issue: a correlated retention lookup was inlined under the entrant
join and repeated for entrant × activation combinations on a freshly seeded tenant.
The original query exceeded its 15-second limit. One `retained_users AS MATERIALIZED`
fence preserves definitions and limits while computing return eligibility once per actor.
EXPLAIN ANALYZE on the same 1,281-event Neon fixture measured 218.419 ms execution and
0.963 ms planning. No index, JIT setting, timeout, metric boundary or exactness changed.
Neon guest integration then passed 6/6. Local golden tests preserve inclusive +7d and
exclusive +14d returns, filters, tenant scope, denominators and currencies. The verification
compute was suspended after testing; the branch remains a task-owned verification artifact.

Production migration 37 was then applied successfully with `pnpm db:migrate` through
the existing direct Neon connection. It only created the two guest metadata tables;
existing account/event tables were not rewritten.

Application commits `70005542e` and `194eab4ba` were pushed to the owned `main` branch.
The existing Vercel GitHub integration deployed
[`194eab4ba`](https://github.com/godaylor/signal-studio/commit/194eab4bac15f6690d469a2029c23083890035dd)
successfully to **https://signal-studio-smoky.vercel.app**. Public build metadata confirms
that exact revision, serverless profile and Vercel-managed Node 22.23.2. `/api/ready`
returned 200 with PostgreSQL ready. No new runtime secret or provider was required.

The actual HTTPS browser suites passed 6/6 in 35.5 seconds, including query changes,
Insight/dashboard reload persistence, JSON download, independent guests, foreign-resource
denial, the 13th export's 429, revocation, forged-cookie denial, mobile error recovery,
dark mode and tablet navigation. A separate synthetic guest checked Secure/HttpOnly/Lax,
Home's 50% activation and 75% retention, the actual 7,498-byte CSV, and all six pages at
1440 and 390 pixels: zero serious/critical axe findings and zero document overflow.
Every acceptance guest was revoked afterward. The public screenshot set is named
`design/guest-redesign/hosted-*.png`; no real account data is included.

Exact-revision GitHub Actions run:
[Signal Studio CI #14](https://github.com/godaylor/signal-studio/actions/runs/39010831638).
Main verification and serverless jobs passed. The main job includes 33/33 browser
cases, 64 PostgreSQL integration tests, typechecks, lint, production build, dependency
inventory, secret exclusion and dependency-aware readiness. The serverless job includes
13/13 browser cases. All four packaging jobs (runner, worker, migration and hosted)
passed their build, legal/inventory and non-root checks; applicable offline Prisma
checks passed. The full six-job workflow completed successfully in 9 min 49 s.

Final acceptance screenshots, gallery and reports are a documentation-only follow-up
commit. No runtime source changed after this exact-revision acceptance; CI is skipped
for that follow-up to avoid rebuilding the same four images for documentation alone.
All changes are task-owned and committed/pushed; the final working tree is clean.

## Remaining limits, legal and worktree safety

Guest work expires after 24 hours or becomes inaccessible if the browser cookie is cleared.
The synthetic snapshot does not create a live stream or fabricate replays. Guest public
sharing, account/source administration and unbounded/background exports are intentionally
unavailable; normal workspaces retain their existing capabilities. Physical cleanup follows
maintenance, not an exact deadline. Shared-client entry throttling can limit repeated starts.

Manual screen-reader/device review and the historical 1M-event benchmark are not certified
by automated axe or this small fixture. Historical deferred product requirements stay deferred.
No new font/icon/map/browser dependency was introduced. Root LICENSE, upstream MIT notice,
Copyright (c) Umami Software, Inc., and explicit Based on Umami attribution remain intact.

Initial checkout was clean on `main`; all changes belong to this task. Other projects'
processes and containers were inventoried and preserved. Only task-owned app ports, local
test databases/container and the isolated Neon verification branch were used for new tests.
Final git revision/status and hosted verification are recorded in the deployment section.
