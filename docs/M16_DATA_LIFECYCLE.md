# M16 data lifecycle contract

The existing app and export worker implement explicit, one-shot retention/deletion
requests. No automatic purge is enabled and migration 35 deletes no existing data.

## Scope and safety

Workspace settings exposes the controls only to the reusable
manageWorkspaceSecurity capability (normally Owner/system administrator).
API authentication, assurance and live permissions are enforced independently of UI.
A request requires the exact project UUID, an idempotency key, category and cutoff.
Only one pending job per project is accepted. Repeating a completed identity deletion
returns the original result, including after the identity no longer exists.

Project retention uses UTC createdAt < cutoff, with legacy NULL timestamps treated
as old. Categories: events, properties, replay, heatmaps, exports, all. Event deletion
also removes dependent evidence. User/account erasure covers full recorded history;
account scope uses current membership. Identity is resolved through session_link or
Session.distinctId. Entire associated sessions are erased, including anonymous/shared
session evidence. Project settings, saved analytical definitions and security audit
are preserved; this is not a claim of universal statutory erasure of arbitrary
operator-entered text.

Any purge invalidates project export artifacts, since files may contain affected
rows. Only validated artifact keys from owned database records are unlinked.
Operator backups and previously downloaded copies are outside the enabled-store
contract and require their own expiry/deletion policy. Security audit retention is
separate and indefinite. Existing query caches expire within 120 seconds.

## Execution

The same worker alternates a lifecycle batch and an export job. PostgreSQL
SKIP LOCKED claims, project advisory locks and durable step progress bound deletion
to 500 rows per transaction (export file batches 100). Accepted ingestion holds a
shared project lock; pending deletion rejects new writes with 503/Retry-After.
The lock-only pool is bounded to two additional PostgreSQL connections and avoids
holding the normal query pool while waiting for accepted writes.

Permissions/session version are checked on each batch. Revoked access, running
exports or unsupported configured stores produce an explicit blocked status.
Unexpected batch errors produce failed, not an infinite retry loop. After correcting
the cause, an authorized operator can submit a new idempotency key. Completed is
reported only after final predicate verification. Logs/audit contain job IDs,
safe status/error codes and row counts, never deleted payloads.

PostgreSQL and owned local export files are the verified stores. ClickHouse,
Kafka/cloud modes are not supported by this release and cannot be reported erased.
Legacy source reset/delete additionally invalidates owned export files; large or
running export queues require the bounded lifecycle workflow first.

## Verification

All destructive fixtures use signal_studio_test_20260908 with UUID-owned records.
Integration covers bounded batches, categories, user/account identity, physical
encrypted artifacts, unrelated-file preservation, revocation, idempotency, concurrent
accepted ingestion and unsupported-store blocking. Browser acceptance covers
anonymous/Viewer denial, keyboard confirmation, actual replay deletion, persisted
job state, RU/EN and mobile axe. Exact final counts are in M16_FINAL_REPORT.md.

