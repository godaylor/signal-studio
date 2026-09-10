CREATE TABLE "insight" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "owner_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" VARCHAR(500) NOT NULL DEFAULT '',
  "query_version" INTEGER NOT NULL,
  "query" JSONB NOT NULL,
  "visualization" JSONB NOT NULL DEFAULT '{}',
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "insight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "insight_project_id_status_updated_at_id_idx"
  ON "insight"("project_id", "status", "updated_at", "id");
CREATE INDEX "insight_project_id_owner_id_updated_at_id_idx"
  ON "insight"("project_id", "owner_id", "updated_at", "id");
CREATE INDEX "insight_project_id_favorite_updated_at_id_idx"
  ON "insight"("project_id", "favorite", "updated_at", "id");