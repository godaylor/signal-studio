CREATE TABLE "export_artifact" (
  "key" VARCHAR(100) PRIMARY KEY,
  "job_id" UUID NOT NULL REFERENCES "export_job"("id") ON DELETE CASCADE,
  "payload" BYTEA NOT NULL CHECK (octet_length("payload") BETWEEN 28 AND 3145756),
  "expires_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "export_artifact_expires_at_idx" ON "export_artifact"("expires_at");
CREATE INDEX "export_artifact_job_id_idx" ON "export_artifact"("job_id");
ALTER TABLE "export_artifact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "export_artifact" FROM PUBLIC;
