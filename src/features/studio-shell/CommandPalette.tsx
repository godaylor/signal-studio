'use client';

import { Command, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AccessibleDialog } from './AccessibleDialog';
import type { StudioNavItem } from './navigation';
import styles from './StudioShell.module.css';

type PaletteItem = Pick<StudioNavItem, 'id' | 'label' | 'description' | 'icon'> & {
  path: string;
};

export function CommandPalette({
  items,
  open,
  onOpenChange,
  onNavigate,
  locale = 'en-US',
}: {
  items: PaletteItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  locale?: string;
}) {
  const isEnglish = locale === 'en-US';
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const filteredItems = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();

    if (!value) {
      return items;
    }

    return items.filter(item =>
      `${item.label} ${item.description}`.toLocaleLowerCase().includes(value),
    );
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(index => Math.min(index, Math.max(filteredItems.length - 1, 0)));
  }, [filteredItems.length]);

  const navigate = (item: PaletteItem) => {
    onOpenChange(false);
    onNavigate(item.path);
  };

  return (
    <AccessibleDialog
      open={open}
      title={isEnglish ? 'Go to' : 'Перейти'}
      description={
        isEnglish
          ? 'Search the pages available in this project.'
          : 'Поиск доступных страниц проекта.'
      }
      onClose={() => onOpenChange(false)}
    >
      <div className={styles.commandSearch}>
        <Search aria-hidden="true" size={18} />
        <input
          data-autofocus
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex(index => Math.min(index + 1, filteredItems.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex(index => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && filteredItems[activeIndex]) {
              event.preventDefault();
              navigate(filteredItems[activeIndex]);
            }
          }}
          aria-label={isEnglish ? 'Search Studio pages' : 'Поиск по страницам Studio'}
          aria-controls="studio-command-results"
          aria-activedescendant={filteredItems[activeIndex]?.id}
          placeholder={
            isEnglish ? 'Search Home, Explore, Audiences…' : 'Поиск: Главная, Анализ, Аудитории…'
          }
        />
        <kbd>Esc</kbd>
      </div>
      <div id="studio-command-results" className={styles.commandResults} role="listbox">
        {filteredItems.length ? (
          filteredItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={item.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={styles.commandResult}
                data-active={index === activeIndex || undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => navigate(item)}
              >
                <Icon aria-hidden="true" size={18} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })
        ) : (
          <div className={styles.commandEmpty} role="status">
            {isEnglish
              ? `No permitted page matches “${query}”.`
              : `Нет доступной страницы по запросу «${query}».`}
          </div>
        )}
      </div>
      <footer className={styles.commandFooter}>
        <span>
          <Command aria-hidden="true" size={14} /> {isEnglish ? 'K to open' : 'K — открыть'}
        </span>
        <span>{isEnglish ? '↑ ↓ to move · Enter to open' : '↑ ↓ — выбор · Enter — открыть'}</span>
      </footer>
    </AccessibleDialog>
  );
}
