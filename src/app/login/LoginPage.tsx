'use client';
import { useTheme } from '@umami/react-zen';
import { ArrowDown, ArrowUpRight, Moon, Pause, Play, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { type PropsWithChildren, useEffect, useState } from 'react';
import { GuestStartButton } from '@/features/guest/GuestStartButton';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { BrandMark } from '@/features/visual/BrandMark';
import { useVisualMotion } from '@/features/visual/MotionPreferences';
import { OpticalScene } from '@/features/visual/OpticalScene';
import { LoginForm } from './LoginForm';
import styles from './LoginPage.module.css';

export function LoginPageWrapper({ children }: PropsWithChildren) {
  return <main className={styles.screen}>{children}</main>;
}
export function LoginPage() {
  const { t } = useStudioLocale();
  const { theme, setTheme } = useTheme();
  const { animate, enabled, toggle } = useVisualMotion();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).get('guest') === 'expired');
  }, []);
  return (
    <LoginPageWrapper>
      <header className={styles.header}>
        <BrandMark wordmark />
        <span className={styles.tagline}>{t('Product intelligence', 'Продуктовая аналитика')}</span>
        <nav aria-label={t('Entry navigation', 'Навигация входа')}>
          <button
            type="button"
            onClick={toggle}
            aria-label={
              enabled
                ? t('Pause animation', 'Приостановить анимацию')
                : t('Enable animation', 'Включить анимацию')
            }
            title={t('Motion', 'Движение')}
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
        <OpticalScene className={styles.scene} />
        <motion.div
          className={styles.intro}
          initial={animate ? { opacity: 0, y: 24 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className={styles.eyebrow}>
            <span />
            {t('See the story behind the events', 'За событиями — поведение людей')}
          </p>
          <h1>
            {t('From a trace.', 'От следа.')}
            <br />
            <span>{t('To a clear answer.', 'К ясному ответу.')}</span>
          </h1>
          <p className={styles.description}>
            {t(
              'Understand where people find value in your product — and where you lose them. Explore, compare, save your next decision.',
              'Поймите, где люди находят ценность в продукте. И где вы их теряете. Исследуйте путь, сравните результат, сохраните решение.',
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
          <GuestStartButton />
          <p className={styles.caption}>
            {t(
              'Your private space · synthetic events · saved for 24 hours',
              'Личное пространство · синтетические события · сохранение на 24 часа',
            )}
          </p>
        </motion.div>
        <div className={styles.heroNote} aria-hidden="true">
          <i />
          <span>{t('Every event leaves a trace', 'У каждого события есть продолжение')}</span>
        </div>
        <a href="#how" className={styles.scrollLink}>
          <ArrowDown size={16} />
          {t('How it works', 'Как это работает')}
        </a>
      </section>
      <section
        id="how"
        className={styles.journey}
        aria-label={t('From question to decision', 'От вопроса к решению')}
      >
        {[
          [
            t('Ask a question', 'Задайте вопрос'),
            t('Where does activation break?', 'Где теряется активация?'),
          ],
          [
            t('Follow the trace', 'Проследите путь'),
            t('Events, funnels, retention', 'События, воронки, удержание'),
          ],
          [
            t('Keep the answer', 'Сохраните ответ'),
            t('Insights, dashboards, CSV / JSON', 'Инсайты, дашборды, CSV / JSON'),
          ],
        ].map(([title, copy], i) => (
          <motion.div
            key={title}
            initial={animate ? { opacity: 0, y: 16 } : false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ delay: i * 0.1, duration: 0.45 }}
          >
            <span className={styles.node}>{i + 1}</span>
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
            </div>
          </motion.div>
        ))}
      </section>
      <section id="account" className={styles.account}>
        <div>
          <p className={styles.eyebrow}>{t('Your workspace', 'Ваше рабочее пространство')}</p>
          <h2>{t('Already have an account?', 'Уже есть аккаунт?')}</h2>
          <p>
            {t(
              'Sign in to continue working with your projects and team.',
              'Войдите, чтобы продолжить работу со своими проектами и командой.',
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
