# M15 — scoped CSV/JSON exports

Implemented on 2026-09-08. PostgreSQL is the supported backend; no ClickHouse parity claim.

Explore exports its applied AnalysisQuery, not the editor draft. Dashboard widgets export their Insight with the applied global context. Audiences export the currently loaded rows or all matching identities. Definitions, filters, date boundaries, freshness/exactness and permission scope accompany the data. A background export captures data at worker execution time, not a frozen browser result.

## Limits and privacy

- Immediate response: up to 1,000 rows and 1 MiB; a larger result queues automatically.
- Background job: up to 100,000 rows and 64 MiB, one worker execution at a time, three active jobs per requester.
- TTL: one hour from request. Downloads check live project capabilities, requester ownership, session version, scope, state and expiry.
- CSV has `record_type,metadata,...columns`; the first record contains metadata, following records contain data. Formula/control prefixes are escaped. JSON preserves typed values.
- Identity pages use deterministic cursor ordering; background identity reads use one repeatable-read transaction. Standard scope excludes external IDs, names and sensitive traits.
- AES-256-GCM files derive their storage key from APP_SECRET. Keep that secret stable and share the storage directory between app and worker. Rotate it only with the expectation that old artifacts become unreadable.
- Audit records contain project/job/scope/format/outcome, never raw search terms, rows or sensitive traits. Structured job logs include duration, rows and bytes.
- Worker claims use PostgreSQL `SKIP LOCKED`, attempt-specific leases and recorded artifact ownership. A stale five-minute lease can retry up to three attempts. Cancellation/lost leases cannot publish. Cleanup processes expired jobs in batches; unknown files are never deleted by directory scanning.

## Running

Build with `pnpm build`, explicitly migrate with `pnpm db:migrate`, then run `pnpm start` and `pnpm worker:exports` with the same DATABASE_URL, APP_SECRET and EXPORT_STORAGE_PATH. `pnpm worker:exports --once` performs one pass. Docker includes a `worker` target/service and a shared export volume; the existing PostgreSQL volume name and container ports remain unchanged. The worker has no external port.

Windows commands may be prefixed with `./scripts/pnpm.ps1` to use repository-local Node 22.22.2/pnpm 10.15.1. No global Node change is needed.

## Verified evidence

- Frozen dependency installation and local Node pin verified.
- Historical checkpoint: migration 33 first passed on `signal_studio_test_20260908`. The main database subsequently reached migration 34 after verified backup/restore on 2026-09-09; main app/worker/shared-volume export smoke passed. See M16_FINAL_REPORT.md for the final migration-35 installation.
- Backup of the existing database restored into `signal_studio_restore_20260908`; project/event/user/migration counts match the source (1/8/1/32).
- `pnpm exec vitest run`: 151 files, 989 tests passed.
- Studio component suite: 9 files, 23 tests passed.
- PostgreSQL regression suite: 33 tests passed before adding three extra lease tests; final targeted export suite: 12/12 passed.
- Chromium export suite: 4/4 passed on a standalone release build at 127.0.0.1:32140 with the test database, including EN desktop, RU mobile (390 px), Escape/focus return, API authentication/cross-project rejection and background export/download. Export dialogs have zero axe WCAG 2/2.1/2.2 A/AA findings.
- `pnpm build` passed; independently bundled ESM worker executed successfully against the test queue.
- `pnpm lint`: exit 0; existing warnings/info remain, no automatic repo-wide fixes.
- Streaming benchmark: 100,000 synthetic identities, 21,088,984 output bytes, 555 ms, sampled heap growth 13,206,800 bytes on Windows/Node 22.22.2. This measures encoding/encryption/storage, **not** SQL or 1M-event application performance.

M16 still owns production bootstrap, release CI/SBOM, complete retention/observability, 1M-event and full flagship release verification. Existing M0–M14 user changes and root MIT LICENSE/Umami attribution are preserved. No commits or pushes have been made.
