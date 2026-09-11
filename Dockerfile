ARG NODE_IMAGE_VERSION="22.22.2-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f"
ARG PNPM_VERSION="10.15.1"

FROM node:${NODE_IMAGE_VERSION} AS deps
ARG PNPM_VERSION
RUN apk add --no-cache libc6-compat \
    && corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM node:${NODE_IMAGE_VERSION} AS builder
ARG PNPM_VERSION
WORKDIR /app
RUN corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY docker/proxy.ts ./src
ARG SIGNAL_STUDIO_REVISION=source-checkout
ENV SIGNAL_STUDIO_REVISION=$SIGNAL_STUDIO_REVISION
ARG BASE_PATH
ENV BASE_PATH=$BASE_PATH
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"
ENV SKIP_BUILD_GEO=1
# Materialize the migration engine during image build, never at production startup.
RUN pnpm exec prisma version && pnpm build-docker

# One-shot image target for explicit migrations. Demo data is opt-in, never automatic.
FROM node:${NODE_IMAGE_VERSION} AS migration
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/exports \
    && chown nextjs:nodejs /app/exports \
    && chmod 700 /app/exports
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/generated/legal ./legal
COPY --from=builder /app/LICENSE ./LICENSE
COPY --from=builder /app/THIRD_PARTY_NOTICES.md ./THIRD_PARTY_NOTICES.md
USER nextjs
CMD ["sh", "-c", "node scripts/check-db.js && ./node_modules/.bin/prisma migrate deploy"]

# Same application code and PostgreSQL queue; no listening port or external broker.
FROM migration AS worker
ENV EXPORT_STORAGE_PATH=/app/exports
USER nextjs
CMD ["sh", "-c", "node scripts/check-env.js && node scripts/check-runtime-db.js && exec node generated/export-worker.mjs"]

FROM node:${NODE_IMAGE_VERSION} AS runner
WORKDIR /app
ARG NODE_OPTIONS
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=$NODE_OPTIONS
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apk add --no-cache curl libc6-compat \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/exports \
    && chown nextjs:nodejs /app/exports \
    && chmod 700 /app/exports

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start-docker.sh ./scripts/start-docker.sh
COPY --from=builder --chown=nextjs:nodejs /app/scripts/runtime-config.js /app/scripts/check-runtime-env.js /app/scripts/check-runtime-db.js ./scripts/
COPY --from=builder --chown=nextjs:nodejs /app/scripts/release-fingerprint.js /app/scripts/verify-release-inventory.js ./scripts/
COPY --from=builder --chown=nextjs:nodejs /app/generated ./generated
COPY --from=builder --chown=nextjs:nodejs /app/LICENSE ./LICENSE
COPY --from=builder --chown=nextjs:nodejs /app/THIRD_PARTY_NOTICES.md ./THIRD_PARTY_NOTICES.md

USER nextjs
EXPOSE 3000
CMD ["sh", "scripts/start-docker.sh"]

# Small-host deployment: one billed service runs app and queue worker together.
# Migration dependencies are available for the provider's explicit pre-deploy step.
FROM migration AS hosted
ENV NEXT_TELEMETRY_DISABLED=1
ENV SIGNAL_STUDIO_BIND_HOST=0.0.0.0
ENV EXPORT_STORAGE_PATH=/app/exports
ENV PORT=3000
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./.next/standalone
USER nextjs
EXPOSE 3000
CMD ["node", "scripts/start-hosted.js"]
