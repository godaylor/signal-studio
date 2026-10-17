'use client';

import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { AccessibleDialog } from '@/features/studio-shell/AccessibleDialog';
import styles from './GuestWorkspace.module.css';
import type { GuestSessionDto } from './useGuestSession';

export function WorkspaceHelp({
  open,
  onClose,
  guest,
}: {
  open: boolean;
  onClose: () => void;
  guest?: GuestSessionDto | null;
}) {
  const { t, locale } = useStudioLocale();
  return (
    <AccessibleDialog
      open={open}
      onClose={onClose}
      title={t('How to read the workspace', 'Как читать данные')}
      description={t(
        'Definitions, saved work and workspace limits.',
        'Определения, сохранение работы и ограничения пространства.',
      )}
    >
      <article className={styles.help}>
        {guest ? (
          <>
            <h3>
              {t(
                'A fictional product, real calculations',
                'Вымышленный продукт, настоящие расчёты',
              )}
            </h3>
            <p>
              {t(
                `This isolated space contains ${guest.dataset.events.toLocaleString(locale)} synthetic events over ${guest.dataset.days} days. Every chart and export is calculated from these stored events. These are not customer data.`,
                `В этом личном пространстве ${guest.dataset.events.toLocaleString(locale)} синтетическое событие за ${guest.dataset.days} дня. Графики и экспорт рассчитываются по сохранённым событиям. Это не данные реальных клиентов.`,
              )}
            </p>
            <p>
              {t(
                'Start with signup → onboarding_completed → core_feature_used. Change a step or filter by device to investigate where activation differs.',
                'Начните с signup → onboarding_completed → core_feature_used. Измените шаг или добавьте фильтр по устройству, чтобы исследовать различия в активации.',
              )}
            </p>
            <h3>{t('Your guest work', 'Ваша гостевая работа')}</h3>
            <p>
              {t(
                'Insights and dashboards are saved on the server. Reloading and reopening this browser preserve them until',
                'Анализы и дашборды сохраняются на сервере. Обновление страницы и возвращение в этом браузере сохраняют работу до',
              )}{' '}
              {new Date(guest.expiresAt).toLocaleString(locale)}.{' '}
              {t(
                'Clearing cookies loses access. After expiry the space is removed.',
                'При удалении cookies доступ теряется. После истечения срока пространство удаляется.',
              )}
            </p>
            <p>
              {t('Limits per space:', 'Ограничения пространства:')} {guest.limits.insights}{' '}
              {t('insights', 'анализов')}, {guest.limits.dashboards} {t('dashboards', 'дашбордов')},{' '}
              {guest.limits.exports} {t('exports', 'экспортов')}, {guest.limits.queries}{' '}
              {t('analysis requests', 'запросов анализа')}.{' '}
              {t(
                'Sharing, source changes and account administration are unavailable to guests.',
                'Публикация ссылок, изменение источников и управление аккаунтами гостям недоступны.',
              )}
            </p>
          </>
        ) : null}
        <h3>{t('Define the question', 'Сформулируйте вопрос')}</h3>
        <p>
          {t(
            'The Query Spine records the event, measure, filters and time range. Edit a block and run analysis. The address restores the applied question; an Insight keeps it for later.',
            'Цепочка анализа задаёт событие, метрику, фильтры и период. Измените блок и выполните анализ. Ссылка восстанавливает применённый вопрос; сохранённый анализ позволяет вернуться к нему позже.',
          )}
        </p>
        <h3>{t('Read the result', 'Прочитайте результат')}</h3>
        <p>
          {t(
            'Event count includes repeated actions. Unique users count each identified person once across the range. Funnel conversion counts people who completed ordered steps within the selected window. The table provides the same data as the chart.',
            'Число событий включает повторные действия. Уникальные пользователи учитывают каждого известного участника один раз за период. Конверсия воронки учитывает участников, последовательно выполнивших шаги за выбранное время. Таблица содержит те же данные, что и график.',
          )}
        </p>
        <p>
          {t(
            'Date ranges include the start and exclude the end, in the selected timezone. The result definition and calculation time appear below each analysis. Late arrivals and deletions can change historical results.',
            'Период включает начальную дату и исключает конечную в выбранном часовом поясе. Определение и время расчёта находятся под анализом. Поздние события и удаление данных могут изменить исторические значения.',
          )}
        </p>
        <h3>{t('Keep and export', 'Сохраните и экспортируйте')}</h3>
        <p>
          {t(
            'Save an Insight, then add it to a dashboard in edit mode. Export CSV for a table or JSON for the result and its definition. Exports retain your permissions and filters.',
            'Сохраните анализ, затем добавьте его на дашборд в режиме редактирования. Экспортируйте таблицу в CSV или результат с определением в JSON. Экспорт учитывает ваши права и фильтры.',
          )}
        </p>
      </article>
    </AccessibleDialog>
  );
}
