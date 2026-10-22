'use client';
import { useTheme } from '@umami/react-zen';
import { ArrowDown, ArrowRight, ArrowUpRight, Moon, Pause, Play, Sun } from 'lucide-react';
import { type PropsWithChildren, useEffect, useState } from 'react';
import { GuestStartButton } from '@/features/guest/GuestStartButton';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { BrandMark } from '@/features/visual/BrandMark';
import { DataValue } from '@/features/visual/DataValue';
import { FlowField } from '@/features/visual/FlowField';
import { useVisualMotion } from '@/features/visual/MotionPreferences';
import { SceneEntrance } from '@/features/visual/SceneEntrance';
import { useSceneEntrance } from '@/features/visual/useSceneEntrance';
import { LoginForm } from './LoginForm';
import styles from './LoginPage.module.css';

export function LoginPageWrapper({ children }: PropsWithChildren) {
  return <main className={styles.screen}>{children}</main>;
}

type EntrySample = {
  users: number;
  onboarding: number;
  activatedUsers: number;
  subscriptions: number;
};

export function LoginPage({
  sample = { users: 336, onboarding: 252, activatedUsers: 168, subscriptions: 84 },
}: {
  sample?: EntrySample;
}) {
  const { t, locale } = useStudioLocale();
  const { theme, setTheme } = useTheme();
  const { enabled, toggle } = useVisualMotion();
  const journeyEntrance = useSceneEntrance<HTMLElement>();
  const accountEntrance = useSceneEntrance<HTMLElement>();
  const [expired, setExpired] = useState(false);
  const [subscription, setSubscription] = useState(false);
  const [active, setActive] = useState<number>();
  useEffect(
    () => setExpired(new URLSearchParams(window.location.search).get('guest') === 'expired'),
    [],
  );
  const values = [
    sample.users,
    sample.onboarding,
    subscription ? sample.subscriptions : sample.activatedUsers,
  ];
  const labels = [
    t('Signup', 'Регистрация'),
    t('Setup complete', 'Настройка'),
    subscription
      ? t('Subscribed', 'Оформили подписку')
      : t('Used a feature', 'Использовали функцию'),
  ];
  const inspectedStep = active ?? 2;
  const rate = values[0] ? values[inspectedStep] / values[0] : 0;
  return (
    <LoginPageWrapper>
      <div className={styles.observatory}>
        <header className={styles.header}>
          <BrandMark wordmark />
          <a href="#how" className={styles.aboutLink}>
            {t('Behavior in motion', 'Поведение в движении')}
          </a>
          <nav aria-label={t('Entry navigation', 'Навигация входа')}>
            <button
              type="button"
              onClick={toggle}
              aria-label={
                enabled
                  ? t('Pause animation', 'Приостановить анимацию')
                  : t('Enable animation', 'Включить анимацию')
              }
            >
              {enabled ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={
                theme === 'dark'
                  ? t('Switch to light theme', 'Включить светлую тему')
                  : t('Switch to dark theme', 'Включить тёмную тему')
              }
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <a href="#account">
              {t('Sign in', 'Войти')} <ArrowUpRight size={15} />
            </a>
          </nav>
        </header>
        <section className={styles.hero}>
          <SceneEntrance className={styles.intro}>
            <p className={styles.eyebrow}>
              <span />
              {t('Product intelligence, made visible', 'Продуктовая аналитика, которую видно')}
            </p>
            <h1>
              {t('See the journey.', 'Увидеть путь.')}
              <br />
              <span>{t('Find the growth.', 'Найти рост.')}</span>
            </h1>
            <p className={styles.description}>
              {t(
                'See which step people do not reach in your app. Compare devices, inspect the participants and save the answer for your team.',
                'Узнайте, до какого шага не доходят люди в вашем приложении. Сравните устройства, изучите участников и сохраните ответ для команды.',
              )}
            </p>
            {expired ? (
              <p role="status" className={styles.expired}>
                {t(
                  'Your guest session expired. Open a new space to continue.',
                  'Гостевая сессия завершилась. Откройте новое пространство, чтобы продолжить.',
                )}
              </p>
            ) : null}
            <GuestStartButton className={styles.guestAction} />
            <p className={styles.caption}>
              {t(
                'Private workspace · no signup · saved for 24 hours',
                'Личное пространство · без регистрации · сохранение на 24 часа',
              )}
            </p>
            <p className={styles.exampleContext}>
              {t(
                'Try it on Orbit, a fictional online service. No data connection needed.',
                'Попробуйте на Orbit — вымышленном онлайн-сервисе. Подключать свои данные не нужно.',
              )}
            </p>
          </SceneEntrance>
          <SceneEntrance className={styles.dataScene} delay={140}>
            <div className={styles.sampleTop}>
              <span>
                {t('Synthetic example · 42 days · UTC', 'Синтетический пример · 42 дня · UTC')}
              </span>
              <div
                className={styles.scenario}
                role="group"
                aria-label={t('Example outcome', 'Цель примера')}
              >
                <button
                  type="button"
                  aria-pressed={!subscription}
                  onClick={() => setSubscription(false)}
                >
                  {t('Activation', 'Активация')}
                </button>
                <button
                  type="button"
                  aria-pressed={subscription}
                  onClick={() => setSubscription(true)}
                >
                  {t('Subscription', 'Подписка')}
                </button>
              </div>
            </div>
            <div className={styles.sceneLabels}>
              {values.map((value, index) => (
                <button
                  key={index}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(undefined)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(undefined)}
                  onClick={() => setActive(index)}
                  data-highlight={active === index || undefined}
                  aria-label={`${labels[index]}: ${value.toLocaleString(locale)}`}
                >
                  <strong>
                    <DataValue value={value.toLocaleString(locale)} />
                  </strong>
                  <span>{labels[index]}</span>
                </button>
              ))}
            </div>
            <FlowField values={values} active={active} className={styles.heroFlow} panoramic />
            <div className={styles.sceneAnswer}>
              <span>
                {active == null
                  ? t('From signup to the outcome', 'От регистрации до результата')
                  : `${labels[active]} · ${t('of signups', 'от регистраций')}`}
              </span>
              <strong>
                <DataValue
                  value={rate.toLocaleString(locale, {
                    style: 'percent',
                    maximumFractionDigits: 0,
                  })}
                />
              </strong>
              <span className={styles.answerNote}>
                {t(
                  `${values[inspectedStep]} of ${values[0]} reached ${active == null ? 'the final' : 'this'} step.`,
                  `${values[inspectedStep]} из ${values[0]} дошли до ${active == null ? 'последнего' : 'этого'} шага.`,
                )}
              </span>
            </div>
          </SceneEntrance>
          <a href="#how" className={styles.scrollLink}>
            <ArrowDown size={16} />
            {t('Look inside', 'Что внутри')}
          </a>
        </section>
        <div className={styles.exampleReading}>
          <p>
            <span className={styles.waterKey} aria-hidden="true" />
            {t('Blue flow — reached the next step', 'Голубой поток — прошли дальше')}
          </p>
          <p>
            <span className={styles.lossKey} aria-hidden="true" />
            {t(
              'Warm branch — did not reach the next step',
              'Тёплая ветвь — не дошли до следующего шага',
            )}
          </p>
          <p>
            {t(
              'Change the goal above, then open the workspace to change the query.',
              'Переключите цель выше. В рабочем пространстве можно менять сам запрос.',
            )}
          </p>
        </div>
        <div className={styles.proofline}>
          <span>{t('From the event to the decision', 'От события до решения')}</span>
          <span>
            {t('A real query', 'Рабочий запрос')}
            <ArrowRight size={15} />
            {t('An exact answer', 'Точный ответ')}
            <ArrowRight size={15} />
            {t('A saved insight', 'Сохранённый инсайт')}
          </span>
        </div>
      </div>
      <section id="how" className={styles.journey} ref={journeyEntrance}>
        <p className={styles.sectionLabel}>
          {t('One continuous workspace', 'Одно пространство исследования')}
        </p>
        <div className={styles.journeyHeading}>
          <h2>
            {t('Less assembling reports.', 'Меньше сборки отчётов.')}
            <br />
            <span>{t('More understanding.', 'Больше понимания.')}</span>
          </h2>
          <p>
            {t(
              'Ask a question. Change the events, compare a segment, inspect the people behind the numbers. Keep the answer in an Insight and build a dashboard.',
              'Задайте вопрос. Измените события, сравните сегмент, изучите людей за цифрами. Сохраните ответ в инсайт и соберите дашборд.',
            )}
          </p>
        </div>
        <div className={styles.capabilities}>
          {[
            [
              '01',
              t('Follow behavior', 'Проследить поведение'),
              t('Events, funnels, retention', 'События, воронки, удержание'),
            ],
            [
              '02',
              t('Understand the context', 'Увидеть контекст'),
              t('Audiences and session evidence', 'Аудитории и данные сессий'),
            ],
            [
              '03',
              t('Keep the result', 'Сохранить результат'),
              t('Insights, dashboards, CSV / JSON', 'Инсайты, дашборды, CSV / JSON'),
            ],
          ].map(([n, title, copy], i) => (
            <SceneEntrance key={title} delay={i * 90}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </SceneEntrance>
          ))}
        </div>
        <p className={styles.sampleDefinition}>
          {t(
            'The entry scene is a fixed synthetic example, not a live event feed. Inside your guest space, change the query and explore results calculated from the sample events.',
            'Сцена входа — фиксированный синтетический пример, а не поток новых событий. Внутри меняйте запросы и исследуйте результаты, рассчитанные по событиям набора.',
          )}
        </p>
      </section>
      <section id="account" className={styles.account} ref={accountEntrance}>
        <div>
          <p className={styles.sectionLabel}>{t('Your workspace', 'Ваше рабочее пространство')}</p>
          <h2>{t('Continue your research.', 'Продолжить исследование.')}</h2>
          <p>
            {t(
              'Sign in to your projects and team. Your data stays in its workspace.',
              'Войдите в свои проекты и команду. Ваши данные остаются в своём пространстве.',
            )}
          </p>
        </div>
        <div className={styles.form}>
          <LoginForm />
        </div>
      </section>
      <footer className={styles.legal}>
        <BrandMark wordmark />
        <a href={`${process.env.basePath || ''}/legal/THIRD_PARTY_NOTICES.md`}>
          {t(
            'Based on Umami · MIT · Open-source notices',
            'На основе Umami · MIT · Лицензии компонентов',
          )}
        </a>
      </footer>
    </LoginPageWrapper>
  );
}
