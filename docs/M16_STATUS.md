# M16 historical acceptance — LOCAL GREEN, 2026-09-09

Historical installed-demo acceptance. For source changes and the separate publication
candidate as of 2026-09-10, use RELEASE_CLOSURE_REPORT.md and ../FINAL_AUDIT.md.
The installed demo has deliberately not been rolled out to the new candidate.

Final evidence and exact external exclusions: [M16_FINAL_REPORT.md](M16_FINAL_REPORT.md).
This replaces the earlier incomplete checkpoint. M0–M14 recorded GREEN gates remain;
M15 and all locally executable M16 portfolio gates are complete.

## Running installation

- Site/API: http://127.0.0.1:32109
- Portfolio: http://127.0.0.1:32109/studio/9ecf84dc-2a53-4d62-985b-74adefd3a9d4/home
- PostgreSQL:127.0.0.1:32110; worker has no listening port.
- Main DB signal_studio:35 migrations,2projects/31events/1user preserved,
  zero lifecycle jobs. Automatic retention is OFF.
- Credentials:signal-owner; random password only .local/credentials/administrator.json.
  admin/umami rejected401.
- Existing database/export volumes preserved. Test servers32140/32170/32171 stopped.
- No commit,push,public deploy or foreign-container changes.

## Closed local gaps

- Full FR-HOME and reference portfolio workflows.
- Retention/deletion with physical PostgreSQL/export-file verification,
  bounded worker batches, authorization, idempotency and explicit blocked scopes.
- Licenses/provenance, self-hosted Inter, MIT ua-parser-js1.0.41,
  application and all three image SBOMs, packaged full notices/build identity.
- Selected24 browser scenarios, Linux retention/legal3, main/preview portfolio smoke,
  native and Linux builds, final TypeScript/lint, targeted unit/integration checks.
- 1M concurrent Dashboard/Live/background deletion benchmark and release shell
  LCP/CLS/bundle measurements. See report for dataset and exact counts.
- Fresh backup restored and migration35 rehearsed; previous image readiness
  verified against migrated copy before main update.
- Main app→worker→export download200 confirmed after final installation.

## Preservation / rollback

Database volume:signal-studio-transform_signal-studio-db-data.
Export volume:signal-studio-transform_signal-studio-export-data.
Backup:.local/backups/signal-studio-pre-m16-final-20260909.dump
SHA256:5553000FE377701F0CC6229A924F8C7B38E20DDBD41C7792C5654383A498A060.
Restored DB:signal_studio_restore_test_20260909_m16.
Previous images retained under pre-m16-final-20260909 tags.
Never replace/clear these volumes to restart the demonstration.

## External / not claimed passed

- GitHub CI execution and owned repository/access; current origin is still upstream.
- Real-device and human screen-reader checks.
- Hosting/domain/cloud credentials and deployed HTTPS verification only if public
  publication is requested later. No public deploy is needed for current completion.

Future hosting needs one app + same-version worker, PostgreSQL15+, shared durable
export storage, private DB, HTTPS proxy and independently injected APP_SECRET,
TWO_FACTOR_ENCRYPTION_KEY and database credentials. Backups/download copies are
operator-managed and excluded from the in-app erasure claim. Preserve all notices.
