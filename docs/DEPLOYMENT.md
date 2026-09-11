# Public deployment

The deployment target is the real Next.js application, PostgreSQL and the export/
retention worker. No static substitute is used. A public URL is not yet provisioned.

## Recommended small-host topology

Use one **Railway Hobby project** with two services:

1. PostgreSQL 15 or newer, private network only, with its own persistent volume.
2. This repository's Docker **hosted** image (the final Dockerfile stage), one
   replica, with an export volume mounted at `/app/exports`.

`scripts/start-hosted.js` runs Next.js and the existing queue worker as separate
processes in one billed service. Both share the same database and export volume.
Unexpected termination of either process stops its sibling and fails the service
so the host restarts it. SIGTERM drains the worker with a bounded 250-second grace
period. Interrupted jobs retain their existing lease/recovery semantics.

This is a deliberate portfolio deployment: it avoids an extra worker service or
object-storage account. It is not horizontally scalable with local export storage.
Use the existing separate `runner` and `worker` images on a shared volume for a VPS.

Railway Hobby has a $5/month minimum credited toward metered usage. **$5 is not a
maximum or a guaranteed cost for this application.** Set a usage budget before
enabling billing. The free trial is useful for validation, not a promise of free
permanent hosting. [Official pricing](https://railway.com/pricing), checked
2026-09-11. Render is an alternative, but its separately provisioned app, database
and persistent disk do not offer a durable free version of this full topology.

## Exact Railway configuration

Create a project dedicated to Signal Studio. Connect `godaylor/signal-studio`,
branch `main`, root directory `/`, Dockerfile `Dockerfile`. The final stage is
`hosted`; no unsupported Docker build-target setting is necessary.

Set these service settings:

| Setting | Value |
|---|---|
| Pre-deploy command | `./node_modules/.bin/prisma migrate deploy` |
| Pre-deploy timeout | 300 seconds |
| Start command | `node scripts/start-hosted.js` |
| Healthcheck | `/api/ready` |
| Healthcheck timeout | 180 seconds |
| Replicas | 1 |
| Serverless/sleep | Disabled, so queued jobs keep progressing |
| Restart policy | On failure, 5 retries |
| Shutdown grace | At least 260 seconds when available |
| Export volume mount | `/app/exports` |
| Public networking | Generated HTTPS domain, app port 3000 |

The legacy `railway.toml` mechanism is deliberately not used: Railway's current
[IaC documentation](https://docs.railway.com/infrastructure-as-code) says new
services cannot opt into it. Import the configured project using `railway config
pull` if managing it through the current Railway SDK later.

Variables (values below describe sources, not actual credentials):

| Name | Source |
|---|---|
| `DATABASE_URL` | Railway reference `${{Postgres.DATABASE_URL}}` using the private host |
| `APP_SECRET` | Independent random value, at least 32 characters |
| `TWO_FACTOR_ENCRYPTION_KEY` | Independent 32-byte random key encoded as 64 hexadecimal characters |
| `EXPORT_STORAGE_PATH` | `/app/exports` |
| `PORT` | `3000` |
| `SIGNAL_STUDIO_BIND_HOST` | `0.0.0.0` |
| `SIGNAL_STUDIO_PUBLIC_URL` | The generated HTTPS origin |
| `RAILWAY_RUN_UID` | `0`, only to initialize Railway's root-owned export mount |

The hosted supervisor, even when launched as UID 0 for Railway's
[volume ownership](https://docs.railway.com/volumes), changes only the mount's
directory ownership and drops to UID/GID 1001 **before** starting app or worker.
The image default user is still `nextjs`. No recursive chown, privileged container,
public database port, or disabled TLS verification is required.

Migrations run only in the explicit pre-deploy phase. A migration failure blocks
deployment. Do not put migrations in the build or normal start command. Railway's
[pre-deploy container](https://docs.railway.com/deployments/pre-deploy-command)
has private database access but no export volume.

## First administrator and data

Temporarily set `BOOTSTRAP_ADMIN_USERNAME` (not `admin`) and a random
`BOOTSTRAP_ADMIN_PASSWORD` (20–72 UTF-8 bytes) using Railway's secret editor.
Run `node scripts/bootstrap-admin.js` through the service shell. The command is
idempotent for those credentials and refuses to overwrite an existing account.
Remove these bootstrap-only variables afterward. It does not print the password.

Sign in, create a project, install its tracker and verify an event arrives. Use
workspace settings to create the intended reviewer access. Public self-registration
is not enabled; this is a self-hosted team application.

Optional sample data is explicitly synthetic: `node scripts/seed-portfolio.js`.
It is never seeded on startup and is not a substitute for collecting real events.

## CI/CD and verification

Enable Railway's wait-for-CI behavior for GitHub deploys. `Signal Studio CI` verifies
types, lint, unit/component tests, PostgreSQL integration, production build,
Chromium workflows and non-root/legal packaging for every image target. Release
image publishing is manual and runs the same CI before publishing immutable tags.

After provisioning, verify the **public HTTPS origin**, not localhost:

1. `/api/ready` returns 200; public access to protected project APIs returns 401.
2. Sign in → create a source → send an actual event → query it in Explore.
3. Save an Insight, reload, add it to a Dashboard, and reopen it.
4. Create an Audience and verify its intended event/user membership.
5. Export CSV/JSON, including a queued export; wait for completion and download.
6. Confirm Viewer restrictions, share expiry/revocation and logout token revocation.
7. Restart the service; saved data and unexpired export artifacts remain available.
8. Check RU/EN, mobile, keyboard focus and screen reader on the public version.

Enable PostgreSQL backups and rehearse restore into a separate database before
production data is relied on. Never restore over a live database to test backups.
Before later migrations, retain a backup and previous release image digest.

## Current external prerequisite

A Railway account/session and dedicated project are not present in the available
tools or environment. Sign into Railway to allow provisioning to continue. No
paid resource has been purchased, and no public release is claimed by this file.
