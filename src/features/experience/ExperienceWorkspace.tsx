'use client';

import { ArrowLeft, Gauge, Play, ShieldCheck } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import styles from './ExperienceWorkspace.module.css';
import { useEvidenceReplay, useSessionEvidence } from './useEvidence';

const ReplayPlayer = dynamic(
  () =>
    import('@/app/(main)/websites/[websiteId]/replays/[replayId]/ReplayPlayer').then(
      module => module.ReplayPlayer,
    ),
  { ssr: false, loading: () => <ReplayLoading /> },
);

function ReplayLoading() {
  const { t } = useStudioLocale();
  return <p role="status">{t('Loading replay player…', 'Загрузка проигрывателя записи…')}</p>;
}

function formatDate(value: string | null | undefined, locale: string) {
  return value
    ? new Date(value).toLocaleString(locale)
    : locale === 'en-US'
      ? 'Unknown time'
      : 'Время неизвестно';
}

function metric(value: number | null, locale: string, suffix = ' ms') {
  return value === null
    ? locale === 'en-US'
      ? 'Not observed'
      : 'Не наблюдалось'
    : `${value.toLocaleString(locale)}${suffix}`;
}

export function ExperienceWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const { locale, t } = useStudioLocale();
  const params = useSearchParams();
  const sessionId = params.get('sessionId') ?? undefined;
  const startAt = params.get('startAt') ?? undefined;
  const endAt = params.get('endAt') ?? undefined;
  const urlPath = params.get('urlPath') ?? undefined;
  const candidateReturnTo = params.get('returnTo') ?? '';
  const returnTo =
    candidateReturnTo.startsWith(`/studio/${projectId}/`) && !candidateReturnTo.startsWith('//')
      ? candidateReturnTo
      : `/studio/${projectId}/audiences`;
  const evidence = useSessionEvidence(projectId, { sessionId, startAt, endAt, urlPath });
  const first = evidence.data?.pages[0];
  const timeline = evidence.data?.pages.flatMap(page => page.timeline.data) ?? [];
  const replayId = first?.replay.state === 'available' ? first.replay.replayId : undefined;
  const [loadReplay, setLoadReplay] = useState(false);
  const replay = useEvidenceReplay(projectId, replayId, loadReplay);
  const compatible = new URLSearchParams();
  if (first?.compatibleContext.startAt)
    compatible.set('startDate', first.compatibleContext.startAt);
  if (first?.compatibleContext.endAt) compatible.set('endDate', first.compatibleContext.endAt);
  if (first?.compatibleContext.urlPath) compatible.set('urlPath', first.compatibleContext.urlPath);

  return (
    <main className={styles.workspace}>
      <header className={styles.heading}>
        <Link href={returnTo}>
          <ArrowLeft aria-hidden="true" size={16} /> {t('Back to analysis', 'Назад к анализу')}
        </Link>
        <p>
          {t('Experience evidence', 'Данные об опыте')} · {projectName}
        </p>
        <h1>{t('Session evidence', 'Данные сессии')}</h1>
        <span>
          {t(
            'Identity, behavior, performance and replay availability stay linked to the selected aggregate member.',
            'Идентичность, поведение, производительность и доступность записи связаны с выбранным участником агрегата.',
          )}
        </span>
      </header>
      {!sessionId ? (
        <section className={styles.state}>
          <h2>{t('Choose a session from evidence', 'Выберите сессию из данных')}</h2>
          <p>
            {t(
              'Open a member from Explore, a retention cell, or an Audience profile to preserve matching context here.',
              'Откройте участника из анализа, ячейки удержания или профиля аудитории, чтобы сохранить здесь совпадающий контекст.',
            )}
          </p>
          <Link href={`/studio/${projectId}/audiences`}>
            {t('Browse Audiences', 'Открыть аудитории')}
          </Link>
        </section>
      ) : null}
      {evidence.isPending ? (
        <section className={styles.state} role="status">
          <h2>{t('Loading session evidence', 'Загрузка данных сессии')}</h2>
          <p>
            {t(
              'The last aggregate result remains available through Back to analysis.',
              'Последний агрегированный результат доступен по ссылке «Назад к анализу».',
            )}
          </p>
        </section>
      ) : null}
      {evidence.error ? (
        <section className={styles.state} role="alert">
          <h2>{t('Session evidence could not be loaded', 'Не удалось загрузить данные сессии')}</h2>
          <p>
            {t(
              'The session may be outside this project or unavailable to the current role.',
              'Сессия может относиться к другому проекту или быть недоступна текущей роли.',
            )}
          </p>
        </section>
      ) : null}
      {first ? (
        <>
          <section
            className={styles.contextStrip}
            aria-label={t('Session context', 'Контекст сессии')}
          >
            <div>
              <span>{t('Identity', 'Идентичность')}</span>
              <strong>{first.identity?.label ?? t('Anonymous session', 'Анонимная сессия')}</strong>
              <small>
                {first.identity?.account?.label ??
                  t('No linked account', 'Нет связанного аккаунта')}
              </small>
            </div>
            <div>
              <span>{t('Device', 'Устройство')}</span>
              <strong>
                {first.session.browser ?? t('Unknown', 'Неизвестно')} ·{' '}
                {first.session.device ?? t('Unknown', 'Неизвестно')}
              </strong>
              <small>
                {first.session.os ?? t('Unknown OS', 'Неизвестная ОС')} ·{' '}
                {first.session.country ?? t('Unknown country', 'Страна неизвестна')}
              </small>
            </div>
            <div>
              <span>{t('Observed', 'Наблюдалось')}</span>
              <strong>{formatDate(first.session.createdAt, locale)}</strong>
              <small>
                {t('Session', 'Сессия')} {first.session.id.slice(0, 8)}
              </small>
            </div>
          </section>
          {first.timeline.masked ? (
            <p className={styles.notice} role="status">
              <ShieldCheck aria-hidden="true" size={17} />{' '}
              {t(
                'Sensitive traits, page titles and event properties are masked for this role.',
                'Чувствительные атрибуты, заголовки страниц и свойства событий скрыты для этой роли.',
              )}
            </p>
          ) : null}
          <div className={styles.grid}>
            <section className={styles.panel}>
              <p className={styles.eyebrow}>{t('Behavioral timeline', 'Хронология поведения')}</p>
              <h2>{t('Observed events', 'Наблюдаемые события')}</h2>
              {timeline.length ? (
                <ol className={styles.timeline}>
                  {timeline.map(event => (
                    <li key={event.id}>
                      <time>{formatDate(event.createdAt, locale)}</time>
                      <div>
                        <strong>{event.label}</strong>
                        <span>{event.urlPath}</span>
                        {event.pageTitle ? <small>{event.pageTitle}</small> : null}
                        {event.properties.length ? (
                          <dl>
                            {event.properties.map(property => (
                              <div key={property.key}>
                                <dt>{property.key}</dt>
                                <dd>{property.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>
                  {t(
                    'No events match the inherited evidence context.',
                    'Нет событий, соответствующих унаследованному контексту.',
                  )}
                </p>
              )}
              {evidence.hasNextPage ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={evidence.isFetchingNextPage}
                  onClick={() => evidence.fetchNextPage()}
                >
                  {evidence.isFetchingNextPage
                    ? t('Loading more activity…', 'Загрузка активности…')
                    : t('Load more activity', 'Загрузить ещё')}
                </button>
              ) : null}
            </section>
            <aside className={styles.rail}>
              <section className={styles.panel}>
                <p className={styles.eyebrow}>{t('Performance', 'Производительность')}</p>
                <h2>
                  <Gauge aria-hidden="true" size={18} />{' '}
                  {t('Observed Web Vitals', 'Наблюдаемые Web Vitals')}
                </h2>
                <dl className={styles.metrics}>
                  <div>
                    <dt>LCP</dt>
                    <dd>{metric(first.performance.lcp, locale)}</dd>
                  </div>
                  <div>
                    <dt>INP</dt>
                    <dd>{metric(first.performance.inp, locale)}</dd>
                  </div>
                  <div>
                    <dt>CLS</dt>
                    <dd>{metric(first.performance.cls, locale, '')}</dd>
                  </div>
                </dl>
                <p>
                  {locale === 'en-US'
                    ? first.performance.definition
                    : 'Метрики отражают наблюдаемые значения выбранной сессии.'}
                </p>
                <Link href={`/websites/${projectId}/performance?${compatible}`}>
                  {t(
                    'Open compatible performance context',
                    'Открыть совместимый контекст производительности',
                  )}
                </Link>
              </section>
              <section className={styles.panel}>
                <p className={styles.eyebrow}>{t('Replay', 'Запись сессии')}</p>
                <h2>{t('Privacy-aware playback', 'Воспроизведение с защитой данных')}</h2>
                <ReplayState
                  state={first.replay.state}
                  maskLevel={first.replay.maskLevel}
                  locale={locale}
                />
                {first.replay.state === 'available' ? (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => setLoadReplay(true)}
                    disabled={loadReplay}
                  >
                    <Play aria-hidden="true" size={16} />{' '}
                    {loadReplay
                      ? t('Replay requested', 'Запись запрошена')
                      : t('Load replay', 'Загрузить запись')}
                  </button>
                ) : null}
                {replay.error ? (
                  <p role="alert">
                    {t(
                      'Replay could not be loaded with the current capability.',
                      'Текущие права не позволяют загрузить запись сессии.',
                    )}
                  </p>
                ) : null}
                {replay.data ? (
                  <>
                    <p>
                      {replay.data.eventCount.toLocaleString(locale)}{' '}
                      {t('replay events', 'событий записи')} ·{' '}
                      {replay.data.chunkCount.toLocaleString(locale)} {t('chunks', 'фрагментов')}
                      {replay.data.bounded ? t(' · bounded', ' · ограничено') : ''}
                    </p>
                    <ReplayPlayer events={replay.data.events} />
                  </>
                ) : null}
              </section>
              <section className={styles.panel}>
                <p className={styles.eyebrow}>{t('Compatible handoff', 'Совместимый переход')}</p>
                <h2>{t('Heatmap context', 'Контекст тепловой карты')}</h2>
                <p>
                  {t(
                    'Only date range and URL path are inherited. Identity-only filters are deliberately excluded.',
                    'Наследуются только диапазон дат и путь URL. Фильтры идентичности намеренно исключены.',
                  )}
                </p>
                <Link href={`/websites/${projectId}/heatmaps?${compatible}`}>
                  {t(
                    'Open compatible heatmap context',
                    'Открыть совместимый контекст тепловой карты',
                  )}
                </Link>
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </main>
  );
}

function ReplayState({
  state,
  maskLevel,
  locale,
}: {
  state: string;
  maskLevel: string;
  locale: string;
}) {
  const isEnglish = locale === 'en-US';
  const message =
    state === 'permission-denied'
      ? isEnglish
        ? 'Replay requires a separate replay capability.'
        : 'Для записи сессии требуется отдельное право.'
      : state === 'recording-disabled'
        ? isEnglish
          ? 'Replay recording was disabled for this project.'
          : 'Запись сессий отключена для этого проекта.'
        : state === 'unavailable'
          ? isEnglish
            ? 'No replay chunks are available for this session.'
            : 'Для этой сессии нет доступных фрагментов записи.'
          : isEnglish
            ? `Replay is available with ${maskLevel} masking.`
            : `Запись доступна с уровнем маскирования «${maskLevel}».`;
  return (
    <p className={styles.replayState} data-state={state}>
      {message}
    </p>
  );
}
