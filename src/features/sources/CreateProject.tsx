'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { getStudioPath } from '@/features/studio-shell/navigation';
import styles from './SourcesWorkspace.module.css';
import { useCreateProject } from './useCreateProject';

export function CreateProject({ onStart }: { onStart?: () => void }) {
  const { t } = useStudioLocale();
  const router = useRouter();
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [invalidDomain, setInvalidDomain] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;
    let hostname: string;
    try {
      const url = new URL(domain.includes('://') ? domain : `https://${domain}`);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.'))
        throw new Error();
      hostname = url.hostname;
    } catch {
      setInvalidDomain(true);
      return;
    }
    setInvalidDomain(false);
    onStart?.();
    try {
      const project = await create.mutateAsync({ name: name.trim(), domain: hostname });
      router.push(getStudioPath(project.id, 'sources'));
    } catch {
      // The mutation's error state provides a safe, localized retry message.
    }
  }

  return (
    <section className={styles.create} aria-labelledby="create-project-title">
      <p className={styles.eyebrow}>Signal Studio</p>
      <h1 id="create-project-title">
        {t('Understand how people use your product', 'Узнайте, как люди используют ваш продукт')}
      </h1>
      <p>
        {t(
          'Connect your website, collect events, and turn a question into a saved insight.',
          'Подключите сайт, собирайте события и сохраняйте ответы на продуктовые вопросы.',
        )}
      </p>
      <form onSubmit={submit} className={styles.form}>
        <label htmlFor="project-name">{t('Project name', 'Название проекта')}</label>
        <input
          id="project-name"
          value={name}
          onChange={event => setName(event.target.value)}
          required
          maxLength={100}
          placeholder={t('My product', 'Мой продукт')}
          autoComplete="organization"
        />
        <label htmlFor="project-domain">{t('Website address', 'Адрес сайта')}</label>
        <input
          id="project-domain"
          value={domain}
          onChange={event => {
            setDomain(event.target.value);
            setInvalidDomain(false);
          }}
          required
          maxLength={500}
          placeholder="https://example.com"
          autoComplete="url"
          aria-describedby="domain-help"
          aria-invalid={invalidDomain || undefined}
        />
        <p id="domain-help">
          {invalidDomain
            ? t(
                'Enter a valid website address, such as https://example.com.',
                'Введите адрес сайта, например https://example.com.',
              )
            : t(
                'You will get a tracking snippet to install on this website.',
                'Вы получите код трекера для установки на этот сайт.',
              )}
        </p>
        {create.isError && (
          <p role="alert">
            {t(
              'Project could not be created. Check your connection and permission to create projects, then retry.',
              'Не удалось создать проект. Проверьте соединение и право создавать проекты, затем повторите.',
            )}
          </p>
        )}
        <button type="submit" disabled={create.isPending || !name.trim()}>
          {create.isPending
            ? t('Creating project…', 'Создаём проект…')
            : t('Create project', 'Создать проект')}
        </button>
      </form>
      <p>
        <Link href="/studio">{t('Back to projects', 'Вернуться к проектам')}</Link>
      </p>
    </section>
  );
}
