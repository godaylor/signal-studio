'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useConfig, useLoginQuery, useUserWebsitesQuery } from '@/components/hooks';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { getStudioPath } from './navigation';
import styles from './StudioPage.module.css';
import { StudioLoadingScreen, StudioState } from './StudioState';

export function StudioEntry() {
  const router = useRouter();
  const config = useConfig();
  const { t } = useStudioLocale();
  const { user, isLoading: isLoginLoading, error: loginError } = useLoginQuery();
  const { data, isLoading, error } = useUserWebsitesQuery(
    { userId: user?.id },
    { pageSize: 100, includeTeams: true },
    { enabled: !!user },
  );
  const projects: { id: string; name: string }[] = data?.data ?? [];

  useEffect(() => {
    if (loginError && config) {
      window.location.href = config.cloudMode
        ? `${process.env.cloudUrl}/login`
        : `${process.env.basePath || ''}/login`;
    }
  }, [config, loginError]);

  useEffect(() => {
    if (projects[0]) {
      router.replace(getStudioPath(projects[0].id, 'home'));
    }
  }, [projects, router]);

  if (!config || isLoginLoading || isLoading || projects[0]) {
    return <StudioLoadingScreen />;
  }

  if (loginError) {
    return <StudioLoadingScreen />;
  }

  return (
    <main className={styles.fullPageState}>
      <StudioState
        variant={error ? 'error' : 'empty'}
        title={
          error
            ? t('Projects could not be loaded', 'Не удалось загрузить проекты')
            : t('No project is available', 'Нет доступных проектов')
        }
        message={
          error
            ? t(
                'Retry after checking your session and data service.',
                'Повторите попытку после проверки сессии и сервиса данных.',
              )
            : t(
                'Create a Source in the existing data settings before entering Studio.',
                'Создайте источник в настройках данных перед входом в Studio.',
              )
        }
      />
    </main>
  );
}
