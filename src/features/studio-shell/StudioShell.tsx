'use client';

import { useTheme } from '@umami/react-zen';
import {
  CircleHelp,
  Command,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Search,
  Sun,
} from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  useConfig,
  useLoginQuery,
  useTwoFactorStatusQuery,
  useUserWebsitesQuery,
  useWebsiteQuery,
} from '@/components/hooks';
import { TwoFactorSetupModal } from '@/components/modals/TwoFactorSetupModal';
import { useProjectAccess } from '@/features/access/useProjectAccess';
import guestStyles from '@/features/guest/GuestWorkspace.module.css';
import { GuestWorkspaceContext } from '@/features/guest/GuestWorkspaceContext';
import { useGuestProjectRecovery } from '@/features/guest/useGuestProjectRecovery';
import { useGuestSession } from '@/features/guest/useGuestSession';
import { WorkspaceHelp } from '@/features/guest/WorkspaceHelp';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { BrandMark } from '@/features/visual/BrandMark';
import { useVisualMotion } from '@/features/visual/MotionPreferences';
import type { StudioCapabilities, StudioRole } from '@/server/permissions/capabilities';
import { AccessibleDialog } from './AccessibleDialog';
import { CommandPalette } from './CommandPalette';
import {
  getLocalizedStudioNavigation,
  getStudioPath,
  type StudioNavItem,
  studioNavigation,
  studioUtilityNavigation,
} from './navigation';
import styles from './StudioShell.module.css';
import { StudioLoadingScreen, StudioState } from './StudioState';

export function StudioShell({ projectId, children }: { projectId: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const config = useConfig();
  const { theme, setTheme } = useTheme();
  const { animate, enabled: motionEnabled, toggle: toggleMotion } = useVisualMotion();
  const { locale, t } = useStudioLocale();
  const localizedNavigation = useMemo(() => getLocalizedStudioNavigation(locale), [locale]);
  const { user, isLoading: isLoginLoading, error: loginError } = useLoginQuery();
  const {
    data: project,
    isLoading: isProjectLoading,
    error: projectError,
  } = useWebsiteQuery(projectId, { enabled: !!user });
  const {
    data: access,
    isLoading: isAccessLoading,
    error: accessError,
  } = useProjectAccess(projectId, !!user);
  const { data: projectList } = useUserWebsitesQuery(
    { userId: user?.id },
    { pageSize: 100, includeTeams: true },
    { enabled: !!user },
  );
  const { data: twoFactorStatus } = useTwoFactorStatusQuery(
    !!user && !user?.isGuest && !config?.cloudMode,
  );
  const guest = useGuestSession(!!user?.isGuest);
  const recoveringGuest = useGuestProjectRecovery(projectId, user?.isGuest ? guest.data : null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const projects: { id: string; name: string }[] = projectList?.data ?? [];
  const pathSection = pathname.split('/').filter(Boolean)[2] ?? 'home';
  const roleLabel = access
    ? roleLabels[access.studioRole][locale === 'en-US' ? 'en-US' : 'ru-RU']
    : '—';
  const needsTwoFactorSetup = !!(twoFactorStatus?.isRequired && !twoFactorStatus?.isEnabled);

  useEffect(() => {
    if (!guest.data?.expiresAt) return;
    const remaining = new Date(guest.data.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(
      () => window.location.assign(`${process.env.basePath || ''}/login?guest=expired`),
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(timer);
  }, [guest.data?.expiresAt]);

  useEffect(() => {
    if (loginError && config) {
      window.location.href = config.cloudMode
        ? `${process.env.cloudUrl}/login`
        : `${process.env.basePath || ''}/login`;
    }
  }, [config, loginError]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(open => !open);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const paletteItems = useMemo(
    () =>
      localizedNavigation
        .filter(item => canOpenNavigation(item.id, access?.capabilities))
        .map(item => ({
          ...item,
          path: getStudioPath(projectId, item.id),
        })),
    [access?.capabilities, localizedNavigation, projectId],
  );

  if (
    !config ||
    recoveringGuest ||
    isLoginLoading ||
    isProjectLoading ||
    isAccessLoading ||
    (user?.isGuest && guest.isPending)
  ) {
    return <StudioLoadingScreen />;
  }

  if (loginError) {
    return <StudioLoadingScreen />;
  }

  if (!user || projectError || accessError || !project || !access) {
    return (
      <main className={`${styles.studioFrame} ${styles.permissionPage}`}>
        <StudioState
          variant="permission"
          title={t('Project access is unavailable', 'Доступ к проекту недоступен')}
          message={t(
            'The project does not exist or your current role cannot open it. No project data was loaded.',
            'Проект не существует или текущая роль не разрешает его открыть. Данные проекта не загружались.',
          )}
          action={
            <Link href="/studio">
              {t('Choose an available project', 'Выбрать доступный проект')}
            </Link>
          }
        />
      </main>
    );
  }

  const handleProjectChange = (nextProjectId: string) => {
    const compatibleSection = studioNavigation.some(item => item.id === pathSection)
      ? pathSection
      : 'home';
    router.push(getStudioPath(nextProjectId, compatibleSection));
  };

  const SourceIcon = studioUtilityNavigation[0].icon;
  const SettingsIcon = studioUtilityNavigation[1].icon;

  return (
    <div
      className={styles.studioFrame}
      data-studio-shell
      data-sidebar-collapsed={sidebarCollapsed || undefined}
    >
      <a className={styles.skipLink} href="#studio-main">
        {t('Skip to content', 'Перейти к содержимому')}
      </a>
      <aside className={styles.desktopSidebar} aria-label="Кинорит">
        <div className={styles.brandRow}>
          <Link className={styles.brand} href={getStudioPath(projectId, 'home')}>
            <BrandMark wordmark />
          </Link>
          <button
            className={styles.iconButton}
            type="button"
            onClick={() => setSidebarCollapsed(value => !value)}
            aria-label={
              sidebarCollapsed
                ? t('Expand navigation', 'Развернуть навигацию')
                : t('Collapse navigation', 'Свернуть навигацию')
            }
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" size={18} />
            ) : (
              <PanelLeftClose aria-hidden="true" size={18} />
            )}
          </button>
        </div>
        <ProjectSelector
          projectId={projectId}
          projectName={project.name}
          projects={projects}
          collapsed={sidebarCollapsed}
          onChange={handleProjectChange}
          locale={locale}
        />
        <PrimaryNavigation
          projectId={projectId}
          selectedSection={pathSection}
          collapsed={sidebarCollapsed}
          capabilities={access.capabilities}
          navigation={localizedNavigation}
        />
        <div className={styles.sidebarUtility}>
          {access.capabilities.manageSources ? (
            <Link
              className={styles.utilityLink}
              href={getStudioPath(projectId, 'sources')}
              aria-label={t('Sources', 'Источники')}
              title={sidebarCollapsed ? t('Sources', 'Источники') : undefined}
            >
              <SourceIcon aria-hidden="true" size={18} />
              <span>{t('Sources', 'Источники')}</span>
            </Link>
          ) : null}
          {!user.isGuest &&
          (access.capabilities.manageMembers ||
            access.capabilities.editInsights ||
            access.capabilities.editDashboards) ? (
            <Link
              className={styles.utilityLink}
              href={getStudioPath(projectId, 'settings')}
              aria-label={t('Workspace settings', 'Настройки пространства')}
              title={
                sidebarCollapsed ? t('Workspace settings', 'Настройки пространства') : undefined
              }
            >
              <SettingsIcon aria-hidden="true" size={18} />
              <span>{t('Workspace settings', 'Настройки пространства')}</span>
            </Link>
          ) : null}
          <button
            type="button"
            className={styles.utilityLink}
            onClick={() => setHelpOpen(true)}
            aria-label={t('Help & definitions', 'Справка и определения')}
          >
            <CircleHelp aria-hidden="true" size={18} />
            <span>{t('Help & definitions', 'Справка и определения')}</span>
          </button>
          <button
            type="button"
            className={styles.utilityLink}
            onClick={() => setCommandOpen(true)}
            aria-label={t('Command palette', 'Палитра команд')}
            title={sidebarCollapsed ? t('Command palette', 'Палитра команд') : undefined}
          >
            <Command aria-hidden="true" size={18} />
            <span>{t('Command palette', 'Палитра команд')}</span>
            <kbd>⌘K</kbd>
          </button>
        </div>
        <div className={styles.userSummary}>
          <span className={styles.avatar} aria-hidden="true">
            <BrandMark />
          </span>
          <span>
            <strong>{user.isGuest ? t('Guest', 'Гость') : user.username}</strong>
            <small>
              {user.isGuest ? t('Your private workspace', 'Ваше личное пространство') : roleLabel}
            </small>
          </span>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <strong>{project.name}</strong>
            <span>/</span>
            {localizedNavigation.find(item => item.id === pathSection)?.label ?? pathSection}
          </div>
          <button
            className={`${styles.iconButton} ${styles.mobileMenuButton}`}
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t('Open navigation', 'Открыть навигацию')}
            aria-expanded={mobileOpen}
          >
            <Menu aria-hidden="true" size={20} />
          </button>
          <div className={styles.mobileBrand}>
            <BrandMark wordmark />
          </div>
          <div className={styles.topbarProject}>
            <ProjectSelector
              projectId={projectId}
              projectName={project.name}
              projects={projects}
              onChange={handleProjectChange}
              locale={locale}
            />
          </div>
          <div className={styles.topbarActions}>
            {guest.data ? (
              <div className={`${guestStyles.session} ${styles.guestMeta}`}>
                <button
                  type="button"
                  className={guestStyles.synthetic}
                  onClick={() => setHelpOpen(true)}
                >
                  {t('Synthetic data', 'Синтетические данные')}
                </button>
                <strong>
                  {t('Guest until', 'Гость до')}{' '}
                  {new Date(guest.data.expiresAt).toLocaleString(locale, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </div>
            ) : null}
            <button
              type="button"
              className={styles.iconButton}
              onClick={toggleMotion}
              aria-label={
                motionEnabled
                  ? t('Pause animation', 'Приостановить анимацию')
                  : t('Enable animation', 'Включить анимацию')
              }
            >
              {motionEnabled ? (
                <Pause size={17} aria-hidden="true" />
              ) : (
                <Play size={17} aria-hidden="true" />
              )}
            </button>
            <button
              className={styles.commandButton}
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label={t('Open command palette', 'Открыть палитру команд')}
            >
              <Search aria-hidden="true" size={17} />
              <span>{t('Search', 'Поиск')}</span>
              <kbd>⌘K</kbd>
            </button>
            <button
              className={styles.iconButton}
              type="button"
              aria-label={
                theme === 'dark'
                  ? t('Switch to light theme', 'Включить светлую тему')
                  : t('Switch to dark theme', 'Включить тёмную тему')
              }
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <Sun aria-hidden="true" size={18} />
              ) : (
                <Moon aria-hidden="true" size={18} />
              )}
            </button>
            {!user.isGuest ? (
              <Link
                className={styles.avatarButton}
                href="/settings/profile"
                aria-label={t('Profile settings', 'Настройки профиля')}
              >
                {user.username.slice(0, 1).toLocaleUpperCase()}
              </Link>
            ) : null}
            <Link className={styles.iconButton} href="/logout" aria-label={t('Log out', 'Выйти')}>
              <LogOut aria-hidden="true" size={18} />
            </Link>
          </div>
        </header>
        <GuestWorkspaceContext.Provider value={user.isGuest ? (guest.data ?? null) : null}>
          <main id="studio-main" className={styles.mainContent} tabIndex={-1}>
            <motion.div
              className={styles.routeFrame}
              key={pathSection}
              initial={animate ? { y: 18 } : false}
              animate={{ y: 0 }}
              transition={{ type: 'tween', duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </main>
        </GuestWorkspaceContext.Provider>
        <footer className={styles.footer}>
          <span>Кинорит</span>
          <Link href={getStudioPath(projectId, 'legal')}>
            {t('Based on Umami · MIT', 'На основе Umami · MIT')}
          </Link>
        </footer>
      </div>

      <nav
        className={styles.mobileBottomNav}
        aria-label={t('Quick navigation', 'Быстрая навигация')}
      >
        {localizedNavigation.slice(0, 3).map(item => (
          <Link
            key={item.id}
            href={getStudioPath(projectId, item.id)}
            aria-current={pathSection === item.id ? 'page' : undefined}
          >
            <item.icon size={20} aria-hidden="true" />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={t('Open navigation', 'Открыть навигацию')}
        >
          <Menu size={20} aria-hidden="true" />
          {t('More', 'Ещё')}
        </button>
      </nav>

      <AccessibleDialog
        open={mobileOpen}
        title="Кинорит"
        description={`${project.name} · ${roleLabel}`}
        side="left"
        onClose={() => setMobileOpen(false)}
      >
        <div className={styles.mobileNavBody} data-autofocus tabIndex={-1}>
          <PrimaryNavigation
            projectId={projectId}
            selectedSection={pathSection}
            onNavigate={() => setMobileOpen(false)}
            capabilities={access.capabilities}
            navigation={localizedNavigation}
          />
          <div className={styles.mobileUtilityLinks}>
            {access.capabilities.manageSources ? (
              <Link href={getStudioPath(projectId, 'sources')} onClick={() => setMobileOpen(false)}>
                {t('Sources', 'Источники')}
              </Link>
            ) : null}
            {!user.isGuest &&
            (access.capabilities.manageMembers ||
              access.capabilities.editInsights ||
              access.capabilities.editDashboards) ? (
              <Link
                href={getStudioPath(projectId, 'settings')}
                onClick={() => setMobileOpen(false)}
              >
                {t('Workspace settings', 'Настройки пространства')}
              </Link>
            ) : null}
            <button
              type="button"
              className={styles.utilityLink}
              onClick={() => {
                setMobileOpen(false);
                setHelpOpen(true);
              }}
            >
              <CircleHelp aria-hidden="true" size={18} />
              {t('Help & definitions', 'Справка и определения')}
            </button>
            <Link href={getStudioPath(projectId, 'legal')} onClick={() => setMobileOpen(false)}>
              {t('Legal & notices', 'Лицензии и уведомления')}
            </Link>
          </div>
        </div>
      </AccessibleDialog>

      <CommandPalette
        items={paletteItems}
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onNavigate={path => router.push(path)}
        locale={locale}
      />

      {needsTwoFactorSetup ? <TwoFactorSetupModal required={true} /> : null}
      <WorkspaceHelp open={helpOpen} onClose={() => setHelpOpen(false)} guest={guest.data} />
    </div>
  );
}

function PrimaryNavigation({
  projectId,
  selectedSection,
  collapsed = false,
  onNavigate,
  capabilities,
  navigation,
}: {
  projectId: string;
  selectedSection: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  capabilities: StudioCapabilities;
  navigation: StudioNavItem[];
}) {
  const groupId = useId();
  return (
    <LayoutGroup id={groupId}>
      <nav
        className={styles.primaryNav}
        aria-label={navigation[0]?.label === 'Home' ? 'Primary' : 'Основная'}
      >
        {navigation
          .filter(item => canOpenNavigation(item.id, capabilities))
          .map(item => {
            const Icon = item.icon;
            const selected = selectedSection === item.id;
            return (
              <Link
                key={item.id}
                href={getStudioPath(projectId, item.id)}
                className={styles.navLink}
                data-selected={selected || undefined}
                aria-current={selected ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                onClick={onNavigate}
              >
                {selected ? (
                  <motion.span
                    className={styles.navMarker}
                    layoutId="selected-navigation"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon aria-hidden="true" size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>
    </LayoutGroup>
  );
}

const roleLabels: Record<StudioRole, Record<'ru-RU' | 'en-US', string>> = {
  owner: { 'ru-RU': 'Владелец', 'en-US': 'Owner' },
  admin: { 'ru-RU': 'Администратор', 'en-US': 'Admin' },
  analyst: { 'ru-RU': 'Аналитик', 'en-US': 'Analyst' },
  editor: { 'ru-RU': 'Редактор', 'en-US': 'Editor' },
  viewer: { 'ru-RU': 'Наблюдатель', 'en-US': 'Viewer' },
};

function canOpenNavigation(section: string, capabilities?: StudioCapabilities) {
  if (!capabilities) return false;
  if (section === 'audiences' || section === 'experience') return capabilities.viewIdentity;
  return capabilities.viewAggregate;
}

function ProjectSelector({
  projectId,
  projectName,
  projects,
  collapsed = false,
  onChange,
  locale,
}: {
  projectId: string;
  projectName: string;
  projects: { id: string; name: string }[];
  collapsed?: boolean;
  onChange: (projectId: string) => void;
  locale: string;
}) {
  return (
    <label className={styles.projectSelector} data-collapsed={collapsed || undefined}>
      <span className={styles.visuallyHidden}>{locale === 'en-US' ? 'Project' : 'Проект'}</span>
      <span className={styles.projectGlyph} aria-hidden="true">
        {projectName.slice(0, 1).toLocaleUpperCase()}
      </span>
      <span className={styles.projectSelectText}>
        <small>{locale === 'en-US' ? 'Project' : 'Проект'}</small>
        <select value={projectId} onChange={event => onChange(event.target.value)}>
          {projects.length ? (
            projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))
          ) : (
            <option value={projectId}>{projectName}</option>
          )}
        </select>
      </span>
    </label>
  );
}
