# Transformation spec: Signal Studio

Status: product/design contract with implemented portfolio slices and explicit deferred scope; see REQUIREMENTS_TRACEABILITY.md. Public deployment and external verification remain pending.  
Working title: **Signal Studio**  
Source foundation: Umami 3.3.1, MIT  
Primary audience: product, growth and customer-success teams in PLG SaaS

## 1. Product thesis

Signal Studio turns privacy-first event data into a shared product-growth workspace.

The product does not stop at counting visits. It connects aggregate behavior to the accounts, users and sessions that created it, then lets a team save the analysis as an insight, place it on a dashboard, share or export it, and watch it in near real time.

The core loop is:

```text
Ask → Explore → Segment → Compare → Save → Share/Monitor → Explain with evidence
```

The transformation is successful only if a reviewer can understand, within a short demo, that this is a new commercial product built on Umami's analytics kernel rather than a reskinned Umami installation.

## 2. Concrete subject and primary job

The reference customer is a small-to-mid-sized B2B PLG SaaS company. Its product and growth team needs to understand why trial activation or retention changed.

The single most important job of the flagship Explore page is:

> Explain which product behaviors and audience segments caused a change in activation, then let the analyst preserve and communicate the answer.

All product, IA and visual decisions are evaluated against this job.

## 3. Product goals

### G1. Change the center of gravity

Move the product from website-centric traffic reporting to project/account/user-centric product intelligence.

### G2. Create one analytical workflow

Replace isolated report configuration patterns with a reusable Explore contract that powers trends, breakdowns, funnels and retention.

### G3. Make analysis reproducible

The full meaningful state of an analysis must be serializable in the URL and saveable as an Insight.

### G4. Connect metrics to evidence

Every aggregate view should offer a path to affected accounts, users, sessions and, when available, replay/performance evidence.

### G5. Feel like production SaaS

Deliver cohesive navigation, permissions, loading/error/empty states, responsive behavior, exports, accessibility, observability and testing—not just showcase charts.

### G6. Preserve the analytics kernel

Retain privacy-first collection, custom events, typed properties, date/timezone filtering, self-hosted PostgreSQL and the strongest existing queries.

## 4. Non-goals for the first release

Portfolio-v1 scope clarification (2026-09-10, authorized publication closure):
FR-SHELL-05 (entity/action command search), FR-SHELL-06 (personal recents/favorites)
and FR-CAT-01–06 (governed event/metrics catalog) are deferred to a subsequent release.
The current palette navigates pages; Insight favorites are shared project flags,
not personal preferences. These additions are not necessary for the reference
activation → Explore → Insight → Dashboard → evidence demo. Security, permissions,
export safety and release verification remain mandatory; none are deferred.
The original FR definitions below are retained as future acceptance criteria.

- billing and subscription management;
- external CRM/ad platform integrations;
- AI-generated conclusions;
- arbitrary SQL editor;
- real-time collaborative text editing;
- native mobile applications;
- full replacement of every legacy Umami route before the new vertical slices work;
- production ClickHouse/Kafka deployment in the portfolio MVP;
- automatic ML anomaly detection;
- changing or removing the original MIT license.

## 5. Users and jobs-to-be-done

### Product lead

Needs to monitor activation, adoption and retention, compare segments, and communicate what changed.

### Growth analyst

Needs flexible event queries, funnels, cohorts, breakdowns, date comparison, reusable segments and exports.

### Customer-success lead

Needs account health, recent activity, adoption gaps and a safe route from aggregate patterns to affected accounts.

### Engineering/data owner

Needs event catalog, schema visibility, data health, ingestion status and definitions that prevent metric drift.

### Executive/viewer

Needs stable dashboards with clear definitions, annotations, freshness and limited drill-down without edit rights.

### Workspace administrator

Needs members, roles, project access, shares, retention and legal/security settings.

## 6. Product vocabulary

Interface copy uses user-recognizable language. Implementation terms are not exposed unless the user is configuring data.

| Term | Meaning |
|---|---|
| Workspace | Team and security boundary |
| Project | One product/application analytics boundary |
| Source | Website/app/tracker origin feeding a project |
| Account | Customer organization identified by an account trait |
| User | Identified person, possibly linked to multiple sessions |
| Event | Named behavior with typed properties |
| Metric | Named calculation with a definition and owner |
| Segment | Reusable filter over users/accounts/events |
| Cohort | Population defined by behavior in time |
| Insight | Saved, reproducible analytical query and visualization |
| Dashboard | Curated layout of insights and notes |
| Alert | A monitored metric condition and evaluation state |
| Evidence | Session, replay, heatmap or performance context explaining an aggregate result |

The word Website is retained only under Sources and tracking setup.

## 7. Information architecture

### Primary navigation

1. **Home** — workspace health, activation and recent insights.
2. **Explore** — universal analysis builder.
3. **Dashboards** — curated monitoring and reporting.
4. **Audiences** — segments, cohorts, users and accounts.
5. **Experience** — sessions, replays, heatmaps and performance evidence.
6. **Live** — near-realtime activity and monitored signals.

### Utility navigation

- Search / command palette;
- Recent and favorites;
- Project switcher;
- Data management: events, metrics, sources, data health;
- Workspace settings: members, roles, shares, retention, legal notices.

### IA rule

Advanced analytics are modes inside Explore or saved Insights, not 17 independent website menu items.

## 8. Flagship screen: Explore

### 8.1 Layout

```text
┌─────────────┬───────────────────────────┬──────────────────────┐
│ Product nav │ Query spine               │ Evidence drawer      │
│             │ ┌───────────────────────┐ │ hidden until needed  │
│ Home        │ │ Metric / event        │ │ accounts / users     │
│ Explore     │ │ Measure               │ │ sessions / replay    │
│ Dashboards  │ │ Breakdown             │ │ definitions          │
│ Audiences   │ │ Filters               │ │                      │
│ Experience  │ │ Compare / range       │ │                      │
│ Live        │ └───────────────────────┘ │                      │
│             │ Result canvas             │                      │
│             │ chart + table + summary   │                      │
└─────────────┴───────────────────────────┴──────────────────────┘
```

At laptop widths, the evidence drawer overlays. At tablet widths, the query spine becomes a collapsible top sheet. On mobile, Explore becomes a deliberate read/inspect flow rather than a compressed desktop builder; editing opens full-screen steps.

### 8.2 Query modes

- Trend;
- Breakdown;
- Funnel;
- Retention.

The MVP does not promise arbitrary cross-mode combinations. Each mode implements one normalized query contract and a predictable set of controls.

### 8.3 Common controls

- project;
- metric/event;
- aggregation;
- date preset or custom range;
- timezone;
- interval where applicable;
- global filters;
- segment/cohort;
- previous-period or custom comparison;
- visualization;
- result table;
- save Insight;
- add to Dashboard;
- export.

### 8.4 URL contract

The URL must reproduce:

- query mode;
- project;
- metric/event and aggregation;
- steps for funnel/retention definitions where safe;
- breakdowns;
- filters and match mode;
- segment/cohort;
- date range, unit and timezone;
- comparison;
- visualization and table state;
- sort, page/cursor and selected drill-down where meaningful.

Ephemeral presentation state such as an open tooltip is excluded.

Reset filters removes filter keys only. It never silently removes date, comparison or visualization state.

### 8.5 Result states

- **Loading:** preserve layout and labels; use skeletons sized like the result.
- **Empty:** state why no data matched and offer the next meaningful action, such as widening the range or removing one filter.
- **Error:** identify whether the query, permissions, source or service failed; keep the query editable.
- **Partial:** show freshness and unavailable breakdowns without pretending the entire result failed.
- **Stale:** display last successful timestamp and a retry action.

## 9. Functional requirements

### 9.1 Workspace and project shell

- `FR-SHELL-01` A signed-in user sees only workspaces/projects permitted by server-side authorization.
- `FR-SHELL-02` Project switching preserves compatible page state and clears incompatible entity IDs.
- `FR-SHELL-03` Navigation is consistent across desktop and mobile.
- `FR-SHELL-04` Every page provides explicit loading, empty, error and permission states.
- `FR-SHELL-05` Command palette opens pages, saved insights, users/accounts and actions permitted to the current role.
- `FR-SHELL-06` Recent items and favorites are scoped by user and workspace.

### 9.2 Home

- `FR-HOME-01` Show activation, weekly active users/accounts, retention and tracked revenue with definitions and comparison.
- `FR-HOME-02` Show a lifecycle funnel from signup to activated to retained.
- `FR-HOME-03` Show feature adoption and at-risk account lists.
- `FR-HOME-04` Show data freshness and ingestion health.
- `FR-HOME-05` Show recent saved insights/annotations, not generic marketing copy.
- `FR-HOME-06` Every KPI links to its Explore definition.

### 9.3 Trend and breakdown Explore

- `FR-EXP-01` Query an event/metric by count, unique users, unique accounts, sessions, sum or average where type-compatible.
- `FR-EXP-02` Apply dimension and typed property filters with all/any match mode.
- `FR-EXP-03` Break down by one supported dimension in MVP and sort by value/change.
- `FR-EXP-04` Compare previous period or a selected segment.
- `FR-EXP-05` Toggle compatible chart/table views without losing state.
- `FR-EXP-06` Open a result row as a scoped drill-down.
- `FR-EXP-07` Save the normalized query as an Insight.

### 9.4 Funnels

- `FR-FUN-01` Define 2-8 ordered event/page steps.
- `FR-FUN-02` Configure conversion window.
- `FR-FUN-03` Apply global and per-step property filters.
- `FR-FUN-04` Show step entrants, conversion, drop-off and overall conversion.
- `FR-FUN-05` Show conversion trend across the selected range.
- `FR-FUN-06` Show time-to-convert distribution.
- `FR-FUN-07` Compare one breakdown or segment.
- `FR-FUN-08` Drill into converted/dropped users or accounts, then sessions/replays.

### 9.5 Cohorts and retention

- `FR-RET-01` Define entry behavior and return behavior independently.
- `FR-RET-02` Support daily, weekly and monthly granularity within bounded ranges.
- `FR-RET-03` Show matrix, retention curve and cohort size.
- `FR-RET-04` Compare two segments/cohorts.
- `FR-RET-05` Open a cell to view matching accounts/users.
- `FR-RET-06` Save the definition as a reusable Cohort or Insight.
- `FR-RET-07` State whether retention is exact or approximate.

### 9.6 Events and metrics catalog

- `FR-CAT-01` List event name, description, owner, status, volume, unique users, first seen and last seen.
- `FR-CAT-02` Show observed properties and types.
- `FR-CAT-03` Flag type conflicts, stale events and missing descriptions.
- `FR-CAT-04` Allow authorized users to set display name, description, owner and lifecycle status without renaming raw data.
- `FR-CAT-05` Show where an event is used by insights, funnels, cohorts and dashboards.
- `FR-CAT-06` Never expose raw sensitive property samples by default.

### 9.7 Accounts and users

- `FR-AUD-01` List accounts/users with search, filters, sort and cursor pagination.
- `FR-AUD-02` Show lifecycle stage, health/activation status and recent activity.
- `FR-AUD-03` Account detail shows members, traits, adoption, trends and sessions.
- `FR-AUD-04` User detail shows traits, stitched sessions, event timeline and cohort membership.
- `FR-AUD-05` Every calculated score exposes its definition and freshness.
- `FR-AUD-06` Sensitive traits are masked or excluded based on permission policy.

### 9.8 Segments and cohorts

- `FR-SEG-01` Build reusable account/user segments from traits and behavior.
- `FR-SEG-02` Preview estimated size before save.
- `FR-SEG-03` Show exact evaluation timestamp and freshness.
- `FR-SEG-04` Show sample members subject to permissions.
- `FR-SEG-05` Show dependencies before edit/delete.
- `FR-SEG-06` Segment and cohort terminology remains unambiguous throughout the UI.

### 9.9 Insights and dashboards

- `FR-INS-01` Insight stores normalized query, visualization, title, description, owner and timestamps.
- `FR-INS-02` Opening an Insight restores the full analysis.
- `FR-INS-03` Authorized users can duplicate rather than overwrite shared work.
- `FR-DASH-01` Dashboard contains insight widgets, text notes and section headers.
- `FR-DASH-02` Global date/segment context can override compatible widgets and visibly marks exceptions.
- `FR-DASH-03` Edit mode supports deterministic grid placement and keyboard-accessible alternatives.
- `FR-DASH-04` Dashboard shows freshness and per-widget errors.
- `FR-DASH-05` Internal/public share respects explicit scope and expiry.

### 9.10 Experience evidence

- `FR-EXPX-01` Aggregate results can open matching sessions when the query permits.
- `FR-EXPX-02` Session detail combines timeline, properties, identity and performance.
- `FR-EXPX-03` Replay is visibly marked as unavailable, not silently omitted, when recording is disabled.
- `FR-EXPX-04` Heatmap and Web Vitals use the same project/date/filter context where semantically valid.
- `FR-EXPX-05` Replay masking mode and privacy warning are visible to administrators.

### 9.11 Live

- `FR-LIVE-01` Show current active users/accounts, event stream and top changing behaviors.
- `FR-LIVE-02` Display last update, connection/polling state and pause/resume.
- `FR-LIVE-03` One server snapshot is shared across compatible viewers where possible.
- `FR-LIVE-04` Historical results do not refetch every 10 seconds.
- `FR-LIVE-05` Live view degrades to adaptive polling if streaming is unavailable.

### 9.12 Exports

- `FR-EXPORT-01` Visible table results export as CSV with active filters and stable column definitions.
- `FR-EXPORT-02` Query definitions export as JSON.
- `FR-EXPORT-03` Filenames include project, insight/mode and date range.
- `FR-EXPORT-04` Large exports run as background jobs with status, expiry and permission recheck.
- `FR-EXPORT-05` CSV formula injection is prevented.
- `FR-EXPORT-06` Export actions are audit logged.

## 10. Roles and permissions

Proposed project roles:

| Capability | Owner | Admin | Analyst | Editor | Viewer |
|---|---:|---:|---:|---:|---:|
| Manage workspace/security | Yes | Limited | No | No | No |
| Manage members/roles | Yes | Yes | No | No | No |
| Manage sources/schema metadata | Yes | Yes | No | Limited | No |
| Create/edit shared insights | Yes | Yes | Yes | Yes | No |
| Create/edit dashboards | Yes | Yes | Yes | Yes | No |
| Create segments/cohorts | Yes | Yes | Yes | Yes | No |
| View aggregate analytics | Yes | Yes | Yes | Yes | Yes |
| View account/user detail | Yes | Yes | Yes | Configurable | Configurable |
| View replay/sensitive properties | Configurable | Configurable | Configurable | Configurable | No by default |
| Export data | Yes | Configurable | Configurable | Configurable | No by default |
| Create public share | Yes | Configurable | No | No | No |

Authorization rules are enforced in API/data access, never only in navigation or disabled buttons.

## 11. Visual design direction

### 11.1 Design idea: the analytical instrument

Signal Studio should feel like a precise instrument used by a product team, not a generic admin template. Its visual world comes from traces, signals, annotations, measurement grids and evidence—not decorative analytics clichés.

The deliberate aesthetic risk is the **Query Spine**: the active analytical definition is rendered as a persistent vertical sequence of typed blocks. When a valid query changes, a single restrained motion travels once through the spine into the result canvas. This makes lineage visible and memorable without scattering animation across the product.

Everything around the Query Spine remains quiet and disciplined.

### 11.2 Palette

Initial token proposal, subject to contrast verification:

| Token | Hex | Use |
|---|---|---|
| Instrument canvas | `#F5F7FA` | primary light background |
| Ink | `#172033` | primary text and dark surfaces |
| Measurement grid | `#DCE4ED` | borders, rules, chart grid |
| Signal cobalt | `#2F62F2` | active query, links, primary action |
| Outcome coral | `#DF5B47` | conversion loss, alerts, selected evidence |
| Verified mint | `#27896D` | healthy/fresh/success states |

Dark mode uses the same semantic relationships, not simple color inversion. Charts must remain distinguishable without relying on red/green alone.

### 11.3 Typography

- Display/headings: **Onest**, restrained use, medium/semibold.
- Body/UI: **Source Sans 3**, high legibility at dense SaaS sizes.
- Data/utility: **JetBrains Mono**, tabular numbers, query tokens, timestamps and IDs only.

All font licenses and bundling provenance must be approved before implementation. If new fonts are not accepted, equivalent locally hosted fallbacks must preserve the role separation.

### 11.4 Type hierarchy

- page title: 28/34, semibold;
- section title: 18/24, semibold;
- body/control: 14/20 and 15/22;
- label: 12/16, medium;
- data figure: 24-36 with tabular numerals depending on context;
- dense table utility: 12-13/18.

Large KPI numbers are used only when the number is the page's decision-driving thesis. They are not repeated as decorative cards.

### 11.5 Layout and surfaces

- 12-column responsive result canvas;
- stable navigation rail;
- query controls use aligned rules and typed blocks rather than nested card-on-card containers;
- elevation is reserved for drawers, dialogs and drag state;
- border radius stays moderate and consistent; pills are reserved for filters/status, not every control;
- charts share axes, grid, tooltip and empty-state contracts;
- tables are first-class analytical surfaces, not secondary leftovers.

### 11.6 Motion

- one Query Spine transition per committed query change;
- 120-180 ms control feedback;
- 180-240 ms drawer transitions;
- no ambient gradients, floating blobs or continuous chart motion;
- `prefers-reduced-motion` removes nonessential transitions;
- realtime inserts do not reorder content while the user is interacting unless explicitly resumed.

### 11.7 Copy

- active voice and sentence case;
- actions say what happens: `Save insight`, `Add to dashboard`, `Export CSV`;
- the same action name appears in the button, toast and activity log;
- errors explain cause and recovery;
- empty states point to a concrete next action;
- implementation terms such as raw table names and query adapters stay out of normal UI.

## 12. Responsive behavior

### Desktop, 1280+

Full navigation, Query Spine, result canvas and optional evidence drawer.

### Compact desktop/tablet, 768-1279

Collapsible navigation; Query Spine becomes a resizable/collapsible panel; evidence is an overlay drawer.

### Mobile, below 768

- Home, dashboards, alerts/live summaries and account/user profiles remain fully useful;
- Explore results are readable and filterable;
- complex query editing uses a full-screen step flow;
- wide tables switch to prioritized columns plus detail sheet, not horizontal micro-text;
- dashboard edit mode may be limited, but view mode remains accessible.

## 13. Accessibility contract

- WCAG 2.2 AA target;
- every action is reachable by keyboard;
- visible focus is never removed;
- Query Spine blocks use semantic buttons/forms, not clickable divs;
- charts have concise accessible summaries and equivalent data tables;
- color is never the only encoding;
- dialogs/drawers trap and restore focus;
- live updates use restrained ARIA announcements;
- reduced motion is respected;
- touch targets are at least 44×44 CSS px where appropriate;
- axe checks run on flagship screens in CI;
- keyboard-only and screen-reader smoke scenarios are documented.

## 14. Analytics semantics contract

Before feature expansion, the product must define:

- user, account, session, visit and active entity;
- activation and lifecycle stages;
- unique counting strategy;
- exact vs approximate results;
- timezone and DST handling;
- half-open date ranges `[start, end)`;
- current vs previous range boundaries;
- late-arriving event behavior;
- identity merge behavior;
- event/property type conflicts;
- deleted/retained data semantics.

Every saved Metric and Insight exposes its definition, timezone, filters and freshness.

## 15. Performance requirements

Initial budgets for the seeded portfolio dataset:

| Interaction | Target |
|---|---:|
| App shell usable after navigation | p75 ≤ 1.5 s local/reference environment |
| Cached historical query | p95 ≤ 300 ms server |
| Uncached overview/trend | p95 ≤ 1.5 s at 1M events |
| Funnel, 4 steps | p95 ≤ 2.5 s at 1M events |
| Retention, 12 cohorts | p95 ≤ 3.0 s at 1M events |
| Account/user table page | p95 ≤ 800 ms |
| Filter/query UI feedback | ≤ 100 ms |
| Live update visible | ≤ 10 s staleness target |
| CSV export, visible page | ≤ 2 s |

Additional rules:

- enforce page-size and date-range bounds;
- use cursor pagination for event/user/account activity;
- avoid duplicated full count queries when not decision-critical;
- log query duration, rows/bytes scanned and cache status;
- cancel superseded client requests;
- debounce only where it improves semantics, not to hide slow queries;
- do not ship dashboards that refetch identical queries independently.

Budgets must be re-baselined at 10M events before claiming large-scale readiness.

## 16. Realtime contract

The first implementation may use adaptive polling, but its API is snapshot-oriented and transport-neutral.

- one normalized snapshot contains timestamp, freshness and compatible widgets;
- 5-15 s cache/single-flight protects the database;
- inactive tabs reduce or stop polling;
- live page exposes pause/resume and last updated;
- a future SSE/WebSocket transport must not change UI semantics;
- connection loss never clears the last valid snapshot.

## 17. Export contract

- visible exports are synchronous and bounded;
- large exports become asynchronous jobs;
- authorization is checked at request and download time;
- export includes query metadata and generated-at time;
- sensitive columns follow role policy;
- CSV protects against formula injection;
- files expire;
- audit logs record requester, scope, format and result;
- object storage is an optional future adapter, not required for the first bounded export.

## 18. Security and privacy requirements

Before public release:

- required 2FA is enforced server-side;
- auth/share tokens have TTL, rotation and revocation semantics;
- logout/password change revoke applicable sessions;
- login and sensitive verification endpoints are rate-limited;
- recorder token is bound to website/project/session/type;
- `APP_SECRET` is mandatory and validated;
- tracker CORS is separated from management API CORS;
- CSP removes unsafe script directives where feasible;
- sensitive traits/replay access are separately permissioned;
- replay masking defaults are privacy-preserving;
- data retention/deletion has one auditable contract;
- public shares are expiring, revocable and scope-limited;
- exports and role changes are audit logged.

The product remains privacy-first; account/user analytics does not imply collecting raw IP or hidden identity data.

## 19. Observability requirements

- structured logs with request/query IDs;
- shallow liveness and dependency-aware readiness endpoints;
- request latency/error metrics;
- query duration, scanned rows/bytes and cache hit metrics;
- ingestion accepted/rejected/lost/retried counters;
- realtime polling/snapshot metrics;
- export job metrics;
- security events for login, 2FA, share and role changes;
- errors reported without exposing stack traces to users;
- documented SLOs for ingestion availability, dashboard queries and live freshness.

## 20. Testing requirements

### Unit

- normalized query schema and URL codec;
- date/timezone/range semantics;
- permission decisions;
- metrics and lifecycle definitions;
- reducers/stores and visualization transforms.

### Integration

- route → permission → query service → PostgreSQL;
- clean migrations and seed;
- export authorization and escaping;
- token expiry/revocation/2FA assurance;
- account/user identity linking;
- cache key correctness.

### Query parity

- golden dataset;
- exact expected metrics for trend, funnel and retention;
- timezone/DST boundaries;
- `[start, end)` boundaries;
- property filters;
- PostgreSQL first; ClickHouse parity before enabling that adapter.

### Component/accessibility

- accessible names and keyboard interactions;
- chart summary/data table;
- Query Spine editing;
- empty/error/partial states;
- focus behavior in drawers/dialogs.

### E2E

- onboarding/login;
- Explore URL round-trip;
- save Insight and add to Dashboard;
- funnel drill-down;
- retention cell to users;
- account → session → replay;
- viewer permission denial;
- export;
- share expiry/revocation;
- realtime pause/reconnect.

### Performance

- seeded 1M event dataset baseline;
- p50/p95 latency and rows scanned;
- concurrent dashboard viewers;
- live snapshot fan-out;
- ingestion throughput;
- large export memory behavior.

## 21. Demo acceptance scenario

The reference seeded project is a fictional PLG SaaS with accounts, users, signup/onboarding/activation events, feature usage, revenue, sessions and selected replays.

A reviewer must be able to:

1. open Home and see activation decline with freshness and definition;
2. open the KPI in Explore;
3. compare enterprise vs self-serve accounts;
4. identify the onboarding step with the largest drop-off;
5. inspect time-to-convert and affected accounts;
6. open one account, then a user session/replay;
7. save the analysis as an Insight;
8. add it to a dashboard;
9. copy a URL and reproduce the exact query state;
10. export the bounded result;
11. switch to Viewer and observe edit/export restrictions;
12. open Live and see explicit freshness/pause state.

If this flow is not coherent end-to-end, the transformation is not complete regardless of the number of implemented screens.

## 22. Product success measures

For the portfolio/review context:

- first meaningful insight reachable in ≤ 3 minutes from seeded login;
- 100% flagship Explore state round-trips through URL tests;
- every dashboard widget links to a reproducible Insight;
- every aggregate flagship view has at least one evidence drill-down;
- no critical accessibility violations on flagship routes;
- no cross-tenant access in negative tests;
- performance budgets pass on reference seed;
- production build, typecheck, lint and selected E2E gates pass;
- legal page and source distribution preserve Umami attribution.

## 23. Open decisions before implementation reaches affected milestones

1. Canonical public product name and trademark check.
2. Exact account identity trait and merge semantics.
3. Whether Metric is a persisted entity in the first release or a typed preset.
4. Scope of comments/annotations in MVP.
5. Background export storage adapter.
6. Canonical font files after license/provenance review.
7. PostgreSQL-only portfolio runtime versus optional ClickHouse demo.
8. Retention deletion policy for replay/heatmap data.

These decisions are deliberately staged in the plan; none require changing application code during this specification phase.
