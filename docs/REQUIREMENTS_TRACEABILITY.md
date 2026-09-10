# Portfolio-v1 requirement traceability

2026-09-10. All 76 original functional IDs are retained below. Eight are explicitly
deferred by the authorized portfolio-scope clarification. The other 68 map to
implemented milestones and historical selected tests; this is not a new claim that
every subclause has independent passing acceptance evidence.

Deferred ownership: next portfolio milestone D1 owns FR-SHELL-05 entity/action search
and FR-SHELL-06 per-user/workspace recents/favorites; D2 owns FR-CAT-01–06 governed
catalog metadata/types/conflicts/editing/dependencies/privacy. Preserve the original
criteria in TRANSFORMATION_SPEC.md. Do not mark these requirements done until their
API permissions, persistence, UI and tests exist. Current favorites are project-wide;
current palette searches navigation labels only.

Security/release requirements are never deferred. PUB-01/03/05/06/08/09 are mapped in
RELEASE_CLOSURE_REPORT.md; PUB-04/07 are publication-stage external/authorization gates.

| ID | Original requirement | Status | Milestone | Source | Evidence entry |
|---|---|---|---|---|---|
| FR-SHELL-01 | A signed-in user sees only workspaces/projects permitted by server-side authorization. | HISTORICAL EVIDENCE; not re-certified per FR | M3 | src/features/studio-shell/ | tests/e2e/studio-shell.spec.ts |
| FR-SHELL-02 | Project switching preserves compatible page state and clears incompatible entity IDs. | HISTORICAL EVIDENCE; not re-certified per FR | M3 | src/features/studio-shell/ | tests/e2e/studio-shell.spec.ts |
| FR-SHELL-03 | Navigation is consistent across desktop and mobile. | HISTORICAL EVIDENCE; not re-certified per FR | M3 | src/features/studio-shell/ | tests/e2e/studio-shell.spec.ts |
| FR-SHELL-04 | Every page provides explicit loading, empty, error and permission states. | HISTORICAL EVIDENCE; not re-certified per FR | M3 | src/features/studio-shell/ | tests/e2e/studio-shell.spec.ts |
| FR-SHELL-05 | Command palette opens pages, saved insights, users/accounts and actions permitted to the current role. | DEFERRED | M3 | src/features/studio-shell/ | tests/e2e/studio-shell.spec.ts |
| FR-SHELL-06 | Recent items and favorites are scoped by user and workspace. | DEFERRED | M3 | src/features/studio-shell/ | tests/e2e/studio-shell.spec.ts |
| FR-HOME-01 | Show activation, weekly active users/accounts, retention and tracked revenue with definitions and comparison. | HISTORICAL EVIDENCE; not re-certified per FR | M16 | src/features/home/; src/server/home/ | tests/e2e/m16-home.spec.ts |
| FR-HOME-02 | Show a lifecycle funnel from signup to activated to retained. | HISTORICAL EVIDENCE; not re-certified per FR | M16 | src/features/home/; src/server/home/ | tests/e2e/m16-home.spec.ts |
| FR-HOME-03 | Show feature adoption and at-risk account lists. | HISTORICAL EVIDENCE; not re-certified per FR | M16 | src/features/home/; src/server/home/ | tests/e2e/m16-home.spec.ts |
| FR-HOME-04 | Show data freshness and ingestion health. | HISTORICAL EVIDENCE; not re-certified per FR | M16 | src/features/home/; src/server/home/ | tests/e2e/m16-home.spec.ts |
| FR-HOME-05 | Show recent saved insights/annotations, not generic marketing copy. | HISTORICAL EVIDENCE; not re-certified per FR | M16 | src/features/home/; src/server/home/ | tests/e2e/m16-home.spec.ts |
| FR-HOME-06 | Every KPI links to its Explore definition. | HISTORICAL EVIDENCE; not re-certified per FR | M16 | src/features/home/; src/server/home/ | tests/e2e/m16-home.spec.ts |
| FR-EXP-01 | Query an event/metric by count, unique users, unique accounts, sessions, sum or average where type-compatible. | HISTORICAL EVIDENCE; not re-certified per FR | M5–M6 | src/features/explore/; src/server/analytics/ | tests/e2e/explore-workspace.spec.ts |
| FR-EXP-02 | Apply dimension and typed property filters with all/any match mode. | HISTORICAL EVIDENCE; not re-certified per FR | M5–M6 | src/features/explore/; src/server/analytics/ | tests/e2e/explore-workspace.spec.ts |
| FR-EXP-03 | Break down by one supported dimension in MVP and sort by value/change. | HISTORICAL EVIDENCE; not re-certified per FR | M5–M6 | src/features/explore/; src/server/analytics/ | tests/e2e/explore-workspace.spec.ts |
| FR-EXP-04 | Compare previous period or a selected segment. | HISTORICAL EVIDENCE; not re-certified per FR | M5–M6 | src/features/explore/; src/server/analytics/ | tests/e2e/explore-workspace.spec.ts |
| FR-EXP-05 | Toggle compatible chart/table views without losing state. | HISTORICAL EVIDENCE; not re-certified per FR | M5–M6 | src/features/explore/; src/server/analytics/ | tests/e2e/explore-workspace.spec.ts |
| FR-EXP-06 | Open a result row as a scoped drill-down. | HISTORICAL EVIDENCE; not re-certified per FR | M5–M6 | src/features/explore/; src/server/analytics/ | tests/e2e/explore-workspace.spec.ts |
| FR-EXP-07 | Save the normalized query as an Insight. | HISTORICAL EVIDENCE; not re-certified per FR | M5–M6 | src/features/explore/; src/server/analytics/ | tests/e2e/explore-workspace.spec.ts |
| FR-FUN-01 | Define 2-8 ordered event/page steps. | HISTORICAL EVIDENCE; not re-certified per FR | M9 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | tests/integration/ (advanced analytics); PLAN.md M9 |
| FR-FUN-02 | Configure conversion window. | HISTORICAL EVIDENCE; not re-certified per FR | M9 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | tests/integration/ (advanced analytics); PLAN.md M9 |
| FR-FUN-03 | Apply global and per-step property filters. | HISTORICAL EVIDENCE; not re-certified per FR | M9 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | tests/integration/ (advanced analytics); PLAN.md M9 |
| FR-FUN-04 | Show step entrants, conversion, drop-off and overall conversion. | HISTORICAL EVIDENCE; not re-certified per FR | M9 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | tests/integration/ (advanced analytics); PLAN.md M9 |
| FR-FUN-05 | Show conversion trend across the selected range. | HISTORICAL EVIDENCE; not re-certified per FR | M9 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | tests/integration/ (advanced analytics); PLAN.md M9 |
| FR-FUN-06 | Show time-to-convert distribution. | HISTORICAL EVIDENCE; not re-certified per FR | M9 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | tests/integration/ (advanced analytics); PLAN.md M9 |
| FR-FUN-07 | Compare one breakdown or segment. | HISTORICAL EVIDENCE; not re-certified per FR | M9 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | tests/integration/ (advanced analytics); PLAN.md M9 |
| FR-FUN-08 | Drill into converted/dropped users or accounts, then sessions/replays. | HISTORICAL EVIDENCE; not re-certified per FR | M9 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | tests/integration/ (advanced analytics); PLAN.md M9 |
| FR-RET-01 | Define entry behavior and return behavior independently. | HISTORICAL EVIDENCE; not re-certified per FR | M10 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | PLAN.md M10; docs/evidence/m9-m10/ |
| FR-RET-02 | Support daily, weekly and monthly granularity within bounded ranges. | HISTORICAL EVIDENCE; not re-certified per FR | M10 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | PLAN.md M10; docs/evidence/m9-m10/ |
| FR-RET-03 | Show matrix, retention curve and cohort size. | HISTORICAL EVIDENCE; not re-certified per FR | M10 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | PLAN.md M10; docs/evidence/m9-m10/ |
| FR-RET-04 | Compare two segments/cohorts. | HISTORICAL EVIDENCE; not re-certified per FR | M10 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | PLAN.md M10; docs/evidence/m9-m10/ |
| FR-RET-05 | Open a cell to view matching accounts/users. | HISTORICAL EVIDENCE; not re-certified per FR | M10 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | PLAN.md M10; docs/evidence/m9-m10/ |
| FR-RET-06 | Save the definition as a reusable Cohort or Insight. | HISTORICAL EVIDENCE; not re-certified per FR | M10 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | PLAN.md M10; docs/evidence/m9-m10/ |
| FR-RET-07 | State whether retention is exact or approximate. | HISTORICAL EVIDENCE; not re-certified per FR | M10 | src/features/explore/AdvancedAnalysis.tsx; src/server/analytics/ | PLAN.md M10; docs/evidence/m9-m10/ |
| FR-CAT-01 | List event name, description, owner, status, volume, unique users, first seen and last seen. | DEFERRED | Deferred catalog | No governed catalog implementation | No acceptance claim |
| FR-CAT-02 | Show observed properties and types. | DEFERRED | Deferred catalog | No governed catalog implementation | No acceptance claim |
| FR-CAT-03 | Flag type conflicts, stale events and missing descriptions. | DEFERRED | Deferred catalog | No governed catalog implementation | No acceptance claim |
| FR-CAT-04 | Allow authorized users to set display name, description, owner and lifecycle status without renaming raw data. | DEFERRED | Deferred catalog | No governed catalog implementation | No acceptance claim |
| FR-CAT-05 | Show where an event is used by insights, funnels, cohorts and dashboards. | DEFERRED | Deferred catalog | No governed catalog implementation | No acceptance claim |
| FR-CAT-06 | Never expose raw sensitive property samples by default. | DEFERRED | Deferred catalog | No governed catalog implementation | No acceptance claim |
| FR-AUD-01 | List accounts/users with search, filters, sort and cursor pagination. | HISTORICAL EVIDENCE; not re-certified per FR | M4/M11 | src/features/audiences/; src/server/identities/ | tests/e2e/audiences-experience.spec.ts |
| FR-AUD-02 | Show lifecycle stage, health/activation status and recent activity. | HISTORICAL EVIDENCE; not re-certified per FR | M4/M11 | src/features/audiences/; src/server/identities/ | tests/e2e/audiences-experience.spec.ts |
| FR-AUD-03 | Account detail shows members, traits, adoption, trends and sessions. | HISTORICAL EVIDENCE; not re-certified per FR | M4/M11 | src/features/audiences/; src/server/identities/ | tests/e2e/audiences-experience.spec.ts |
| FR-AUD-04 | User detail shows traits, stitched sessions, event timeline and cohort membership. | HISTORICAL EVIDENCE; not re-certified per FR | M4/M11 | src/features/audiences/; src/server/identities/ | tests/e2e/audiences-experience.spec.ts |
| FR-AUD-05 | Every calculated score exposes its definition and freshness. | HISTORICAL EVIDENCE; not re-certified per FR | M4/M11 | src/features/audiences/; src/server/identities/ | tests/e2e/audiences-experience.spec.ts |
| FR-AUD-06 | Sensitive traits are masked or excluded based on permission policy. | HISTORICAL EVIDENCE; not re-certified per FR | M4/M11 | src/features/audiences/; src/server/identities/ | tests/e2e/audiences-experience.spec.ts |
| FR-SEG-01 | Build reusable account/user segments from traits and behavior. | HISTORICAL EVIDENCE; not re-certified per FR | M10/M11 | src/features/audiences/ | tests/e2e/audiences-experience.spec.ts |
| FR-SEG-02 | Preview estimated size before save. | HISTORICAL EVIDENCE; not re-certified per FR | M10/M11 | src/features/audiences/ | tests/e2e/audiences-experience.spec.ts |
| FR-SEG-03 | Show exact evaluation timestamp and freshness. | HISTORICAL EVIDENCE; not re-certified per FR | M10/M11 | src/features/audiences/ | tests/e2e/audiences-experience.spec.ts |
| FR-SEG-04 | Show sample members subject to permissions. | HISTORICAL EVIDENCE; not re-certified per FR | M10/M11 | src/features/audiences/ | tests/e2e/audiences-experience.spec.ts |
| FR-SEG-05 | Show dependencies before edit/delete. | HISTORICAL EVIDENCE; not re-certified per FR | M10/M11 | src/features/audiences/ | tests/e2e/audiences-experience.spec.ts |
| FR-SEG-06 | Segment and cohort terminology remains unambiguous throughout the UI. | HISTORICAL EVIDENCE; not re-certified per FR | M10/M11 | src/features/audiences/ | tests/e2e/audiences-experience.spec.ts |
| FR-INS-01 | Insight stores normalized query, visualization, title, description, owner and timestamps. | HISTORICAL EVIDENCE; not re-certified per FR | M7 | src/features/insights/; src/server/insights/ | tests/e2e/insight-library.spec.ts |
| FR-INS-02 | Opening an Insight restores the full analysis. | HISTORICAL EVIDENCE; not re-certified per FR | M7 | src/features/insights/; src/server/insights/ | tests/e2e/insight-library.spec.ts |
| FR-INS-03 | Authorized users can duplicate rather than overwrite shared work. | HISTORICAL EVIDENCE; not re-certified per FR | M7 | src/features/insights/; src/server/insights/ | tests/e2e/insight-library.spec.ts |
| FR-DASH-01 | Dashboard contains insight widgets, text notes and section headers. | HISTORICAL EVIDENCE; not re-certified per FR | M8/M14 | src/features/dashboards/; src/server/dashboards/ | tests/e2e/dashboard-workspace.spec.ts |
| FR-DASH-02 | Global date/segment context can override compatible widgets and visibly marks exceptions. | HISTORICAL EVIDENCE; not re-certified per FR | M8/M14 | src/features/dashboards/; src/server/dashboards/ | tests/e2e/dashboard-workspace.spec.ts |
| FR-DASH-03 | Edit mode supports deterministic grid placement and keyboard-accessible alternatives. | HISTORICAL EVIDENCE; not re-certified per FR | M8/M14 | src/features/dashboards/; src/server/dashboards/ | tests/e2e/dashboard-workspace.spec.ts |
| FR-DASH-04 | Dashboard shows freshness and per-widget errors. | HISTORICAL EVIDENCE; not re-certified per FR | M8/M14 | src/features/dashboards/; src/server/dashboards/ | tests/e2e/dashboard-workspace.spec.ts |
| FR-DASH-05 | Internal/public share respects explicit scope and expiry. | HISTORICAL EVIDENCE; not re-certified per FR | M8/M14 | src/features/dashboards/; src/server/dashboards/ | tests/e2e/dashboard-workspace.spec.ts |
| FR-EXPX-01 | Aggregate results can open matching sessions when the query permits. | HISTORICAL EVIDENCE; not re-certified per FR | M12 | src/features/experience/; src/server/evidence/ | tests/e2e/audiences-experience.spec.ts |
| FR-EXPX-02 | Session detail combines timeline, properties, identity and performance. | HISTORICAL EVIDENCE; not re-certified per FR | M12 | src/features/experience/; src/server/evidence/ | tests/e2e/audiences-experience.spec.ts |
| FR-EXPX-03 | Replay is visibly marked as unavailable, not silently omitted, when recording is disabled. | HISTORICAL EVIDENCE; not re-certified per FR | M12 | src/features/experience/; src/server/evidence/ | tests/e2e/audiences-experience.spec.ts |
| FR-EXPX-04 | Heatmap and Web Vitals use the same project/date/filter context where semantically valid. | HISTORICAL EVIDENCE; not re-certified per FR | M12 | src/features/experience/; src/server/evidence/ | tests/e2e/audiences-experience.spec.ts |
| FR-EXPX-05 | Replay masking mode and privacy warning are visible to administrators. | HISTORICAL EVIDENCE; not re-certified per FR | M12 | src/features/experience/; src/server/evidence/ | tests/e2e/audiences-experience.spec.ts |
| FR-LIVE-01 | Show current active users/accounts, event stream and top changing behaviors. | HISTORICAL EVIDENCE; not re-certified per FR | M13 | src/features/live/; src/server/live/ | tests/e2e/live-workspace.spec.ts |
| FR-LIVE-02 | Display last update, connection/polling state and pause/resume. | HISTORICAL EVIDENCE; not re-certified per FR | M13 | src/features/live/; src/server/live/ | tests/e2e/live-workspace.spec.ts |
| FR-LIVE-03 | One server snapshot is shared across compatible viewers where possible. | HISTORICAL EVIDENCE; not re-certified per FR | M13 | src/features/live/; src/server/live/ | tests/e2e/live-workspace.spec.ts |
| FR-LIVE-04 | Historical results do not refetch every 10 seconds. | HISTORICAL EVIDENCE; not re-certified per FR | M13 | src/features/live/; src/server/live/ | tests/e2e/live-workspace.spec.ts |
| FR-LIVE-05 | Live view degrades to adaptive polling if streaming is unavailable. | HISTORICAL EVIDENCE; not re-certified per FR | M13 | src/features/live/; src/server/live/ | tests/e2e/live-workspace.spec.ts |
| FR-EXPORT-01 | Visible table results export as CSV with active filters and stable column definitions. | HISTORICAL EVIDENCE; not re-certified per FR | M15 | src/features/exports/; src/server/exports/ | tests/e2e/m15-export.spec.ts |
| FR-EXPORT-02 | Query definitions export as JSON. | HISTORICAL EVIDENCE; not re-certified per FR | M15 | src/features/exports/; src/server/exports/ | tests/e2e/m15-export.spec.ts |
| FR-EXPORT-03 | Filenames include project, insight/mode and date range. | HISTORICAL EVIDENCE; not re-certified per FR | M15 | src/features/exports/; src/server/exports/ | tests/e2e/m15-export.spec.ts |
| FR-EXPORT-04 | Large exports run as background jobs with status, expiry and permission recheck. | HISTORICAL EVIDENCE; not re-certified per FR | M15 | src/features/exports/; src/server/exports/ | tests/e2e/m15-export.spec.ts |
| FR-EXPORT-05 | CSV formula injection is prevented. | HISTORICAL EVIDENCE; not re-certified per FR | M15 | src/features/exports/; src/server/exports/ | tests/e2e/m15-export.spec.ts |
| FR-EXPORT-06 | Export actions are audit logged. | HISTORICAL EVIDENCE; not re-certified per FR | M15 | src/features/exports/; src/server/exports/ | tests/e2e/m15-export.spec.ts |
