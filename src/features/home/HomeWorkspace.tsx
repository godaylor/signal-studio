'use client';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useGuestWorkspace } from '@/features/guest/GuestWorkspaceContext';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { getStudioPath } from '@/features/studio-shell/navigation';
import { StudioState } from '@/features/studio-shell/StudioState';
import { DataValue } from '@/features/visual/DataValue';
import { useSceneEntrance } from '@/features/visual/useSceneEntrance';
import type { AnalysisBreakdownRow } from '@/server/analytics/contracts';
import { serializeAnalysisQuery } from '@/server/analytics/url-codec';
import type { HomeMetric, HomeSnapshot } from '@/server/home/contracts';
import styles from './HomeWorkspace.module.css';
import { ProductFlow } from './ProductFlow';
import { useHome } from './useHome';

function href(metric: HomeMetric) {
  return `${getStudioPath(metric.query.projectId, 'explore')}?${serializeAnalysisQuery(metric.query)}`;
}

export function HomeWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const { t, locale } = useStudioLocale();
  const headingEntrance = useSceneEntrance<HTMLElement>();
  const lifecycleEntrance = useSceneEntrance<HTMLElement>(100);
  const metricsEntrance = useSceneEntrance<HTMLElement>();
  const guest = useGuestWorkspace();
  const home = useHome(projectId);
  const data = home.data;
  const date = (value: string) =>
    new Date(value).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'short' });
  const range = (value: { startAt: string; endAt: string }) =>
    `${date(value.startAt)} — ${date(new Date(new Date(value.endAt).getTime() - 1).toISOString())} · UTC`;
  const names: Record<string, string> = {
    activation: t('Activation', 'Активация'),
    retention: t('Retention', 'Удержание'),
    signups: t('Signed up', 'Зарегистрировались'),
    users: t('Weekly active users', 'Активные пользователи за неделю'),
    accounts: t('Weekly active accounts', 'Активные аккаунты за неделю'),
  };
  const adoption = data?.metrics.find(item => item.id === 'adoption');
  const activation = data?.metrics.find(item => item.id === 'activation');
  const activationTotal = activation?.result?.data.total;
  return (
    <section className={styles.page}>
      <header className={styles.heading} ref={headingEntrance}>
        <div>
          <p className={styles.eyebrow}>
            {projectName} / {t('First value', 'Первая ценность')}
          </p>
          <h1>{t('How do users find value?', 'Как пользователи находят ценность?')}</h1>
          <p>
            {activationTotal?.denominator != null
              ? t(
                  `${activationTotal.value.toLocaleString(locale)} of ${activationTotal.denominator.toLocaleString(locale)} new users used the core feature within seven days of signup.`,
                  `${activationTotal.value.toLocaleString(locale)} из ${activationTotal.denominator.toLocaleString(locale)} новых пользователей использовали основную функцию за семь дней после регистрации.`,
                )
              : t(
                  'Follow the path from signup to a lasting habit.',
                  'Проследите путь от регистрации до привычки пользоваться.',
                )}
          </p>
          <div className={styles.heroDecision}>
            <div className={styles.heroValue}>
              <strong>
                <DataValue
                  value={
                    activationTotal?.rate == null
                      ? '—'
                      : activationTotal.rate.toLocaleString(locale, {
                          style: 'percent',
                          maximumFractionDigits: 1,
                        })
                  }
                />
              </strong>
              <span>{t('Activation', 'Активация')}</span>
            </div>
            <Link
              className={styles.primaryAction}
              href={activation ? href(activation) : getStudioPath(projectId, 'explore')}
            >
              {t('Explore the journey', 'Исследовать путь')}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className={styles.dashboardLink} href={getStudioPath(projectId, 'dashboards')}>
              {t('Open dashboard', 'Открыть дашборд')}
            </Link>
          </div>
        </div>
      </header>
      {home.isPending ? (
        <StudioState
          variant="loading"
          title={t('Loading product health', 'Загружаем обзор продукта')}
          message={t(
            'Calculating metrics and recent work.',
            'Считаем метрики и загружаем недавнюю работу.',
          )}
        />
      ) : home.isError || !data ? (
        <StudioState
          variant="error"
          title={t('Home could not be loaded', 'Не удалось загрузить главную')}
          message={t('Check your connection and retry.', 'Проверьте соединение и повторите.')}
          action={
            <button type="button" onClick={() => home.refetch()}>
              {t('Retry', 'Повторить')}
            </button>
          }
        />
      ) : (
        <>
          <section
            aria-labelledby="home-lifecycle"
            className={styles.lifecycle}
            ref={lifecycleEntrance}
          >
            <header className={styles.sectionHeading}>
              <div>
                <h2 id="home-lifecycle">
                  {t('Signup → activation → return', 'Регистрация → активация → возвращение')}
                </h2>
              </div>
              <span>{range(data.cohortRange)}</span>
            </header>
            <ProductFlow metrics={data.metrics} />
            <details className={styles.explanation}>
              <summary>{t('How this journey is measured', 'Как рассчитывается этот путь')}</summary>
              <p>
                {t(
                  'Mature signup cohort: a complete 21-day horizon. Seven days to activate, then repeat core feature use 7–14 days after activation. This is observed behavior, not a stored lifecycle label.',
                  'Зрелая когорта регистраций: полное окно 21 день. Семь дней на активацию, затем повторное использование основной функции через 7–14 дней. Это наблюдаемое поведение, а не сохранённая метка стадии.',
                )}
              </p>
            </details>
          </section>
          <ProductHealth
            data={data}
            synthetic={!!guest}
            refreshing={home.isFetching}
            onRefresh={() => home.refetch()}
          />
          <section aria-labelledby="home-week" className={styles.section} ref={metricsEntrance}>
            <header className={styles.sectionHeading}>
              <h2 id="home-week">{t('Last completed week', 'Последняя полная неделя')}</h2>
              <span>{range(data.activeRange)}</span>
            </header>
            <div className={styles.metrics}>
              {data.metrics
                .filter(
                  metric =>
                    ['users', 'accounts'].includes(metric.id) || metric.id.startsWith('revenue:'),
                )
                .map(metric => (
                  <Metric
                    key={metric.id}
                    metric={metric}
                    label={
                      names[metric.id] ??
                      `${t('Tracked revenue', 'Отслеживаемая выручка')} · ${metric.query.measure.property}`
                    }
                  />
                ))}
            </div>
            {!data.metrics.some(metric => metric.id.startsWith('revenue:')) ? (
              <p>
                {t(
                  'No tracked revenue in this period.',
                  'За этот период нет отслеживаемой выручки.',
                )}
              </p>
            ) : null}
            {data.currenciesTruncated ? (
              <p role="status">
                {t(
                  'Partial: first five currencies. Explore another currency in Explore.',
                  'Частично: первые пять валют. Другие валюты доступны в анализе.',
                )}
              </p>
            ) : null}
          </section>
          <div className={styles.columns}>
            <section className={styles.section} aria-labelledby="home-adoption">
              <header className={styles.sectionHeading}>
                <h2 id="home-adoption">{t('Feature adoption', 'Использование функций')}</h2>
              </header>
              {adoption?.result ? (
                <>
                  <table>
                    <caption>
                      {t(
                        'Top events by distinct users',
                        'Популярные события по уникальным пользователям',
                      )}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('Event', 'Событие')}</th>
                        <th scope="col">{t('Users', 'Пользователи')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(adoption.result.data.rows as AnalysisBreakdownRow[]).map(row => (
                        <tr key={row.key}>
                          <th scope="row">{row.key}</th>
                          <td>{row.value.toLocaleString(locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!adoption.result.data.rows.length ? (
                    <p>
                      {t(
                        'No identified feature use in this week.',
                        'За эту неделю нет использования функций с известными пользователями.',
                      )}
                    </p>
                  ) : null}
                  <Link className={styles.open} href={href(adoption)}>
                    {t('Explore feature adoption', 'Анализировать использование функций')}{' '}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <p>
                  {t(
                    'Feature use is unavailable. Refresh to retry.',
                    'Использование функций недоступно. Обновите страницу.',
                  )}
                </p>
              )}
            </section>
            <section className={styles.section} aria-labelledby="home-risk">
              <header className={styles.sectionHeading}>
                <h2 id="home-risk">{t('At-risk accounts', 'Аккаунты с риском оттока')}</h2>
              </header>
              <p>
                {t(
                  'Previously active, now quiet for seven days.',
                  'Раньше были активны, теперь не заходят семь дней.',
                )}
              </p>
              {!data.atRisk.permitted ? (
                <p>
                  {t(
                    'Your role cannot view account identities. No account data was loaded.',
                    'Ваша роль не разрешает просмотр аккаунтов. Данные аккаунтов не загружались.',
                  )}
                </p>
              ) : !data.atRisk.accounts.length ? (
                <p>
                  {t(
                    'No accounts match this inactivity definition.',
                    'Нет аккаунтов, соответствующих этому определению неактивности.',
                  )}
                </p>
              ) : (
                <ul className={styles.list}>
                  {data.atRisk.accounts.map(account => (
                    <li key={account.id}>
                      <Link
                        href={
                          getStudioPath(projectId, 'audiences') +
                          '?view=accounts&profileEntity=account&profileId=' +
                          account.id
                        }
                      >
                        {account.label}
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </Link>
                      <span>
                        {t('Last activity', 'Последняя активность')}: {date(account.lastSeenAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <details className={styles.explanation}>
                <summary>{t('Definition', 'Определение')}</summary>
                <p>
                  {t(
                    'Up to ten observed accounts inactive for seven elapsed days. An inactivity signal, not a churn prediction.',
                    'До десяти наблюдаемых аккаунтов без активности семь полных дней. Признак неактивности, а не прогноз оттока.',
                  )}
                </p>
              </details>
            </section>
          </div>
          <section className={styles.section} aria-labelledby="home-recent">
            <header className={styles.sectionHeading}>
              <h2 id="home-recent">
                {t('Recent Insights and notes', 'Недавние анализы и заметки')}
              </h2>
              <Link href={getStudioPath(projectId, 'explore')}>
                {t('Open Explore', 'Открыть анализ')} →
              </Link>
            </header>
            {!data.recent.length ? (
              <p>
                {t(
                  'Save an Insight in Explore to keep your finding here.',
                  'Сохраните результат анализа, чтобы видеть вывод здесь.',
                )}
              </p>
            ) : (
              <ul className={styles.recent}>
                {data.recent.map(insight => (
                  <li key={insight.id}>
                    <div>
                      {insight.query ? (
                        <Link
                          href={
                            getStudioPath(projectId, 'explore') +
                            '?' +
                            serializeAnalysisQuery(insight.query) +
                            '&insight=' +
                            insight.id
                          }
                        >
                          {insight.title}
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </Link>
                      ) : (
                        <span>
                          {insight.title} ·{' '}
                          {t('Unsupported saved definition', 'Неподдерживаемое определение')}
                        </span>
                      )}
                      {insight.description ? <p>{insight.description}</p> : null}
                    </div>
                    <span>{date(insight.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className={styles.timestamp}>
            {t('Computed', 'Вычислено')}: {new Date(data.generatedAt).toLocaleString(locale)} ·{' '}
            {t(
              'Exact metrics · definitions available for each result',
              'Точные метрики · определения доступны для каждого результата',
            )}
          </p>
        </>
      )}
    </section>
  );
}

function ProductHealth({
  data,
  synthetic,
  refreshing,
  onRefresh,
}: {
  data: HomeSnapshot;
  synthetic: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t, locale } = useStudioLocale();
  return (
    <section className={styles.health} aria-label={t('Data health', 'Состояние данных')}>
      <span
        className={styles.healthDot}
        data-state={synthetic ? 'synthetic' : data.health.state}
        aria-hidden="true"
      />
      <div>
        <strong>
          {synthetic
            ? t('Fixed synthetic dataset', 'Фиксированный синтетический набор')
            : data.health.state === 'empty'
              ? t('No observed events yet', 'События ещё не поступали')
              : data.health.state === 'stale'
                ? t('No new events in 24h', 'Нет новых событий за 24 ч')
                : t('Events are arriving', 'События поступают')}
        </strong>
        <span>
          {data.health.lastEventAt
            ? `${t('Last event', 'Последнее событие')}: ${new Date(data.health.lastEventAt).toLocaleString(locale)}`
            : t('Connect a source to begin.', 'Подключите источник, чтобы начать.')}
        </span>
      </div>
      <details>
        <summary>{t('Details', 'Подробнее')}</summary>
        <p>
          {t('Stored events / 24h', 'Сохранено событий / 24 ч')}:{' '}
          {data.health.observedEvents24h.toLocaleString(locale)}.{' '}
          {t(
            'Delivery loss is unknown; stored events are not client delivery receipts.',
            'Потери доставки неизвестны: сохранённые события не подтверждают все отправки клиента.',
          )}
        </p>
      </details>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label={t('Refresh', 'Обновить')}
      >
        <RefreshCw size={16} aria-hidden="true" />
      </button>
    </section>
  );
}

function Metric({
  metric,
  label,
  rate = false,
}: {
  metric: HomeMetric;
  label: string;
  rate?: boolean;
}) {
  const { t, locale } = useStudioLocale();
  const total = metric.result?.data.total;
  const previous = metric.result?.data.comparisonTotal;
  const value = rate ? total?.rate : total?.value;
  const comparison = rate ? previous?.rate : previous?.value;
  const number = (value: number) =>
    new Intl.NumberFormat(
      locale,
      rate ? { style: 'percent', maximumFractionDigits: 1 } : { maximumFractionDigits: 4 },
    ).format(value);
  return (
    <article className={styles.metric}>
      <h3>
        <Link href={href(metric)}>
          {label}
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </h3>
      <strong>{value == null ? '—' : number(value)}</strong>
      <p>
        {metric.error
          ? t('Unavailable · refresh to retry', 'Недоступно · обновите для повтора')
          : value == null
            ? t('No eligible denominator', 'Нет подходящего знаменателя')
            : rate
              ? `${total?.value} / ${total?.denominator}`
              : t('Exact range total', 'Точный итог диапазона')}
      </p>
      <p>
        {t('Previous period', 'Предыдущий период')}: {comparison == null ? '—' : number(comparison)}
        {value != null && comparison != null
          ? ` · Δ ${new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'always' }).format((value - comparison) * (rate ? 100 : 1))}${rate ? t(' pp', ' п. п.') : ''}`
          : ''}
      </p>
      <details>
        <summary>{t('Definition', 'Определение')}</summary>
        <p>
          {rate
            ? t(
                'Observed signup cohort with the complete 21-day horizon. Activation divides activated users by signups; retention divides retained users by activated users.',
                'Когорта регистраций с полным окном 21 день. Активация — доля активированных среди зарегистрированных; удержание — доля вернувшихся среди активированных.',
              )
            : metric.query.measure.source === 'revenue'
              ? t(
                  'Recorded revenue in this currency only. No conversion; refunds keep their sign.',
                  'Сохранённая выручка только в этой валюте. Без конвертации; возвраты сохраняют знак.',
                )
              : metric.id === 'accounts'
                ? t(
                    'Distinct current membership accounts with custom-event activity. Membership is not historical.',
                    'Уникальные аккаунты текущего членства с пользовательскими событиями. Членство не историческое.',
                  )
                : t(
                    'Distinct tracked users with custom-event activity. Anonymous sessions are excluded.',
                    'Уникальные отслеживаемые пользователи с пользовательскими событиями. Анонимные сессии исключены.',
                  )}
        </p>
      </details>
      <Link className={styles.open} href={href(metric)}>
        {t('Open definition in Explore', 'Открыть определение в анализе')}
      </Link>
    </article>
  );
}
