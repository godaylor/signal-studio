CREATE TABLE data_lifecycle_job (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  session_version INTEGER NOT NULL,
  idempotency_key UUID NOT NULL,
  definition JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  step INTEGER NOT NULL DEFAULT 0,
  deleted_rows INTEGER NOT NULL DEFAULT 0,
  error_code VARCHAR(80),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ(6),
  CONSTRAINT data_lifecycle_status CHECK (status IN ('queued','running','completed','blocked','failed')),
  CONSTRAINT data_lifecycle_request UNIQUE(project_id, requester_id, idempotency_key)
);
CREATE INDEX data_lifecycle_queue ON data_lifecycle_job(status, created_at);
CREATE INDEX data_lifecycle_project ON data_lifecycle_job(project_id, created_at);
-- Deliberately no cascading foreign keys: erasure status survives project/user removal.
-- No policy is enabled and no existing data is modified by this migration.
