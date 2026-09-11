# Code origins and personal contribution

Signal Studio 1.0 is an MIT-licensed transformation based on Umami 3.3.1,
upstream baseline `ca661c7057984aa98ed4f7083d84dae2f65bfcb0`.
It is not a clean-room replacement of the whole upstream application.

| Area | Origin and current boundary |
|---|---|
| Studio feature UI | Project-specific `src/features`: shell, Query Spine, Explore, Home, Insights, Dashboards, Audiences, Experience, Live, Sources, access and export workflows |
| Normalized analysis | Project-specific contracts, URL codec, planner/cache, definitions and adapters in `src/server/analytics` |
| Event count SQL | New independent compiler/executor in `adapters/event-postgresql.ts`; direct parameterized fact aggregation, half-open dates, tenant scope and bounded dimensions; no legacy query-module call |
| Other Studio analytics | Project-specific metric and advanced adapters; PostgreSQL golden tests define behavior |
| Saved entities and jobs | Project-specific Insights, Dashboard references, tracked users/accounts, capability services, exports and lifecycle jobs |
| Tracker and ingestion | Retained/adapted Umami collection with compatible identifiers and API; new versioned identity and security enforcement layered on it |
| Legacy reports/settings | Retained Umami route/query/component implementation, available for compatibility and administrative setup |
| Login/common infrastructure | Retained and hardened authentication implementation; new product login layout, Studio routing and safe logout handling |
| UI libraries | Normal third-party dependencies, including MIT @umami/react-zen; using them does not make their implementation ours |
| Fonts/icons/maps/replay | Recorded in THIRD_PARTY_NOTICES and the generated asset inventory; no new remote media was added in M17 |

The contribution is product engineering across the above project-specific areas,
not ownership of the upstream runtime. Renaming the package to Signal Studio 1.0
identifies the transformed release; it does not change the original authorship.
The full root MIT license, Umami copyright and based-on attribution remain intact.

## Analytics behavior retained and extended

The event executor counts stored custom-event facts (`event_type = 2`) exactly.
A chosen event is an additional predicate outside OR filter groups. String search
uses case-insensitive literal substring matching; values are parameters, never SQL.
Null dimensions display `(not set)`. Breakdown order is value descending then key;
limits are validated to 1–50. UTC buckets retain ISO labels; other supported daily/
weekly/monthly timezones retain local wall-time labels. Hourly non-UTC remains
rejected by the normalized contract. Range membership is `[startAt, endAt)`.

Session joins happen only for session dimensions/filters. Event counts never join
account memberships. Numeric event/revenue aggregation also avoids unnecessary
membership joins. Current membership remains intentionally relevant only for
unique-account analytics. Late events and deletion are reflected after the bounded
cache TTL or cache bypass; no new approximate or ClickHouse capability is claimed.

## License evidence

Build inventory: 1029 components, 478 license texts at the M17 verification point.
This inventory is not a vulnerability scan or blanket legal warranty. Existing
notices document declaration-only evidence where upstream packages omit a license
file. GeoLite2 is not bundled by default. Root LICENSE SHA-256 remains
`2a2a42dba0334d768c61edc8f5bb5d3732d94de23d99a7e539a719b1d5117ba0`.

## UX references

The design retains a distinctive Query Spine, surrounding it with restrained
analytical surfaces and actionable source setup. References were the documented
question-to-insight workflow in [Mixpanel Insights](https://docs.mixpanel.com/docs/reports/insights),
the shared overview in [Amplitude](https://amplitude.com/docs/analytics/product-analytics),
and [PostHog's activation guidance](https://newsletter.posthog.com/p/wtf-is-activation-and-why-should).
No reference UI, image, font or source code was copied into the project.
