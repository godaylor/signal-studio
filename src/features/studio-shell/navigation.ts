import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Database,
  Home,
  LayoutDashboard,
  PlayCircle,
  Search,
  Settings,
  Users,
} from 'lucide-react';

export type StudioSection = 'home' | 'explore' | 'dashboards' | 'audiences' | 'experience' | 'live';

export type StudioNavItem = {
  id: StudioSection;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const studioNavigation: StudioNavItem[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'Project health and recent analytical work',
    icon: Home,
  },
  {
    id: 'explore',
    label: 'Explore',
    description: 'Define a reproducible analytical question',
    icon: Search,
  },
  {
    id: 'dashboards',
    label: 'Dashboards',
    description: 'Curated monitoring from saved insights',
    icon: LayoutDashboard,
  },
  {
    id: 'audiences',
    label: 'Audiences',
    description: 'Accounts, users, segments and cohorts',
    icon: Users,
  },
  {
    id: 'experience',
    label: 'Experience',
    description: 'Sessions, replay and performance evidence',
    icon: PlayCircle,
  },
  {
    id: 'live',
    label: 'Live',
    description: 'Timestamped near-realtime activity',
    icon: Activity,
  },
];

export const studioUtilityNavigation = [
  {
    id: 'sources',
    label: 'Sources',
    description: 'Tracking sources connected to this project',
    icon: Database,
  },
  {
    id: 'settings',
    label: 'Workspace settings',
    description: 'Members, security and workspace preferences',
    icon: Settings,
    adminOnly: true,
  },
] as const;

const russianNavigation: Record<StudioSection, Pick<StudioNavItem, 'label' | 'description'>> = {
  home: { label: 'Главная', description: 'Состояние проекта и недавняя аналитическая работа' },
  explore: { label: 'Анализ', description: 'Воспроизводимый аналитический вопрос' },
  dashboards: { label: 'Дашборды', description: 'Мониторинг на основе сохранённых Insights' },
  audiences: { label: 'Аудитории', description: 'Аккаунты, пользователи, сегменты и когорты' },
  experience: { label: 'Опыт', description: 'Сессии, replay и данные о производительности' },
  live: { label: 'Сейчас', description: 'Активность с отметкой времени почти в реальном времени' },
};

export function getLocalizedStudioNavigation(locale: string) {
  if (locale === 'en-US') return studioNavigation;
  return studioNavigation.map(item => ({ ...item, ...russianNavigation[item.id] }));
}

export function getStudioPath(projectId: string, section: string) {
  return `/studio/${projectId}/${section}`;
}

export function isStudioSection(value: string): value is StudioSection {
  return studioNavigation.some(item => item.id === value);
}
