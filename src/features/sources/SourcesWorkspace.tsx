'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useHome } from '@/features/home/useHome';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { getStudioPath } from '@/features/studio-shell/navigation';
import styles from './SourcesWorkspace.module.css';

export function SourcesWorkspace({
  projectId,
  projectName,
  domain,
}: {
  projectId: string;
  projectName: string;
  domain?: string;
}) {
  const { t, locale } = useStudioLocale();
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const home = useHome(projectId);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const snippet = origin
    ? `<script defer src="${origin}${process.env.basePath || ''}/script.js" data-website-id="${projectId}"></script>`
    : '';
  const events = `// Run after the tracker has loaded\nwindow.umami.identify({ identityVersion: 1, id: 'your-user-id' });\nwindow.umami.track('signup');\n// When the user completes onboarding:\nwindow.umami.track('onboarding_completed');\n// When the user uses your main feature:\nwindow.umami.track('core_feature_used');`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  }
  return (
    <section className={styles.page}>
      <header>
        <p className={styles.eyebrow}>
          {projectName}
          {domain ? ` · ${domain}` : ''}
        </p>
        <h1>{t('Connect your data', 'Подключите данные')}</h1>
        <p>
          {t(
            'Install the tracker once. Every event you send becomes available in Explore, audiences and dashboards.',
            'Установите трекер один раз. Отправленные события станут доступны в анализе, аудиториях и дашбордах.',
          )}
        </p>
        <div className={styles.actions}>
          <Link className={styles.link} href="/studio/new">
            {t('Create another project', 'Создать ещё один проект')}
          </Link>
        </div>
      </header>
      <ol className={styles.steps}>
        <li>
          <h2>{t('1. Install the tracker', '1. Установите трекер')}</h2>
          <p>
            {t(
              'Add this snippet inside the <head> of your website. Page views are collected automatically.',
              'Добавьте этот код в <head> вашего сайта. Просмотры страниц собираются автоматически.',
            )}
          </p>
          <textarea
            className={styles.code}
            readOnly
            value={snippet}
            aria-label={t('Tracking snippet', 'Код трекера')}
            spellCheck={false}
          />
          <div className={styles.actions}>
            <button type="button" onClick={copy} disabled={!snippet}>
              {copied ? t('Copied', 'Скопировано') : t('Copy snippet', 'Скопировать код')}
            </button>
            <span role="status">
              {copyFailed
                ? t(
                    'Select the code above and copy it manually.',
                    'Выделите код выше и скопируйте вручную.',
                  )
                : copied
                  ? t('Ready to paste into your website.', 'Можно вставить на сайт.')
                  : ''}
            </span>
          </div>
        </li>
        <li>
          <h2>{t('2. Track meaningful actions', '2. Отслеживайте полезные действия')}</h2>
          <p>
            {t(
              'Use your own event names in Explore. For the activation overview on Home, send these events at the corresponding points in your product. Identify users with a stable internal ID, without email or other sensitive information.',
              'В анализе можно использовать любые названия событий. Для обзора активации на главной отправляйте эти события в соответствующие моменты работы продукта. Идентифицируйте пользователей стабильным внутренним ID без email и других чувствительных данных.',
            )}
          </p>
          <textarea
            className={styles.code}
            readOnly
            value={events}
            rows={8}
            aria-label={t('Product event examples', 'Примеры продуктовых событий')}
            spellCheck={false}
          />
          <p>
            {t(
              'Only send events for actions that actually happened. Activation means signup → onboarding completed → core feature used within seven days.',
              'Отправляйте события только для реально совершённых действий. Активация: регистрация → завершение настройки → использование основной функции в течение семи дней.',
            )}
          </p>
        </li>
        <li>
          <h2>{t('3. Check your connection', '3. Проверьте подключение')}</h2>
          <div className={styles.status} aria-live="polite">
            <strong>
              {home.isPending
                ? t('Checking for events…', 'Проверяем события…')
                : home.isError
                  ? t('Connection check failed', 'Не удалось проверить подключение')
                  : home.data?.health.lastEventAt
                    ? t('Your source is receiving events', 'События поступают')
                    : t('Waiting for your first event', 'Ожидаем первое событие')}
            </strong>
            <p>
              {home.data?.health.lastEventAt
                ? `${t('Last event', 'Последнее событие')}: ${new Date(home.data.health.lastEventAt).toLocaleString(locale)}`
                : t(
                    'Open your website after installing the snippet, then check again. Check your browser’s network requests if events do not arrive.',
                    'Откройте сайт после установки кода и повторите проверку. Если события не приходят, проверьте сетевые запросы в браузере.',
                  )}
            </p>
            <div className={styles.actions}>
              <button type="button" disabled={home.isFetching} onClick={() => home.refetch()}>
                {t('Check connection', 'Проверить подключение')}
              </button>
              <Link className={styles.link} href={getStudioPath(projectId, 'live')}>
                {t('Open live activity', 'Открыть активность')}
              </Link>
              <Link className={styles.link} href={getStudioPath(projectId, 'explore')}>
                {t('Explore events', 'Анализировать события')}
              </Link>
            </div>
          </div>
        </li>
      </ol>
    </section>
  );
}
