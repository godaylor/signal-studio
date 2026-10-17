export function eventLabel(value: string, locale: string) {
  if (locale === 'en-US')
    return (
      (
        {
          signup: 'Signup',
          onboarding_completed: 'Setup complete',
          core_feature_used: 'Core feature',
          subscription_started: 'Subscription',
        } as Record<string, string>
      )[value] ?? value
    );
  return (
    (
      {
        signup: 'Регистрация',
        onboarding_completed: 'Настройка завершена',
        core_feature_used: 'Ключевая функция',
        subscription_started: 'Подписка оформлена',
      } as Record<string, string>
    )[value] ?? value
  );
}
