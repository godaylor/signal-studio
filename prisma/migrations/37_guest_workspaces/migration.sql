-- Additive: existing accounts, data, tokens and capabilities are unchanged.
CREATE TABLE "guest_session" (
  "id" UUID PRIMARY KEY,
  "token_hash" VARCHAR(64) NOT NULL UNIQUE,
  "user_id" UUID NOT NULL UNIQUE,
  "workspace_id" UUID NOT NULL UNIQUE,
  "project_id" UUID NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "dataset_start_at" TIMESTAMPTZ(6) NOT NULL,
  "dataset_end_at" TIMESTAMPTZ(6) NOT NULL,
  "window_started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "window_requests" INTEGER NOT NULL DEFAULT 0,
  "lifetime_requests" INTEGER NOT NULL DEFAULT 0,
  "operations" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "guest_lifetime_bound" CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '24 hours')
);
CREATE INDEX "guest_session_expires_at_idx" ON "guest_session"("expires_at");
CREATE TABLE "guest_entry_limit" (
  "key" VARCHAR(80) PRIMARY KEY,
  "window_started_at" TIMESTAMPTZ(6) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE "guest_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guest_entry_limit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "guest_session", "guest_entry_limit" FROM PUBLIC;
