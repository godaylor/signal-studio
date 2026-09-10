# M16 final local acceptance — GREEN, 2026-09-09

Historical evidence for the preserved installed build. Publication closure on
2026-09-10 is tracked in RELEASE_CLOSURE_REPORT.md; deferred requirements in
REQUIREMENTS_TRACEABILITY.md are not part of this historical GREEN claim.

All locally executable gates for the requested portfolio demonstration are complete.
Remote execution and actual human/device checks are explicitly excluded below.
This report does not claim public deployment or formal accessibility certification.

## Verified new gates

- Native production build, application TypeScript and E2E TypeScript: pass.
- Selected Chromium acceptance: 24 distinct scenarios passed across targeted runs.
  The initial run had 22 passes; only the two corrected failures were repeated.
  Corrected native export absolute storage path and mobile Legal target sizes.
  Workspace empty share-table keyboard scrolling corrected. Viewer denial was
  correct; its test now expects the actual permission screen.
- Linux runner/worker/migration builds: pass, Node 22.22.2 pinned by image digest.
- Linux preview: portfolio smoke passes, readiness200, admin/umami401,
  activation50% versus100%, EN desktop/RU390mobile, Explore URL reload,0 page errors.
- Linux retention/Legal E2E:3/3, including actual deletion, access denial,
  WCAG2.2AA axe, keyboard confirmation and six downloadable legal artifacts.
- Linux export API→worker→shared-file download:200,2 synthetic rows,1183 bytes;
  job181cc8c3-a2e4-4176-bfa4-714b4d8a5e39 on restored test DB.
- Lifecycle/tracked-identity integration:17/17; legacy reset/delete unit:2/2.
  Earlier affected ingestion/export/device tests90/90; lifecycle+export24/24;
  dedicated20-concurrent-ingestion lock regression included in lifecycle13/13.
- 1M concurrent benchmark:20 Dashboard viewers×4 widgets,50 Live viewers,
  background retention. Widget p95=813.42ms; Dashboard p95=921.86ms;
  Live p95=2081.19ms; cached historical p95=0.7254ms. No new index/rollup.
- Production shell5samples:usable p75=431.4ms,LCPp75=372ms,CLSp75=0.02909,
  script encoded bytes=1,021,849. Local lab, no CPU/network throttling;
  not field Core Web Vitals/INP or a real-device claim.
- Root LICENSE SHA256 unchanged:
  2A2A42DBA0334D768C61EDC8F5BB5D3732D94DE23D99A7E539A719B1D5117BA0.

## Backup and rollback rehearsal

Fresh backup: .local/backups/signal-studio-pre-m16-final-20260909.dump.
SHA256:5553000FE377701F0CC6229A924F8C7B38E20DDBD41C7792C5654383A498A060.
Restored into signal_studio_restore_test_20260909_m16:2projects/31events/1user/34migrations.
Migration35 then passed:2/31/1 preserved,zero lifecycle jobs. Previous app image
successfully returned ready200 on the migrated copy; no destructive schema rollback.
Actual erasure tests used only UUID-owned synthetic fixtures in isolated test DBs.

## Final installed runtime and packaging

- Main migration35 applied using the tested migration image. Counts remain
  2projects/31events/1user; main lifecycle jobs=0. No automatic purge enabled.
- Only own app/worker were recreated with `docker compose up -d --no-deps app worker`.
  Database volume `signal-studio-transform_signal-studio-db-data` and shared export
  volume `signal-studio-transform_signal-studio-export-data` were preserved.
- Final installed-site Chromium smoke passed: ready200,admin/umami401,
  activation50% versus100%,EN desktop/RU mobile/Explore reload,0 page errors.
- Main API→worker→download passed: job9afbb0fa-57e6-43f9-be50-fb51032400ca,
  completed,2rows,1183bytes,HTTP200. Synthetic artifact expires under normal export TTL.
- Final types and E2E types passed; `pnpm lint` exit0,1588files,0errors,
  26warnings/57infos retained without broad autofix. Three large generated SBOM
  files exceed Biome's size threshold; they were parsed as JSON separately.
- Migration35 readiness/runtime checks14/14 passed. Final lifecycle13/13 includes
  repeated identity erasure after the identity has physically disappeared.
- Docker Scout1.23.1 local:// SBOMs generated: runner1265,worker1356,migration1356
  components. These scanner counts include embedded build inventory and are not
  a count of exclusively runtime-reachable modules. Files: evidence/m16/*-image.cdx.json.
- Linux application inventory:1038components,zero missing notices/unknown licenses.
  Windows build inventory:1029components. Platform optional dependencies explain
  the difference. Full GPL/LGPL/OFL text and provenance sources are bundled.
- Runner is non-root `nextjs`; worker is non-root `nextjs`; migration is an explicit
  one-shot image. Runner contains no .env or .local. Root LICENSE hash matches.
- Runner image:sha256:a0ab23cbce27541c23dffd6739d8fbbd9a45b8a903c171ca80e6064f0014ed35.
  Worker:sha256:1762c574b1c89b5ef119393f0e2983e431571e42398e15c3703e231ae6fd0fab.
  Migration:sha256:bd23f805032681ef88f8120578d3b4d6ab793165899f8d82ba9325ba3e853302.
  Bundled source SHA256:85cda169fdfad6e9d3181ed4c25412144a2acfc4c82bf0b19dd7735655b293d4.
- Previous app/worker images retained with pre-m16-final-20260909 tags.
  Backups, restored/test databases and test export volumes retained. Only task-owned
  temporary servers were stopped. No foreign processes/containers were stopped.

## Local address and ports

http://127.0.0.1:32109/studio/9ecf84dc-2a53-4d62-985b-74adefd3a9d4/home

Site/API32109 and PostgreSQL32110 bind127.0.0.1. Worker has no port.
Temporary32140/32170/32171 are now free. Windows exclusions do not overlap32100–32199.
Login signal-owner; random password remains only in .local/credentials/administrator.json.

## Changed subsystems and evidence commands

- Lifecycle contracts/service/worker/ingestion gate, thin project lifecycle route,
  Workspace settings panel, exports access/storage invalidation and legacy reset/delete;
  additive prisma migration35/model. See M16_DATA_LIFECYCLE.md for exact deletion scope.
- MIT device parser pin/types/golden tests; self-hosted Inter/font loader;
  license maintenance/inventory scripts, docs/licenses, legal UI and Docker packaging.
- Native start paths now resolve shared export storage before standalone changes cwd.
  Existing React/TanStack Query state ownership retained; no new broker/service architecture.
- CI includes new lifecycle/legal/localization tests and legal image checks; no remote run claimed.
- Commands: `pnpm build`; `pnpm exec npm-run-all typecheck typecheck:e2e lint`;
  targeted Vitest integration/unit commands; `node scripts/run-release-e2e.js` with
  selected specs; `node scripts/measure-release-shell.js`; Docker target builds;
  pg_dump/pg_restore; explicit migration container; `docker scout sbom local://...`;
  `node scripts/portfolio-smoke.js`. All final listed commands exited0.
- Performance evidence: evidence/m16/concurrent-1m.json,
  shell-release-performance.json and unchanged prior home-metrics-1m.json/EXPLAIN.
  Desktop/mobile retention screenshots were visually inspected; keyboard/axe tests passed.
- Historical GREEN M0–M14/query golden/performance results were reused where untouched.
  No larger dataset, ClickHouse parity or unavailable external check is claimed.

## External only after local acceptance

GitHub CI execution needs the owner's repository/access; origin is still upstream.
Public hosting/domain/cloud credentials are not requested for this local delivery.
Actual device and human screen-reader smoke remain external/manual, not claimed passed.
No commit, push or public deploy performed. All pre-existing dirty changes preserved.
Branch remains master tracking origin/master; origin remains the upstream Umami URL.
An owned repository must be chosen before any future push. Existing worktree changes
were not discarded, reset or committed. Provenance limitations/declaration-only records
remain explicit evidence qualifications, not an assertion of trademark rights.

See M16_DATA_LIFECYCLE.md and M16_LICENSE_PROVENANCE.md for exact semantics,
store exclusions, attribution evidence and declaration-only notices.
