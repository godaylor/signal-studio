import { Button, Dialog, DialogTrigger, Grid, Icon, Popover, Text } from '@umami/react-zen';
import { Globe } from 'lucide-react';
import { useLocale } from '@/components/hooks';
import { languages, PUBLIC_LOCALES } from '@/lib/lang';

export function LanguageButton() {
  const { locale, saveLocale } = useLocale();
  const items = PUBLIC_LOCALES.map(key => ({
    ...languages[key],
    shortLabel: key === 'en-US' ? 'EN' : 'RU',
    value: key,
  }));
  const currentLabel = locale === 'en-US' ? 'EN' : 'RU';

  function handleSelect(value: string, close: () => void) {
    saveLocale(value);
    close();
  }

  return (
    <DialogTrigger key="language">
      <Button variant="quiet" aria-label={locale === 'en-US' ? 'Select language' : 'Выбрать язык'}>
        <Icon color="primary">
          <Globe />
        </Icon>
        <Text>{currentLabel}</Text>
      </Button>
      <Popover side="bottom" align="end">
        <Dialog>
          {({ close }) => (
            <Grid columns="repeat(2, minmax(120px, 1fr))" overflow="hidden">
              {items.map(({ value, label, shortLabel }) => {
                return (
                  <Button key={value} variant="quiet" onPress={() => handleSelect(value, close)}>
                    <Text
                      weight={value === locale ? 'bold' : 'medium'}
                      color={value === locale ? undefined : 'muted'}
                    >
                      {shortLabel} — {label}
                    </Text>
                  </Button>
                );
              })}
            </Grid>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
