'use client';
import Link from 'next/link';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { getStudioPath } from '@/features/studio-shell/navigation';
import { StudioState } from '@/features/studio-shell/StudioState';
import type { AnalysisBreakdownRow } from '@/server/analytics/contracts';
import { serializeAnalysisQuery } from '@/server/analytics/url-codec';
import type { HomeMetric } from '@/server/home/contracts';
import styles from './HomeWorkspace.module.css';
import { useHome } from './useHome';

function href(metric: HomeMetric) {
  return (
    getStudioPath(metric.query.projectId, 'explore') + '?' + serializeAnalysisQuery(metric.query)
  );
}
export function HomeWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const { t, locale } = useStudioLocale();
  const home = useHome(projectId);
  const data = home.data;
  const date = (value: string) => new Date(value).toLocaleDateString(locale, { timeZone: 'UTC' });
  const range = (value: { startAt: string; endAt: string }) =>
    `[${date(value.startAt)}, ${date(value.endAt)}) · UTC`;
  const names: Record<string, string> = {
    activation: t('Activation', 'Активация'),
    retention: t('Retention', 'Удержание'),
    signups: t('Signed up', 'Зарегистрировались'),
    users: t('Weekly active users', 'Активные пользователи за неделю'),
    accounts: t('Weekly active accounts', 'Активные аккаунты за неделю'),
  };
  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <p>{projectName}</p>
        <h1>{t('Home', 'Главная')}</h1>
        <p>
          {t(
            'From signup to lasting product use.',
            'От регистрации к регулярному использованию продукта.',
          )}
        </p>
      </header>
      {home.isPending ? (
        <StudioState
          variant="loading"
          title={t('Loading product health', 'Загружаем обзор продукта')}
          message={t(
            'Calculating defined metrics and recent work.',
            'Вычисляем метрики и загружаем недавнюю работу.',
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
          <section className={styles.health} aria-labelledby="home-health">
            <div>
              <h2 id="home-health">{t('Data health', 'Состояние данных')}</h2>
              {data.health.state === 'empty' ? <Link href={getStudioPath(projectId, 'sources')}>{t('Connect your website to get started', 'Подключите сайт, чтобы начать')}</Link> : null}
              <p>
                {data.health.state === 'empty'
                  ? t('No observed events yet', 'События ещё не поступали')
                  : data.health.state === 'stale'
                    ? t(
                        'No events observed in the last 24 hours',
                        'За последние 24 часа событий не было',
                      )
                    : t(
                        'Events observed in the last 24 hours',
                        'За последние 24 часа поступали события',
                      )}
              </p>
              <p>
                {t('Observed events / 24h', 'События / 24 ч')}:{' '}
                {data.health.observedEvents24h.toLocaleString(locale)} ·{' '}
                {t('Last event', 'Последнее событие')}:{' '}
                {data.health.lastEventAt
                  ? new Date(data.health.lastEventAt).toLocaleString(locale)
                  : '—'}
              </p>
              <p>
                {t(
                  'Delivery loss is unknown: this counts stored events, not client delivery receipts.',
                  'Потери доставки неизвестны: здесь подсчитаны сохранённые события, а не подтверждения отправки клиента.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => home.refetch()}
              aria-disabled={home.isFetching}
              disabled={home.isFetching}
            >
              {t('Refresh', 'Обновить')}
            </button>
          </section>
          <section aria-labelledby="home-lifecycle" className={styles.section}>
            <h2 id="home-lifecycle">
              {t('Signup → activated → retained', 'Регистрация → активация → удержание')}
            </h2>
            <p>
              {t('Mature signup cohort', 'Зрелая когорта регистраций')}: {range(data.cohortRange)}
            </p>
            <p>
              {t(
                'A complete 21-day horizon: seven days to activate, then repeat core feature use 7–14 days after activation. This is observed behavior, not a stored lifecycle label.',
                'Полное окно 21 день: семь дней на активацию, затем повторное использование основной функции через 7–14 дней. Это наблюдаемое поведение, а не сохранённая метка стадии.',
              )}
            </p>
            <ol className={styles.spine}>
              {['signups', 'activation', 'retention'].map(id => {
                const metric = data.metrics.find(item => item.id === id);
                if (!metric) return null;
                const total = metric.result?.data.total;
                return (
                  <li key={id}>
                    <Link href={href(metric)}>
                      <span>{names[id]}</span>
                      <strong>{total ? total.value.toLocaleString(locale) : '—'}</strong>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <div className={styles.metrics}>
              {data.metrics
                .filter(metric => ['activation', 'retention'].includes(metric.id))
                .map(metric => (
                  <Metric key={metric.id} metric={metric} label={names[metric.id]} rate />
                ))}
            </div>
          </section>
          <section aria-labelledby="home-week" className={styles.section}>
            <h2 id="home-week">{t('Last completed week', 'Последняя полная неделя')}</h2>
            <p>{range(data.activeRange)}</p>
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
                      t('Tracked revenue', 'Отслеживаемая выручка') +
                        ' · ' +
                        metric.query.measure.property
                    }
                  />
                ))}
            </div>
            {!data.metrics.some(metric => metric.id.startsWith('revenue:')) ? (
              <p>
                {t(
                  'No tracked currency in this week or its comparison. Configure revenue events to see a defined currency total.',
                  'За эту и предыдущую неделю нет выручки с известной валютой. Настройте события выручки, чтобы увидеть итог по валюте.',
                )}
              </p>
            ) : null}
            {data.currenciesTruncated ? (
              <p role="status">
                {t(
                  'Partial: the first five currencies are shown. Use Explore for another currency.',
                  'Частично: показаны первые пять валют. Другую валюту можно открыть в анализе.',
                )}
              </p>
            ) : null}
          </section>
          <div className={styles.columns}>
            <section className={styles.section} aria-labelledby="home-adoption">
              <h2 id="home-adoption">{t('Feature adoption', 'Использование функций')}</h2>
              <p>
                {t(
                  'Top 10 event names by distinct tracked users. Users can use more than one feature.',
                  '10 событий с наибольшим числом отслеживаемых пользователей. Один пользователь может использовать несколько функций.',
                )}
              </p>
              {(() => {
                const metric = data.metrics.find(item => item.id === 'adoption');
                return metric?.result ? (
                  <>
                    <table>
                      <caption>
                        {t('Observed feature use', 'Наблюдаемое использование функций')}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('Event', 'Событие')}</th>
                          <th scope="col">{t('Users', 'Пользователи')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(metric.result.data.rows as AnalysisBreakdownRow[]).map(row => (
                          <tr key={row.key}>
                            <th scope="row">{row.key}</th>
                            <td>{row.value.toLocaleString(locale)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!metric.result.data.rows.length ? (
                      <p>
                        {t(
                          'No identified feature use in this week.',
                          'За эту неделю нет использования функций с известными пользователями.',
                        )}
                      </p>
                    ) : null}
                    <Link href={href(metric)}>
                      {t('Explore feature adoption', 'Анализировать использование функций')}
                    </Link>
                  </>
                ) : (
                  <p>
                    {t(
                      'Feature adoption is unavailable. Refresh to retry.',
                      'Использование функций недоступно. Обновите страницу для повтора.',
                    )}
                  </p>
                );
              })()}
            </section>
            <section className={styles.section} aria-labelledby="home-risk">
              <h2 id="home-risk">{t('At-risk accounts', 'Аккаунты с риском оттока')}</h2>
              <p>
                {t(
                  'Up to 10 previously observed accounts inactive for seven elapsed days. An inactivity signal, not a churn prediction.',
                  'До 10 ранее наблюдавшихся аккаунтов без активности семь дней. Признак неактивности, не прогноз оттока.',
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
                      </Link>
                      <span>
                        {t('Last activity', 'Последняя активность')}: {date(account.lastSeenAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <section className={styles.section} aria-labelledby="home-recent">
            <h2 id="home-recent">
              {t('Recent Insights and notes', 'Недавние Insights и заметки')}
            </h2>
            {!data.recent.length ? (
              <p>
                {t(
                  'Save an Insight in Explore to keep your finding here.',
                  'Сохраните Insight в анализе, чтобы видеть вывод здесь.',
                )}
              </p>
            ) : (
              <ul className={styles.list}>
                {data.recent.map(insight => (
                  <li key={insight.id}>
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
                      </Link>
                    ) : (
                      <span>
                        {insight.title} ·{' '}
                        {t('Unsupported saved definition', 'Неподдерживаемое определение')}
                      </span>
                    )}
                    {insight.description ? <p>{insight.description}</p> : null}
                    <span>{date(insight.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className={styles.timestamp}>
            {t('Computed', 'Вычислено')}: {new Date(data.generatedAt).toLocaleString(locale)}.{' '}
            {t(
              'Historical values can change after late arrivals or deletion.',
              'Исторические значения могут измениться после поздней доставки или удаления данных.',
            )}
          </p>
        </>
      )}
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
        <Link href={href(metric)}>{label}</Link>
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
