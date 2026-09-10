CREATE TABLE "studio_dashboard" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "owner_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" VARCHAR(500) NOT NULL DEFAULT '',
  "global_context" JSONB NOT NULL DEFAULT '{}',
  "share_policy" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_dashboard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "studio_dashboard_widget" (
  "id" UUID NOT NULL,
  "dashboard_id" UUID NOT NULL,
  "insight_id" UUID,
  "kind" VARCHAR(20) NOT NULL,
  "title" VARCHAR(200) NOT NULL DEFAULT '',
  "body" VARCHAR(2000) NOT NULL DEFAULT '',
  "position" INTEGER NOT NULL,
  "width" INTEGER NOT NULL DEFAULT 1,
  "height" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_dashboard_widget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "studio_dashboard_project_id_updated_at_id_idx"
  ON "studio_dashboard"("project_id", "updated_at", "id");
CREATE INDEX "studio_dashboard_project_id_owner_id_updated_at_id_idx"
  ON "studio_dashboard"("project_id", "owner_id", "updated_at", "id");
CREATE INDEX "studio_dashboard_widget_dashboard_id_position_id_idx"
  ON "studio_dashboard_widget"("dashboard_id", "position", "id");
CREATE INDEX "studio_dashboard_widget_insight_id_idx"
  ON "studio_dashboard_widget"("insight_id");