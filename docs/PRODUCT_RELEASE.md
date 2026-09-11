# M17 — Working product and hosting handoff

Verified 2026-09-11. M17 remains open until public production acceptance passes.
The product is a full Next.js/PostgreSQL application; there is no public URL yet.

## Delivered

- First-run project creation, tracker installation and live ingestion feedback.
- Studio entry/login/logout flow, responsive source setup, accessible login actions.
- Independent parameterized PostgreSQL event-count executor and six breakdowns.
- Correct session-dimension joins for unique users; no membership fanout for sums.
- Combined hosted application/worker image, durable exports and child supervision.
- Own repository metadata, release CI, screenshots, provenance and deployment guide.

Changed subsystems: `src/features/sources`, `studio-shell`, Home and Explore;
root/login/logout routes; `src/server/analytics`; Docker/start scripts; CI/CD;
tests and release documentation. No schema migration or dependency was added.
Hosted deployment requires `EXPORT_STORAGE_PATH=/app/exports` and a mounted volume.
See [deployment configuration](DEPLOYMENT.md) for all settings and bootstrap.

## Verification

Local Windows, Node 22.22.2, pnpm 10.15.1, PostgreSQL 15 in the existing project's
database container; isolated database `signal_studio_test_product_20260911`.
Only task-owned native processes and a separately named candidate container were
started/stopped. Other PetProjects containers, networks and volumes were untouched.
The preserved old demo at 32109 is not this release.

| Check | Result |
|---|---|
| Unit / `vitest run` | 160 files, 1035 tests passed |
| PostgreSQL integration | 11 files, 55 tests passed |
| Studio component tests | 9 files, 23 tests passed |
| Node release/supervisor tests | 4 passed |
| TypeScript application and E2E | Passed |
| Read-only lint | 0 errors; 29 warnings, 59 informational diagnostics |
| Production build and standalone packaging | Passed |
| Critical browser suite | Initial 25/28; all three failures fixed and targeted reruns passed |
| First-user source creation → ingestion → Explore | Passed after navigation race fix |
| Login, logout and product screenshots | Targeted 3 passed after login accessibility fixes |
| Docker app + worker export scenarios | 4 passed, including queued downloadable artifact |
| Dependency readiness | Candidate `/api/ready` returned 200 with PostgreSQL ready |
| Hosted process permissions | Supervisor, app and worker run as nextjs after volume initialization |
| Distribution provenance | 1029 components, 478 license texts; zero missing notice texts |

Commands are defined in package.json and `.github/workflows/ci.yml`. Local evidence
logs are under ignored `.local/product-*.log`; browser screenshots are committed
under `docs/screenshots`. GitHub Actions is the authoritative fresh Linux check
for the published commit: [CI runs](https://github.com/godaylor/signal-studio/actions/workflows/ci.yml).
Do not substitute an older green run for the published revision.

Automated Chromium/axe checks cover the changed onboarding/login and flagship
workflows, including RU mobile. Manual screen-reader certification is outstanding.
Permission and authentication integration tests passed. No new 1M-event performance
measurement was run; historical results are not a benchmark of the new executor.
ClickHouse parity, public TLS/ingestion, production backup restore and provider
restart persistence are not claimed as verified.

LICENSE is unchanged, SHA-256
`2a2a42dba0334d768c61edc8f5bb5d3732d94de23d99a7e539a719b1d5117ba0`.
Upstream copyright and Umami attribution are retained. Initial working tree was
clean; this release preserves upstream history and does not rewrite it.

## Remaining release gate

Authenticate a Railway account, create the dedicated project and PostgreSQL service,
configure variables/volume and deploy the documented image. Then run the public
acceptance checklist in DEPLOYMENT.md and add the verified URL to README, GitHub
About and PORTFOLIO_HANDOFF.md. Hosting registration and billing are not available
through current credentials. No paid service has been created.
