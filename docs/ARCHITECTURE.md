# Target architecture: Signal Studio

Status: target architecture with implemented portfolio slices; requirements and deferred boundaries are tracked in REQUIREMENTS_TRACEABILITY.md. See RELEASE_CLOSURE_REPORT.md for current verification.  
Baseline: Umami 3.3.1 at `ca661c7057984aa98ed4f7083d84dae2f65bfcb0`

## 1. Architectural intent

Signal Studio is built as a modular evolution of Umami, not a rewrite.

The target keeps the proven collection and analytics kernel, places a normalized query/semantic layer above it, and builds a new project/account/user-oriented SaaS experience as vertical slices. Existing routes remain operational until a replacement slice meets its product, test, performance and permission gates.

The architecture optimizes for:

- a strong portfolio-scale product that can run locally and self-host;
- clear module boundaries inside one repository;
- PostgreSQL-first correctness;
- optional ClickHouse scale path without pretending parity exists before tests prove it;
- URL-reproducible analytics;
- server-enforced authorization;
- measurable query and ingestion behavior;
- incremental delivery with low rewrite risk.

## 2. Key decisions

### A1. Modular monolith, not premature microservices

Next.js remains the application/runtime boundary. Domain modules, query services and background jobs receive explicit interfaces, but the first release stays in one deployable repository.

Rationale:

- current backend is already integrated into Next route handlers;
- product scope benefits more from contracts and observability than network boundaries;
- a modular monolith is easier to install, demo, test and review;
- exports/alerts can use a separate worker process from the same codebase when needed.

### A2. PostgreSQL is the canonical portfolio backend

PostgreSQL is the required reference implementation for functional correctness and automated tests.

ClickHouse remains a supported adapter boundary, but no new query is considered ClickHouse-ready until golden parity and performance tests pass. Existing ClickHouse code is not deleted.

Rationale:

- PostgreSQL is already mandatory for the control plane;
- local reproducibility is much better with one required data service;
- dual implementations currently create semantic drift;
- ClickHouse can be demonstrated later as a scale adapter rather than an unverified checkbox.

### A3. Normalized analysis contract

UI, URL, saved Insight, API and cache keys use one versioned `AnalysisQuery` contract. Routes do not invent separate ad hoc parameters for the same concept.

### A4. Project is a product facade over Website during migration

The new UI calls the analytical boundary a Project. Initially, a Project maps one-to-one to the existing Website record to avoid a high-risk data migration. Source-specific concepts remain under tracking/data settings.

A future multi-source Project can be introduced through an explicit migration, not implied by copy alone.

### A5. Tracked identities are distinct from application users

The existing `User` model represents a person who signs into the analytics SaaS. Product users are named `TrackedUser`; customer organizations are `TrackedAccount`.

This avoids ambiguous authorization and domain code.

### A6. Insight is a first-class persisted entity

An Insight stores the normalized analytical question and presentation metadata. Dashboard widgets reference Insights instead of embedding incompatible query fragments.

### A7. Realtime uses snapshot semantics

The UI consumes a timestamped snapshot. Adaptive polling is acceptable initially. SSE/WebSocket can replace transport later without changing product semantics.

### A8. Security fixes are foundation work

Server-side 2FA assurance, token lifecycle, rate limiting, secret validation and scoped share/replay tokens precede public sharing of new analytical surfaces.

## 3. System context

```text
┌────────────────────┐
│ Tracked web product│
│ tracker / recorder │
└─────────┬──────────┘
          │ events, identity, performance, replay
          ▼
┌────────────────────────────────────────────────────┐
│ Signal Studio application                         │
│                                                    │
│ Collection │ Auth/RBAC │ Analytics │ SaaS UI       │
│ Query API  │ Insights  │ Exports   │ Observability │
└───────┬──────────┬───────────┬─────────────────────┘
        │          │           │
        ▼          ▼           ▼
 PostgreSQL      Redis       Object storage
 required        optional    optional/later
 control+facts   cache/jobs  large exports
        │
        └──────────────► ClickHouse optional analytics adapter
                         Kafka optional ingestion transport
```

External CRM, billing, ad networks and AI services are not required by the first release.

## 4. Runtime containers

### Required

#### Web application

- Next.js App Router UI and route handlers;
- tracker/recorder static bundles;
- auth, permissions, query orchestration;
- bounded synchronous exports;
- liveness/readiness endpoints.

#### PostgreSQL

- auth/control-plane entities;
- project/source metadata;
- analytics facts for reference deployment;
- tracked identity/account projections;
- insights, metrics, annotations and alert definitions;
- audit log and job metadata.

### Optional

#### Redis

- short-lived normalized analytics cache;
- request single-flight/locks;
- rate limiting;
- revoked-session/share state where required;
- background job queue.

The product must remain functionally correct without Redis. Performance-sensitive features may degrade explicitly.

#### Worker

Same repository and domain code, separate process entrypoint for:

- large exports;
- alert evaluation;
- retention/deletion jobs;
- future account materialization.

It is introduced only when the first job requires it.

#### Object storage

Used only for large export artifacts or future replay storage strategy. Local filesystem/dev adapter is allowed; permission and expiry semantics remain identical.

#### ClickHouse/Kafka

Optional high-volume analytics/ingestion path. It must conform to the same semantic/query contracts and expose loss/lag metrics.

## 5. Application module boundaries

Proposed target layout; exact moves happen only in the relevant milestones.

```text
src/
  app/
    (studio)/                    # new product routes and layouts
    api/                         # thin HTTP adapters
  features/
    shell/
    explore/
    dashboards/
    audiences/
    experience/
    live/
    data-management/
    workspace-settings/
  server/
    auth/
    permissions/
    analytics/
      contracts/
      semantic/
      planner/
      adapters/
        postgresql/
        clickhouse/
      cache/
    identities/
    insights/
    dashboards/
    exports/
    alerts/
    audit/
    observability/
  queries/                       # existing Umami kernel during migration
  tracker/                       # preserved collection bundle
  recorder/                      # preserved recorder bundle
```

### Boundary rule

Feature components may call typed client/API hooks. They do not import raw Prisma/ClickHouse/query modules.

Route handlers parse transport input, authenticate, authorize, call one application service and map the result. They do not contain analytical SQL or role logic.

The existing `src/queries/sql` remains the kernel until queries are wrapped or migrated; it is not bulk-moved for aesthetics.

## 6. Strangler migration approach

```text
Existing Umami route
    │ remains available
    ▼
New Studio vertical slice
    │ uses normalized service
    ▼
Existing SQL query wrapped by adapter
    │ tests + metrics + budgets
    ▼
Replace old navigation entry only after parity gate
```

Rules:

1. No repo-wide component rename before a working vertical slice.
2. No simultaneous rewrite of tracker, schema, query layer and UI.
3. New routes can coexist behind a development flag until acceptance passes.
4. Legacy route removal requires usage mapping and rollback plan.
5. Existing public tracker/send contracts remain backward compatible unless versioned.

## 7. Domain model

### Existing entities retained

- `User` — authenticated SaaS user;
- `Team` / `TeamUser` — initial Workspace and membership foundation;
- `Website` — initial Project/source foundation;
- `Session`, `WebsiteEvent`, `EventData`, `SessionData`, `Revenue` — analytics facts;
- `Segment`, `Report`, `Board`, `Share` — migration inputs;
- replay/heatmap/performance entities.

### Proposed entities

#### TrackedUser

Represents a product end user.

Core fields:

- internal ID;
- project ID;
- stable external/distinct ID;
- first/last seen;
- display traits allowed by policy;
- lifecycle state/derived timestamps;
- optional current account link;
- created/updated timestamps.

Raw/large traits should not be duplicated without need. Sensitive-property policy is applied before exposure.

#### TrackedAccount

Represents a customer organization.

Core fields:

- internal ID;
- project ID;
- stable external account ID;
- name and approved display traits;
- first/last seen;
- lifecycle/activation fields;
- optional revenue/plan summary;
- created/updated timestamps.

#### AccountMembership

Temporal or current relationship between TrackedUser and TrackedAccount. The MVP may support only current membership, but the schema must not silently claim historical accuracy.

#### MetricDefinition

- project/workspace scope;
- name, description, owner;
- versioned normalized measure/filter definition;
- exact/approximate policy;
- status and timestamps.

The first release may ship typed presets before exposing full persistence, but the API contract anticipates definitions.

#### Insight

- workspace/project;
- title, description, owner;
- `queryVersion`;
- normalized `AnalysisQuery` JSON;
- visualization config;
- visibility/status;
- created/updated timestamps.

#### Dashboard/Widget relationship

Existing Board can be evolved or adapted. Target widget fields:

- dashboard ID;
- insight ID or note type;
- layout coordinates/size;
- safe presentation overrides;
- version.

The query itself remains owned by Insight.

#### Annotation

Project/metric/date-bound context with author and body. Later collaboration can extend it; the first model stays small.

#### AlertRule / AlertEvaluation

Introduced only with alert milestone. Rule references Metric/Insight; evaluation records status, value, threshold and time.

#### AuditEvent

Append-only application audit trail for security- and data-sensitive actions.

## 8. Analytics semantic layer

### Responsibilities

- normalize user-facing metrics;
- validate dimension/operator compatibility;
- resolve saved segments/cohorts;
- apply project/permission scope;
- normalize timezone and half-open ranges;
- choose exact/approximate mode;
- generate stable cache keys;
- plan PostgreSQL or ClickHouse adapter execution;
- attach definition/freshness metadata;
- emit query telemetry.

### AnalysisQuery v1

Illustrative contract:

```ts
type AnalysisQueryV1 = {
  version: 1;
  projectId: string;
  mode: 'trend' | 'breakdown' | 'funnel' | 'retention';
  range: {
    startAt: string;
    endAt: string;
    timezone: string;
    unit?: 'minute' | 'hour' | 'day' | 'week' | 'month';
  };
  measure?: {
    source: 'event' | 'metric';
    key: string;
    aggregation: 'count' | 'uniqueUsers' | 'uniqueAccounts' | 'sum' | 'average';
    property?: string;
  };
  breakdown?: { field: string; limit: number };
  filters: Array<NormalizedFilter>;
  match: 'all' | 'any';
  segmentId?: string;
  cohortId?: string;
  compare?: NormalizedComparison;
  funnel?: NormalizedFunnel;
  retention?: NormalizedRetention;
};
```

This is a design sketch, not committed source syntax.

### Result envelope

Every query returns:

```ts
type AnalysisResult<T> = {
  queryVersion: 1;
  generatedAt: string;
  freshnessAt: string;
  exactness: 'exact' | 'approximate';
  cache: 'hit' | 'miss' | 'bypass';
  data: T;
  definitions: Array<{ key: string; label: string; description: string }>;
  warnings?: Array<{ code: string; message: string }>;
};
```

Internal timing/scanned-row diagnostics go to telemetry and optionally an admin debug surface, not normal users.

## 9. Query planning and adapters

### PostgreSQL adapter

Reference semantics. Existing raw SQL functions can be wrapped, but adapter methods expose normalized types and half-open range semantics.

Initial priorities:

- trend/breakdown;
- funnels;
- retention;
- users/accounts/activity;
- session evidence.

### ClickHouse adapter

Enabled per capability. It must declare whether a query uses raw or aggregate tables and exact or approximate functions.

No silent fallback that changes semantics without a result warning/telemetry marker.

### Query budgets

The planner rejects or constrains:

- unsupported property/operator combinations;
- unbounded page size;
- excessive date ranges for expensive modes;
- funnel step count outside contract;
- excessive breakdown cardinality;
- synchronous exports beyond limits.

Budget failures are user-actionable validation responses, not generic 500 errors.

## 10. Date and timezone architecture

Canonical contract:

- ISO UTC instants at API/storage boundaries;
- explicit IANA timezone for bucketing/presentation;
- half-open intervals `[startAt, endAt)`;
- one shared range normalizer;
- comparison ranges derived before adapter execution;
- DST transition golden tests;
- saved Insight stores explicit range mode: relative preset or absolute custom.

Relative ranges such as last 7 days resolve at request time. Absolute shared reports remain stable.

## 11. Identity architecture

### Inputs

- existing deterministic anonymous session ID;
- tracker `identify` distinct ID;
- approved user traits;
- explicit account ID/traits contract introduced in a versioned tracker/API extension.

### Principles

- never infer identity from raw IP;
- application User and TrackedUser are separate types/tables;
- merges are explicit, idempotent and auditable;
- account membership semantics are documented;
- property masking happens before API output;
- deletion can target project, tracked user/account and replay artifacts consistently.

### Materialization

For MVP scale, TrackedUser/Account can be updated during identify/session processing or via bounded upsert. At higher scale, an asynchronous projection may be introduced. The product contract remains the same.

## 12. API architecture

### New API style

Proposed namespaces:

```text
/api/projects/:projectId/analytics/query
/api/projects/:projectId/insights
/api/projects/:projectId/dashboards
/api/projects/:projectId/segments
/api/projects/:projectId/cohorts
/api/projects/:projectId/tracked-users
/api/projects/:projectId/accounts
/api/projects/:projectId/live
/api/projects/:projectId/exports
/api/workspaces/:workspaceId/members
```

These are target contracts, not existing endpoints.

### Handler sequence

```text
parse → authenticate → enforce assurance → authorize scope/action
      → validate normalized contract → service/query planner
      → audit/telemetry → response envelope
```

### Error envelope

- stable machine code;
- safe user-facing message;
- field/path details for validation;
- request ID;
- retryability where meaningful;
- no stack trace in user response.

## 13. Frontend architecture

### State ownership

| State type | Owner |
|---|---|
| Shareable analysis state | URL + versioned codec |
| Server entities/results | TanStack Query |
| Draft query edits | local feature state until Apply |
| Session/user preferences | Zustand/local storage |
| Auth/workspace context | server-validated query + minimal client cache |
| Dashboard edit draft | feature state with explicit save/discard |

The same concept must not have competing URL, Zustand and component-state authorities.

### URL codec

- parse and serialize functions are pure and tested;
- defaults are omitted from URLs where safe;
- key ordering is stable;
- unknown versions fail safely;
- browser back/forward restores committed analysis;
- reset operations are key-scoped;
- large funnel definitions may use compact validated encoding, but a saved Insight is preferred for durable sharing.

### Component layering

```text
Page/route
  → feature container
    → query/entity hooks
      → API client
    → domain visualization
      → shared chart/table primitives
        → design system primitives
```

Charts do not fetch data. Tables do not define permission policy. Shared controls do not import page routes.

### Visualization contract

Every analytical visualization provides:

- title/definition;
- date/segment context;
- loading/empty/error/partial state;
- accessible summary;
- table equivalent where applicable;
- stable colors/legend behavior;
- tooltip formatting;
- freshness;
- evidence drill-down action if available.

## 14. Caching architecture

### Client

TanStack Query keys derive from normalized query/entity contracts. Superseded requests are cancelled. Identical dashboard queries share client cache.

### Server

Optional Redis cache with in-process fallback for development.

Cache key includes:

- contract version;
- project/tenant scope;
- normalized query;
- permission-sensitive field scope;
- adapter/exactness;
- relevant data/reset version.

Suggested TTL:

- live snapshot: 5-15 s;
- recent historical range: 30-60 s;
- closed historical range: 2-5 min;
- metadata/catalog: longer, explicitly invalidated.

Single-flight prevents identical concurrent misses from multiplying database work.

Sensitive results are never shared across incompatible permission scopes.

## 15. Pagination architecture

- cursor pagination for events, users, accounts, sessions and audit/export jobs;
- cursor tuple includes stable time + ID where chronological;
- bounded page sizes with server maximum;
- total count is optional or separately requested;
- aggregate breakdowns use bounded top-N, not generic pagination over unlimited cardinality;
- URL stores cursor/page intent where shareable, but saved Insights do not persist fragile deep cursors by default.

Legacy offset routes remain until migrated.

## 16. Realtime architecture

### Snapshot service

One service computes or reads:

- generated/freshness timestamps;
- active users/accounts;
- event series;
- recent event stream;
- top pages/events/segments;
- warnings/degraded dependencies.

### Transport

Phase 1: adaptive polling with cache/single-flight.  
Future: SSE or WebSocket transport.

### Load controls

- stop/reduce polling on hidden tabs;
- deduplicate viewers;
- minute rollups where valid;
- cap activity list;
- preserve last snapshot on error;
- instrument QPS and query time per open viewer.

## 17. Export and job architecture

### Bounded synchronous export

For current visible data and safe row limits:

- streamed response where practical;
- CSV/JSON;
- formula escaping;
- query metadata;
- permission recheck.

### Asynchronous export

```text
request → validate/authorize → create ExportJob
        → worker executes paged/streamed query
        → encrypted/controlled artifact
        → expiring download with authorization recheck
```

Jobs have states `queued/running/completed/failed/expired/cancelled`, progress where measurable and request IDs. Large datasets are not assembled as in-memory base64 ZIPs.

## 18. Authentication and authorization architecture

### Session model

Target auth token/session contains:

- user ID;
- session ID;
- issued/expiry time;
- password/session version;
- 2FA assurance level/time;
- token type/audience.

Server-side session/revocation state may use PostgreSQL or Redis depending on deployment. Stateless mode cannot claim revocable logout without a revocation/version mechanism.

### Authorization

Permission API takes:

```text
subject + workspace/project resource + action + optional data classification
```

It returns an allow/deny decision and optional field scope. Navigation uses the same capability data for presentation, but presentation never replaces enforcement.

### Shares

- random opaque share record;
- signed token references live record;
- expiry and revocation checked on every protected request or safe cached interval;
- explicit project/insight/dashboard and data-section scope;
- no arbitrary client header grants access;
- access is auditable.

## 19. Data lifecycle

Retention policy is scoped by workspace/project and covers:

- events/session facts;
- event/session properties;
- replay chunks;
- heatmap events/screenshots;
- exports;
- audit/security records with separate minimum policy.

Deletion workflow:

```text
request → authorize → plan affected stores → execute/idempotent retry
        → verify → audit outcome → expose status
```

PostgreSQL and ClickHouse adapters must report physical completion. Hiding data with `resetAt` alone is not presented as erasure.

## 20. Observability architecture

### Logs

Structured JSON in production:

- timestamp, level, service/module;
- request/trace ID;
- workspace/project IDs when safe;
- route/action;
- error code, not raw secrets/payloads;
- duration and outcome.

### Metrics

- HTTP rate/error/latency;
- auth/login/2FA/rate-limit events;
- ingestion accepted/rejected/retried/lost;
- query latency/cache/scanned rows or bytes;
- live snapshot age/QPS/viewers;
- DB pool saturation;
- export/alert job states;
- deletion/retention job outcomes.

### Health

- `/livez`: process responds;
- `/readyz`: required dependencies and migrations are ready;
- optional dependencies report degraded state without falsely failing unrelated features.

### Tracing

OpenTelemetry-compatible spans around route, service, planner, adapter query, cache and job execution. Initial implementation may start with request IDs + timers, but interfaces should not block later tracing.

## 21. Performance architecture

### Safeguards

- normalized query budgets;
- bounded cardinality/page size/date ranges;
- short server cache and single-flight;
- cursor pagination;
- parallel independent queries with explicit concurrency limits;
- cancellation/timeouts;
- PostgreSQL indexes driven by measured plans;
- optional rollups/materialized views;
- no automatic total count for every list;
- background large exports;
- shared realtime snapshot.

### Measurement datasets

- small deterministic golden dataset for correctness;
- 1M events reference performance seed;
- later 10M/100M load profiles;
- representative property-heavy and funnel/retention cases.

Every optimization must preserve semantic tests.

## 22. Test architecture

### Test layers

1. Pure unit tests for contracts, codecs, definitions and transforms.
2. Component tests for interaction/accessibility/state.
3. PostgreSQL integration tests using isolated schema/database.
4. Route/auth/permission integration tests.
5. Golden analytics query tests.
6. Playwright E2E with deterministic per-test fixtures.
7. Performance/load tests outside normal unit run.
8. Optional ClickHouse parity suite.

### Isolation

- no shared fixed username/project across parallel tests;
- each test owns created entities;
- retries start from clean/idempotent state;
- tests do not assert removed sensitive response fields;
- CI browser install and service prerequisites are explicit.

### CI gates

- frozen install;
- typecheck;
- lint;
- unit/component;
- PostgreSQL integration/migrations;
- selected Chromium E2E;
- axe on flagship pages;
- license/SBOM policy later;
- build.

Long performance and cross-browser suites can run separately, but failures remain visible.

## 23. Deployment architecture

### Local development

Target reproducible command should build the current checkout, not pull upstream `latest`.

Required:

- pinned Node and pnpm via `engines`/`packageManager` or equivalent;
- `.env.example` with generated secrets guidance;
- compose profile with `build: .` and PostgreSQL health;
- explicit migrations command;
- optional deterministic seed;
- documented Playwright browser install.

### Production image

- pinned base image digest;
- frozen dependencies, no unpinned runtime `pnpm add`;
- non-root runtime;
- explicit `LICENSE` and third-party notices;
- liveness/readiness;
- immutable build metadata/commit;
- SBOM and provenance;
- migration job separated from arbitrary application build where possible.

### Configuration

Fail fast on:

- missing/placeholder `APP_SECRET`;
- malformed database URLs;
- invalid 2FA encryption key;
- unsupported backend combination;
- unsafe production defaults.

## 24. Legal and provenance architecture

- root `LICENSE` remains unchanged;
- product About/Legal page attributes Umami and links to MIT text;
- distribution image/archive includes `LICENSE` and `THIRD_PARTY_NOTICES`;
- application and OCI SBOMs are generated;
- bundled datasets/assets have immutable source, hash, SPDX/license and attribution metadata;
- external downloads are pinned and integrity-checked;
- new fonts/icons/assets pass the same process;
- original Umami name/logo are replaced in product branding without erasing provenance.

## 25. Architecture risks and mitigations

| Risk | Mitigation |
|---|---|
| Universal Explore becomes unbounded | Four explicit modes, versioned schema, query budgets |
| PostgreSQL cannot meet complex-query budgets | indexes/rollups/cache, then capability-tested ClickHouse adapter |
| Account identity creates incorrect joins | explicit external ID contract, golden identity tests, audit merges |
| New shell duplicates old UI indefinitely | vertical route replacement gates and removal milestones |
| URL contract becomes too large | stable codec, saved Insight links, bounded definitions |
| Server cache leaks scoped data | permission-sensitive cache key and authorization before cache |
| Realtime overloads DB | snapshot cache, single-flight, adaptive polling, visibility pause |
| Dashboard widgets diverge | widgets reference Insights and shared result envelopes |
| Async exports expose stale permissions | authorize at create and download, short expiry, audit |
| Dual backend KPI drift | exactness metadata and golden parity suite |
| Security foundation postponed by visual work | dedicated foundation milestone blocks public sharing |
| Rewrite destroys Umami strengths | strangler strategy and baseline regression floors |

## 26. Architecture acceptance criteria

The target architecture is considered established when:

- a versioned AnalysisQuery round-trips URL → API → Insight → URL;
- one trend/breakdown vertical slice runs through a query service, not raw route SQL;
- PostgreSQL golden results are deterministic;
- permission scope is enforced before query/cache/export access;
- account/user/session drill-down uses unambiguous tracked identity types;
- dashboard widget references a saved Insight;
- live view consumes a timestamped shared snapshot;
- logs include request/query IDs and readiness checks dependencies;
- clean local setup builds the current checkout with pinned toolchain;
- source distribution and image preserve Umami MIT attribution;
- no requirement depends on deleting the existing analytics kernel.

## 27. Deferred ADRs

The following decisions need focused ADRs in their milestones:

1. account identity and membership history;
2. MetricDefinition persistence versus presets;
3. Insight query encoding/version migration;
4. Redis-required versus optional job implementation;
5. background export storage;
6. ClickHouse capability/parity policy;
7. replay/heatmap retention and deletion;
8. comment/annotation collaboration model;
9. SSE versus continued adaptive polling;
10. final project/source relationship for multi-source tracking.

No deferred ADR blocks the documentation-only phase.
# M18 hosting amendment — 2026-09-12

The free profile keeps Next.js/Node route handlers and the existing application
authentication on Vercel Hobby. PostgreSQL moves to dedicated Supabase Free with
Supavisor transaction pooling. Application tables have RLS and no Data API grants;
authorization remains in existing services, using a server-only database connection.
Supabase Auth is not substituted for Application User/session/2FA semantics.

Encrypted exports use a private Supabase Storage bucket. Files are limited to
3 MiB in this profile, authenticated before download, and expire after one hour.
The local 64 MiB/streaming adapter remains available for self-hosting. No secrets
or signed public download URLs are sent to the browser.

Next `after()` processes an enqueued export after its HTTP response. Durable queue
state and leases remain in PostgreSQL. Supabase pg_cron/pg_net calls an authenticated
300-second Node function every five minutes only when there is pending work; it
recovers interrupted leases, advances bounded lifecycle batches and removes expired
objects. No always-running worker, paid queue or Edge runtime rewrite is needed.
Free quota exhaustion/pausing can delay jobs; public availability is not guaranteed.
