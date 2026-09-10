-- Project remains a one-to-one product facade over website. These projection
-- tables are additive so an older application can safely ignore them.
CREATE TABLE "tracked_user" (
  "tracked_user_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "external_id" VARCHAR(50) NOT NULL,
  "display_name" VARCHAR(255),
  "traits" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "sensitive_traits" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "lifecycle_stage" VARCHAR(40) NOT NULL DEFAULT 'identified',
  "definition_version" VARCHAR(80) NOT NULL DEFAULT 'signal-studio.activation.v1',
  "activated_at" TIMESTAMPTZ(6),
  "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "tracked_user_pkey" PRIMARY KEY ("tracked_user_id")
);

CREATE TABLE "tracked_account" (
  "tracked_account_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "external_id" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255),
  "traits" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "sensitive_traits" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "lifecycle_stage" VARCHAR(40) NOT NULL DEFAULT 'identified',
  "definition_version" VARCHAR(80) NOT NULL DEFAULT 'signal-studio.activation.v1',
  "activated_at" TIMESTAMPTZ(6),
  "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "tracked_account_pkey" PRIMARY KEY ("tracked_account_id")
);

CREATE TABLE "account_membership" (
  "account_membership_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "tracked_user_id" UUID NOT NULL,
  "tracked_account_id" UUID NOT NULL,
  "observed_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "account_membership_pkey" PRIMARY KEY ("account_membership_id")
);

CREATE UNIQUE INDEX "tracked_user_project_id_external_id_key"
ON "tracked_user"("project_id", "external_id");
CREATE INDEX "tracked_user_project_id_last_seen_at_tracked_user_id_idx"
ON "tracked_user"("project_id", "last_seen_at", "tracked_user_id");
CREATE UNIQUE INDEX "tracked_account_project_id_external_id_key"
ON "tracked_account"("project_id", "external_id");
CREATE INDEX "tracked_account_project_id_last_seen_at_tracked_account_id_idx"
ON "tracked_account"("project_id", "last_seen_at", "tracked_account_id");
CREATE UNIQUE INDEX "account_membership_tracked_user_id_key"
ON "account_membership"("tracked_user_id");
CREATE INDEX "account_membership_project_id_tracked_account_id_tracked_user_id_idx"
ON "account_membership"("project_id", "tracked_account_id", "tracked_user_id");

-- relationMode = "prisma" intentionally keeps referential enforcement in the
-- application. Reset/delete explicitly remove these rows in dependency order.
