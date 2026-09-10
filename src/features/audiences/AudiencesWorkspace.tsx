'use client';

import { ArrowRight, Filter, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { ExportControls } from '@/features/exports/ExportControls';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { AccessibleDialog } from '@/features/studio-shell/AccessibleDialog';
import type {
  IdentityListQuery,
  OperationalSegmentCondition,
  OperationalSegmentDefinition,
} from '@/server/audiences/contracts';
import styles from './AudiencesWorkspace.module.css';
import {
  type IdentityProfile,
  type IdentityRow,
  useDeleteSegment,
  useIdentityList,
  useIdentityProfile,
  useOperationalSegments,
  usePreviewSegment,
  useSaveSegment,
} from './useAudiences';

const lifecycleOptions = [
  'identified',
  'signed-up',
  'onboarding',
  'activated',
  'retained',
  'inactive',
];

type ProfileSelection = { entity: 'account' | 'user'; id: string };

function rowLabel(row: IdentityRow, entity: 'account' | 'user', locale: string) {
  if (entity === 'account')
    return (
      row.name ??
      row.externalId ??
      `${locale === 'en-US' ? 'Account' : 'Аккаунт'} ${row.id.slice(0, 8)}`
    );
  return (
    row.displayName ??
    row.externalId ??
    `${locale === 'en-US' ? 'Tracked user' : 'Пользователь'} ${row.id.slice(0, 8)}`
  );
}

function formatDate(value: string | null | undefined, locale: string) {
  return value
    ? new Date(value).toLocaleString(locale)
    : locale === 'en-US'
      ? 'Not observed'
      : 'Не наблюдалось';
}

function lifecycleLabel(stage: string, locale: string) {
  if (locale === 'en-US') return stage;
  return (
    {
      identified: 'определён',
      'signed-up': 'зарегистрирован',
      onboarding: 'онбординг',
      activated: 'активирован',
      retained: 'удержан',
      inactive: 'неактивен',
    }[stage] ?? stage
  );
}

export function AudiencesWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const { t } = useStudioLocale();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestedView = params.get('view');
  const view =
    requestedView === 'users' || requestedView === 'segments' ? requestedView : 'accounts';
  const [searchDraft, setSearchDraft] = useState(params.get('q') ?? '');
  const profileId = params.get('profileId');
  const profileEntity = params.get('profileEntity');
  const profile: ProfileSelection | undefined =
    profileId &&
    /^[0-9a-f-]{36}$/i.test(profileId) &&
    (profileEntity === 'account' || profileEntity === 'user')
      ? { id: profileId, entity: profileEntity }
      : undefined;
  const deferredSearch = useDeferredValue(searchDraft);
  const serializedParams = params.toString();

  const replaceParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(serializedParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      next.delete('cursor');
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, serializedParams],
  );

  useEffect(() => {
    const current = new URLSearchParams(serializedParams).get('q') ?? '';
    if (deferredSearch === current) return;
    const timer = window.setTimeout(
      () => replaceParams({ q: deferredSearch.trim() || undefined }),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [deferredSearch, replaceParams, serializedParams]);

  const returnTo = `${pathname}${serializedParams ? `?${serializedParams}` : ''}`;
  const setProfile = (selection?: ProfileSelection) =>
    replaceParams({ profileId: selection?.id, profileEntity: selection?.entity });

  return (
    <main className={styles.workspace}>
      <header className={styles.heading}>
        <p>
          {t('Operational audiences', 'Рабочие аудитории')} · {projectName}
        </p>
        <h1>{t('Accounts, users and segments', 'Аккаунты, пользователи и сегменты')}</h1>
        <span>
          {t(
            'Find the product identities behind an aggregate, inspect definition-backed adoption and carry exact session evidence forward.',
            'Находите продуктовые идентичности за агрегатом, проверяйте активацию по определениям и переходите к точным данным сессий.',
          )}
        </span>
      </header>
      <nav className={styles.tabs} aria-label={t('Audience view', 'Представление аудитории')}>
        {(['accounts', 'users', 'segments'] as const).map(item => (
          <button
            key={item}
            type="button"
            aria-current={view === item ? 'page' : undefined}
            onClick={() => replaceParams({ view: item === 'accounts' ? undefined : item })}
          >
            {item === 'accounts'
              ? t('Accounts', 'Аккаунты')
              : item === 'users'
                ? t('Tracked users', 'Пользователи')
                : t('Segments', 'Сегменты')}
          </button>
        ))}
      </nav>

      {view === 'segments' ? (
        <SegmentView projectId={projectId} onOpenProfile={setProfile} />
      ) : (
        <IdentityView
          projectId={projectId}
          entity={view === 'users' ? 'user' : 'account'}
          search={searchDraft}
          onSearch={setSearchDraft}
          params={params}
          replaceParams={replaceParams}
          onOpenProfile={setProfile}
        />
      )}
      <ProfileDialog
        projectId={projectId}
        selection={profile}
        returnTo={returnTo}
        onSelect={setProfile}
        onClose={() => setProfile(undefined)}
      />
    </main>
  );
}

function IdentityView({
  projectId,
  entity,
  search,
  onSearch,
  params,
  replaceParams,
  onOpenProfile,
}: {
  projectId: string;
  entity: 'account' | 'user';
  search: string;
  onSearch: (value: string) => void;
  params: ReturnType<typeof useSearchParams>;
  replaceParams: (patch: Record<string, string | undefined>) => void;
  onOpenProfile: (selection: ProfileSelection) => void;
}) {
  const { locale, t } = useStudioLocale();
  const sort = params.get('sort') ?? 'lastSeenAt';
  const direction = params.get('direction') ?? 'desc';
  const lifecycle = params.get('lifecycle') ?? undefined;
  const list = useIdentityList(projectId, entity === 'account' ? 'accounts' : 'tracked-users', {
    search: params.get('q') ?? undefined,
    sort,
    direction,
    lifecycle,
  });
  const rows = list.data?.pages.flatMap(page => page.data) ?? [];
  const scope = list.data?.pages[0]?.permissionScope;
  return (
    <section className={styles.panel} aria-labelledby="audience-ledger-title">
      <ExportControls
        projectId={projectId}
        disabled={!rows.length || list.isFetching}
        source={{
          kind: entity === 'account' ? 'accounts' : 'users',
          visibleRows: Math.max(1, Math.min(rows.length, 100_000)),
          list: {
            limit: 50,
            search: params.get('q') ?? undefined,
            sort: sort as IdentityListQuery['sort'],
            direction: direction as IdentityListQuery['direction'],
            lifecycle,
          },
        }}
      />
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>{t('Identity ledger', 'Реестр идентичностей')}</p>
          <h2 id="audience-ledger-title">
            {entity === 'account' ? t('Accounts', 'Аккаунты') : t('Tracked users', 'Пользователи')}
          </h2>
        </div>
        <label className={styles.searchField}>
          <Search aria-hidden="true" size={16} />
          <span className="sr-only">{t('Search identities', 'Поиск идентичностей')}</span>
          <input
            value={search}
            placeholder={
              scope === 'identity-standard'
                ? t('Search lifecycle', 'Поиск по этапу')
                : t('Search name or ID', 'Поиск по имени или ID')
            }
            onChange={event => onSearch(event.target.value)}
          />
        </label>
        <label>
          <Filter aria-hidden="true" size={15} /> {t('Lifecycle', 'Жизненный цикл')}
          <select
            aria-label={t('Lifecycle filter', 'Фильтр жизненного цикла')}
            value={lifecycle ?? ''}
            onChange={event => replaceParams({ lifecycle: event.target.value || undefined })}
          >
            <option value="">{t('All stages', 'Все этапы')}</option>
            {lifecycleOptions.map(stage => (
              <option key={stage} value={stage}>
                {lifecycleLabel(stage, locale)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Sort', 'Сортировка')}
          <select
            aria-label={t('Identity sort', 'Сортировка идентичностей')}
            value={sort}
            onChange={event => replaceParams({ sort: event.target.value })}
          >
            <option value="lastSeenAt">{t('Last seen', 'Последняя активность')}</option>
            <option value="firstSeenAt">{t('First seen', 'Первая активность')}</option>
            <option value="lifecycleStage">{t('Lifecycle', 'Жизненный цикл')}</option>
          </select>
        </label>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => replaceParams({ direction: direction === 'desc' ? 'asc' : 'desc' })}
        >
          {direction === 'desc' ? t('Descending', 'По убыванию') : t('Ascending', 'По возрастанию')}
        </button>
      </div>
      {scope === 'identity-standard' ? (
        <p className={styles.notice} role="status">
          {t(
            'Sensitive names, external IDs and classified traits are masked for this role.',
            'Чувствительные имена, внешние ID и классифицированные атрибуты скрыты для этой роли.',
          )}
        </p>
      ) : null}
      {list.isPending ? (
        <p role="status" className={styles.state}>
          {t('Loading identities…', 'Загрузка идентичностей…')}
        </p>
      ) : null}
      {list.error ? (
        <p role="alert" className={styles.state}>
          {t(
            'Identities could not be loaded. Retry from this URL.',
            'Не удалось загрузить идентичности. Повторите попытку с текущего URL.',
          )}
        </p>
      ) : null}
      {!list.isPending && !list.error && rows.length === 0 ? (
        <p className={styles.state}>
          {t(
            'No identities match these reproducible filters.',
            'Нет идентичностей, соответствующих этим воспроизводимым фильтрам.',
          )}
        </p>
      ) : null}
      {rows.length ? (
        <div className={styles.tableWrap}>
          <table>
            <caption>
              {entity === 'account'
                ? t('Project accounts', 'Аккаунты проекта')
                : t('Project tracked users', 'Пользователи проекта')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('Identity', 'Идентичность')}</th>
                <th scope="col">{t('Lifecycle', 'Жизненный цикл')}</th>
                <th scope="col">{t('Plan', 'Тариф')}</th>
                <th scope="col">{t('Last seen', 'Последняя активность')}</th>
                <th scope="col">{t('Evidence', 'Данные')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <th scope="row">{rowLabel(row, entity, locale)}</th>
                  <td>
                    <span className={styles.stage}>
                      {lifecycleLabel(row.lifecycleStage, locale)}
                    </span>
                  </td>
                  <td>{String(row.traits.plan ?? '—')}</td>
                  <td>{formatDate(row.lastSeenAt, locale)}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.rowButton}
                      onClick={() => onOpenProfile({ entity, id: row.id })}
                    >
                      {t('Open profile', 'Открыть профиль')}{' '}
                      <ArrowRight aria-hidden="true" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {list.hasNextPage ? (
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
        >
          {list.isFetchingNextPage
            ? t('Loading next page…', 'Загрузка следующей страницы…')
            : t('Load next page', 'Загрузить следующую страницу')}
        </button>
      ) : null}
    </section>
  );
}

function ProfileDialog({
  projectId,
  selection,
  returnTo,
  onSelect,
  onClose,
}: {
  projectId: string;
  selection?: ProfileSelection;
  returnTo: string;
  onSelect: (selection: ProfileSelection) => void;
  onClose: () => void;
}) {
  const { t } = useStudioLocale();
  const profile = useIdentityProfile(projectId, selection?.entity ?? 'user', selection?.id);
  return (
    <AccessibleDialog
      open={!!selection}
      side="left"
      title={profile.data?.label ?? t('Identity profile', 'Профиль идентичности')}
      description={t(
        'Definition-backed lifecycle, adoption and linked evidence.',
        'Жизненный цикл, активация и связанные данные на основе определений.',
      )}
      onClose={onClose}
    >
      <div className={styles.profileBody}>
        {profile.isPending ? (
          <p role="status">{t('Loading profile…', 'Загрузка профиля…')}</p>
        ) : null}
        {profile.error ? (
          <p role="alert">
            {t(
              'This profile could not be loaded for the current project role.',
              'Текущая роль проекта не позволяет загрузить этот профиль.',
            )}
          </p>
        ) : null}
        {profile.data ? (
          <ProfileContent
            projectId={projectId}
            profile={profile.data}
            returnTo={returnTo}
            onSelect={onSelect}
          />
        ) : null}
      </div>
    </AccessibleDialog>
  );
}

function ProfileContent({
  projectId,
  profile,
  returnTo,
  onSelect,
}: {
  projectId: string;
  profile: IdentityProfile;
  returnTo: string;
  onSelect: (selection: ProfileSelection) => void;
}) {
  const { locale, t } = useStudioLocale();
  const sessions = profile.sessions ?? profile.members?.flatMap(member => member.sessions) ?? [];
  return (
    <>
      <section className={styles.definitionBand}>
        <div>
          <span>{t('Lifecycle', 'Жизненный цикл')}</span>
          <strong>{lifecycleLabel(profile.lifecycle.stage, locale)}</strong>
          <small>
            {profile.lifecycle.definition.label} · {profile.lifecycle.definition.exactness}
          </small>
        </div>
        <div>
          <span>{t('Observed adoption', 'Наблюдаемая активация')}</span>
          <strong>
            {profile.adoption.sessions.toLocaleString(locale)} {t('sessions', 'сессий')} ·{' '}
            {profile.adoption.events.toLocaleString(locale)} {t('events', 'событий')}
          </strong>
          <small>{profile.adoption.definition.description}</small>
        </div>
      </section>
      <details>
        <summary>{t('Definition and traits', 'Определение и атрибуты')}</summary>
        <p>{profile.lifecycle.definition.description}</p>
        <dl className={styles.traits}>
          {Object.entries(profile.traits).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
        {profile.sensitiveTraits ? (
          <dl className={styles.traits}>
            {Object.entries(profile.sensitiveTraits).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {key} · {t('sensitive', 'чувствительный')}
                </dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </details>
      {profile.account ? (
        <button
          type="button"
          className={styles.rowButton}
          onClick={() => onSelect({ entity: 'account', id: profile.account?.id as string })}
        >
          {t('Account', 'Аккаунт')} {profile.account.label}
        </button>
      ) : null}
      {profile.members?.length ? (
        <section>
          <h3>{t('Account members', 'Участники аккаунта')}</h3>
          <ul className={styles.memberList}>
            {profile.members.map(member => (
              <li key={member.id}>
                <button type="button" onClick={() => onSelect({ entity: 'user', id: member.id })}>
                  {member.label}
                </button>
                <span>
                  {lifecycleLabel(member.lifecycleStage, locale)} ·{' '}
                  {member.sessions.length.toLocaleString(locale)}{' '}
                  {t('shown sessions', 'показано сессий')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h3>{t('Session evidence', 'Данные сессий')}</h3>
        {sessions.length ? (
          <ul className={styles.memberList}>
            {sessions.map(session => (
              <li key={session.id}>
                <div>
                  <strong>
                    {session.browser ?? t('Unknown browser', 'Неизвестный браузер')} ·{' '}
                    {session.device ?? t('Unknown device', 'Неизвестное устройство')}
                  </strong>
                  <span>
                    {session.eventCount.toLocaleString(locale)} {t('events', 'событий')} ·{' '}
                    {formatDate(session.createdAt, locale)}
                  </span>
                </div>
                <Link
                  href={`/studio/${projectId}/experience?sessionId=${session.id}&returnTo=${encodeURIComponent(returnTo)}`}
                >
                  {t('Open evidence', 'Открыть данные')}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No linked sessions were observed.', 'Связанные сессии не наблюдались.')}</p>
        )}
      </section>
    </>
  );
}

const initialDefinition: OperationalSegmentDefinition = {
  version: 1,
  entity: 'user',
  match: 'all',
  conditions: [{ kind: 'lifecycle', value: 'activated' }],
};

function SegmentView({
  projectId,
  onOpenProfile,
}: {
  projectId: string;
  onOpenProfile: (selection: ProfileSelection) => void;
}) {
  const { locale, t } = useStudioLocale();
  const [name, setName] = useState(() => t('Activated users', 'Активированные пользователи'));
  const [definition, setDefinition] = useState<OperationalSegmentDefinition>(initialDefinition);
  const segments = useOperationalSegments(projectId);
  const preview = usePreviewSegment(projectId);
  const save = useSaveSegment(projectId);
  const remove = useDeleteSegment(projectId);
  const updateCondition = (index: number, condition: OperationalSegmentCondition) =>
    setDefinition(current => ({
      ...current,
      conditions: current.conditions.map((item, itemIndex) =>
        itemIndex === index ? condition : item,
      ),
    }));
  return (
    <div className={styles.segmentGrid}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>{t('Segment builder', 'Конструктор сегмента')}</p>
        <h2>{t('Define an operational audience', 'Определите рабочую аудиторию')}</h2>
        <div className={styles.builderControls}>
          <label>
            {t('Segment name', 'Название сегмента')}
            <input value={name} maxLength={200} onChange={event => setName(event.target.value)} />
          </label>
          <label>
            {t('Entity', 'Сущность')}
            <select
              value={definition.entity}
              onChange={event =>
                setDefinition(current => ({
                  ...current,
                  entity: event.target.value as 'user' | 'account',
                }))
              }
            >
              <option value="user">{t('Tracked users', 'Пользователи')}</option>
              <option value="account">{t('Accounts', 'Аккаунты')}</option>
            </select>
          </label>
          <label>
            {t('Match', 'Совпадение')}
            <select
              value={definition.match}
              onChange={event =>
                setDefinition(current => ({
                  ...current,
                  match: event.target.value as 'all' | 'any',
                }))
              }
            >
              <option value="all">{t('All conditions', 'Все условия')}</option>
              <option value="any">{t('Any condition', 'Любое условие')}</option>
            </select>
          </label>
        </div>
        {definition.conditions.map((condition, index) => (
          <div className={styles.condition} key={`${condition.kind}-${index}`}>
            <select
              aria-label={t(`Condition ${index + 1} type`, `Тип условия ${index + 1}`)}
              value={condition.kind}
              onChange={event => {
                const kind = event.target.value;
                updateCondition(
                  index,
                  kind === 'trait'
                    ? { kind: 'trait', field: 'plan', operator: 'equals', value: 'enterprise' }
                    : kind === 'behavior'
                      ? {
                          kind: 'behavior',
                          eventName: 'core_feature_used',
                          withinDays: 30,
                          minCount: 1,
                        }
                      : { kind: 'lifecycle', value: 'activated' },
                );
              }}
            >
              <option value="lifecycle">{t('Lifecycle', 'Жизненный цикл')}</option>
              <option value="trait">{t('Trait', 'Атрибут')}</option>
              <option value="behavior">{t('Behavior', 'Поведение')}</option>
            </select>
            {condition.kind === 'lifecycle' ? (
              <select
                aria-label={t(
                  `Condition ${index + 1} lifecycle`,
                  `Жизненный цикл условия ${index + 1}`,
                )}
                value={condition.value}
                onChange={event =>
                  updateCondition(index, { ...condition, value: event.target.value })
                }
              >
                {lifecycleOptions.map(stage => (
                  <option key={stage}>{stage}</option>
                ))}
              </select>
            ) : null}
            {condition.kind === 'trait' ? (
              <>
                <select
                  aria-label={t(`Condition ${index + 1} trait`, `Атрибут условия ${index + 1}`)}
                  value={condition.field}
                  onChange={event =>
                    updateCondition(index, {
                      ...condition,
                      field: event.target.value as typeof condition.field,
                    })
                  }
                >
                  <option value="plan">plan</option>
                  <option value="role">role</option>
                  <option value="industry">industry</option>
                  <option value="company_size">company_size</option>
                </select>
                <select
                  aria-label={t(`Condition ${index + 1} operator`, `Оператор условия ${index + 1}`)}
                  value={condition.operator}
                  onChange={event =>
                    updateCondition(index, {
                      ...condition,
                      operator: event.target.value as typeof condition.operator,
                    })
                  }
                >
                  <option value="equals">{t('equals', 'равно')}</option>
                  <option value="notEquals">{t('does not equal', 'не равно')}</option>
                  <option value="contains">{t('contains', 'содержит')}</option>
                  <option value="doesNotContain">{t('does not contain', 'не содержит')}</option>
                </select>
                <input
                  aria-label={t(`Condition ${index + 1} value`, `Значение условия ${index + 1}`)}
                  value={condition.value}
                  onChange={event =>
                    updateCondition(index, { ...condition, value: event.target.value })
                  }
                />
              </>
            ) : null}
            {condition.kind === 'behavior' ? (
              <>
                <input
                  aria-label={t(`Condition ${index + 1} event`, `Событие условия ${index + 1}`)}
                  value={condition.eventName}
                  onChange={event =>
                    updateCondition(index, { ...condition, eventName: event.target.value })
                  }
                />
                <input
                  aria-label={t(
                    `Condition ${index + 1} days`,
                    `Количество дней условия ${index + 1}`,
                  )}
                  type="number"
                  min={1}
                  max={90}
                  value={condition.withinDays}
                  onChange={event =>
                    updateCondition(index, { ...condition, withinDays: Number(event.target.value) })
                  }
                />
                <input
                  aria-label={t(
                    `Condition ${index + 1} count`,
                    `Количество событий условия ${index + 1}`,
                  )}
                  type="number"
                  min={1}
                  max={100}
                  value={condition.minCount}
                  onChange={event =>
                    updateCondition(index, { ...condition, minCount: Number(event.target.value) })
                  }
                />
              </>
            ) : null}
            <button
              type="button"
              aria-label={t(`Remove condition ${index + 1}`, `Удалить условие ${index + 1}`)}
              disabled={definition.conditions.length === 1}
              onClick={() =>
                setDefinition(current => ({
                  ...current,
                  conditions: current.conditions.filter((_, itemIndex) => itemIndex !== index),
                }))
              }
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
        ))}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={definition.conditions.length >= 8}
            onClick={() =>
              setDefinition(current => ({
                ...current,
                conditions: [
                  ...current.conditions,
                  { kind: 'trait', field: 'plan', operator: 'equals', value: 'enterprise' },
                ],
              }))
            }
          >
            {t('Add condition', 'Добавить условие')}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={preview.isPending}
            onClick={() => preview.mutate(definition)}
          >
            {preview.isPending
              ? t('Evaluating…', 'Вычисление…')
              : t('Preview size', 'Оценить размер')}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate({ name: name.trim(), definition })}
          >
            {save.isPending
              ? t('Saving Segment…', 'Сохранение сегмента…')
              : t('Save Segment', 'Сохранить сегмент')}
          </button>
        </div>
        {preview.error ? (
          <p role="alert">
            {t(
              'Segment preview could not be evaluated inside its bounds.',
              'Не удалось оценить сегмент в заданных ограничениях.',
            )}
          </p>
        ) : null}
        {preview.data ? (
          <div className={styles.preview} role="status">
            <strong>
              {preview.data.count.toLocaleString(locale)} {t('exact', 'точно')}{' '}
              {preview.data.entity === 'user'
                ? t('users', 'пользователей')
                : t('accounts', 'аккаунтов')}
            </strong>
            <span>
              {t('Evaluated', 'Рассчитано')} {formatDate(preview.data.evaluatedAt, locale)}
            </span>
            <ul>
              {preview.data.sample.map(member => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => onOpenProfile({ entity: preview.data.entity, id: member.id })}
                  >
                    {member.label} · {member.lifecycleStage}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {save.isSuccess ? (
          <p role="status">
            {t(
              'Segment saved with its reusable definition.',
              'Сегмент сохранён с повторно используемым определением.',
            )}
          </p>
        ) : null}
        {save.error ? (
          <p role="alert">
            {t(
              'Segment could not be saved for this role.',
              'Текущая роль не позволяет сохранить сегмент.',
            )}
          </p>
        ) : null}
      </section>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>{t('Saved definitions', 'Сохранённые определения')}</p>
        <h2>{t('Operational Segments', 'Рабочие сегменты')}</h2>
        {segments.isPending ? (
          <p role="status">{t('Loading Segments…', 'Загрузка сегментов…')}</p>
        ) : null}
        {segments.error ? (
          <p role="alert">{t('Segments could not be loaded.', 'Не удалось загрузить сегменты.')}</p>
        ) : null}
        {segments.data?.data.length === 0 ? (
          <p>
            {t(
              'No operational Segments yet. Behavioral Cohorts remain reusable from Retention.',
              'Рабочих сегментов пока нет. Поведенческие когорты из удержания можно использовать повторно.',
            )}
          </p>
        ) : null}
        <ul className={styles.segmentList}>
          {segments.data?.data.map(segment => {
            const dependencyCount =
              segment.dependencies.insights.length + segment.dependencies.dashboards;
            return (
              <li key={segment.id}>
                <div>
                  <strong>{segment.name}</strong>
                  <span>
                    {segment.definition.entity === 'user'
                      ? t('users', 'пользователи')
                      : t('accounts', 'аккаунты')}{' '}
                    ·{' '}
                    {segment.definition.match === 'all'
                      ? t('all conditions', 'все условия')
                      : t('any condition', 'любое условие')}{' '}
                    · {segment.definition.conditions.length.toLocaleString(locale)}{' '}
                    {t('conditions', 'условий')}
                  </span>
                  <small>
                    {dependencyCount
                      ? `${segment.dependencies.insights.length.toLocaleString(locale)} ${t('Insights', 'инсайтов')} · ${segment.dependencies.dashboards.toLocaleString(locale)} ${t('Dashboard placements', 'размещений в дашбордах')}`
                      : t('No saved dependencies', 'Нет сохранённых зависимостей')}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={dependencyCount > 0 || remove.isPending}
                  title={
                    dependencyCount
                      ? t(
                          'Remove dependencies before deleting this Segment.',
                          'Удалите зависимости перед удалением сегмента.',
                        )
                      : undefined
                  }
                  onClick={() => remove.mutate(segment.id)}
                >
                  {t('Delete', 'Удалить')}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
