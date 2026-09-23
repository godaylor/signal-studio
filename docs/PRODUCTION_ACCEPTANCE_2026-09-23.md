# Production acceptance and public demo — 2026-09-23

Target: https://signal-studio-smoky.vercel.app, existing Vercel Hobby + Neon Free
`signal-studio` / Frankfurt. No new provider, paid resource, auth system or migration.

**Production/portfolio gate: CLOSED for the explicitly requested workflow.**
Public demo: https://signal-studio-smoky.vercel.app/demo. The verified application
revision is `14fa108dbc3b5498b083e6652521febf3e4f8f84`.

## Verified before the demo rollout

The deployed commit was `ceafc35b03c227545d11597944ddbcd03d9c9050`.
Real HTTPS requests passed the following checks against a dedicated test source,
using two random non-admin acceptance accounts (credentials only in ignored local
files; no shared public credentials):

- PostgreSQL dependency readiness; anonymous maintenance denied.
- Login; source creation; public identify and ingestion of three events.
- Exact analytical result: `production_acceptance = 3`.
- Save Insight; create dashboard; reload its reference to that Insight.
- Audience contains the ingested user; exact behavioral preview count is 1;
  save and reload the segment definition.
- Synchronous JSON matches the analytical result.
- Idempotent queued audience export completes and downloads one identity through
  the serverless PostgreSQL artifact adapter.
- Artifact download denies anonymous (401) and unrelated user (403).
- Logout revokes the prior session.

`scripts/verify-production.mjs` now includes the behavioral audience step.
The existing production jobs schedule is active; run `35791195334` succeeded.
These small fixtures are functional evidence, not a 1M-event performance claim.

## Public entry and scope

Login offers **Попробовать демо**, linking to `/demo`. The public demonstration
explains source → events → analysis → saved analysis → dashboard → audience →
JSON download, with a visibly labeled fictional SaaS dataset. Save/add actions
live only in page memory and reset on reload. It makes no project API requests,
reads no production data and issues no credentials. Real projects still require
normal login and existing server permissions.

This is an interactive explanatory alternative, not a temporary authenticated
workspace. Anonymous writable workspaces would require new provisioning, quota,
abuse and cleanup policies beyond this acceptance scope. No auth guard was relaxed.

RU copy now explains Query Spine as «Цепочка анализа», recent Insights as saved
analyses, exactness as «Точный подсчёт» and removes internal cache statuses from
the main result and dashboard display. Event identifiers remain technical names.

## Local validation

- Node 22.22.2, pnpm 10.15.1; Vercel-mode production build and TypeScript passed.
- Full unit regression: 163 files / 1047 tests passed before the hydration fix;
  targeted final regression: 7 passed, including the new SSR hydration check.
- Public demo Playwright: 3 passed, including JSON contents, no project API calls,
  reset on reload, keyboard use, no horizontal overflow and zero axe violations
  at 1280px and 390px.
- Repository lint: zero errors; 39 existing warnings, 59 informational diagnostics.
- Test app used existing project port 32109; no DB, Docker container, network or
  volume was started or changed. No new dependency or licensed asset was added.

## Production browser and expiry evidence

- Chromium on the public origin passed login, source receiving events, Explore,
  save/reopen/reload an analysis, existing dashboard, user audience and real JSON
  download. A test initially used an unsupported audience URL parameter; switching
  through the actual Tracked users button fixed the test. No auth bypass was used.
- Controlled expiry: only a disposable acceptance export's `expiresAt` was moved
  into the past. Download returned 410 within the same session. Authenticated
  production maintenance marked the job expired and physical artifact count went
  from 1 to 0. This tests expiry enforcement, not natural passage of one hour.
  An older job correctly returned 403 after logout had revoked its session scope.
- New scheduled maintenance run `35803013050` succeeded on 2026-09-23.
- All six CI jobs passed for `fcc0085d0` in run `35801950336`.
- Production testing caught an early click before React hydration in the public
  walkthrough. Commit `14fa108db` disables server-rendered controls until hydrated;
  its local production build, component tests and three demo browser tests pass.
  Vercel did not auto-create a deployment for this push; the existing project's
  Create Deployment UI was used with verified `main` / `14fa108db`, Production.

## Final public acceptance

Vercel deployment `7sq7rtb8T1P4WSCuJDnLb5KsQHds` is Ready and serves the production
alias. Final Chromium run on that alias: **4 passed / 25.9 seconds**:

1. Real authenticated source → Explore → save/reopen/reload → dashboard → audience
   → JSON download.
2. Public login entry → all seven demo steps → actual JSON download with asserted
   fictional contents → page reload resets saves; zero project API requests.
3. 1280px keyboard navigation, no horizontal overflow, zero axe violations.
4. 390px keyboard navigation, no horizontal overflow, zero axe violations.

API ingestion, exact count, queued exports, cross-user denial, session revocation
and controlled expiry evidence above complement the browser run. This is not a
claim that a guest can write real project data. Independent public demo use needs
no credentials; connecting a real source needs an account from the administrator.

Both temporary acceptance accounts were disabled and their sessions revoked after
the final browser run. Only their synthetic records remain for audit; no unrelated
records were deleted. No administrative credentials were published.

Final application CI: [run 35802873760](https://github.com/godaylor/signal-studio/actions/runs/35802873760)
completed successfully, including verification, serverless and image packaging.

Historical broad M16 manual screen-reader and scale gates are not certified by
this bounded acceptance. Production backup/restore rehearsal is also a separate
operational follow-up, not claimed here. LICENSE and Umami MIT attribution are intact.
The initial worktree was clean; all changes in this task are scoped to demo,
wording, acceptance tests and release evidence.

## Changed files and commands

- Public UI: `src/app/demo/page.tsx`, `src/features/demo/*`, login page/CSS.
- RU wording: ExploreWorkspace, DashboardWorkspace, HomeWorkspace,
  QuerySpinePrototype; Home copy assertion updated.
- Acceptance: `scripts/verify-production.mjs`, public-demo and production-acceptance
  Playwright specs; public demo added to both CI browser profiles.
- Documentation: README, PLAN, PORTFOLIO_HANDOFF, PRODUCT_RELEASE,
  FREE_DEPLOYMENT, FREE_DEPLOYMENT_VERIFICATION and this report.

Executed: `node scripts/verify-production.mjs` (scoped fixture environment),
bounded audience/expiry probes, `pnpm build:vercel`, `tsc --noEmit`,
`tsc --noEmit -p tsconfig.e2e.json`, `biome lint .`, `vitest run`, and
`playwright test tests/e2e/public-demo.spec.ts tests/e2e/production-acceptance.spec.ts`
against the production origin. No schema/config secret changes were needed.

LICENSE SHA256 is unchanged:
`2a2a42dba0334d768c61edc8f5bb5d3732d94de23d99a7e539a719b1d5117ba0`.
