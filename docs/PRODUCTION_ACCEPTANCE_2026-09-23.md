# Production acceptance and public demo — 2026-09-23

Target: https://signal-studio-smoky.vercel.app, existing Vercel Hobby + Neon Free
`signal-studio` / Frankfurt. No new provider, paid resource, auth system or migration.

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
- Component tests: 6 passed (demo interactions/download and Home states).
- Public demo Playwright: 3 passed, including JSON contents, no project API calls,
  reset on reload, keyboard use, no horizontal overflow and zero axe violations
  at 1280px and 390px.
- Repository lint: zero errors; 39 existing warnings, 59 informational diagnostics.
- Test app used existing project port 32109; no DB, Docker container, network or
  volume was started or changed. No new dependency or licensed asset was added.

Public rollout, production browser test and expiry results will be recorded after
they pass. Historical broad M16 manual screen-reader and scale gates are not
certified by this bounded acceptance. LICENSE and Umami MIT attribution are intact.
The initial worktree was clean; all changes in this task are scoped to demo,
wording, acceptance tests and release evidence.
