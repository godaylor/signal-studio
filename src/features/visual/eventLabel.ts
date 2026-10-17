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
        signup: 'Зарегистрировались',
        onboarding_completed: 'Завершили настройку',
        core_feature_used: 'Использовали функцию',
        subscription_started: 'Оформили подписку',
      } as Record<string, string>
    )[value] ?? value
  );
}
