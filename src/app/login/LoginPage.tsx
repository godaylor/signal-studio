'use client';
import { Loading } from '@umami/react-zen';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLoginQuery } from '@/components/hooks';
import { LoginForm } from './LoginForm';
import { PropsWithChildren } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import styles from './LoginPage.module.css';

export function LoginPageWrapper({ children }: PropsWithChildren) {
  const { user, isLoading } = useLoginQuery();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  if (isLoading || user) {
    return <Loading placement="absolute" />;
  }

  return (
    <main className={styles.screen}>{children}</main>
  );
}

export function LoginPage() {
  const { t } = useStudioLocale();
  return (
    <LoginPageWrapper>
      <div className={styles.layout}>
        <section className={styles.intro}>
          <p>{t('Product intelligence workspace', 'Пространство продуктовой аналитики')}</p>
          <h2>{t('From a product question to a shared answer.', 'От вопроса о продукте — к общему пониманию.')}</h2>
          <p>{t('Understand activation, find where people drop off, and keep your team focused on the evidence.', 'Изучайте активацию, находите точки оттока и принимайте решения на основе данных.')}</p>
          <ol className={styles.spine}>
            <li><strong>{t('Explore behavior', 'Исследуйте поведение')}</strong><span>{t('Events, funnels and retention in one query.', 'События, воронки и удержание в едином анализе.')}</span></li>
            <li><strong>{t('Save what matters', 'Сохраняйте важное')}</strong><span>{t('Reusable insights with their full definition.', 'Повторно используемые выводы с точным определением.')}</span></li>
            <li><strong>{t('Build a shared view', 'Создавайте общую картину')}</strong><span>{t('Dashboards, audiences and permission-aware exports.', 'Дашборды, аудитории и экспорт с контролем доступа.')}</span></li>
          </ol>
          <footer className={styles.legal}><a href={`${process.env.basePath || ''}/legal/THIRD_PARTY_NOTICES.md`}>{t('Based on Umami · MIT · Open-source notices', 'На основе Umami · MIT · Лицензии компонентов')}</a></footer>
        </section>
        <section className={styles.form} aria-label={t('Sign in', 'Вход')}>
          <LoginForm />
          <p>{t('Use the account provided by your workspace administrator.', 'Используйте учётную запись, которую предоставил администратор пространства.')}</p>
        </section>
      </div>
    </LoginPageWrapper>
  );
}
