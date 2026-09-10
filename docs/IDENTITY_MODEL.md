# Signal Studio identity model

Status: M4 contract  
Contract version: `identityVersion: 1`  
Lifecycle definition: `signal-studio.activation.v1`

## Domain boundary

Signal Studio has two unrelated user concepts:

- application `User` signs in to Signal Studio and participates in authorization;
- `TrackedUser` is an end user of the product being measured.

Application users are never joined to tracked identities by username, email, IP address, or
another inferred attribute. A `Project` is the product facade over one existing `Website` storage
record during the strangler migration. Therefore `Project.id === Website.id`; the Website is shown
as a `Source`, not as the primary product object.

Tracked IDs are case-sensitive and unique only inside a project:

```text
UNIQUE(project_id, external_id)
```

The same external user or account ID may safely exist in two projects. Identity is never inferred
from an IP address.

## Collection contract

The existing identify payload remains valid:

```json
{
  "type": "identify",
  "payload": {
    "website": "project-uuid",
    "id": "user-42",
    "data": { "plan": "pro" }
  }
}
```

The explicit account extension is versioned:

```json
{
  "type": "identify",
  "payload": {
    "website": "project-uuid",
    "identityVersion": 1,
    "id": "user-42",
    "data": {
      "plan": "pro",
      "email": "ada@example.test"
    },
    "account": {
      "id": "acme",
      "name": "Acme",
      "traits": { "industry": "software" }
    }
  }
}
```

Version 1 requires a non-empty user ID of at most 50 characters and an account ID of at most 100
characters. It rejects oversized values rather than truncating them into possible collisions.
Legacy identify still follows the existing session-link behavior; an invalid legacy ID is simply
not materialized into the new projection.

## Upsert and merge semantics

Identity projection is one parameterized PostgreSQL CTE statement. It verifies that a live Project
exists, then upserts the account, user, and optional current membership atomically. This
control-plane projection remains PostgreSQL-backed even when the optional ClickHouse analytics
adapter is enabled.

Rules:

- repeated identify calls are idempotent;
- `firstSeenAt` is the earliest accepted observation;
- `lastSeenAt` is the latest accepted observation;
- an equal or newer observation shallow-merges traits and may update display fields/lifecycle;
- a late observation may move `firstSeenAt` earlier but cannot roll traits or membership back;
- missing trait keys preserve their existing values;
- absent `account` means “do not change current membership”;
- project deletion or reset prevents a cache-token request from creating orphan projections.

M4 performs no automatic legacy backfill. A future backfill must be bounded, restartable, and use
the same merge rules.

## Account membership accuracy

`AccountMembership` is explicitly **current-only** in M4. One tracked user has zero or one current
account membership. An equal or newer identify for a different account replaces it. Older identify
traffic cannot move the user back. The schema and API do not claim historical membership accuracy;
unlinking and temporal membership history are deferred.

Historical session/event traits remain evidence of what was observed at that time, but they must
not be presented as an exact account-membership history.

## Lifecycle definition

`signal-studio.activation.v1` defines activation at tracked-user granularity as the ordered product
behaviors:

```text
signup → onboarding_completed → core_feature_used
```

Supported seed lifecycle stages are `identified`, `signed-up`, `onboarding`, `activated`,
`retained`, and `inactive`. The definition key is stored with each projection so future changes do
not silently reinterpret existing lifecycle values.

## Trait classification and permissions

Standard traits and sensitive traits are stored in separate JSONB columns. Policy
`signal-studio.traits.v1` allows these display-safe standard keys:

- `plan`, `role`, `industry`, `company_size`;
- `billing_tier`, `employee_count`, `lifecycle_stage`.

Email, phone, address, personal names, and every unknown custom key are sensitive by default.
External IDs and display names are also sensitive. Standard-scope Prisma reads do not select the
sensitive JSONB column or those display fields, rather than fetching and masking them after
serialization.

The temporary pre-M14 project policy is conservative:

| Subject | Scope |
|---|---|
| Global admin | `identity-sensitive` |
| Direct project owner | `identity-sensitive` |
| Team owner / manager | `identity-sensitive` |
| Team member / view-only | `identity-standard` |
| Share token / anonymous / foreign project | `deny` |

The stable scope string is designed to become part of M5 permission-sensitive cache keys.

## Read and pagination contract

M4 list APIs are bounded to 100 rows and use an opaque `(lastSeenAt, id)` descending cursor. They do
not perform an automatic total-count query. Account relations are loaded in the same bounded query,
not through per-row lookups.

```text
GET /api/projects/:projectId/tracked-users
GET /api/projects/:projectId/accounts
```

## Deletion and reset dependencies

Prisma uses `relationMode = "prisma"`, so database cascades are not assumed. Project reset and
physical delete remove data in dependency order:

```text
AccountMembership
  → TrackedUser
  → TrackedAccount
  → session/replay/heatmap/revenue/event evidence
  → Project/Website record when deleting
```

Both reset and delete clear the identity projection. This prevents an empty reset Project from
showing identities derived from removed evidence.

## Migration and rollback

Migration `27_project_tracked_identity` is additive and has no fact-table rewrite or automatic
backfill. An older application can ignore the new tables, so the safe production rollback is:

1. stop identity-writing application instances;
2. roll the application back while leaving the additive tables in place;
3. ship a forward fix and resume projection.

Dropping the tables is safe only before valuable identity traits exist or after a verified export
and explicit destructive-change approval. New application code must not start until migration 27
has been applied.
