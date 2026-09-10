# Signal Studio

Signal Studio is a product-intelligence workspace being built as an
MIT-licensed transformation of [Umami](https://github.com/umami-software/umami).
The current implementation still contains the Umami 3.3.1 analytics kernel.
Copyright and permission notices are preserved in [LICENSE](LICENSE), with
additional provenance status in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Canonical toolchain

- Node.js `22.22.x` (the repository pins `22.22.2` in `.nvmrc`)
- pnpm `10.15.1` through Corepack
- PostgreSQL `15+`
- Docker Engine with Compose v2 for the container workflow

Other Node or pnpm versions are unsupported. `package.json`, `.nvmrc`, CI and
the Dockerfile use the same contract.

## Local setup

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm env:init
docker compose up -d db
pnpm db:migrate
pnpm admin:bootstrap --local
pnpm db:seed
pnpm db:seed:portfolio
pnpm build
pnpm start
```

`pnpm env:init` creates `.env` once with cryptographically random
`APP_SECRET` and `TWO_FACTOR_ENCRYPTION_KEY` values. It refuses to overwrite an
existing file. Production startup rejects missing, short and known placeholder
`APP_SECRET` values.

Migrations are intentionally separate from build and startup. `pnpm
db:migrate` is safe to repeat. `pnpm db:seed` is also idempotent and creates a
deterministic historical demo. Run `pnpm admin:bootstrap --local` first: it
preserves historical ownership and creates a random administrator credential in
`.local/credentials/administrator.json` (never committed or printed). The public
`admin` / `umami` credential is disabled by migration 34 and rejected at startup.
`pnpm db:seed:portfolio` adds a separate current-week synthetic product with
activation comparison, accounts, revenue, an Insight and replay. It never rewrites
existing projects and is explicit, not part of startup. Run it again in a later
week only if you want a new dated demo project.

The production launcher is `pnpm start`. It forces production validation and then
loads Next's standalone server in-process. Build copies `public` and `.next/static`
into `.next/standalone`; it no longer connects to or migrates the database.
Native startup binds `127.0.0.1:32109` by default (`PORT` overrides the port;
`SIGNAL_STUDIO_BIND_HOST` explicitly overrides the bind address). Start
`pnpm worker:exports` in a second process with the same database, application
secret and export directory. It does not listen on a network port.

GeoLite2 is optional. The default build performs no unpinned dataset download.
To include a database, configure a licensed `GEO_DATABASE_URL` or
`MAXMIND_LICENSE_KEY`; otherwise geo enrichment is explicitly skipped.

## Docker setup from this checkout

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm env:init
docker compose up -d db
pnpm db:migrate
pnpm admin:bootstrap --local
pnpm db:seed:portfolio
docker compose up -d --build
```

Compose builds the current checkout. Its one-shot `migrate` service checks
PostgreSQL and applies migrations, but never seeds credentials or data before the
non-root application container starts. It never pulls an upstream Umami
application image. Compose is pinned to the `signal-studio-transform` project,
binds the app/database only on `127.0.0.1:32109` and `127.0.0.1:32110`, and
stores PostgreSQL data in its project-scoped `signal-studio-db-data` volume.
Override only this project's host ports with `SIGNAL_STUDIO_APP_PORT` and
`SIGNAL_STUDIO_DB_PORT`.

## Verification

```bash
pnpm typecheck
pnpm typecheck:e2e
pnpm lint
pnpm test
pnpm test:integration
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

`pnpm test` is the fast unit/component/API-route suite and does not require a
live database. `pnpm test:integration` requires a separate migrated PostgreSQL
database whose name contains `_test_`, never your working project database. The
existing `pnpm seed-data` load generator remains separate and is never part of
the per-push unit gate.

Analytics `startDate` and `endDate` strings are ISO instants with an explicit
`Z` or `±HH:mm` offset. The IANA `timezone` parameter controls result bucketing;
it never asks the request parser to reinterpret an offsetless wall-clock time.
Already validated `Date` values from an upstream schema remain supported.

Playwright requires its Chromium binary and platform libraries; the install
command above is explicit locally and automated in CI. CI additionally verifies
a frozen install, isolated migrations, secure bootstrap, golden integration,
production readiness, and `LICENSE`/notices inside the production image. Selected
critical Chromium flows include Home, Explore, Insights, Dashboards, Audiences,
Experience, Live, exports and role/share restrictions. The existing pixel baseline
is Windows-specific; functional and axe checks also run on Linux CI. The published
source and current workflow history are available in the
[Signal Studio repository](https://github.com/godaylor/signal-studio) and
[GitHub Actions](https://github.com/godaylor/signal-studio/actions).

## Publication status

The former Heroku `app.json` one-click target is retired: ephemeral independent
dyno disks do not satisfy the shared export-artifact contract. There is no supported
one-click Heroku deployment. Use the app/worker/PostgreSQL contract below.

Portfolio-v1 scope and deferred FRs: [requirement traceability](docs/REQUIREMENTS_TRACEABILITY.md).
Current publication closure: [release report](docs/RELEASE_CLOSURE_REPORT.md).
Legacy public links are retired in the candidate; recreate them as expiring Studio
Insight/Dashboard shares. Existing records and data are preserved.

See [M16 status](docs/M16_STATUS.md) for verified gates and remaining release
conditions. Do not deploy this local development Compose file unchanged to a
public host: its PostgreSQL credential is local-only. Use managed PostgreSQL or
private PostgreSQL with a unique credential, HTTPS reverse proxy, persistent
shared export storage, one app and one worker. Provide independent random
`APP_SECRET` and `TWO_FACTOR_ENCRYPTION_KEY` via the host's secret mechanism.
Back up and test restore before explicit migration. No production service should
publish PostgreSQL directly. See `scripts/runtime-config.js` for startup checks.

Release image builds are manual and default to **no publication**. The workflow
uses only the current repository's GHCR namespace; configure its `release`
environment approval before enabling publication. Source publication does not by
itself claim a production deployment: a host must provide the full app/worker,
PostgreSQL, durable shared storage and secret-management contract described above.

## M0 verification baseline

Measured on 2026-08-27 on the project Windows workstation with Docker Desktop
using Linux containers. These numbers document the M0 reproducibility run; they
are diagnostic observations, not performance guarantees.

| Operation | Measured result |
|---|---:|
| Frozen pnpm install, empty Docker dependency cache | 84.5 s |
| Frozen install layer reused by BuildKit | cache hit; 0.0 s install step |
| Cold production runner image build | 178.01 s |
| Warm production runner image rebuild | 39.10 s |
| Standalone process readiness | 1.78 s |
| Production runner image size | 84,969,986 bytes |

The cold image build included Node `22.22.2` and pnpm `10.15.1`. The warm result
used the same checkout and Docker BuildKit cache.

## Environment reference

Copying `.env.example` is not a secret-generation mechanism; use `pnpm
env:init`. The example documents variable names only. `DATABASE_URL` must use a
PostgreSQL URL. Optional deployment variables retain their upstream behavior.
`API_URL` may be relative (for an internal proxy path) or absolute.

## Open-source attribution

Signal Studio is based on Umami and remains distributed under the MIT License.
Do not remove the Umami copyright, permission notice or this attribution from
source or binary distributions. The production image includes both `LICENSE`
and `THIRD_PARTY_NOTICES.md`.
