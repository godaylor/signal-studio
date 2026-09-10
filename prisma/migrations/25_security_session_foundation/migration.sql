ALTER TABLE "user"
ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "login_rate_limit" (
    "key" VARCHAR(128) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "locked_until" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "login_rate_limit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "login_rate_limit_locked_until_idx"
ON "login_rate_limit"("locked_until");

CREATE TABLE "security_audit_event" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" VARCHAR(80) NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_audit_event_actor_user_id_created_at_idx"
ON "security_audit_event"("actor_user_id", "created_at");

CREATE INDEX "security_audit_event_event_type_created_at_idx"
ON "security_audit_event"("event_type", "created_at");
