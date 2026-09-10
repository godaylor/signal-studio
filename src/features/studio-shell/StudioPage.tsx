'use client';

import { Database, Scale } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { useWebsiteQuery } from '@/components/hooks';
import { useProjectAccess } from '@/features/access/useProjectAccess';
import { WorkspaceAccessPage } from '@/features/access/WorkspaceAccessPage';
import { AudiencesWorkspace } from '@/features/audiences/AudiencesWorkspace';
import { DashboardWorkspace } from '@/features/dashboards/DashboardWorkspace';
import { ExperienceWorkspace } from '@/features/experience/ExperienceWorkspace';
import { ExploreWorkspace } from '@/features/explore/ExploreWorkspace';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { LiveWorkspace } from '@/features/live/LiveWorkspace';
import { HomeWorkspace } from '@/features/home/HomeWorkspace';
import { getStudioPath } from './navigation';
import styles from './StudioPage.module.css';
import { StudioState } from './StudioState';

export function StudioPage({ section, projectId }: { section: string; projectId: string }) {
  const { t } = useStudioLocale();
  const { data: project } = useWebsiteQuery(projectId);
  const access = useProjectAccess(projectId);
  const projectName = project?.name ?? t('Current project', 'Текущий проект');

  if (section === 'home') return <HomeWorkspace projectId={projectId} projectName={projectName} />;

  if (access.isLoading && ['settings', 'sources', 'audiences', 'experience'].includes(section)) {
    return (
      <div className={styles.page}>
        <StudioState
          variant="loading"
          title={t('Checking access', 'Проверяем доступ')}
          message={t(
            'Loading role and individual permissions.',
            'Загружаем роль и индивидуальные права.',
          )}
        />
      </div>
    );
  }

  if (section === 'settings') {
    if (
      access.data?.capabilities.manageMembers ||
      access.data?.capabilities.editInsights ||
      access.data?.capabilities.editDashboards
    ) {
      return <WorkspaceAccessPage projectId={projectId} />;
    }
    return <PermissionState projectId={projectId} />;
  }

  if (section === 'explore') {
    return <ExploreWorkspace projectId={projectId} projectName={projectName} />;
  }
  if (section === 'dashboards') {
    return <DashboardWorkspace projectId={projectId} projectName={projectName} />;
  }
  if (section === 'audiences') {
    if (!access.data?.capabilities.viewIdentity) return <PermissionState projectId={projectId} />;
    return (
      <Suspense
        fallback={
          <div className={styles.page}>
            <StudioState
              variant="loading"
              title={t('Loading Audiences', 'Загрузка аудиторий')}
              message={t(
                'Restoring identity filters and saved Segment context.',
                'Восстанавливаем фильтры идентичности и контекст сохранённого сегмента.',
              )}
            />
          </div>
        }
      >
        <AudiencesWorkspace projectId={projectId} projectName={projectName} />
      </Suspense>
    );
  }
  if (section === 'experience') {
    if (!access.data?.capabilities.viewIdentity) return <PermissionState projectId={projectId} />;
    return (
      <Suspense
        fallback={
          <div className={styles.page}>
            <StudioState
              variant="loading"
              title={t('Loading Experience', 'Загрузка опыта')}
              message={t(
                'Restoring the selected session and aggregate analysis context.',
                'Восстанавливаем выбранную сессию и контекст агрегированной аналитики.',
              )}
            />
          </div>
        }
      >
        <ExperienceWorkspace projectId={projectId} projectName={projectName} />
      </Suspense>
    );
  }
  if (section === 'live') {
    return <LiveWorkspace projectId={projectId} projectName={projectName} />;
  }

  if (section === 'sources') {
    if (!access.data?.capabilities.manageSources) return <PermissionState projectId={projectId} />;
    return (
      <div className={styles.page}>
        <PageHeading
          eyebrow={t('Data management', 'Управление данными')}
          title={t('Sources', 'Источники')}
          description={t(
            'Website and tracker origins feed a Project; they are not the product navigation model.',
            'Сайт и источники трекера наполняют проект данными, но не являются моделью продуктовой навигации.',
          )}
        />
        <section className={styles.sourceRow}>
          <span className={styles.sourceIcon}>
            <Database aria-hidden="true" size={20} />
          </span>
          <div>
            <p className={styles.eyebrow}>{t('Connected source', 'Подключённый источник')}</p>
            <h2>{projectName}</h2>
            <p>
              {t(
                'The existing Website record currently provides the one-to-one Project facade.',
                'Существующая запись Website сейчас обеспечивает однозначное соответствие проекту.',
              )}
            </p>
          </div>
          <span className={styles.sourceStatus}>{t('Available', 'Доступен')}</span>
        </section>
      </div>
    );
  }

  if (section === 'legal') {
    return (
      <div className={styles.page}>
        <PageHeading
          eyebrow={t('Open source provenance', 'Происхождение открытого кода')}
          title={t('Legal & notices', 'Лицензии и уведомления')}
          description={t(
            'Signal Studio preserves the license and attribution of its Umami foundation.',
            'Signal Studio сохраняет лицензию и атрибуцию основы Umami.',
          )}
        />
        <article className={styles.legalNotice}>
          <Scale aria-hidden="true" size={24} />
          <div>
            <h2>{t('Based on Umami', 'На основе Umami')}</h2>
            <p>
              {t(
                'Signal Studio is based on Umami 3.3.1, Copyright © 2022 Umami Software, Inc., and is distributed under the MIT License.',
                'Signal Studio основан на Umami 3.3.1, Copyright © 2022 Umami Software, Inc., и распространяется по лицензии MIT.',
              )}
            </p>
            <p>
              {t(
                'The original MIT notice is preserved. Inter is OFL-1.1; Lorelei design is CC0 by Lisa Wischofsky, with MIT code by Florian Körner. Dependency notices and the exact build inventory are available below.',
                'Исходное уведомление MIT сохранено. Inter — OFL-1.1; дизайн Lorelei — CC0, автор Lisa Wischofsky, код MIT — Florian Körner. Уведомления зависимостей и точный состав сборки доступны ниже.',
              )}
            </p>
            <ul>
              <li><a href={`${process.env.basePath || ''}/legal/LICENSE.txt`}>{t('Original MIT license', 'Исходная лицензия MIT')}</a></li>
              <li><a href={`${process.env.basePath || ''}/legal/THIRD_PARTY_NOTICES.md`}>{t('Third-party notices', 'Уведомления сторонних компонентов')}</a></li>
              <li><a href={`${process.env.basePath || ''}/legal/DEPENDENCY_LICENSES.txt`}>{t('Full dependency license texts', 'Полные тексты лицензий зависимостей')}</a></li>
              <li><a href={`${process.env.basePath || ''}/legal/application.cdx.json`}>{t('Application SBOM (CycloneDX)', 'SBOM приложения (CycloneDX)')}</a></li>
              <li><a href={`${process.env.basePath || ''}/legal/ASSET_PROVENANCE.json`}>{t('Asset sources and checksums', 'Источники и контрольные суммы ресурсов')}</a></li>
              <li><a href={`${process.env.basePath || ''}/legal/BUILD_METADATA.json`}>{t('Build identity', 'Идентификатор сборки')}</a></li>
            </ul>
          </div>
        </article>
      </div>
    );
  }

    return (
      <div className={styles.page}>
        <StudioState
          variant="error"
          title={t('Unknown Studio page', 'Неизвестная страница Studio')}
          message={t(
            'Use the primary navigation to open a supported project page.',
            'Откройте поддерживаемую страницу проекта через основную навигацию.',
          )}
          action={
            <Link href={getStudioPath(projectId, 'home')}>
              {t('Return to Home', 'Вернуться на главную')}
            </Link>
          }
        />
      </div>
    );

}

function PermissionState({ projectId }: { projectId: string }) {
  const { t } = useStudioLocale();

  return (
    <div className={styles.page}>
      <StudioState
        variant="permission"
        title={t('Insufficient permissions', 'Недостаточно прав')}
        message={t(
          'Your current role cannot open this section. Its data was not loaded.',
          'Текущая роль не разрешает открывать этот раздел. Данные раздела не загружались.',
        )}
        action={
          <Link href={getStudioPath(projectId, 'home')}>
            {t('Return to Home', 'Вернуться на главную')}
          </Link>
        }
      />
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className={styles.pageHeading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
