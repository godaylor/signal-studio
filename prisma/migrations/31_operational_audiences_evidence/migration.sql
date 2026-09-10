-- M11-M12: stable operational audience cursors and bounded identity-to-session evidence.
CREATE INDEX "tracked_user_project_id_first_seen_at_tracked_user_id_idx"
ON "tracked_user"("project_id", "first_seen_at", "tracked_user_id");

CREATE INDEX "tracked_user_project_id_lifecycle_stage_last_seen_at_tracked_user_id_idx"
ON "tracked_user"("project_id", "lifecycle_stage", "last_seen_at", "tracked_user_id");

CREATE INDEX "tracked_account_project_id_first_seen_at_tracked_account_id_idx"
ON "tracked_account"("project_id", "first_seen_at", "tracked_account_id");

CREATE INDEX "tracked_account_project_id_lifecycle_stage_last_seen_at_tracked_account_id_idx"
ON "tracked_account"("project_id", "lifecycle_stage", "last_seen_at", "tracked_account_id");

CREATE INDEX "session_website_id_distinct_id_created_at_session_id_idx"
ON "session"("website_id", "distinct_id", "created_at", "session_id");
