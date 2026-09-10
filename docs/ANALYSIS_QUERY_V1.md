# AnalysisQuery v1

AnalysisQuery v1 is the canonical analytical question shared by Signal Studio URLs,
the management API, the query service, the PostgreSQL adapter, Explore, Insights,
Dashboards and cache keys. M5 established the narrow exact execution contract; M6
adds its complete interactive presentation without widening the metric semantics.

## Supported execution

| Field | PostgreSQL reference behavior through M8 |
|---|---|
| Mode | `trend` or `breakdown` |
| Source | custom events (`website_event.event_type = 2`) |
| Measure | one event name, or `*` for all custom events |
| Aggregation | exact event-row `count` |
| Breakdown | one of `eventName` or `urlPath`, limit `1..50` |
| Filters | `eventName`, `urlPath`, `browser`, `os`, `device`, `country` |
| Match | `all`; bounded `any` where the selected measure does not change its meaning |
| Comparison | none, an equal-duration previous period, or one typed segment filter |
| Adapter | named PostgreSQL implementation only |

The schema includes reserved aggregation and dimension names needed by later
version-compatible clients. Unsupported combinations fail before SQL with a stable
error code, field path and corrective hint. M5 does not claim ClickHouse parity.

## Metric semantics

- Unit of analysis: one stored custom-event fact row.
- Numerator: event rows satisfying the project, half-open range, selected event and
  filters.
- Denominator: none.
- Identity: user, account, session and visit identity are not part of `count`.
- Exactness: exact for the PostgreSQL reference path.
- Range: `[startAt, endAt)`; an event at `endAt` is excluded and belongs to the next
  adjacent range.
- Timezone: `startAt` and `endAt` are offset-bearing instants. Day and month bucket
  labels use the validated IANA timezone. Hour buckets are restricted to UTC in v1
  so a DST fall-back hour cannot produce two indistinguishable labels.
- Series: trend results are sparse. A missing bucket means no returned fact row; a
  future presentation layer may fill zeroes without changing this contract.
- Filters: the selected event key is an additional measure constraint. Filter order
  is canonicalized before URL or cache serialization.
- Comparison: `previousPeriod` uses the same absolute duration immediately before
  `startAt`; it is not described as the same local wall-clock interval across DST.
- Segment comparison: the primary series uses the base filters and the comparison
  series adds one typed `comparisonFilter`. Both retain the same range, timezone,
  measure, breakdown and exactness. The comparison filter is normalized and subject
  to the same operator and filter-count bounds as ordinary filters.
- Late events: historical results may remain cached for at most 120 seconds. Recent
  ranges use 30 or 60 seconds; future-ending ranges bypass the cache.
- Deletion/reset: the adapter reads the existing project-owned evidence tables, so
  the established project deletion path removes the same facts. Cache isolation also
  includes an explicit data-version slot for future reset-version invalidation.

## Runtime bounds

- maximum range: 366 days;
- maximum hourly range: 31 days;
- maximum filters: 8;
- maximum filter value: 200 characters;
- maximum breakdown cardinality: 50;
- one breakdown only;
- invalid IANA zones, unknown versions, unsupported operators and unsupported
  aggregation/dimension combinations return actionable validation errors.

## URL contract

The URL codec uses explicit keys rather than an opaque JSON payload:

```text
aqv, project, mode, event, aggregation, property, start, end, tz, unit,
breakdown, limit, compare, cf, view, match, f
```

Each `f` value is a JSON tuple `[field, operator, value]`; `cf` uses the same tuple
shape for the optional comparison segment. Serialization always normalizes instants,
timezone names and filter order before emitting keys in a fixed order. Parsing then
serializing a valid question is stable. `resetAnalysisFilters` removes only `f` and
`match`; project, range, measure, mode, breakdown, comparison and visualization remain
intact. Unknown or missing `aqv` values fail safely.

## Service and result boundary

The API handler performs:

```text
parse/authenticate/2FA assurance -> project permission -> query service -> response
```

The service normalizes once for planning, derives any previous-period or segment
comparison query, selects the named PostgreSQL adapter and returns:

- `queryVersion`;
- `generatedAt` and adapter `freshnessAt` timestamps;
- `exactness`;
- cache outcome (`hit`, `miss` or `bypass`);
- typed trend or breakdown rows;
- semantic definitions and optional warnings.

Caller cancellation stops that caller from awaiting a superseded request. Identical
misses share one in-flight database operation so cancellation does not multiply work.

## Cache and telemetry isolation

A cache key hashes the normalized question together with contract version, tenant,
project, permission scope, adapter, exactness and data version. Permission is checked
before cache access. The process-local cache is LRU-bounded to 500 entries and has no
unbounded fallback.

Structured telemetry records request ID, cache outcome, adapter, exactness, planner
milliseconds, SQL milliseconds, rows returned, rows scanned when the adapter can
provide it, outcome and a safe error code. The current legacy PostgreSQL wrapper does
not expose executor scan counters, so regular requests report `rowsScanned: null`.
The M5 reference benchmark records scanned rows and approximate scanned bytes with
PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.

## Known v1 limitations

- Unique users/accounts, sessions, property sum/average, property filters and multiple
  breakdowns are deliberately rejected until later milestones define and test them.
- ClickHouse is not selected by the M5 adapter and has no M5 capability claim.
- The cache is per process. A distributed cache and reset-version invalidation can be
  added behind the same key/service boundary.
- Dashboard sharing remains private until the scoped role/share milestone adds
  expiring, revocable public access. Widgets continue to reference Insights rather
  than owning copies of this query contract.
