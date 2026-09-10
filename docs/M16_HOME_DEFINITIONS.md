# Home metric contract — signal-studio.home.v1

FR-HOME is implemented and verified. Final local M16 acceptance and external exclusions are recorded in M16_FINAL_REPORT.md.

Home uses the same normalized AnalysisQuery and PostgreSQL execution as Explore,
saved Insights and exports. No separate authoritative client calculation is used.

- Weekly active users: distinct **project TrackedUser IDs** with at least one custom
  event in the last completed UTC calendar week. Anonymous sessions are excluded.
- Weekly active accounts: distinct current AccountMembership account IDs for those
  users. Membership is the existing latest-observed projection, not historical
  event-time membership. A reassignment can change historical account results.
- Sessions: distinct linked session IDs with qualifying custom events.
- Numeric sums/averages: numeric event property values only, one fact per event
  (duplicate numeric property rows are averaged first); missing/non-numeric values
  are excluded. Revenue is separate: recorded Revenue facts, one explicit currency,
  no exchange-rate conversion, refunds retain their recorded sign.
- Activation: signup → onboarding_completed → core_feature_used for an identified
  TrackedUser, strictly ordered by timestamp/event ID, within seven elapsed days
  of signup. The first signup **in the selected cohort range** is the entry. This
  is an observed-event cohort metric, not the mutable stored lifecycle trait.
- Retained: an activated cohort member uses core_feature_used in the half-open
  elapsed interval [activation + 7 days, activation + 14 days). Denominator is
  activated members; activation denominator is signup members. A zero denominator
  is unavailable, never a fabricated zero-percent rate.
- Home activation/retention uses the most recent completed UTC cohort week whose
  entire 21-day observation horizon has closed. This deliberate lag avoids counting
  right-censored users as churn. Lifecycle counts use that identical cohort.
- Feature adoption: top 10 custom event names by distinct TrackedUser count in the
  active week; counts are not additive across features.
- At risk: current tracked accounts with previously observed activity but no activity
  in the last seven elapsed days. This is an explicit inactivity signal, not a churn
  prediction or opaque health score. Lists obey identity/sensitive-data permissions.

All ranges are half-open [start, end), dates are explicit UTC instants, and calendar
buckets use the query timezone. Comparison is the preceding equal-duration range.
Distinct counts and ratios are recomputed over a whole range for totals: never
summed across time buckets. Late-arriving data and retained/deleted facts can change
historical results; the short cache only delays visibility, it does not freeze data.
No ClickHouse parity is claimed. Displayed freshness distinguishes computation time
from the most recent observed event; absent ingestion receipts cannot prove zero loss.
