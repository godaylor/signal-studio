'use client';

import { useState, useSyncExternalStore } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import styles from './DemoWalkthrough.module.css';

// Public fictional fixtures only. No auth, project IDs, API calls or persistence.
const events = [
  { event: 'signup', ru: 'Регистрация', en: 'Sign up', count: 120 },
  { event: 'onboarding_completed', ru: 'Настройка завершена', en: 'Setup completed', count: 84 },
  { event: 'report_created', ru: 'Первый отчёт создан', en: 'First report created', count: 48 },
];
const subscribeToHydration = () => () => {};

export function DemoWalkthrough() {
  const { t } = useStudioLocale();
  const ready = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [audience, setAudience] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const labels = [
    t('Source', 'Источник'),
    t('Events', 'События'),
    t('Explore', 'Анализ'),
    t('Insight', 'Сохранённый анализ'),
    t('Dashboard', 'Дашборд'),
    t('Audience', 'Аудитория'),
    t('Export', 'Экспорт'),
  ];
  const title = t('From sign-up to the first report', 'От регистрации к первому отчёту');

  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            demo: true,
            dataset: 'Fictional Signal Reports',
            range: {
              startAt: '2026-09-01T00:00:00Z',
              endAt: '2026-09-08T00:00:00Z',
              timezone: 'UTC',
            },
            definition: 'Fictional unique users per event; 48 / 120 created their first report.',
            rows: events.map(({ event, count }) => ({ event, users: count })),
            audience: { definition: 'Completed setup without creating a report', users: 36 },
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'signal-studio-demo.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href={`${process.env.basePath || ''}/`}>Signal Studio</a>
        <a href={`${process.env.basePath || ''}/login`}>
          {t('Sign in to your workspace', 'Войти в своё пространство')}
        </a>
      </header>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>
          {t('Portfolio demo · no account needed', 'Демонстрация проекта · без регистрации')}
        </p>
        <h1>
          {t(
            'Where do users stop before finding value?',
            'Что мешает пользователям дойти до результата?',
          )}
        </h1>
        <p>
          {t(
            'Follow a product question from its events to a saved analysis, dashboard and audience.',
            'Пройдите путь от событий до сохранённого анализа, дашборда и аудитории.',
          )}
        </p>
        <p className={styles.notice}>
          {t(
            'Interactive walkthrough with fictional data, not a live workspace. Changes last until you reload this page. No production data is read or changed.',
            'Интерактивный пример на вымышленных данных, не рабочее пространство. Изменения сохраняются только до перезагрузки страницы. Данные рабочих проектов не читаются и не изменяются.',
          )}
        </p>
      </section>
      <div className={styles.layout}>
        <nav aria-label={t('Analysis path', 'Путь анализа')} className={styles.spine}>
          <ol>
            {labels.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  disabled={!ready}
                  aria-current={step === index ? 'step' : undefined}
                  onClick={() => setStep(index)}
                >
                  <span aria-hidden="true">{index + 1}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <section className={styles.content} aria-labelledby="demo-step">
          <p className={styles.eyebrow}>
            {t('Signal Reports · fictional SaaS', 'Signal Reports · вымышленный сервис отчётов')}
          </p>
          <h2 id="demo-step">{labels[step]}</h2>
          {step === 0 && (
            <>
              <h3>
                {t(
                  'Connect the product you want to understand',
                  'Подключите продукт, который хотите изучить',
                )}
              </h3>
              <p>
                {t(
                  'A source receives events from your website or application. In your own workspace you install a tracking script and check the first received event.',
                  'Источник принимает события с вашего сайта или приложения. В своём пространстве вы устанавливаете скрипт отслеживания и проверяете первое поступившее событие.',
                )}
              </p>
              <dl>
                <dt>{t('Demo source', 'Источник примера')}</dt>
                <dd>Signal Reports · reports.example</dd>
                <dt>{t('Question', 'Вопрос')}</dt>
                <dd>
                  {t(
                    'How many new users create their first report?',
                    'Сколько новых пользователей создают первый отчёт?',
                  )}
                </dd>
              </dl>
            </>
          )}
          {step === 1 && (
            <>
              <p>
                {t(
                  'The demo contains three events. These are examples of received data; this page does not send tracking events.',
                  'В примере три события. Это образец принятых данных; эта страница не отправляет события в систему сбора.',
                )}
              </p>
              <table>
                <caption>{t('Example event catalog', 'Пример каталога событий')}</caption>
                <thead>
                  <tr>
                    <th>{t('Event', 'Событие')}</th>
                    <th>{t('Meaning', 'Значение')}</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(item => (
                    <tr key={item.event}>
                      <td>
                        <code>{item.event}</code>
                      </td>
                      <td>{t(item.en, item.ru)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {step === 2 && (
            <>
              <h3>{title}</h3>
              <p>
                {t(
                  '48 of 120 users created a report: 40% activation. The largest loss is after setup: 36 people did not reach their first report.',
                  '48 из 120 пользователей создали отчёт: активация 40%. Больше всего людей теряется после настройки: 36 не дошли до первого отчёта.',
                )}
              </p>
              <table>
                <caption>
                  {t(
                    'Unique users · September 1–7, 2026 · UTC · fictional data',
                    'Уникальные пользователи · 1–7 сентября 2026 · UTC · вымышленные данные',
                  )}
                </caption>
                <thead>
                  <tr>
                    <th>{t('Step', 'Шаг')}</th>
                    <th>{t('Users', 'Пользователи')}</th>
                    <th>{t('Share of registrations', 'Доля регистраций')}</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(item => (
                    <tr key={item.event}>
                      <th scope="row">{t(item.en, item.ru)}</th>
                      <td>{item.count}</td>
                      <td>{Math.round((item.count / 120) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                {t(
                  'Each person is counted once per step. Fixed example, not a current production measurement.',
                  'Каждый человек учитывается один раз на каждом шаге. Фиксированный пример, не текущие показатели реального проекта.',
                )}
              </p>
            </>
          )}
          {step === 3 && (
            <>
              <h3>{title}</h3>
              <p>
                {t(
                  'A saved analysis keeps the question, date range and metric together so you can return to the same definition.',
                  'Сохранённый анализ объединяет вопрос, период и метрику: к тому же определению можно вернуться позже.',
                )}
              </p>
              <button type="button" disabled={saved} onClick={() => setSaved(true)}>
                {saved
                  ? t('Analysis saved in demo', 'Анализ сохранён в демо')
                  : t('Save analysis in demo', 'Сохранить анализ в демо')}
              </button>
            </>
          )}
          {step === 4 && (
            <>
              <p>
                {t(
                  'A dashboard references the saved analysis instead of duplicating its query.',
                  'Дашборд ссылается на сохранённый анализ и использует то же определение метрики.',
                )}
              </p>
              {saved ? (
                <button type="button" disabled={placed} onClick={() => setPlaced(true)}>
                  {placed
                    ? t('Added to demo dashboard', 'Добавлено на демо-дашборд')
                    : t('Add saved analysis', 'Добавить сохранённый анализ')}
                </button>
              ) : (
                <p>
                  {t('Save the analysis in step 4 first.', 'Сначала сохраните анализ на шаге 4.')}
                </p>
              )}
              {placed && (
                <div className={styles.result}>
                  <h3>{title}</h3>
                  <strong>40%</strong>
                  <p>
                    {t(
                      '48 of 120 registered users',
                      '48 из 120 зарегистрировавшихся пользователей',
                    )}
                  </p>
                  <button type="button" onClick={() => setStep(2)}>
                    {t('Open analysis', 'Открыть анализ')}
                  </button>
                </div>
              )}
            </>
          )}
          {step === 5 && (
            <>
              <h3>
                {t(
                  'Help users reach their first report',
                  'Помогите пользователям создать первый отчёт',
                )}
              </h3>
              <p>
                {t(
                  'The audience contains people who completed setup but did not create a report in this period. No personal data is included in the demo.',
                  'В аудиторию входят люди, завершившие настройку, но не создавшие отчёт за этот период. Персональных данных в демо нет.',
                )}
              </p>
              <button type="button" onClick={() => setAudience(true)}>
                {t('View demo audience', 'Посмотреть аудиторию демо')}
              </button>
              {audience && (
                <p role="status">
                  {t(
                    '36 fictional users · completed setup → no report',
                    '36 вымышленных пользователей · настройка завершена → отчёта нет',
                  )}
                </p>
              )}
            </>
          )}
          {step === 6 && (
            <>
              <p>
                {t(
                  'Download the fictional result and its definition as JSON. Real project exports require sign-in and project permissions.',
                  'Скачайте вымышленный результат вместе с определением в формате JSON. Экспорт реальных проектов требует входа и прав на проект.',
                )}
              </p>
              <button type="button" onClick={download}>
                {t('Download demo JSON', 'Скачать JSON демо')}
              </button>
              {downloaded && (
                <p role="status">
                  {t('Demo file prepared for download.', 'Демо-файл подготовлен к скачиванию.')}
                </p>
              )}
            </>
          )}
          <footer className={styles.actions}>
            {step > 0 && (
              <button type="button" disabled={!ready} onClick={() => setStep(step - 1)}>
                {t('Back', 'Назад')}
              </button>
            )}
            {step < 6 && (
              <button type="button" disabled={!ready} onClick={() => setStep(step + 1)}>
                {t('Next', 'Далее')}: {labels[step + 1]}
              </button>
            )}
          </footer>
        </section>
      </div>
      <footer className={styles.footer}>
        <p>
          {t(
            'Your own data stays private. Sign in with an account provided by your workspace administrator to connect a source and save real results.',
            'Ваши данные остаются закрытыми. Для подключения своего источника и сохранения реальных результатов войдите с учётной записью от администратора пространства.',
          )}
        </p>
        <a href={`${process.env.basePath || ''}/legal/THIRD_PARTY_NOTICES.md`}>
          {t(
            'Based on Umami · MIT · Open-source notices',
            'На основе Umami · MIT · Лицензии компонентов',
          )}
        </a>
      </footer>
    </main>
  );
}
