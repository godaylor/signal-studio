CREATE TABLE "export_job" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "requester_id" UUID NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "definition_hash" VARCHAR(64) NOT NULL,
  "definition" JSONB NOT NULL,
  "permission_scope" VARCHAR(40) NOT NULL,
  "session_version" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lease_id" UUID,
  "artifact_key" VARCHAR(100),
  "filename" VARCHAR(240) NOT NULL,
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "byte_count" INTEGER NOT NULL DEFAULT 0,
  "error_code" VARCHAR(80),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "export_job_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "export_job_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "website"("website_id") ON DELETE CASCADE,
  CONSTRAINT "export_job_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "user"("user_id") ON DELETE CASCADE,
  CONSTRAINT "export_job_status_check" CHECK ("status" IN ('queued','running','completed','failed','expired','cancelled'))
);
CREATE UNIQUE INDEX "export_job_project_id_requester_id_idempotency_key_key" ON "export_job"("project_id","requester_id","idempotency_key");
CREATE INDEX "export_job_requester_id_project_id_created_at_id_idx" ON "export_job"("requester_id","project_id","created_at","id");
CREATE INDEX "export_job_status_created_at_idx" ON "export_job"("status","created_at");
CREATE INDEX "export_job_expires_at_idx" ON "export_job"("expires_at");
CREATE INDEX "export_job_project_id_idx" ON "export_job"("project_id");
