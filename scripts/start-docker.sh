#!/bin/sh
set -eu

node scripts/check-runtime-env.js
node generated/check-runtime-db.mjs

case "${APP_SECRET:-}" in
  ""|replace-me|replace-me-with-a-random-string|generated-by-pnpm-env-init|changeme)
    echo "APP_SECRET must be a non-placeholder secret of at least 32 characters in production." >&2
    exit 1
    ;;
esac

if [ "${#APP_SECRET}" -lt 32 ]; then
  echo "APP_SECRET must be a non-placeholder secret of at least 32 characters in production." >&2
  exit 1
fi

if [ -n "${COLLECT_API_ENDPOINT:-}" ]; then
  node -e "const fs=require('node:fs');const file='public/script.js';fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('/api/send',process.env.COLLECT_API_ENDPOINT));"
fi

# The migration target/service owns database checks and migrations. The runtime
# image contains only the traced standalone application and legal notices.
exec node server.js
