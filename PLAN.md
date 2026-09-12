# Signal Studio transformation plan

Status (2026-09-10): **Publication closure supersedes the earlier blanket readiness wording. M0–M16 GREEN evidence in docs/M16_FINAL_REPORT.md is historical, not automatic certification of changed code. Eight requirements are explicitly deferred for portfolio-v1 in docs/REQUIREMENTS_TRACEABILITY.md. Current candidate checks, installed-demo status and remaining GitHub/hosting/manual gates are recorded in FINAL_AUDIT.md and docs/RELEASE_CLOSURE_REPORT.md. No commit/push/deploy is authorized in this closure task.**
Source baseline: Umami 3.3.1, commit `ca661c7057984aa98ed4f7083d84dae2f65bfcb0`

## How to use this plan

The plan delivers small, verifiable vertical increments. A milestone is complete only when its user outcome works through the real stack and its tests, performance checks, security checks and documentation pass.

Source documents:

- `docs/BASELINE_AUDIT.md` — verified current state;
- `docs/PRODUCT_OPTIONS.md` — alternatives and decision;
- `docs/TRANSFORMATION_SPEC.md` — product/design requirements;
- `docs/ARCHITECTURE.md` — target boundaries and contracts;
- `AGENTS.md` — execution rules for future contributors/agents.

## Global delivery rules

- Preserve root `LICENSE`, Umami copyright and explicit open-source attribution.
- Do not rewrite the analytics kernel wholesale.
- Prefer vertical slices over layer-only rewrites.
- PostgreSQL is the reference backend until ClickHouse parity tests pass.
- Authorization is enforced server-side.
- Shareable analysis state belongs in the versioned URL/query contract.
- New analytical behavior needs deterministic query tests.
- New interactive UI needs keyboard/accessibility tests.
- No milestone is done with failing typecheck, lint or its selected CI tests.
- Performance claims require a named dataset and measured p50/p95 values.
- Existing user changes and unrelated dirty files must not be overwritten.

## Baseline regression floor

Before each implementation milestone begins, confirm or intentionally update:

- production build passes;
- TypeScript `--noEmit` passes;
- at least 739 current unit/component/API tests pass;
- clean PostgreSQL migrations pass;
- login/config/heartbeat smoke passes;
- any accepted E2E failures are linked to an active milestone;
- tracked source is clean apart from scoped work.

## Milestone map

| ID | Milestone | Primary result | Depends on |
|---|---|---|---|
| M0 | Reproducible foundation | One canonical local/CI setup | Baseline |
| M1 | Security/session foundation | Server-enforced secure auth | M0 |
| M2 | Test and semantic harness | Trustworthy green gates and golden data | M0-M1 |
| M3 | Design system and SaaS shell | Distinctive role-aware Studio shell | M2 |
| M4 | Project and tracked identity model | Project/account/user domain + seed | M2 |
| M5 | AnalysisQuery and URL foundation | One versioned analytical contract | M2, M4 |
| M6 | Explore trends and breakdowns | First complete analytical workflow | M3, M5 |
| M7 | Insight library | Save, reopen and duplicate analysis | M6 |
| M8 | Dashboard workspace | Curated dashboards from Insights | M7 |
| M9 | Advanced funnels | Breakdown/trend/time-to-convert/drill-down | M5-M7 |
| M10 | Behavioral cohorts and retention | Configurable cohort retention | M5-M7 |
| M11 | Accounts, users and segments | Operational audience workflows | M4-M6 |
| M12 | Experience evidence loop | Insight → session/replay/performance | M6, M9-M11 |
| M13 | Live snapshot | Efficient explicit near-realtime view | M5-M6 |
| M14 | Roles and safe sharing | Commercial permissions and revocable shares | M1, M7-M8 |
| M15 | Exports and audit jobs | Safe bounded/async data export | M11, M14 |
| M16 | Production hardening and release | Measured, accessible, observable release | All prior |

---

## M0 — Reproducible foundation

**Status:** Complete and independently verified on 2026-08-28.

### Goal

Turn the verified audit procedure into one documented, pinned and repeatable local/CI setup that builds the current checkout rather than an upstream `latest` image.

### User result

A new contributor can clone the repository, start PostgreSQL, migrate, seed, build, run and smoke-test the application without guessing Node, pnpm, secrets or browser prerequisites.

### Changed subsystems

- `package.json` toolchain metadata;
- environment examples and setup documentation;
- Docker/compose development profile;
- build/migration scripts;
- CI workflow;
- image packaging of license/notices;
- no product feature code unless required for health/readiness separation.

### Definition of done

- Node and pnpm versions have one canonical contract.
- Frozen install works from a clean checkout.
- Local compose builds `.` and does not silently pull upstream Umami `latest`.
- `APP_SECRET` example is generated/non-placeholder; unsafe production placeholders fail.
- Migrations are an explicit step and are idempotent.
- Seed creates a deterministic demo workspace/project.
- Production launcher matches Next standalone output.
- Build does not leave tracked-file changes.
- `LICENSE` is present in source and production image.
- README no longer contradicts CI/Docker runtime requirements.

### Tests

- clean-install script on an empty dependency cache where CI permits;
- frozen-lockfile check;
- clean PostgreSQL migration test;
- seed idempotency test;
- liveness/config/login smoke;
- image inspection for `LICENSE`;
- git dirty-tree assertion after build.

### Performance considerations

- record cold/warm install and build duration;
- keep image layers cacheable;
- avoid unpinned runtime package installation;
- record image size and startup readiness time.

### Risks

- changing deployment scripts can break existing self-hosted assumptions;
- pnpm major differences may change build-script policy;
- separating migrations from build may reveal hidden order dependencies;
- GeoLite provenance must be resolved rather than merely cached.

---

## M1 — Security and session foundation

**Status:** Complete and independently verified on 2026-08-28.

### Goal

Close baseline auth/session gaps before exposing new commercial SaaS surfaces.

### User result

Required 2FA cannot be bypassed through direct API calls; sessions expire and revoke predictably; login and shares have safe lifecycle behavior.

### Changed subsystems

- login, verify, logout and 2FA routes;
- common auth/request guard;
- JWT/session payloads and storage;
- password/session versioning;
- rate limiting;
- secret/env validation;
- management API CORS/security headers;
- security audit events;
- recorder cache-token validation.

### Definition of done

- full authorization token is issued only after required 2FA assurance.
- API guard checks required assurance server-side.
- auth tokens have explicit TTL and audience/type.
- logout and password change revoke applicable sessions.
- all full tokens contain password/session version.
- login rate limiting has deterministic limits and safe errors.
- `APP_SECRET` is mandatory outside explicit development mode.
- recorder cache token is bound to token type, project/website and session context.
- management CORS is separated from public ingestion CORS.
- users never see server stack traces.

### Tests

- direct API bypass attempt with required 2FA;
- pre/post-2FA token capability tests;
- expiry, logout and password-change revocation;
- backup code and OTP replay tests;
- login rate-limit tests;
- cross-website recorder token negative test;
- CSP/header snapshot/integration tests;
- existing permission suites.

### Performance considerations

- auth lookup/revocation adds bounded overhead;
- rate limiting must not create a global lock;
- cache/session store failure behavior is explicit;
- target auth guard overhead p95 below 25 ms excluding password hashing.

### Risks

- invalidating existing tokens can be a breaking change;
- Redis-optional deployments need a correct revocation fallback;
- CSP hardening can break Next/browser bundles;
- proxy deployments need documented client-IP trust rules.

---

## M2 — Test, CI and semantic harness

**Status:** Complete and independently verified on 2026-08-28.

### Goal

Create a trustworthy green quality floor and deterministic analytics golden dataset before adding new query behavior.

### User result

Changes can ship with confidence that login, permissions, date ranges and core metrics have not silently regressed.

### Changed subsystems

- Vitest/Playwright configuration;
- CI workflows;
- test fixtures/factories;
- baseline stale E2E specs;
- Biome config and current lint errors;
- analytics golden seed;
- date/timezone/query contract tests;
- optional test-only PostgreSQL orchestration.

### Definition of done

- lint and typecheck are green in CI.
- baseline unit tests remain green.
- stale E2E assertions reflect current secure API/UI behavior.
- E2E fixtures use unique identities and clean retry-safe state.
- Chromium install/service prerequisites are documented/automated.
- selected E2E runs on pull requests.
- golden dataset defines visitors, users, accounts, sessions, events, activation, funnel and retention expectations.
- date contract uses `[start, end)` and explicit timezone.
- current `startDate/endDate` parser mismatch has a regression test and resolution.

### Tests

This milestone is the test harness. Acceptance includes:

- repeated E2E runs with identical result;
- CI-mode retries do not corrupt fixtures;
- DST spring/fall cases;
- adjacent date ranges do not double-count boundary events;
- exact metric snapshots on golden seed;
- migration from empty DB.

### Performance considerations

- keep unit suite fast enough for every push;
- split long E2E/performance jobs without hiding failures;
- deterministic seed should be small; load seed is separate;
- record CI duration by stage.

### Risks

- fixing stale tests may expose real product defects;
- golden semantics may differ from current ClickHouse approximations;
- overly broad E2E can slow feedback;
- test-only behavior must not leak into production paths.

---

## M3 — Design system and commercial SaaS shell

**Status:** Complete with GREEN gate on 2026-08-28.

### Goal

Establish the distinctive Signal Studio visual language, navigation and responsive application frame without rewriting analytical features.

### User result

Users enter a polished workspace/project-oriented product with coherent navigation, states, typography, focus behavior and mobile structure.

### Changed subsystems

- new Studio route group/layout;
- design tokens, typography and chart tokens;
- navigation/project switcher;
- command palette shell;
- page headers, panels, drawers and state components;
- responsive behavior;
- accessibility primitives;
- legal/About entry with Umami attribution.

### Definition of done

- primary IA is Home, Explore, Dashboards, Audiences, Experience and Live.
- Website is presented as a Source, not the main navigation model.
- Query Spine visual primitive exists in a non-data prototype state.
- light/dark themes meet contrast targets.
- desktop/tablet/mobile navigation is equivalent.
- keyboard navigation and focus restoration work.
- loading/empty/error/permission patterns are documented and demonstrated.
- no generic decorative gradient/card proliferation.
- original Umami license/attribution is visible in Legal/About.

### Tests

- component interaction tests;
- axe checks for shell, navigation, drawer and dialog;
- keyboard-only navigation test;
- responsive Playwright snapshots at named breakpoints;
- reduced-motion test;
- visual regression for tokens and flagship shell.

### Performance considerations

- no new font blocks first render; fonts are locally hosted/subset where allowed;
- navigation bundle is measured;
- command palette indexes are lazy/bounded;
- shell layout should not shift after hydration.

### Risks

- `@umami/react-zen` constraints may conflict with the new visual language;
- introducing another design system can duplicate primitives;
- new fonts/assets need provenance review;
- visual work can outrun functional vertical slices.

### Completion evidence (2026-08-28)

- New `(studio)` routes and the role-aware responsive shell expose Home, Explore,
  Dashboards, Audiences, Experience and Live, with Sources under data management.
- Design tokens, documented loading/empty/error/permission states, keyboard focus
  restoration, command palette, mobile navigation and the non-data Query Spine are
  covered by 4 component files / 6 tests.
- Playwright: 5 shell/keyboard/responsive/visual scenarios, 1 axe scan and 1 shell
  performance scenario passed. Evidence covers desktop light/dark, tablet and mobile
  reduced-motion states under `docs/evidence/m3/`.
- Measured browser evidence: CLS `0`, `domComplete` `221 ms`, encoded script bytes
  `2,499,454` on the named local Chromium/dev environment.
- Legal/About visibly retains Umami 3.3.1 attribution and points to the unchanged MIT
  `LICENSE`; `@axe-core/playwright@4.10.2` provenance is recorded in notices.

---

## M4 — Project and tracked identity model

**Status:** Complete with GREEN gate on 2026-08-28.

### Goal

Introduce unambiguous Project, TrackedUser and TrackedAccount concepts with deterministic demo data.

### User result

A product team can see one project with real-looking accounts, users, traits, sessions, events, lifecycle stages and revenue—not anonymous website traffic alone.

### Changed subsystems

- Prisma schema/migrations;
- Project facade over Website;
- tracked identity/account models and services;
- identify/account ingestion contract;
- seed generators and demo dataset;
- permission/data-classification policies;
- basic read APIs, not final audience UI.

### Definition of done

- application `User` and `TrackedUser` are distinct in code/contracts.
- each tracked identity is tenant/project scoped.
- stable external user/account IDs are unique within documented scope.
- idempotent identify/account upsert works.
- account membership semantics are explicit.
- lifecycle/activation definitions are versioned or named constants.
- seed creates deterministic PLG accounts/users/events/revenue/sessions.
- deletion plan includes tracked identities and evidence data.

### Tests

- clean migration and rollback strategy review;
- idempotent upsert;
- cross-project duplicate external IDs do not collide;
- identity merge/update rules;
- permission/masking tests for sensitive traits;
- deterministic seed snapshot;
- deletion dependency integration test.

### Performance considerations

- index project + external ID and activity cursors;
- avoid per-event identity N+1 lookups;
- bulk/materialized update path where needed;
- measure seed generation and 1M-event projection cost.

### Risks

- incorrect identity merge corrupts analytical meaning;
- account membership can be temporal, not merely current;
- traits may contain PII;
- synchronous materialization may slow ingestion.

### Completion evidence (2026-08-28)

- Migration 27 adds project-scoped tracked users, tracked accounts and current account
  membership while the Project facade preserves Website as the existing Source record.
- Versioned identify/account ingestion is idempotent, preserves the legacy tracker
  contract, uses one bulk session-data statement and applies standard/sensitive trait
  masking through reusable permission scopes.
- Deterministic PLG seed is repeatable and idempotent; reset/delete removes identity
  dependencies before project evidence.
- Verification: targeted M4 suites `81/81`, regression suites `58/58`, full unit at the
  M4 gate `842/842`, PostgreSQL integration `5/5`, API Playwright `2/2`, typecheck and
  scoped lint GREEN.
- Named 1M-event local PostgreSQL 15 benchmark: projection p50 `2.75 ms`, p95
  `3.18 ms`; bounded tracked-user page p50 `4.13 ms`, p95 `5.51 ms`; seed
  `50.55 ms`. Evidence: `docs/evidence/m4/identity-performance.json`.
- Identity/API negative tests cover cross-project isolation, sensitive-trait masking and
  denied anonymous/share access. `LICENSE` and Umami attribution remain intact.

---

## M5 — AnalysisQuery, URL and query-service foundation

**Status:** Complete with GREEN gate on 2026-08-28.

### Goal

Create one versioned analytical contract shared by URL, API, cache and future Insights.

### User result

A copied analytical URL reopens the exact same valid question, including date, timezone, filters, breakdown and comparison.

### Changed subsystems

- `AnalysisQuery` schemas and versioning;
- URL parser/serializer;
- semantic definitions;
- query service/planner boundary;
- PostgreSQL adapter wrappers;
- result envelope;
- cache-key builder;
- query telemetry;
- validation/query budgets.

### Definition of done

- v1 trend/breakdown query schema is documented and runtime-validated.
- URL round-trip is stable and deterministic.
- reset filters removes only filter keys.
- route handler is thin and uses auth → permission → service.
- result reports generated/freshness time and exactness.
- cache key includes tenant, permission scope and normalized query.
- unsupported cardinality/range/operator combinations return actionable validation.
- existing query is wrapped without semantic regression on golden data.

### Tests

- property-based or table-driven codec round-trips;
- browser back/forward behavior;
- malformed/unknown query version;
- tenant and permission cache isolation;
- golden trend/breakdown results;
- timezone/date boundary cases;
- cancellation of superseded queries;
- query budget responses.

### Performance considerations

- normalize once per request;
- measure planner overhead separately from SQL;
- add 30-120 s bounded cache for historical queries;
- use single-flight for identical misses;
- record p50/p95 and rows scanned.

### Risks

- schema can become too generic before product modes are understood;
- URL may become unreadably large;
- wrapping dual SQL implementations can expose parity gaps;
- permission-sensitive cache mistakes are severe.

### Completion evidence (2026-08-28)

- `AnalysisQuery` v1 trend/breakdown contract, semantics, bounds, stable URL keys,
  parse/serialize round-trip and filter-only reset behavior are documented in
  `docs/ANALYSIS_QUERY_V1.md` and runtime-validated.
- Thin API flow is parse/authenticate/2FA assurance → project permission → service;
  cache keys isolate contract version, tenant, project, permission scope, normalized
  query, adapter, exactness and data version.
- The named PostgreSQL adapter wraps the existing custom-event count queries with
  half-open `[startAt,endAt)` ranges. ClickHouse remains explicitly unclaimed.
- Golden PostgreSQL integration proves DST-crossing trend `2/1/1`, bounded breakdown
  `4`, and adjacent boundary inclusion exactly once. M5 integration `3/3`; final full
  PostgreSQL integration `12/12`.
- Codec/validation/cache/adapter/service/API tests are `29/29`; final full unit,
  component and API suite is `871/871`. TypeScript app and E2E typechecks pass.
- Browser evidence: copied URL state survives back/forward, unknown versions fail
  safely, auth/permission/PostgreSQL API succeeds and query budgets return actionable
  `400`; all 4 scenarios passed after the user-facing `None` label correction.
- Migration 28 adds `(website_id,event_name,created_at)` for the bounded reference
  query. On 1M deterministic events in local PostgreSQL 15, uncached p50/p95 is
  `417.76/574.26 ms`, planner p50/p95 `0.31/3.22 ms`, cache hit `0.36 ms`, scanned
  rows `1,000,000`, approximate scanned bytes `155,410,432`; exactness is exact.
  Evidence: `docs/evidence/m5/analysis-query-performance.json`.
- Full Biome lint exits `0` with 10 pre-existing warnings and 7 infos outside this
  milestone. The canonical build command was attempted but the available Node
  `22.15.1` is rejected before compilation by the pinned `22.22.x` engine; this is an
  environment limitation, not a relaxed supported-runtime claim.
- Root `LICENSE`, Umami copyright and explicit based-on-Umami attribution are intact.

---

## M6 — Explore trends and breakdowns

### Goal

Deliver the first complete Signal Studio analytical workflow using the new shell and query contract.

### User result

An analyst can choose an event/metric, date and filters, compare segments/periods, view a chart and table, drill into a result and share the URL.

### Changed subsystems

- Explore page and Query Spine;
- metric/event pickers;
- date/timezone/compare controls;
- typed filter builder;
- trend and breakdown charts;
- analytical result table;
- drill-down drawer;
- query hooks and error states.

### Definition of done

- trend and one-dimension breakdown work on seeded data.
- compatible aggregations are enforced by type.
- previous-period and one-segment comparison work.
- chart and table represent the same result.
- full query is URL-reproducible.
- copied URL works in a new session with permissions.
- loading, empty, partial, stale and error states are explicit.
- chart has accessible summary/table equivalent.
- result row opens affected users/sessions where supported.

### Tests

- Explore component and URL integration;
- filter operator/type compatibility;
- compare math and labels;
- chart/table consistency;
- keyboard Query Spine editing;
- axe and reduced-motion checks;
- Playwright shareable URL scenario;
- permission denial and empty data.

### Performance considerations

- target uncached p95 ≤ 1.5 s at 1M events;
- cancel stale requests;
- cap breakdown cardinality;
- virtualize only genuinely large tables;
- prevent duplicate chart/table fetches.

### Risks

- Query Spine may consume too much screen width;
- high-cardinality properties can overload queries/UI;
- local and URL draft state can diverge;
- comparison semantics can confuse users without definitions.

### Completion evidence (2026-08-28)

- Explore now provides the typed Query Spine, trend/breakdown chart and equivalent
  table, bounded filters, date/timezone controls, previous-period and segment compare,
  URL reproduction, copy link and bounded drill-down through the normalized v1 API.
- Loading, empty, stale/partial, permission and actionable error states are explicit;
  the chart has a text summary/table equivalent, visible focus and reduced-motion-safe
  styling. No migration was required for M6.
- Focused analytics/codec/planner/service tests pass as part of the final `49/49`
  server/API suite; Studio component/accessibility/state tests pass `16/16`.
  The final browser gate passes all five M6 scenarios, including back/forward URL
  restoration, unknown-version recovery, permission/budget API behavior and drill-down.
- The PostgreSQL adapter and 1M-event dataset are unchanged from M5: uncached p95 is
  `574.26 ms` against the `<=1.5 s` budget. Superseded requests use `AbortSignal`,
  breakdown cardinality is capped and chart/table share one TanStack query.

---

## M7 — Insight library

### Goal

Make analytical work persistent and reusable.

### User result

An analyst can save Explore state as an Insight, reopen it exactly, duplicate shared work and find recent/favorite insights.

### Changed subsystems

- Insight schema/migration;
- Insight CRUD and permissions;
- save/duplicate/archive flows;
- Insight library/search/recent/favorite UI;
- query-version migration handling;
- audit events.

### Definition of done

- saved Insight stores normalized query and visualization config.
- reopening reproduces the result and definition.
- edit, duplicate and archive follow role rules.
- optimistic UX rolls back on error.
- stale query versions fail safely or migrate explicitly.
- library supports search, owner/status and cursor pagination.
- dependencies are visible before destructive archive/delete.

### Tests

- CRUD/permission matrix;
- query round-trip and version mismatch;
- duplicate isolation;
- optimistic rollback;
- search/pagination;
- audit record;
- Playwright save → reopen → copy URL.

### Performance considerations

- index workspace/project/owner/updated cursor;
- list queries do not load analytical results;
- prefetch only likely recent items;
- avoid storing large result payloads in Insight.

### Risks

- query-schema changes can strand saved work;
- duplicate/edit semantics may confuse collaboration;
- deleting referenced Insights can break dashboards.

### Completion evidence (2026-08-28)

- Migration `29_insight_library` is applied. An Insight stores a normalized query and
  visualization config without result payloads; indexed cursor listing supports
  search, owner, status and favorite filters.
- Reusable server permissions cover admin, project/team owners, managers, members and
  view-only users. Create/edit/duplicate/archive are enforced server-side; stale query
  versions fail safely, duplicates are isolated and dashboard dependencies are shown.
- Explore can save an Insight; the library can search, reopen exactly, edit, favorite,
  duplicate and archive it. Optimistic mutations restore the prior cache on failure.
- Focused service/route/hook tests pass (`11/11` before final aggregation); browser
  save -> reopen -> copy URL and API lifecycle scenarios pass (`2/2`). PostgreSQL
  contains real `insight.created/updated/duplicated/archived` audit events.

---

## M8 — Dashboard workspace

### Goal

Build curated commercial dashboards from reusable Insights.

### User result

A team can assemble an executive/product dashboard, apply shared date/segment context and understand freshness or per-widget failure.

### Changed subsystems

- Board/Dashboard compatibility layer or migration;
- widget-to-Insight references;
- responsive grid/edit mode;
- global context overrides;
- notes/section headers;
- dashboard permissions and shares foundation;
- query deduplication.

### Definition of done

- dashboard adds existing Insights, not copied ad hoc query blobs.
- view and edit modes are distinct.
- date/segment override visibly marks incompatible widgets.
- widgets expose definition/freshness and link back to Insight.
- per-widget error does not fail whole dashboard.
- keyboard alternative exists for layout editing.
- responsive view mode works on mobile.
- identical queries are deduplicated.

### Tests

- add/remove/reorder/resize;
- keyboard layout controls;
- global override compatibility;
- permission matrix;
- partial-error rendering;
- responsive visual regression;
- Playwright Insight → Dashboard flow.

### Performance considerations

- cap/constrain visible concurrent widget queries;
- share TanStack and server cache;
- lazy-load below-fold widgets;
- target usable shell while data streams in;
- record dashboard p75 and query fan-out.

### Risks

- drag/drop can be inaccessible;
- too many widgets can overload database and browser;
- legacy Board schema may not map cleanly;
- global context can silently alter metric meaning.

### Completion evidence (2026-08-28)

- Migration `30_dashboard_workspace` is applied. Dashboard widgets reference active
  project Insights (or bounded note/header content), never copied ad hoc query blobs;
  mutations enforce ownership/manager permissions and the 12-widget cap.
- View/edit modes, add/remove/reorder/resize, keyboard layout controls, notes/headers,
  persisted global date/segment context, incompatible-context badges, definitions,
  freshness and Explore links work through thin typed routes and service boundaries.
- Per-widget failures remain isolated. Responsive mobile view passes WCAG 2.2 AA axe
  checks and the stored Chromium visual snapshot. Two identical Insight widgets
  issue one analytics request; applying one distinct global context adds exactly one.
- Dashboard context/permission/component tests pass within the final `65/65` focused suite;
  API plus Insight -> Dashboard browser scenarios pass `2/2`. On Docker Node 22.22.2,
  PostgreSQL 15 seeded workspace and local headless Chromium, navigation to a visible
  Dashboard shell has p75 `567.77 ms` over nine samples.
- Final gates on the current checkout: app and E2E typechecks pass; focused Biome
  checks `46/46` files clean; focused Vitest `65/65`; combined M6-M8 Playwright `9/9`;
  exact pinned-runtime Docker build passes and both app/database containers are healthy.

---

## M9 — Advanced funnels

**Status:** Complete with GREEN gate on 2026-09-03.

### Goal

Turn the existing funnel primitive into a decision-ready product analytics workflow.

### User result

An analyst can locate a conversion bottleneck, compare a segment, see conversion trend/time-to-convert and inspect dropped users/accounts/sessions.

### Changed subsystems

- normalized funnel contract and planner;
- PostgreSQL funnel query and result model;
- funnel Query Spine mode;
- step visualization, trend and time distribution;
- breakdown/segment compare;
- converted/drop-off drill-down;
- Insight support.

### Definition of done

- ordered 2-8 step funnel with conversion window.
- per-step and global typed filters.
- entrant, converted, drop-off and overall metrics are defined.
- one breakdown or segment compare.
- conversion trend and time-to-convert distribution.
- drill-down to matching users/accounts and sessions.
- URL and Insight round-trip.
- exactness and timezone are visible.

### Tests

- golden funnels with repeated/out-of-order events;
- conversion-window boundaries;
- same-timestamp and duplicate events;
- segment/property filters;
- drop-off user membership;
- URL codec;
- component/a11y/E2E funnel scenario.

### Performance considerations

- target 4-step p95 ≤ 2.5 s at 1M events;
- enforce step/date/property budgets;
- inspect query plans;
- cache closed ranges;
- defer total user materialization until drill-down.

### Risks

- funnel semantics are easy to misstate;
- property-heavy steps can produce expensive joins;
- exact distinct can be slow;
- drill-down membership must match aggregate exactly.

### Completion evidence (2026-09-03)

- `AnalysisQuery` v1 now normalizes ordered 2-8 step funnels, a bounded 1-43,200
  minute conversion window, global typed filters and up to four property filters per
  step. Exact actors use `distinctId` with a session fallback; ordering is deterministic
  by timestamp and event ID, the conversion-window boundary is inclusive and the outer
  analytical range remains half-open `[start, end)`.
- Explore exposes the funnel Query Spine, exact step/drop-off table, optional bounded
  breakdown or typed segment comparison, conversion trend and time-to-convert
  distribution. Definitions, exactness and timezone are shown with the result.
- Identity-sensitive drill-down is enforced server-side and materializes at most 20
  matching users/accounts with their sessions only after the analyst opens a step.
  Aggregate queries never fetch the member list.
- Funnel state round-trips through the stable URL codec and owned Insight query. Existing
  Dashboard rendering accepts the advanced result rows without changing Insight
  ownership or M8 query deduplication.
- Focused verification is GREEN: shared M9-M10 analytics semantics `5/5`, drill-down API
  permission tests `2/2`, Explore component/accessibility tests `9/9`, PostgreSQL golden
  integration tests `3/3`, and Chromium Explore regression/funnel/retention flows `3/3`.
- On the named 1,000,000-event/10,000-actor PostgreSQL 15 Docker fixture (50,000 relevant
  events, five post-VACUUM/ANALYZE samples), the exact four-step funnel measured p50
  `999.69 ms`, p95 `1,094.85 ms` against the `2.5 s` budget. EXPLAIN used an Index Only
  Scan on `website_event_website_id_event_name_created_at_idx` with about 40,001 plan
  rows. Evidence: `docs/evidence/m9-m10/advanced-performance.json`.

---

## M10 — Behavioral cohorts and retention

**Status:** Complete with GREEN gate on 2026-09-03.

### Goal

Unify saved cohorts and retention into one configurable behavioral model.

### User result

An analyst can define entry and return behavior, compare cohorts and open a retention cell to understand its users/accounts.

### Changed subsystems

- cohort definition schema and persistence;
- retention query contract/service;
- daily/weekly/monthly matrix and curve;
- cohort compare;
- cell drill-down;
- segment/cohort terminology migration;
- Insight support.

### Definition of done

- entry and return behaviors are independent.
- daily/weekly/monthly granularity is bounded and defined.
- matrix, curve and cohort size agree.
- two segments/cohorts can be compared.
- cell opens exact matching members.
- saved Cohort is reusable in Explore.
- no ambiguity between audience Cohort and matrix row.
- URL/Insight round-trip passes.

### Tests

- golden retention across period boundaries;
- timezone/DST;
- cohort entry once versus repeated;
- N-period return semantics;
- empty/small cohorts;
- cell membership parity;
- accessible matrix keyboard navigation;
- Playwright save/reuse cohort.

### Performance considerations

- target 12-cohort p95 ≤ 3 s at 1M events;
- bounded date/granularity combinations;
- precompute only after measured need;
- avoid fetching member lists with the aggregate;
- cache stable historical matrices.

### Risks

- behavioral retention definitions can be misunderstood;
- matrix accessibility is nontrivial;
- account/user identity changes can affect past cohorts;
- long ranges can be expensive.

### Completion evidence (2026-09-03)

- Entry and return behaviors are independent. Daily, weekly and monthly retention is
  bounded to 12 periods, assigns an actor to entry once, uses timezone/DST-safe period
  identities and defines period N as an exact return in that period.
- The accessible matrix, weighted retention curve and cohort-size values share the same
  exact rows. Semantic buttons provide keyboard navigation; an identity-sensitive cell
  drill-down returns the same bounded member population as the aggregate cell.
- Behavioral Cohorts persist project-scoped definitions through the existing `Segment`
  store as `behavioral-cohort.v1`, reopen in Explore and participate in typed segment
  comparison. No schema migration was needed; matrix rows remain analytical results and
  are not mislabeled as saved Cohorts. Retention state also round-trips through URL and
  Insight queries.
- On the same named 1M-event PostgreSQL fixture, exact 12-period retention measured p50
  `1,446.29 ms`, p95 `1,639.06 ms` against the `3.0 s` budget; a stable historical cache
  hit measured `75.28 ms` against the `300 ms` budget. The repeatable fixture is vacuumed
  and analyzed before samples so prior test-owned deletes cannot distort p95.
- Final gates are GREEN: app and E2E TypeScript checks, focused Biome `23/23` files, exact
  Node `22.22.2` Docker production build, all 30 clean PostgreSQL migrations plus seed,
  database readiness, and the focused test counts recorded above. The application image
  contains root `LICENSE` and `THIRD_PARTY_NOTICES.md`; upstream Umami attribution remains
  intact. ClickHouse capability is not claimed or enabled for these queries.
- Local infrastructure is isolated as Compose project `signal-studio-transform`, network
  `signal-studio-transform_default`, volume
  `signal-studio-transform_signal-studio-db-data`, application `127.0.0.1:32109` and
  PostgreSQL `127.0.0.1:32110`. Foreign containers, volumes and processes were not
  changed.
- Environment limitation: host `pnpm` remains blocked by its pre-existing Node `22.15.1`
  engine mismatch, so direct TypeScript/Vitest diagnostics were used locally and the
  canonical production build ran in the pinned Node `22.22.2` Docker path. The in-app
  browser runtime hit a Windows sandbox ACL error once; local Playwright Chromium plus
  axe completed the required browser/accessibility evidence instead.

---

## M11 — Accounts, users and operational segments

**Status:** Complete with GREEN gate on 2026-09-03.

### Goal

Make audiences actionable and connect aggregate analytics to real product identities.

### User result

Product and customer-success users can find accounts/users, understand lifecycle and adoption, inspect activity, preview segments and trace segment usage.

### Changed subsystems

- tracked account/user list/detail APIs;
- cursor pagination/search/sort;
- lifecycle/activation/health definitions;
- account/user profile UI;
- segment builder, size preview, freshness and dependencies;
- trait masking/permissions;
- activity timelines.

### Definition of done

- account and user lists are cursor-paginated.
- profiles show definition-backed lifecycle/adoption, not opaque scores.
- account members and user sessions are linked correctly.
- sensitive traits follow data classification and roles.
- segment builder previews estimated/exact size with timestamp.
- segment dependencies are visible before edit/delete.
- sample members open profile/session evidence.
- URL filters/search/sort are reproducible where useful.

### Tests

- cursor stability and duplicate timestamps;
- tenant isolation;
- masked field matrix;
- lifecycle/activation golden definitions;
- segment all/any/property/behavior tests;
- dependency checks;
- large table keyboard/search flows;
- Playwright account → user → session.

### Performance considerations

- target page p95 ≤ 800 ms;
- index project + lifecycle + activity cursors;
- avoid per-row metric queries;
- precompute bounded summaries only when measured;
- debounce search with cancellation.

### Risks

- opaque health score would reduce trust;
- N+1 profile/list queries;
- PII exposure;
- segment preview can be as expensive as full evaluation.

### Completion evidence (2026-09-03)

- Project-scoped account and tracked-user APIs now provide stable cursor pages bound
  to sort/direction with value + ID tie-breaking, bounded search/lifecycle filters and
  role-aware field selection. Audiences exposes reproducible URL search/sort/filter
  state, debounced queries with cancellation, keyboard-operable first-class tables and
  explicit loading, empty, error and masked states.
- Account/user profiles link members and sessions and report exact linked session/event
  adoption counts alongside the versioned activation definition; no opaque health score
  or per-list-row metric query was introduced. Sensitive names, external IDs and
  classified traits are omitted from standard-role responses.
- Operational Segments persist as `operational-segment.v1` definitions in the existing
  project Segment store. The builder bounds all/any lifecycle, allowlisted trait and
  recent behavior conditions, returns an exact timestamped count/sample, opens sample
  profiles and exposes Insight/Dashboard dependencies before blocking deletion.
- Migration `31_operational_audiences_evidence` adds project + first-seen,
  project + lifecycle + last-seen and project + distinct-user session cursor indexes;
  it is applied as migration 31/31 on the isolated PostgreSQL reference database.
- Focused gates are GREEN: M11 server/API tests `12/12`, Audiences component tests
  `2/2`, shared PostgreSQL identity/segment/evidence integration `3/3`, the shared
  performance test `1/1`, and the account → user → session plus Segment Chromium
  scenarios. Tenant isolation, duplicate timestamps, masked fields, all/any behavior,
  dependency blocking, keyboard flow and zero serious/critical axe violations are covered.
- On PostgreSQL 15 in `signal-studio-transform`, a vacuumed/analyzed fixture of 10,000
  tracked users (50-row lifecycle page) measured p50 `3.20 ms` and p95 `19.13 ms`,
  within the `800 ms` target. Evidence is stored in
  `docs/evidence/m11-m12/operational-performance.json`.

---

## M12 — Experience evidence loop

**Status:** Complete with GREEN gate on 2026-09-03.

### Goal

Integrate sessions, replay, heatmaps and performance into product-analysis drill-downs.

### User result

From a funnel drop-off, retention segment or account profile, a user can open relevant sessions and understand behavioral/performance evidence without switching to disconnected tools.

### Changed subsystems

- common evidence drawer/routes;
- session detail timeline;
- replay player integration;
- heatmap/performance context handoff;
- session/replay permissions and privacy states;
- evidence links from Explore/Funnel/Retention/Audiences;
- masking/admin notices.

### Definition of done

- aggregate result can produce a semantically matching evidence query.
- session detail combines identity, event timeline, properties and performance.
- replay availability/recording disabled/masked states are explicit.
- replay access has separate permission capability.
- heatmap/performance inherit only compatible filters.
- back navigation restores aggregate analysis.
- sensitive text/traits are not exposed to unauthorized roles.

### Tests

- aggregate-to-session membership;
- permission denial for replay/sensitive traits;
- masked replay fixtures;
- deep-link/back-state restoration;
- empty/unavailable evidence;
- keyboard player/drawer controls;
- Playwright funnel → account/user → session/replay.

### Performance considerations

- lazy-load rrweb/player bundles;
- paginate/stream long activity;
- bound replay chunk fetching;
- do not preload replay for every list row;
- measure drawer open and player ready time.

### Risks

- replay privacy and storage cost;
- filter contexts do not always map to sessions exactly;
- heavy dynamic bundle can hurt core analytics pages;
- heatmap screenshot provenance/retention.

### Completion evidence (2026-09-03)

- Explore trend/breakdown and funnel/retention member results, plus account/user profiles,
  now open a project-scoped Experience route. Aggregate links preserve the full return
  URL and pass only compatible half-open date range and exact URL-path context; Back to
  analysis restores the original query.
- The bounded session contract combines identity, chronological cursor-paginated events,
  classified properties, page text, device context and observed LCP/INP/CLS. Standard
  roles receive masked labels with no sensitive properties/page titles. Empty, missing,
  loading and error states remain explicit.
- Replay is a separately enforced server capability. Recording-disabled, unavailable,
  permission-denied and strict-masked available states are visible; chunks are capped at
  50 and restored events at 50,000. The existing replay/player bundle is dynamically
  loaded only after explicit activation. Heatmap/performance handoff excludes
  identity-only filters.
- M12 contract/privacy/replay tests pass `5/5`; Experience component tests pass `3/3`;
  the touched Explore regression suite passes inside the `14/14` component run; shared
  PostgreSQL integration passes `3/3`. Final Chromium workflows pass `3/3`, including
  funnel → exact member → session → restored funnel, responsive account evidence,
  strict-masked replay readiness and keyboard focus on replay controls.
- On the named 10,000-identity / 1,000-event / 5-replay-chunk PostgreSQL fixture,
  the 50-event evidence page measured p50 `10.64 ms`, p95 `19.46 ms`; replay payload
  readiness measured p50 `1.14 ms`, p95 `2.78 ms`. Mobile Chromium rendered the lazy
  replay player in `846 ms` in the final focused run.
- Final gates pass: app and E2E TypeScript, focused Biome, exact Node `22.22.2` Docker
  production build, all 31 clean migrations, seed and readiness. App/database remain
  healthy at `127.0.0.1:32109` / `127.0.0.1:32110` under Compose project
  `signal-studio-transform`; no foreign containers, volumes, processes or ports changed.
  Root `LICENSE`, Umami attribution and `THIRD_PARTY_NOTICES.md` remain intact; no new
  third-party asset was added and ClickHouse parity is not claimed.
- Environment limitations: host Node remains `22.15.1`, so local focused checks used
  direct installed CLIs and the canonical build used Docker Node `22.22.2`. The in-app
  browser runtime exited during its connection attempt; local Playwright Chromium plus
  axe completed the required UI/accessibility evidence.

---

## M13 — Live snapshot and near-realtime

**Status:** Complete with GREEN gate on 2026-09-03.

### Goal

Replace uncontrolled multi-query polling behavior with an explicit, cacheable live snapshot workflow.

### User result

Users see current activity, active users/accounts and freshness, can pause/resume updates, and retain the last valid snapshot on connection loss.

### Changed subsystems

- live snapshot service/result contract;
- short server cache/single-flight;
- adaptive polling transport;
- Live page and virtualized stream;
- pause/resume/last-updated/degraded states;
- visibility-aware client behavior;
- realtime metrics.

### Definition of done

- one timestamped snapshot powers compatible Live widgets.
- last-updated and transport state are visible.
- hidden tabs reduce/stop polling.
- pause freezes the view without losing the last result.
- multiple viewers reuse short-lived snapshot/cache.
- errors preserve prior data and offer retry.
- transport can later change to SSE without UI contract changes.

### Tests

- snapshot schema and freshness;
- cache/single-flight concurrency;
- visibility pause/resume;
- reconnect with last valid state;
- virtualized stream behavior;
- tenant isolation;
- Playwright pause/reconnect scenario;
- load test with concurrent viewers.

### Performance considerations

- freshness target ≤ 10 s;
- measure DB queries/min per viewer and shared cache hit rate;
- cap activity rows;
- consider minute rollups;
- prevent historical widgets from joining live refresh loop.

### Risks

- polling still overloads DB if cache keys diverge;
- clock/freshness semantics can mislead;
- event ordering under late arrival;
- virtualization and live inserts can disrupt user focus.

### Completion evidence (2026-09-03)

- Studio Live now consumes one versioned timestamped snapshot for active identified
  users/accounts, visitors, events, minute series, changing behaviors and the bounded
  activity stream. The contract defines a trailing 30-minute UTC `[start,end)` window,
  latest-event freshness, late-arrival behavior, an 8-second cache and a 10-second
  recommended polling cadence; its transport field accepts polling or future SSE
  without changing the UI data contract.
- The thin authenticated project route resolves tenant and permission scope before the
  cache boundary. The in-process key includes contract version, tenant, project,
  permission scope and database adapter; compatible misses single-flight and activity
  is capped at 100 rows. PostgreSQL joins identified users/accounts without returning
  names, external IDs or traits. ClickHouse identity counts remain null/zero and no new
  ClickHouse parity is claimed.
- Live visibly reports transport, generated time, data-through freshness and shared
  cache state. Pause and hidden-tab states stop polling without clearing the last valid
  result; refresh errors retain that result and expose Retry. The virtualized stream
  links to matching Experience evidence. Empty/loading/error states, semantic tables,
  keyboard-focusable scroll regions, responsive mobile layout and reduced-motion
  behavior are implemented.
- Focused schema/cache/tenant/visibility/SSE/pause/reconnect/virtualization/API tests
  pass `12/12`; the isolated PostgreSQL golden integration passes `1/1`, including an
  identified user/account and the half-open range. The Chromium pause/reconnect/mobile
  axe workflow passes `1/1`: a paused view made zero requests across a full 10.5-second
  interval, reconnect restored transport, and no serious/critical WCAG violations
  remained.
- Production load evidence used PostgreSQL 15 and the seeded project with 4 sessions,
  8 events, 3 tracked users and 2 accounts under Compose project
  `signal-studio-transform`. Two synchronized waves of 50 viewers produced 100
  responses from 2 database loads (98 single-flight), a 98% shared hit rate, p50
  `506.06 ms` and p95 `512.64 ms`. At the 10-second cadence this is 18 underlying
  queries/minute total, or `0.36` per viewer; a separate production request returned a
  snapshot age of `10 ms`. The seeded events were outside the current live window, so
  production `freshnessAt` and activity were correctly empty rather than fabricated;
  the PostgreSQL fixture verifies non-empty latest-event freshness.
- App and E2E typechecks, focused Biome and the exact Node `22.22.2` Docker production
  build pass. No migration, dependency, font or third-party asset was added. The final
  app/database remain healthy on `127.0.0.1:32109` / `127.0.0.1:32110`; no foreign
  container, volume, process or port was changed. Root `LICENSE`, Umami attribution and
  `THIRD_PARTY_NOTICES.md` remain intact.
- Environment limitations: host Node remains `22.15.1`, so focused checks used the one
  repo-local engine-check bypass and the canonical build used Docker Node `22.22.2`.
  The in-app browser controller exited during initialization; repo-local Playwright
  Chromium plus axe completed the required browser/accessibility gate.

---

## M14 — Roles and safe sharing

### Goal

Deliver the proposed commercial role matrix and revocable, expiring internal/public sharing.

### User result

Workspace owners can invite the right roles; viewers see safe dashboards; public links expose only intended data and can be revoked immediately.

### Changed subsystems

- role/capability model and migration from existing roles;
- permission services for Insights/Dashboards/Audiences/Experience;
- member management UI;
- share records/tokens, expiry/revocation/scope;
- audit trail;
- permission-aware navigation and fields.

### Definition of done

- Owner/Admin/Analyst/Editor/Viewer capabilities are documented and server-enforced.
- replay/sensitive traits/export/public share are separate capabilities.
- existing users map predictably to new roles.
- share token references a live share record.
- share has expiry, revocation and explicit resource/data scope.
- deleting/updating share changes access promptly.
- role/share changes are audit logged.
- permission-denied UI is clear and does not leak data.

### Tests

- full role/action/resource matrix;
- cross-workspace/project negatives;
- field masking;
- share expiry/revocation/change scope;
- old token after share deletion;
- navigation versus direct API;
- audit events;
- Playwright Viewer and public-share flows.

### Performance considerations

- cache capability decisions safely;
- permission scope is part of analytics cache key;
- revocation latency has a measured bound;
- member lists use cursor pagination if needed.

### Risks

- migration from admin/user/view-only can overgrant;
- cache can delay revocation;
- UI hiding may be mistaken for enforcement;
- public share can expose sensitive drill-downs.

### Completion evidence (2026-09-04)

- The additive PostgreSQL migration `32_roles_and_safe_sharing` adds nullable
  `studioRole`, JSON capability overrides and live share metadata without removing or
  renaming legacy role/share fields. The local Compose migration is applied; the
  existing membership is backfilled and no membership has a missing `studioRole`.
  Legacy wire values remain unchanged, including `team-member` for Analyst.
- The reusable server capability resolver implements the complete
  Owner/Admin/Analyst/Editor/Viewer matrix. A valid `studioRole` is authoritative, so
  Analyst does not inherit Editor rights from legacy `team-member`; installation-wide
  admins remain superusers. Replay, sensitive traits, export and public sharing are
  independent capabilities with conservative default-deny and validated per-member
  overrides. Permission-sensitive analytics cache scopes include tenant/project and
  resolved data scope.
- Member contracts, services, project APIs and workspace access UI support product
  roles and capability overrides. Insight, Dashboard, Audience, identity, replay and
  export routes enforce the shared server resolver; direct requests do not rely on
  navigation hiding. Role/share mutations write safe audit events. Identity list
  integration proves regular traits remain visible while external ID, display name
  and sensitive traits stay masked until an explicit override is granted.
- New public shares accept only Insight or Dashboard and persist the fixed
  aggregate-only scope. Tokens carry type, audience, issuer, short expiry and live
  record version; expiry, revocation, deletion or scope/expiry version changes reject
  old tokens. Cross-project resources are rejected. Legacy share creation routes are
  closed while existing legacy records remain readable/revocable for compatibility.
  Local revocation measured below the `1.5 s` test bound.
- Signal Studio user surfaces, auth, navigation, forms, states, roles and sharing are
  localized for public `ru-RU` and `en-US`; unknown/retained upstream locales safely
  normalize to Russian. The selector visibly exposes only RU/EN and persists the
  choice. User-visible Umami wordmarks/logo defaults were replaced while technical
  package/API/database/cookie/storage/environment identifiers and legal attribution
  remain compatible. Title, manifest and active RU/EN metadata use Signal Studio.
- Final focused verification passes: application and E2E typechecks; full Biome lint
  with only 10 existing warnings and 7 infos; `70/70` unit/API regressions; `5/5`
  isolated PostgreSQL integration tests; `3/3` dialog/command-palette component tests;
  and `3/3` Chromium flows for locale persistence, a live aggregate-only public
  Insight with immediate revocation, and an authenticated Viewer navigation/direct-API
  boundary. The canonical Docker production build passes on Node `22.22.2-alpine`;
  app and PostgreSQL are healthy on `127.0.0.1:32109` and `127.0.0.1:32110`, and
  `/api/ready` reports the database ready.
- The authenticated Viewer browser gate passes with a disposable local user whose
  random password existed only in Playwright process memory. The flow proved the
  aggregate-only navigation and query path, permission state without identity
  fetches, and direct `403` responses for member, share, identity and export APIs.
  All Viewer, public-share and integration fixtures, related Viewer audit records and
  credentials were deleted after the tests; a final database check found zero M14
  users, workspaces, projects and shares. Root `LICENSE`, Umami attribution and
  `THIRD_PARTY_NOTICES.md` remain intact. M14 is GREEN.

---

## M15 — Exports and audit jobs

### Goal

Expose safe product-level CSV/JSON exports and introduce the minimal background-job foundation for large datasets.

### User result

Authorized users can export the analysis they see, understand status for larger exports and download a correctly scoped, expiring artifact.

### Changed subsystems

- visible export controls in Explore, tables and dashboards;
- normalized export definition;
- bounded streamed CSV/JSON;
- ExportJob model/service/worker entrypoint;
- optional object/local storage adapter;
- download authorization/expiry;
- audit events and job UI.

### Definition of done

- current visible result exports with filters/date/definitions.
- filenames are meaningful.
- CSV formula injection remains prevented.
- hard sync row/size limits are enforced.
- large export becomes queued job, not in-memory ZIP.
- requester can view status, failure and expiry.
- permission is checked at request and download.
- sensitive columns obey role scope.
- audit log captures scope/format/outcome.

### Tests

- CSV/JSON content and metadata;
- injection escaping;
- sync limit boundary;
- job state transitions/idempotency;
- permission revoked before download;
- expired artifact;
- memory-bounded large export;
- Playwright export flow.

### Performance considerations

- stream/paginate data;
- cap worker concurrency;
- query budgets apply to exports;
- measure memory and duration;
- artifacts expire and are cleaned asynchronously.

### Risks

- exports can bypass UI-level masking;
- long jobs compete with dashboard queries;
- object storage adds operational complexity;
- retries can duplicate artifacts without idempotency.

---

## M16 — Production hardening, observability and release

Local acceptance: **GREEN (2026-09-09)** under the user's local-portfolio scope.
All locally executable gates below have evidence in `docs/M16_FINAL_REPORT.md`.
Remote CI execution, real-device and human screen-reader smoke remain external;
this is not a claim of publicly deployed production or full manual WCAG certification.

### Goal

Close cross-cutting gaps, validate the end-to-end demo and package a credible production SaaS release while preserving open-source provenance.

### User result

Signal Studio is fast, accessible, observable, secure and coherent across its main workflows, with trustworthy installation and legal attribution.

### Changed subsystems

- structured logging/request IDs;
- liveness/readiness;
- query/ingestion/cache/job metrics;
- performance/load harness and indexes/rollups as measured;
- accessibility remediation;
- responsive/visual polish;
- data retention/deletion jobs;
- SBOM/NOTICE/provenance;
- production image/release CI;
- documentation and UAT.

### Definition of done

- reference end-to-end demo in `TRANSFORMATION_SPEC.md` passes.
- no P0/P1 open security finding without explicit release block.
- flagship routes pass WCAG 2.2 AA automated checks and manual keyboard review.
- performance budgets pass at 1M events; larger-scale claims are qualified.
- liveness and dependency-aware readiness are distinct.
- structured logs and request/query IDs work.
- ingestion/query/cache/live/export metrics are visible.
- retention/deletion completes physically for enabled stores or reports blocked scope honestly.
- CI gates install, migrations, typecheck, lint, tests, selected E2E, accessibility and build.
- production image contains `LICENSE`, notices and build metadata.
- application and image SBOMs are generated.
- legal page says the product is based on Umami under MIT.
- original Umami branding is replaced without erasing attribution.

### Tests

- full selected regression suite;
- reference UAT scenario;
- cross-role and cross-tenant tests;
- load tests at 1M events and concurrent dashboards/live viewers;
- readiness dependency failure tests;
- deletion/retention verification;
- image smoke and license/notices inspection;
- axe + keyboard + targeted screen-reader smoke;
- restore/rollback rehearsal for migrations.

### Performance considerations

- publish measured p50/p95 and environment;
- compare against baseline fan-out/query plans;
- validate bundle size and Core Web Vitals of Studio shell;
- bound logs/metrics cardinality;
- verify background jobs do not starve interactive queries.

### Risks

- hardening uncovers architectural shortcuts late;
- performance tuning can change metric semantics;
- full legal provenance may require replacing assets/dependencies;
- release pressure can tempt deferring accessibility/security;
- multi-store deletion may remain incomplete until ClickHouse work is enabled.

---

## Final acceptance flow

On the deterministic seeded PLG project, a reviewer must be able to:

1. sign in securely;
2. see activation change on Home;
3. open it in Explore;
4. reproduce the analysis from its URL;
5. compare account segments;
6. locate funnel drop-off and time-to-convert;
7. inspect affected account → user → session/replay;
8. save an Insight;
9. add it to a Dashboard;
10. view Live freshness and pause/resume;
11. export within permission limits;
12. switch to Viewer and observe server-enforced restrictions;
13. revoke a share and prove the old link no longer works;
14. inspect Legal/Open Source Notices.

## Stop conditions

Pause implementation and raise an explicit decision when:

- a requested change would remove or replace the Umami MIT notice;
- account identity semantics cannot be made deterministic;
- a migration risks unrecoverable user data without backup/rollback;
- a new query cannot meet correctness before optimization;
- permission scope cannot be represented safely in cache/export/share;
- a milestone requires an external service not authorized by the project scope;
- existing user changes overlap the planned files and cannot be preserved.

## Publication closure — PUB-01–PUB-09 (2026-09-10)

Local completion: **GREEN** for the authorized source/native/Linux closure. All three
candidate targets verified non-root and legal manifests; migration/worker Prisma works
offline; read-only migration status and candidate HTTP security/readiness passed. PUB-02
is explicitly deferred, not implemented. PUB-04/07 remain later authorized GitHub/hosting/
manual gates. Installed demo is preserved and healthy; it is not the patched candidate.

Authorized scope: fix local security/release defects while preserving the running demo,
data and existing dirty work. No commit/push/deploy. Current evidence and remaining
external gates: docs/RELEASE_CLOSURE_REPORT.md and FINAL_AUDIT.md.

- PUB-01: retire legacy token issuance and management authentication; preserve records;
  verify legacy denial and Studio live-share expiry/revocation/internal access.
- PUB-02: defer FR-SHELL-05/06 and FR-CAT-01–06 for portfolio-v1, retaining their
  acceptance criteria in docs/REQUIREMENTS_TRACEABILITY.md. No implementation claim.
- PUB-03: release calls mandatory reusable CI for the exact commit; build typechecks.
- PUB-04: preparation only; owned repository/commits/push require the later publication
  stage explicitly excluded by this task. Dirty checkout is not a published release.
- PUB-05: shared fingerprint algorithm, source manifest and artifact digest verification;
  rebuild candidate independently from preserved installed images.
- PUB-06: retire unsupported Heroku one-click manifest; supported deployment contract
  is one app + worker + private PostgreSQL + durable shared export storage.
- PUB-07: GitHub, hosting/HTTPS and human/device checks remain external and unpassed.
- PUB-08: all image targets run non-root and receive identical CI packaging checks.
- PUB-09: synchronize checkpoint/status docs and complete requirement traceability.

Definition of done: local changed-scope checks pass and candidate packaging is verified;
reports separate source-ready, preserved installed demo, deferred functionality and
external publication gates. Do not equate an unchanged running image with patched source.

## M17 — Working product and public hosting (2026-09-11)

Explicitly authorized by the user's product-completion request. Scope: first-run
project creation and source setup; Studio entry/login/logout UX; independent event
count SQL and six breakdown dimensions; economical app/worker deployment; owned
GitHub publication and truthful portfolio handoff. Existing work and other projects'
processes, networks, volumes and containers must remain untouched.

Definition of done:
- A signed-in user creates a project, installs tracking, receives real events,
  analyzes them, saves/reopens an Insight, uses Dashboards/Audiences and exports.
- Changed SQL passes golden PostgreSQL tests for scope, dates, filters and counts.
- App/worker hosted image is non-root at runtime and uses durable shared artifacts.
- Typecheck, lint, relevant regression, production build and critical E2E pass.
- Owned main, README, provenance and handoff reflect actual source and deployment.
- Public HTTPS workflow is verified only after a host/account is provisioned.

Public hosting/account remains an external prerequisite, not a passed gate.
Current evidence: docs/PRODUCT_RELEASE.md.
# M18 — Free serverless deployment (2026-09-12)

Explicit user scope: Vercel Hobby + Supabase Free, no paid resources or upgrades.
Preserve Studio/auth/analytics. Replace durable local export files with private
Supabase Storage in this profile and persistent worker with bounded request/cron
invocations. Configure pooled PostgreSQL, protect database tables from Data API,
test storage/auth/queue recovery and document free-tier limits. Public completion
requires actual provider access, migrations, storage and end-to-end acceptance.
