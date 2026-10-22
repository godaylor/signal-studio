'use client';

import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { getApiUrl } from '@/lib/api-url';
import { activateClientGuestSession } from '@/lib/client';
import styles from './GuestWorkspace.module.css';

export function GuestStartButton({ className }: { className?: string }) {
  const { t } = useStudioLocale();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  // The server-rendered CTA must not accept a click before its handler is ready.
  useEffect(() => setReady(true), []);
  const start = async () => {
    if (!ready || pending) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch(getApiUrl('/guest'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const data = await response.json();
      if (!response.ok) {
        setError(
          response.status === 429
            ? t(
                'Guest spaces are busy. Please try again later.',
                'Гостевые пространства заняты. Попробуйте чуть позже.',
              )
            : t(
                'Could not open a guest space. Please retry.',
                'Не удалось открыть гостевое пространство. Повторите попытку.',
              ),
        );
        setPending(false);
        return;
      }
      const path =
        typeof data.redirect === 'string' && data.redirect.startsWith('/studio')
          ? data.redirect
          : '/studio';
      activateClientGuestSession();
      window.location.assign(`${process.env.basePath || ''}${path}`);
    } catch {
      setError(
        t(
          'Connection lost. Check your connection and retry.',
          'Нет соединения. Проверьте сеть и повторите.',
        ),
      );
      setPending(false);
    }
  };
  return (
    <div className={styles.start}>
      <button
        type="button"
        className={className ?? styles.startButton}
        disabled={!ready || pending}
        aria-busy={!ready || pending || undefined}
        onClick={start}
      >
        {pending ? <LoaderCircle size={18} aria-hidden="true" /> : null}
        {pending
          ? t('Opening your workspace…', 'Открываем ваше пространство…')
          : t('Try without signing up', 'Попробовать без регистрации')}
        {!pending ? <ArrowUpRight size={19} aria-hidden="true" /> : null}
      </button>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
