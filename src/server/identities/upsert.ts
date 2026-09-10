import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import prisma from '@/lib/prisma';
import {
  MAX_TRACKED_ACCOUNT_EXTERNAL_ID_LENGTH,
  MAX_TRACKED_USER_EXTERNAL_ID_LENGTH,
  type UpsertTrackedIdentityInput,
  type UpsertTrackedIdentityResult,
} from './contracts';
import { ACTIVATION_DEFINITION, getLifecycleStageFromTraits } from './definitions';
import { classifyIdentityTraits, getDisplayName } from './traits';

const upsertInputSchema = z.object({
  projectId: z.uuid(),
  externalId: z.string().trim().min(1).max(MAX_TRACKED_USER_EXTERNAL_ID_LENGTH),
  observedAt: z.date(),
  account: z
    .object({
      id: z.string().trim().min(1).max(MAX_TRACKED_ACCOUNT_EXTERNAL_ID_LENGTH),
      name: z.string().trim().min(1).max(255).optional(),
      traits: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

/**
 * Materializes product identity in PostgreSQL in one atomic CTE statement.
 *
 * Invalid legacy IDs are deliberately not projected: the legacy session-link
 * path remains backward-compatible, while the versioned v1 collection schema
 * rejects them before this service is called.
 */
export async function upsertTrackedIdentity(
  input: UpsertTrackedIdentityInput,
): Promise<UpsertTrackedIdentityResult | null> {
  if (!upsertInputSchema.safeParse(input).success) {
    return null;
  }

  const userTraits = classifyIdentityTraits(input.traits);
  const accountTraits = classifyIdentityTraits(input.account?.traits);
  const trackedUserId = uuid('tracked-user', input.projectId, input.externalId);
  const trackedAccountId = input.account
    ? uuid('tracked-account', input.projectId, input.account.id)
    : null;
  const membershipId = uuid('account-membership', input.projectId, input.externalId);
  const lifecycleStage = input.lifecycleStage ?? getLifecycleStageFromTraits(input.traits);

  const rows = (await prisma.writeRawQuery(
    `
    with live_project as (
      select website_id
      from website
      where website_id = {{projectId::uuid}}
        and deleted_at is null
    ),
    account_upsert as (
      insert into tracked_account (
        tracked_account_id,
        project_id,
        external_id,
        name,
        traits,
        sensitive_traits,
        lifecycle_stage,
        definition_version,
        activated_at,
        first_seen_at,
        last_seen_at,
        created_at,
        updated_at
      )
      select
        {{trackedAccountId::uuid}},
        live_project.website_id,
        {{accountExternalId}},
        {{accountName}},
        {{accountTraits}}::jsonb,
        {{accountSensitiveTraits}}::jsonb,
        {{accountLifecycleStage}},
        {{definitionVersion}},
        {{accountActivatedAt}},
        {{observedAt}},
        {{observedAt}},
        now(),
        now()
      from live_project
      where {{accountExternalId::text}} is not null
      on conflict (project_id, external_id)
      do update set
        name = case
          when excluded.last_seen_at >= tracked_account.last_seen_at
            then coalesce(excluded.name, tracked_account.name)
          else tracked_account.name
        end,
        traits = case
          when excluded.last_seen_at >= tracked_account.last_seen_at
            then tracked_account.traits || excluded.traits
          else tracked_account.traits
        end,
        sensitive_traits = case
          when excluded.last_seen_at >= tracked_account.last_seen_at
            then tracked_account.sensitive_traits || excluded.sensitive_traits
          else tracked_account.sensitive_traits
        end,
        lifecycle_stage = case
          when excluded.last_seen_at >= tracked_account.last_seen_at
            then excluded.lifecycle_stage
          else tracked_account.lifecycle_stage
        end,
        definition_version = case
          when excluded.last_seen_at >= tracked_account.last_seen_at
            then excluded.definition_version
          else tracked_account.definition_version
        end,
        activated_at = case
          when excluded.last_seen_at >= tracked_account.last_seen_at
            then coalesce(excluded.activated_at, tracked_account.activated_at)
          else tracked_account.activated_at
        end,
        first_seen_at = least(tracked_account.first_seen_at, excluded.first_seen_at),
        last_seen_at = greatest(tracked_account.last_seen_at, excluded.last_seen_at),
        updated_at = case
          when excluded.last_seen_at >= tracked_account.last_seen_at then now()
          else tracked_account.updated_at
        end
      returning tracked_account_id, project_id
    ),
    user_upsert as (
      insert into tracked_user (
        tracked_user_id,
        project_id,
        external_id,
        display_name,
        traits,
        sensitive_traits,
        lifecycle_stage,
        definition_version,
        activated_at,
        first_seen_at,
        last_seen_at,
        created_at,
        updated_at
      )
      select
        {{trackedUserId::uuid}},
        live_project.website_id,
        {{userExternalId}},
        {{displayName}},
        {{userTraits}}::jsonb,
        {{userSensitiveTraits}}::jsonb,
        {{lifecycleStage}},
        {{definitionVersion}},
        {{activatedAt}},
        {{observedAt}},
        {{observedAt}},
        now(),
        now()
      from live_project
      on conflict (project_id, external_id)
      do update set
        display_name = case
          when excluded.last_seen_at >= tracked_user.last_seen_at
            then coalesce(excluded.display_name, tracked_user.display_name)
          else tracked_user.display_name
        end,
        traits = case
          when excluded.last_seen_at >= tracked_user.last_seen_at
            then tracked_user.traits || excluded.traits
          else tracked_user.traits
        end,
        sensitive_traits = case
          when excluded.last_seen_at >= tracked_user.last_seen_at
            then tracked_user.sensitive_traits || excluded.sensitive_traits
          else tracked_user.sensitive_traits
        end,
        lifecycle_stage = case
          when excluded.last_seen_at >= tracked_user.last_seen_at
            then excluded.lifecycle_stage
          else tracked_user.lifecycle_stage
        end,
        definition_version = case
          when excluded.last_seen_at >= tracked_user.last_seen_at
            then excluded.definition_version
          else tracked_user.definition_version
        end,
        activated_at = case
          when excluded.last_seen_at >= tracked_user.last_seen_at
            then coalesce(excluded.activated_at, tracked_user.activated_at)
          else tracked_user.activated_at
        end,
        first_seen_at = least(tracked_user.first_seen_at, excluded.first_seen_at),
        last_seen_at = greatest(tracked_user.last_seen_at, excluded.last_seen_at),
        updated_at = case
          when excluded.last_seen_at >= tracked_user.last_seen_at then now()
          else tracked_user.updated_at
        end
      returning tracked_user_id, project_id
    ),
    membership_upsert as (
      insert into account_membership (
        account_membership_id,
        project_id,
        tracked_user_id,
        tracked_account_id,
        observed_at,
        created_at,
        updated_at
      )
      select
        {{membershipId::uuid}},
        user_upsert.project_id,
        user_upsert.tracked_user_id,
        account_upsert.tracked_account_id,
        {{observedAt}},
        now(),
        now()
      from user_upsert
      join account_upsert on account_upsert.project_id = user_upsert.project_id
      on conflict (tracked_user_id)
      do update set
        project_id = excluded.project_id,
        tracked_account_id = excluded.tracked_account_id,
        observed_at = excluded.observed_at,
        updated_at = now()
      where excluded.observed_at >= account_membership.observed_at
      returning tracked_user_id, tracked_account_id, observed_at
    )
    select
      user_upsert.tracked_user_id as "trackedUserId",
      account_upsert.tracked_account_id as "trackedAccountId",
      membership_upsert.observed_at as "membershipObservedAt"
    from user_upsert
    left join account_upsert on account_upsert.project_id = user_upsert.project_id
    left join membership_upsert
      on membership_upsert.tracked_user_id = user_upsert.tracked_user_id
    `,
    {
      projectId: input.projectId,
      trackedUserId,
      userExternalId: input.externalId,
      displayName: getDisplayName(input.traits),
      userTraits: JSON.stringify(userTraits.standard),
      userSensitiveTraits: JSON.stringify(userTraits.sensitive),
      lifecycleStage,
      definitionVersion: ACTIVATION_DEFINITION.key,
      activatedAt: input.activatedAt,
      trackedAccountId,
      accountExternalId: input.account?.id ?? null,
      accountName: input.account?.name ?? null,
      accountTraits: JSON.stringify(accountTraits.standard),
      accountSensitiveTraits: JSON.stringify(accountTraits.sensitive),
      accountLifecycleStage: getLifecycleStageFromTraits(input.account?.traits),
      accountActivatedAt: null,
      membershipId,
      observedAt: input.observedAt,
    },
    'upsertTrackedIdentity',
  )) as UpsertTrackedIdentityResult[];

  return rows[0] ?? null;
}
