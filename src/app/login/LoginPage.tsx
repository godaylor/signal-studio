'use client';
import { Loading } from '@umami/react-zen';
import { useRouter } from 'next/navigation';
import { type PropsWithChildren, useEffect, useState } from 'react';
import { useLoginQuery } from '@/components/hooks';
import { GuestStartButton } from '@/features/guest/GuestStartButton';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { LoginForm } from './LoginForm';
import styles from './LoginPage.module.css';

export function LoginPageWrapper({ children }: PropsWithChildren) {
  const { user, isLoading } = useLoginQuery();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace('/');
  }, [user, router]);
  if (isLoading || user) return <Loading placement="absolute" />;
  return <main className={styles.screen}>{children}</main>;
}

export function LoginPage() {
  const { t } = useStudioLocale();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).get('guest') === 'expired');
  }, []);
  return (
    <LoginPageWrapper>
      <div className={styles.layout}>
        <section className={styles.intro}>
          <div className={styles.brand}>
            <span className={styles.mark} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Signal Studio
          </div>
          <p>{t('Product intelligence, within reach', 'Продуктовая аналитика по делу')}</p>
          <h2>
            {t(
              'Find the moment your product starts to matter.',
              'Найдите момент, когда продукт становится полезным.',
            )}
          </h2>
          <p>
            {t(
              'Where do new users drop off? Open a workspace, follow the events, and turn your answer into a dashboard.',
              'Где теряются новые пользователи? Откройте пространство, исследуйте события и соберите дашборд с ответом.',
            )}
          </p>
          {expired ? (
            <p role="status">
              {t(
                'Your guest session has expired. Open a new space to continue exploring.',
                'Срок гостевой сессии истёк. Откройте новое пространство, чтобы продолжить исследование.',
              )}
            </p>
          ) : null}
          <GuestStartButton />
          <p className={styles.caption}>
            {t(
              'Your own guest space · synthetic events · work saved for 24 hours',
              'Личное гостевое пространство · синтетические события · работа хранится 24 часа',
            )}
          </p>
          <ol className={styles.preview}>
            <li>
              <small>01 / {t('ASK', 'ВОПРОС')}</small>
              <strong>{t('Explore behavior', 'Исследуйте поведение')}</strong>
              <span>{t('Trends, funnels, retention', 'Динамика, воронки, удержание')}</span>
            </li>
            <li>
              <small>02 / {t('UNDERSTAND', 'ОТВЕТ')}</small>
              <strong>{t('See what changes', 'Находите различия')}</strong>
              <span>
                {t('Compare devices and audiences', 'Сравнивайте устройства и аудитории')}
              </span>
            </li>
            <li>
              <small>03 / {t('KEEP', 'РЕШЕНИЕ')}</small>
              <strong>{t('Save what matters', 'Сохраняйте важное')}</strong>
              <span>{t('Insights, dashboards, export', 'Анализы, дашборды, экспорт')}</span>
            </li>
          </ol>
          <footer className={styles.legal}>
            <a href={`${process.env.basePath || ''}/legal/THIRD_PARTY_NOTICES.md`}>
              {t(
                'Based on Umami · MIT · Open-source notices',
                'На основе Umami · MIT · Лицензии компонентов',
              )}
            </a>
          </footer>
        </section>
        <section className={styles.form} aria-label={t('Sign in', 'Вход')}>
          <LoginForm />
          <p>
            {t(
              'Already have a workspace? Sign in with the account provided by your administrator.',
              'Уже есть пространство? Войдите с учётной записью, которую предоставил администратор.',
            )}
          </p>
        </section>
      </div>
    </LoginPageWrapper>
  );
}
