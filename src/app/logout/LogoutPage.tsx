'use client';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@/features/explore/useAnalysisQuery';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { StudioState } from '@/features/studio-shell/StudioState';
import { getApiUrl } from '@/lib/api-url';
import { removeClientAuthToken } from '@/lib/client';
import { setUser } from '@/store/app';

export function LogoutPage() {
  const { t } = useStudioLocale();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);
  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    async function logout() {
      try {
        await requestJson(getApiUrl('/auth/logout'), { method: 'POST' });
      } catch (error) {
        if ((error as { status?: number }).status !== 401) {
          setFailed(true);
          return;
        }
      }
      removeClientAuthToken();
      setUser(null);
      window.location.href = `${process.env.basePath || ''}/login`;
    }
    void logout();
  }, [attempt]);
  return (
    <main>
      <StudioState
        variant={failed ? 'error' : 'loading'}
        title={
          failed
            ? t('Could not log out', 'Не удалось выйти')
            : t('Logging out', 'Выходим из аккаунта')
        }
        message={
          failed
            ? t(
                'Check your connection and retry to revoke your session.',
                'Проверьте соединение и повторите, чтобы завершить сессию.',
              )
            : t('Ending your session securely.', 'Безопасно завершаем сессию.')
        }
        action={
          failed ? (
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setAttempt(value => value + 1);
              }}
            >
              {t('Retry', 'Повторить')}
            </button>
          ) : undefined
        }
      />
    </main>
  );
}
