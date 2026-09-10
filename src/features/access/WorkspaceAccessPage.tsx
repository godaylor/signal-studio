'use client';

import { ExternalLink, Link2, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocale } from '@/components/hooks/useLocale';
import { useDashboards } from '@/features/dashboards/useDashboards';
import { useInsights } from '@/features/insights/useInsights';
import type {
  CapabilityOverrides,
  StudioCapability,
  StudioRole,
} from '@/server/permissions/capabilities';
import {
  useCreateStudioShare,
  useCreateWorkspaceMember,
  useDeleteWorkspaceMember,
  useProjectAccess,
  useRevokeStudioShare,
  useStudioShares,
  useUpdateWorkspaceMember,
  useWorkspaceMembers,
  type WorkspaceMemberDto,
} from './useProjectAccess';
import styles from './WorkspaceAccessPage.module.css';
import { OperationsPanel } from '@/features/operations/OperationsPanel';
import { LifecyclePanel } from '@/features/lifecycle/LifecyclePanel';

const controlledCapabilities = [
  'viewSensitiveTraits',
  'viewReplay',
  'exportData',
  'createPublicShare',
] as const satisfies readonly StudioCapability[];

const copy = {
  'ru-RU': {
    eyebrow: 'Доступ к рабочему пространству',
    title: 'Роли и безопасный общий доступ',
    intro:
      'Роль задаёт базовые права, а индивидуальные исключения точечно разрешают или запрещают чувствительные действия.',
    members: 'Участники',
    addMember: 'Добавить участника',
    username: 'Имя пользователя',
    usernamePlaceholder: 'user@example.com',
    role: 'Роль',
    capabilities: 'Индивидуальные права',
    actions: 'Действия',
    add: 'Добавить',
    adding: 'Добавление…',
    remove: 'Удалить участника',
    loadingMembers: 'Загрузка участников…',
    noMembers: 'В рабочем пространстве пока нет участников.',
    memberError: 'Не удалось загрузить участников.',
    defaultValue: 'По роли',
    allow: 'Разрешить',
    deny: 'Запретить',
    shares: 'Безопасные ссылки',
    shareIntro:
      'Публичные ссылки содержат только определения и агрегированные результаты. Идентифицирующие данные, чувствительные атрибуты, записи сессий и детализация всегда исключены.',
    shareName: 'Название ссылки',
    shareNamePlaceholder: 'Еженедельный обзор',
    resourceType: 'Тип',
    resource: 'Insight или Dashboard',
    insight: 'Insight',
    dashboard: 'Dashboard',
    visibility: 'Доступ',
    internal: 'Только участники',
    public: 'Публичная ссылка',
    expires: 'Истекает',
    createShare: 'Создать ссылку',
    creatingShare: 'Создание…',
    loadingShares: 'Загрузка ссылок…',
    noShares: 'Безопасные ссылки ещё не созданы.',
    shareError: 'Не удалось загрузить ссылки.',
    active: 'Активна',
    revoked: 'Отозвана',
    revoke: 'Отозвать ссылку',
    open: 'Открыть ссылку',
    warningTitle: 'Изменения доступа применяются сразу',
    warning:
      'Смена роли, индивидуального исключения или отзыв ссылки может немедленно закрыть активный экран. Удаление участника не удаляет созданные им аналитические объекты.',
    confirmRemove: 'Удалить этого участника из рабочего пространства?',
    confirmRevoke: 'Отозвать эту ссылку? Уже выданные токены перестанут работать.',
  },
  'en-US': {
    eyebrow: 'Workspace access',
    title: 'Roles and safe sharing',
    intro:
      'A role defines baseline access, while individual overrides explicitly allow or deny sensitive actions.',
    members: 'Members',
    addMember: 'Add member',
    username: 'Username',
    usernamePlaceholder: 'user@example.com',
    role: 'Role',
    capabilities: 'Individual capabilities',
    actions: 'Actions',
    add: 'Add',
    adding: 'Adding…',
    remove: 'Remove member',
    loadingMembers: 'Loading members…',
    noMembers: 'This workspace has no members yet.',
    memberError: 'Members could not be loaded.',
    defaultValue: 'Use role',
    allow: 'Allow',
    deny: 'Deny',
    shares: 'Safe links',
    shareIntro:
      'Public links include definitions and aggregate results only. Identity, sensitive traits, replay, and drilldown are always excluded.',
    shareName: 'Link name',
    shareNamePlaceholder: 'Weekly review',
    resourceType: 'Type',
    resource: 'Insight or Dashboard',
    insight: 'Insight',
    dashboard: 'Dashboard',
    visibility: 'Access',
    internal: 'Members only',
    public: 'Public link',
    expires: 'Expires',
    createShare: 'Create link',
    creatingShare: 'Creating…',
    loadingShares: 'Loading links…',
    noShares: 'No safe links have been created.',
    shareError: 'Links could not be loaded.',
    active: 'Active',
    revoked: 'Revoked',
    revoke: 'Revoke link',
    open: 'Open link',
    warningTitle: 'Access changes take effect immediately',
    warning:
      'Changing a role or override, or revoking a link, can close an active screen immediately. Removing a member does not delete analytical objects they created.',
    confirmRemove: 'Remove this member from the workspace?',
    confirmRevoke: 'Revoke this link? Previously issued tokens will stop working.',
  },
} as const;

const roleLabels: Record<StudioRole, { 'ru-RU': string; 'en-US': string }> = {
  owner: { 'ru-RU': 'Владелец', 'en-US': 'Owner' },
  admin: { 'ru-RU': 'Администратор', 'en-US': 'Admin' },
  analyst: { 'ru-RU': 'Аналитик', 'en-US': 'Analyst' },
  editor: { 'ru-RU': 'Редактор', 'en-US': 'Editor' },
  viewer: { 'ru-RU': 'Наблюдатель', 'en-US': 'Viewer' },
};

const capabilityLabels: Record<StudioCapability, { 'ru-RU': string; 'en-US': string }> = {
  manageWorkspaceSecurity: { 'ru-RU': 'Безопасность пространства', 'en-US': 'Workspace security' },
  manageMembers: { 'ru-RU': 'Участники', 'en-US': 'Members' },
  manageSources: { 'ru-RU': 'Источники', 'en-US': 'Sources' },
  editInsights: { 'ru-RU': 'Редактирование инсайтов', 'en-US': 'Edit Insights' },
  editDashboards: { 'ru-RU': 'Редактирование дашбордов', 'en-US': 'Edit Dashboards' },
  createSegments: { 'ru-RU': 'Сегменты', 'en-US': 'Segments' },
  viewAggregate: { 'ru-RU': 'Агрегированные данные', 'en-US': 'Aggregate data' },
  viewIdentity: { 'ru-RU': 'Идентифицирующие данные', 'en-US': 'Identity' },
  viewSensitiveTraits: { 'ru-RU': 'Чувствительные атрибуты', 'en-US': 'Sensitive traits' },
  viewReplay: { 'ru-RU': 'Записи сессий', 'en-US': 'Replay' },
  exportData: { 'ru-RU': 'Экспорт', 'en-US': 'Export' },
  createPublicShare: { 'ru-RU': 'Публичный общий доступ', 'en-US': 'Public sharing' },
};

function defaultExpiry() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function WorkspaceAccessPage({ projectId }: { projectId: string }) {
  const { locale } = useLocale();
  const text = copy[locale];
  const access = useProjectAccess(projectId);
  const canManageMembers = Boolean(access.data?.capabilities.manageMembers);
  const canManageSecurity = Boolean(access.data?.capabilities.manageWorkspaceSecurity);
  const canManageShares = Boolean(
    access.data?.capabilities.editInsights || access.data?.capabilities.editDashboards,
  );
  const members = useWorkspaceMembers(projectId, canManageMembers);
  const shares = useStudioShares(projectId, canManageShares);
  const insights = useInsights(projectId, {});
  const dashboards = useDashboards(projectId);
  const createMember = useCreateWorkspaceMember(projectId);
  const updateMember = useUpdateWorkspaceMember(projectId);
  const deleteMember = useDeleteWorkspaceMember(projectId);
  const createShare = useCreateStudioShare(projectId);
  const revokeShare = useRevokeStudioShare(projectId);
  const [username, setUsername] = useState('');
  const [newRole, setNewRole] = useState<Exclude<StudioRole, 'owner'>>('viewer');
  const [shareName, setShareName] = useState('');
  const [resourceType, setResourceType] = useState<'insight' | 'dashboard'>('insight');
  const [resourceId, setResourceId] = useState('');
  const [visibility, setVisibility] = useState<'internal' | 'public'>('internal');
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const insightOptions = useMemo(
    () => insights.data?.pages.flatMap(page => page.data) ?? [],
    [insights.data],
  );
  const dashboardOptions = dashboards.data?.data ?? [];
  const resourceOptions = resourceType === 'insight' ? insightOptions : dashboardOptions;

  const addMember = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createMember.mutateAsync({ username, studioRole: newRole });
      setUsername('');
    } catch {
      // The localized inline error state is rendered below.
    }
  };

  const addShare = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createShare.mutateAsync({
        name: shareName,
        resourceType,
        resourceId,
        visibility,
        expiresAt: new Date(expiresAt).toISOString(),
      });
      setShareName('');
    } catch {
      // The localized inline error state is rendered below.
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p>{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <span>{text.intro}</span>
      </header>
      {access.data?.isSystemAdmin ? <OperationsPanel /> : null}
      {canManageSecurity ? <LifecyclePanel projectId={projectId} /> : null}

      <aside className={styles.warning} aria-label={text.warningTitle}>
        <ShieldCheck aria-hidden="true" size={22} />
        <div>
          <strong>{text.warningTitle}</strong>
          <p>{text.warning}</p>
        </div>
      </aside>

      {canManageMembers ? (
        <section className={styles.section} aria-labelledby="workspace-members-title">
          <div className={styles.sectionHeading}>
            <div>
              <p>{text.addMember}</p>
              <h2 id="workspace-members-title">{text.members}</h2>
            </div>
          </div>
          <form className={styles.inlineForm} onSubmit={addMember}>
            <label>
              <span>{text.username}</span>
              <input
                required
                value={username}
                placeholder={text.usernamePlaceholder}
                onChange={event => setUsername(event.target.value)}
              />
            </label>
            <label>
              <span>{text.role}</span>
              <select
                value={newRole}
                onChange={event => setNewRole(event.target.value as typeof newRole)}
              >
                {(['admin', 'analyst', 'editor', 'viewer'] as const).map(role => (
                  <option key={role} value={role}>
                    {roleLabels[role][locale]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={createMember.isPending}>
              <UserPlus aria-hidden="true" size={17} />
              {createMember.isPending ? text.adding : text.add}
            </button>
          </form>
          {createMember.error ? (
            <p className={styles.error} role="alert">
              {text.memberError}
            </p>
          ) : null}
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={text.username}>
            <table>
              <thead>
                <tr>
                  <th>{text.username}</th>
                  <th>{text.role}</th>
                  <th>{text.capabilities}</th>
                  <th>{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {members.isLoading ? (
                  <tr>
                    <td colSpan={4}>{text.loadingMembers}</td>
                  </tr>
                ) : null}
                {members.isError ? (
                  <tr>
                    <td colSpan={4} className={styles.error}>
                      {text.memberError}
                    </td>
                  </tr>
                ) : null}
                {!members.isLoading && !members.isError && !members.data?.data.length ? (
                  <tr>
                    <td colSpan={4}>{text.noMembers}</td>
                  </tr>
                ) : null}
                {members.data?.data.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    locale={locale}
                    canManageSecurity={canManageSecurity}
                    text={text}
                    onRole={studioRole =>
                      updateMember.mutate({ memberId: member.id, patch: { studioRole } })
                    }
                    onOverride={capabilityOverrides =>
                      updateMember.mutate({ memberId: member.id, patch: { capabilityOverrides } })
                    }
                    onRemove={() => {
                      if (window.confirm(text.confirmRemove)) deleteMember.mutate(member.id);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {updateMember.error || deleteMember.error ? (
            <p className={styles.error} role="alert">
              {text.memberError}
            </p>
          ) : null}
        </section>
      ) : null}

      {canManageShares ? (
        <section className={styles.section} aria-labelledby="workspace-shares-title">
          <div className={styles.sectionHeading}>
            <div>
              <p>{text.shareIntro}</p>
              <h2 id="workspace-shares-title">{text.shares}</h2>
            </div>
          </div>
          <form className={styles.shareForm} onSubmit={addShare}>
            <label>
              <span>{text.shareName}</span>
              <input
                required
                value={shareName}
                placeholder={text.shareNamePlaceholder}
                onChange={event => setShareName(event.target.value)}
              />
            </label>
            <label>
              <span>{text.resourceType}</span>
              <select
                value={resourceType}
                onChange={event => {
                  setResourceType(event.target.value as typeof resourceType);
                  setResourceId('');
                }}
              >
                <option value="insight">{text.insight}</option>
                <option value="dashboard">{text.dashboard}</option>
              </select>
            </label>
            <label>
              <span>{text.resource}</span>
              <select
                required
                value={resourceId}
                onChange={event => setResourceId(event.target.value)}
              >
                <option value="">—</option>
                {resourceOptions.map(resource => (
                  <option key={resource.id} value={resource.id}>
                    {resource.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{text.visibility}</span>
              <select
                value={visibility}
                onChange={event => setVisibility(event.target.value as typeof visibility)}
              >
                <option value="internal">{text.internal}</option>
                {access.data?.capabilities.createPublicShare ? (
                  <option value="public">{text.public}</option>
                ) : null}
              </select>
            </label>
            <label>
              <span>{text.expires}</span>
              <input
                required
                type="datetime-local"
                value={expiresAt}
                onChange={event => setExpiresAt(event.target.value)}
              />
            </label>
            <button type="submit" disabled={createShare.isPending || !resourceId}>
              <Link2 aria-hidden="true" size={17} />
              {createShare.isPending ? text.creatingShare : text.createShare}
            </button>
          </form>
          {createShare.error ? (
            <p className={styles.error} role="alert">
              {text.shareError}
            </p>
          ) : null}
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-labelledby="workspace-shares-title">
            <table>
              <thead>
                <tr>
                  <th>{text.shareName}</th>
                  <th>{text.resourceType}</th>
                  <th>{text.visibility}</th>
                  <th>{text.expires}</th>
                  <th>{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {shares.isLoading ? (
                  <tr>
                    <td colSpan={5}>{text.loadingShares}</td>
                  </tr>
                ) : null}
                {shares.isError ? (
                  <tr>
                    <td colSpan={5} className={styles.error}>
                      {text.shareError}
                    </td>
                  </tr>
                ) : null}
                {!shares.isLoading && !shares.isError && !shares.data?.data.length ? (
                  <tr>
                    <td colSpan={5}>{text.noShares}</td>
                  </tr>
                ) : null}
                {shares.data?.data.map(share => (
                  <tr key={share.id}>
                    <td>
                      <strong>{share.name}</strong>
                      <small>{share.revokedAt ? text.revoked : text.active}</small>
                    </td>
                    <td>{share.resourceType === 'insight' ? text.insight : text.dashboard}</td>
                    <td>{share.visibility === 'public' ? text.public : text.internal}</td>
                    <td>
                      {share.expiresAt
                        ? new Intl.DateTimeFormat(locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(share.expiresAt))
                        : '—'}
                    </td>
                    <td className={styles.actions}>
                      {!share.revokedAt ? (
                        <a
                          href={`/share/${share.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${text.open}: ${share.name}`}
                        >
                          <ExternalLink aria-hidden="true" size={17} />
                        </a>
                      ) : null}
                      {!share.revokedAt ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(text.confirmRevoke)) revokeShare.mutate(share.id);
                          }}
                          aria-label={`${text.revoke}: ${share.name}`}
                        >
                          <Trash2 aria-hidden="true" size={17} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {revokeShare.error ? (
            <p className={styles.error} role="alert">
              {text.shareError}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MemberRow({
  member,
  locale,
  canManageSecurity,
  text,
  onRole,
  onOverride,
  onRemove,
}: {
  member: WorkspaceMemberDto;
  locale: 'ru-RU' | 'en-US';
  canManageSecurity: boolean;
  text: (typeof copy)['ru-RU'] | (typeof copy)['en-US'];
  onRole: (role: Exclude<StudioRole, 'owner'>) => void;
  onOverride: (overrides: CapabilityOverrides) => void;
  onRemove: () => void;
}) {
  const protectedOwner = member.studioRole === 'owner';
  return (
    <tr>
      <td>
        <strong>{member.user.displayName || member.user.username}</strong>
        <small>{member.user.displayName ? member.user.username : member.legacyRole}</small>
      </td>
      <td>
        <select
          aria-label={`${text.role}: ${member.user.username}`}
          value={member.studioRole}
          disabled={protectedOwner}
          onChange={event => onRole(event.target.value as Exclude<StudioRole, 'owner'>)}
        >
          {protectedOwner ? <option value="owner">{roleLabels.owner[locale]}</option> : null}
          {(['admin', 'analyst', 'editor', 'viewer'] as const).map(role => (
            <option key={role} value={role}>
              {roleLabels[role][locale]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <div className={styles.capabilityGrid}>
          {controlledCapabilities.map(capability => {
            const override = member.capabilityOverrides[capability];
            const value = override === undefined ? 'default' : override ? 'allow' : 'deny';
            return (
              <label key={capability}>
                <span>{capabilityLabels[capability][locale]}</span>
                <select
                  value={value}
                  disabled={!canManageSecurity || protectedOwner}
                  onChange={event => {
                    const next = { ...member.capabilityOverrides };
                    if (event.target.value === 'default') delete next[capability];
                    else next[capability] = event.target.value === 'allow';
                    onOverride(next);
                  }}
                >
                  <option value="default">{text.defaultValue}</option>
                  <option value="allow">{text.allow}</option>
                  <option value="deny">{text.deny}</option>
                </select>
              </label>
            );
          })}
        </div>
      </td>
      <td className={styles.actions}>
        {!protectedOwner ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${text.remove}: ${member.user.username}`}
          >
            <Trash2 aria-hidden="true" size={17} />
          </button>
        ) : null}
      </td>
    </tr>
  );
}
