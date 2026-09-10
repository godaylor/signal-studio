# Publication closure — 2026-09-10

## Scope and compatibility

Final verdict: **all locally fixable PUB-01–PUB-09 blockers are closed**. PUB-02 is
explicitly deferred for portfolio-v1, not implemented. PUB-04/07 require the later
authorized GitHub/hosting/manual publication stage. The installed demo remains healthy.

This report supersedes publication conclusions from the original 2026-09-09 audit.
The working checkout contains the publication fixes; the installed demo is deliberately
not replaced. Old installed images do not acquire security fixes by editing source.
No commit, push or deploy is performed. Final check results are in FINAL_AUDIT.md.

Legacy public links intentionally return 410 and no longer issue tokens. Existing records
and application data are preserved. Authenticated analytics and scoped Studio aggregate
shares remain the supported paths. Internal Studio token reuse additionally checks current
membership and required second-factor assurance.

## Task traceability

| ID | Local change | Evidence / remaining gate |
|---|---|---|
| PUB-01 | Common auth rejects share-token-only authentication; legacy resolver is retired. Internal Studio reads recheck auth/assurance/access. | auth/request/share-service/slug-route tests; native bundled HTTP negatives. Studio expiry/revocation/version validation retained. |
| PUB-02 | FR-SHELL-05/06 and FR-CAT-01–06 explicitly deferred for portfolio-v1; no simulated implementation. | REQUIREMENTS_TRACEABILITY.md preserves all 76 IDs and D1/D2 future ownership. Palette only searches navigation; favorites are shared, not personal. |
| PUB-03 | CD requires same-commit reusable CI including image gates. TypeScript errors fail production build. | Parsed workflow contract test; native/Linux build results. Remote CI not run here. |
| PUB-04 | Dirty checkout is explicitly distinguished from release revision. | Owned repository, reviewable commits and push require the later authorized publication stage. Upstream HEAD is not represented as the Studio implementation. |
| PUB-05 | Shared normalized source fingerprint v2, SOURCE_MANIFEST and ARTIFACT_HASHES; packaging/CI verification. Revision build arg reaches Docker. | Four native inventory copies verified; candidate image checks recorded in FINAL_AUDIT. Injected Docker proxy counted once; native/docker-proxy profile retained. |
| PUB-06 | Removed obsolete app.json and documented unsupported Heroku one-click deployment. | Supported contract remains app + same-version worker + private PostgreSQL + shared durable export storage + independent secrets + explicit migrate/bootstrap. |
| PUB-07 | External gates retained, never marked passed. | Owned GitHub CI, hosting/domain/TLS/secrets/storage, deployed smoke/restore, human screen-reader/device acceptance. |
| PUB-08 | Migration runs as nextjs UID 1001; worker inherits user; CI covers runner/worker/migration user and legal inventory. | Actual container check results are recorded in FINAL_AUDIT. |
| PUB-09 | Updated AGENTS, PLAN, spec/architecture, README, M16 historical status and requirement matrix. | All 76 original FR IDs occur once. Eight deferred; 68 mapped to historical milestone/source/test evidence, not blanket per-clause recertification. |

## Verification ledger

- Pinned Windows Node 22.22.2 / pnpm 10.15.1; existing dependencies, no new package added.
- `scripts/pnpm.ps1 typecheck`: PASS.
- Focused Vitest on auth/request/share-service/slug-route/Next security config: 5 files,
  33 tests PASS. After strengthening membership and adding assurance regression, only
  share-service was rerun: 9/9 PASS (supersedes that file's earlier result).
- `scripts/pnpm.ps1 build`: PASS including actual Next TypeScript validation (15.7s),
  worker/tracker/recorder and 71 static pages; standalone prepared.
- `scripts/pnpm.ps1 lint`: no errors, 1592 files; 26 warnings/59 infos and existing
  large-SBOM notices. Read-only; no lint fixes.
- `node --test tests/release-contract.test.mjs`: 2/2 PASS, also added to mandatory CI.
- `node scripts/publication-security-smoke.js`: three requests with a signed old JWT
  denied with HTTP 401 by the actual standalone stats/events/sessions routes. Own server
  used only 127.0.0.1:32150 and was stopped afterward; synthetic ID, no data writes.
  This bypasses DB preflight for an auth test and is not a readiness claim.
- Final metadata repackaging: 1029 components, 478 license texts, zero missing texts.
  `verify-release-inventory.js` verifies source/lock/LICENSE and all inventory checksums.
- Docker initially unavailable during user's restart; user restarted it, then the existing
  app/DB were healthy and GET 32109/api/ready returned 200. This transient failure is not
  a persistent publication defect. Candidate builds use separate pub-closure tags.
- One wrong component-only Vitest config yielded no files; corrected once to normal unit
  config and passed. Unavailable pnpm exec shim was bypassed using pinned Node directly.
  No ten-minute silent command or repeated-timeout loop occurred.

Unchanged broad PostgreSQL, browser/axe, performance, backup/restore and lifecycle suites
are reused only with their qualifications from M16_FINAL_REPORT. Changed build/security/
packaging scope is tested anew. No new scale/ClickHouse/real-device claims are made.
Original FR texts are retained; matrix links are historical evidence, not 76/76 approval.

## Identity, provenance and data safety

Final Linux evidence: all three targets built successfully; final Next TypeScript took
19.0s. All three run as UID 1001, packaged manifests verify, and their source fingerprint
matches native. Migration and worker pass Prisma version with network disabled. The
migration image's read-only `prisma migrate status` reports 35 migrations and current schema.
No migration was applied. Candidate runner readiness on 32151 returned 200; three signed
legacy JWT requests returned 401. Its probe container was stopped and auto-removed.
Installed app/DB remain healthy, worker running, readiness 32109 returns 200.

The first non-root check exposed absent/unwritable Prisma engines. Final Dockerfile
materializes the engine during build and copies builder dependencies with nextjs ownership;
the corrected check passed. A first Docker HTTP probe could not require jsonwebtoken as
an external module (Next bundles it); one corrected probe used built-in crypto HS256
and passed. Neither diagnostic caused a data write or installed-container restart.

Image SBOMs generated with `docker scout sbom local://signal-studio:pub-closure-TARGET
--format cyclonedx --output .local/evidence/pub-closure/TARGET.cdx.json`, exit 0.
All three parse as CycloneDX 1.5. Exact local image IDs are in FINAL_AUDIT.md.

| Target | Components | SBOM SHA-256 |
|---|---:|---|
| migration | 1356 | 2158cc78889eb31882e32bbc2e603cf38e1b83e8c21ebc7a12d31806d4e8472d |
| worker | 1356 | 8875d13463c9e019eaffbe99d1e2bfe073768dfda459dcd06f86a2af1fb6bb62 |
| runner | 1265 | 345369970b492572b6e6b6ab723f075ba4728c5aab17687a461a7d3e595bfb71 |

Scout reported only a cleanup warning for its locked runner temporary image archive.
SBOM output is valid; no other process was stopped to remove this tool-owned cache.
SBOM generation is an inventory result, not a claim of zero vulnerabilities.

Candidate native fingerprint v2:
`ca3597779c1167ffb755e52436ab7387a7bb3548f4af66624c00b019220521d6`.
Lockfile: `f1a53d919431d4182f9cfc540dc1ebf3aa30525ffb3a2b57744f0c705a377a7c`.
LICENSE: `2a2a42dba0334d768c61edc8f5bb5d3732d94de23d99a7e539a719b1d5117ba0`.
The full upstream MIT notice, Umami copyright and based-on-Umami attribution remain intact.
Metadata states that the fingerprint includes uncommitted source; revision alone is not
identity. No cross-platform identical-byte claim is made: each build verifies its own
manifest and records its profile. Image identities are separately recorded in FINAL_AUDIT.

Changed subsystems: auth/share routes/service/tests; CI/CD and Docker packaging; Next
TypeScript gate; inventory/fingerprint/verifier/standalone scripts; documentation.
No Prisma schema/migration, database data, operator secrets or existing credentials changed.
Existing dirty work was retained. The obsolete app.json removal is recoverable from Git;
no unrelated deletion/modification was reverted. Only task-owned probe containers may be
removed; installed app/worker/DB and other projects are not restarted or stopped.
Final `git diff --check` passes; `git status --short --branch` remains master tracking
upstream master with 231 status entries. LICENSE hash is unchanged. Generated tracker
formatting messages refer to the build script's own temporary directory, not a rewrite
of the user's checked-in declarations.

## Remaining publication sequence

1. Read FINAL_AUDIT for the final local candidate verdict and image verification results.
2. With later authorization choose owned repository/release commit; run mandatory CI and
   retain immutable tags/digests, application manifests, image SBOM and provenance together.
3. Complete manual screen-reader/device and hosting/TLS/secrets/storage/backup gates.
4. Only then authorize publish/deploy. Never expose the old demo image as the patched build.

Optional hardening is not disguised as a completed requirement: CSP baseline tightening,
immutable Action pinning, line-ending policy, chosen product version/owner metadata and
deferred catalog/personal search features remain follow-up work.
