'use client';

import { Activity, CirclePause, CirclePlay, RefreshCw, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import type { LiveSnapshot } from '@/server/live/contracts';
import styles from './LiveWorkspace.module.css';
import { useLiveSnapshot } from './useLiveSnapshot';

const ROW_HEIGHT = 58;
const MAX_STREAM_HEIGHT = 464;

function formatTime(value: string | null | undefined, locale: string) {
  if (!value) return locale === 'en-US' ? 'No recent event' : 'Нет недавних событий';
  return new Date(value).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return locale === 'en-US' ? 'No recent event' : 'Нет недавних событий';
  return new Date(value).toLocaleString(locale);
}

function StreamRow({
  index,
  style,
  rows,
  projectId,
  locale,
}: RowComponentProps<{ rows: LiveSnapshot['activity']; projectId: string; locale: string }>) {
  const isEnglish = locale === 'en-US';
  const row = rows[index];
  const label =
    row.eventName ?? row.urlPath ?? (isEnglish ? 'Observed activity' : 'Наблюдаемая активность');
  return (
    <div className={styles.streamRow} style={style} role="listitem">
      <time dateTime={row.createdAt ?? undefined}>{formatTime(row.createdAt, locale)}</time>
      <span className={styles.eventType}>{row.type}</span>
      <div>
        <strong>{label}</strong>
        <small>
          {[row.country, row.browser, row.device].filter(Boolean).join(' · ') ||
            (isEnglish ? 'Anonymous context' : 'Анонимный контекст')}
        </small>
      </div>
      <Link
        href={`/studio/${projectId}/experience?sessionId=${encodeURIComponent(row.sessionId)}&returnTo=${encodeURIComponent(`/studio/${projectId}/live`)}`}
      >
        {isEnglish ? 'Inspect' : 'Открыть'}
      </Link>
    </div>
  );
}

export function LiveWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const { locale, t } = useStudioLocale();
  const [paused, setPaused] = useState(false);
  const query = useLiveSnapshot(projectId, paused);
  const snapshot = query.data;
  const state = paused
    ? t('Paused', 'Приостановлено')
    : !query.visible
      ? t('Tab hidden · polling stopped', 'Вкладка скрыта · опрос остановлен')
      : query.error
        ? t('Connection interrupted', 'Соединение прервано')
        : query.isFetching && snapshot
          ? t('Refreshing', 'Обновление')
          : snapshot
            ? snapshot?.transport.kind === 'sse'
              ? t('Connected · event stream', 'Подключено · поток событий')
              : t('Connected · adaptive polling', 'Подключено · адаптивный опрос')
            : t('Connecting', 'Подключение');

  if (query.isPending && !snapshot) {
    return (
      <main className={styles.workspace}>
        <header className={styles.heading}>
          <p>
            {t('Live signal', 'Сигнал сейчас')} · {projectName}
          </p>
          <h1>{t('Current activity', 'Текущая активность')}</h1>
        </header>
        <section className={styles.state} role="status">
          <RefreshCw aria-hidden="true" size={19} />
          <div>
            <h2>{t('Building the first snapshot', 'Формируем первый снимок')}</h2>
            <p>
              {t(
                'Loading one bounded 30-minute view for all Live instruments.',
                'Загружаем ограниченное 30-минутное окно для всех инструментов раздела.',
              )}
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (query.error && !snapshot) {
    return (
      <main className={styles.workspace}>
        <header className={styles.heading}>
          <p>
            {t('Live signal', 'Сигнал сейчас')} · {projectName}
          </p>
          <h1>{t('Current activity', 'Текущая активность')}</h1>
        </header>
        <section className={styles.state} role="alert">
          <Activity aria-hidden="true" size={20} />
          <div>
            <h2>{t('Live snapshot unavailable', 'Снимок активности недоступен')}</h2>
            <p>
              {t(
                'No valid snapshot has arrived yet. Historical analytics are unaffected.',
                'Корректный снимок пока не получен. Историческая аналитика не затронута.',
              )}
            </p>
            <button type="button" onClick={() => query.refetch()}>
              {t('Retry connection', 'Повторить подключение')}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!snapshot) return null;

  const streamHeight = Math.min(snapshot.activity.length * ROW_HEIGHT, MAX_STREAM_HEIGHT);

  return (
    <main className={styles.workspace}>
      <header className={styles.heading}>
        <div>
          <p>
            {t('Live signal', 'Сигнал сейчас')} · {projectName}
          </p>
          <h1>{t('Current activity', 'Текущая активность')}</h1>
          <span>
            {t(
              'One timestamped snapshot powers every instrument below. Window: trailing 30 minutes, UTC.',
              'Все инструменты ниже используют один снимок с отметкой времени. Окно: последние 30 минут, UTC.',
            )}
          </span>
        </div>
        <div className={styles.controls}>
          <button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused}>
            {paused ? (
              <CirclePlay aria-hidden="true" size={17} />
            ) : (
              <CirclePause aria-hidden="true" size={17} />
            )}
            {paused ? t('Resume live view', 'Продолжить') : t('Pause live view', 'Приостановить')}
          </button>
          <button type="button" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw aria-hidden="true" size={16} /> {t('Refresh now', 'Обновить сейчас')}
          </button>
        </div>
      </header>

      <section
        className={styles.signalRail}
        aria-label={t('Live transport state', 'Состояние обновления')}
        tabIndex={0}
      >
        <span
          className={styles.signalDot}
          data-state={query.error ? 'error' : paused ? 'paused' : 'live'}
          aria-hidden="true"
        />
        <strong aria-live="polite">{state}</strong>
        <span>
          {t('Snapshot', 'Снимок')}{' '}
          <time dateTime={snapshot.generatedAt}>{formatTime(snapshot.generatedAt, locale)}</time>
        </span>
        <span>
          {t('Data through', 'Данные по')}{' '}
          <time dateTime={snapshot.freshnessAt ?? undefined}>
            {formatTime(snapshot.freshnessAt, locale)}
          </time>
        </span>
        <span>
          {snapshot.cache === 'miss'
            ? t('Fresh query', 'Новый запрос')
            : t('Shared snapshot', 'Общий снимок')}
        </span>
      </section>

      {query.error ? (
        <p className={styles.warning} role="alert">
          {t(
            'Connection interrupted. Showing the last valid snapshot from',
            'Соединение прервано. Показан последний корректный снимок от',
          )}{' '}
          {formatDateTime(snapshot.generatedAt, locale)}.
          <button type="button" onClick={() => query.refetch()}>
            {t('Retry', 'Повторить')}
          </button>
        </p>
      ) : null}

      <section
        className={styles.metrics}
        aria-label={t('Current activity totals', 'Итоги текущей активности')}
      >
        <div>
          <span>{t('Active users', 'Активные пользователи')}</span>
          <strong>{snapshot.totals.activeUsers.toLocaleString(locale)}</strong>
          <small>{t('identified in window', 'определены в окне')}</small>
        </div>
        <div>
          <span>{t('Active accounts', 'Активные аккаунты')}</span>
          <strong>{snapshot.totals.activeAccounts.toLocaleString(locale)}</strong>
          <small>{t('linked in window', 'связаны в окне')}</small>
        </div>
        <div>
          <span>{t('Visitors', 'Посетители')}</span>
          <strong>{snapshot.totals.visitors.toLocaleString(locale)}</strong>
          <small>{t('distinct sessions', 'уникальные сессии')}</small>
        </div>
        <div>
          <span>{t('Events', 'События')}</span>
          <strong>{snapshot.totals.events.toLocaleString(locale)}</strong>
          <small>{t('custom events', 'пользовательские события')}</small>
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <header className={styles.panelHeading}>
            <div>
              <p>{t('Velocity table', 'Таблица интенсивности')}</p>
              <h2>{t('Minute-by-minute signal', 'Сигнал по минутам')}</h2>
            </div>
            <Activity aria-hidden="true" size={20} />
          </header>
          {snapshot.series.views.length ? (
            <div className={styles.tableScroll}>
              <table>
                <caption>
                  {t(
                    'Equivalent tabular summary of views and visitors in each UTC minute.',
                    'Табличное представление просмотров и посетителей по минутам UTC.',
                  )}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t('Minute (UTC)', 'Минута (UTC)')}</th>
                    <th scope="col">{t('Views', 'Просмотры')}</th>
                    <th scope="col">{t('Visitors', 'Посетители')}</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.series.views.map((point, index) => (
                    <tr key={`${point.time}:${index}`}>
                      <th scope="row">{formatTime(point.time, locale)}</th>
                      <td>{point.value.toLocaleString(locale)}</td>
                      <td>
                        {(snapshot.series.visitors[index]?.value ?? 0).toLocaleString(locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>
              {t(
                'No minute-level activity in the current window.',
                'В текущем окне нет поминутной активности.',
              )}
            </p>
          )}
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHeading}>
            <div>
              <p>{t('Changing behavior', 'Изменения поведения')}</p>
              <h2>
                {t('Current 15 min vs previous 15 min', 'Текущие 15 минут к предыдущим 15 минутам')}
              </h2>
            </div>
            <UsersRound aria-hidden="true" size={20} />
          </header>
          {snapshot.topBehaviors.length ? (
            <ol className={styles.behaviors}>
              {snapshot.topBehaviors.map(item => (
                <li key={item.key}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>
                      {item.current.toLocaleString(locale)} {t('now', 'сейчас')} ·{' '}
                      {item.previous.toLocaleString(locale)} {t('before', 'ранее')}
                    </span>
                  </div>
                  <b
                    data-direction={
                      item.changePercent != null && item.changePercent < 0 ? 'down' : 'up'
                    }
                  >
                    {item.changePercent == null
                      ? t('New', 'Новое')
                      : `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toLocaleString(locale)}%`}
                  </b>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>
              {t(
                'No behaviors have changed in the current window.',
                'В текущем окне изменения поведения не обнаружены.',
              )}
            </p>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <header className={styles.panelHeading}>
          <div>
            <p>{t('Bounded activity stream', 'Ограниченный поток активности')}</p>
            <h2>{t('Recent observations', 'Недавние наблюдения')}</h2>
          </div>
          <span>
            {snapshot.activity.length.toLocaleString(locale)} / {t('100 max', 'максимум 100')}
          </span>
        </header>
        {snapshot.activity.length ? (
          <List
            aria-label={t('Recent live activity', 'Недавняя активность')}
            tabIndex={0}
            rowComponent={StreamRow}
            rowCount={snapshot.activity.length}
            rowHeight={ROW_HEIGHT}
            rowProps={{ rows: snapshot.activity, projectId, locale }}
            defaultHeight={streamHeight}
            style={{ width: '100%', height: streamHeight }}
          />
        ) : (
          <p className={styles.empty}>
            {t(
              'No activity has arrived in the trailing 30-minute window.',
              'За последние 30 минут активность не поступала.',
            )}
          </p>
        )}
      </section>

      <p className={styles.definition}>
        {locale === 'en-US'
          ? snapshot.definitions.lateArrivals
          : 'События, поступившие с задержкой, появятся в следующем снимке соответствующего окна.'}
      </p>
    </main>
  );
}
