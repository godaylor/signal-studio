-- M14: additive Signal Studio roles, capability overrides and revocable shares.
-- Legacy role/share columns remain authoritative for older application builds.

ALTER TABLE "team_user"
  ADD COLUMN "studio_role" VARCHAR(20),
  ADD COLUMN "capability_overrides" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "team_user"
SET
  "studio_role" = CASE "role"
    WHEN 'team-owner' THEN 'owner'
    WHEN 'team-manager' THEN 'admin'
    WHEN 'team-member' THEN 'editor'
    WHEN 'team-view-only' THEN 'viewer'
    ELSE 'viewer'
  END,
  "capability_overrides" = CASE "role"
    WHEN 'team-owner' THEN '{"manageWorkspaceSecurity":true,"manageMembers":true,"manageSources":true,"editInsights":true,"editDashboards":true,"createSegments":true,"viewAggregate":true,"viewIdentity":true,"viewSensitiveTraits":true,"viewReplay":true,"exportData":true,"createPublicShare":true}'::jsonb
    WHEN 'team-manager' THEN '{"manageWorkspaceSecurity":true,"manageMembers":true,"manageSources":true,"editInsights":true,"editDashboards":true,"createSegments":true,"viewAggregate":true,"viewIdentity":true,"viewSensitiveTraits":true,"viewReplay":true,"exportData":true,"createPublicShare":true}'::jsonb
    WHEN 'team-member' THEN '{"manageWorkspaceSecurity":false,"manageMembers":false,"manageSources":true,"editInsights":true,"editDashboards":true,"createSegments":true,"viewAggregate":true,"viewIdentity":true,"viewSensitiveTraits":false,"viewReplay":false,"exportData":true,"createPublicShare":true}'::jsonb
    WHEN 'team-view-only' THEN '{"manageWorkspaceSecurity":false,"manageMembers":false,"manageSources":false,"editInsights":false,"editDashboards":false,"createSegments":false,"viewAggregate":true,"viewIdentity":true,"viewSensitiveTraits":false,"viewReplay":false,"exportData":true,"createPublicShare":false}'::jsonb
    ELSE '{"manageWorkspaceSecurity":false,"manageMembers":false,"manageSources":false,"editInsights":false,"editDashboards":false,"createSegments":false,"viewAggregate":true,"viewIdentity":false,"viewSensitiveTraits":false,"viewReplay":false,"exportData":false,"createPublicShare":false}'::jsonb
  END
WHERE "studio_role" IS NULL;

ALTER TABLE "team_user"
  ADD CONSTRAINT "team_user_studio_role_check"
  CHECK ("studio_role" IS NULL OR "studio_role" IN ('owner', 'admin', 'analyst', 'editor', 'viewer'));

ALTER TABLE "share"
  ADD COLUMN "project_id" UUID,
  ADD COLUMN "created_by" UUID,
  ADD COLUMN "resource_type" VARCHAR(20),
  ADD COLUMN "visibility" VARCHAR(20) NOT NULL DEFAULT 'public',
  ADD COLUMN "scope" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "revoked_at" TIMESTAMPTZ(6);

ALTER TABLE "share"
  ADD CONSTRAINT "share_visibility_check"
    CHECK ("visibility" IN ('internal', 'public')),
  ADD CONSTRAINT "share_resource_type_check"
    CHECK ("resource_type" IS NULL OR "resource_type" IN ('insight', 'dashboard')),
  ADD CONSTRAINT "share_expiry_check"
    CHECK ("expires_at" IS NULL OR "created_at" IS NULL OR "expires_at" > "created_at"),
  ADD CONSTRAINT "share_token_version_check"
    CHECK ("token_version" > 0);

CREATE INDEX "share_project_id_created_at_idx" ON "share"("project_id", "created_at");
CREATE INDEX "share_expires_at_idx" ON "share"("expires_at");
