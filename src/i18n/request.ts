import { getRequestConfig } from 'next-intl/server';
import ruRU from '../../public/intl/messages/ru-RU.json';

export default getRequestConfig(async () => {
  return {
    locale: 'ru-RU',
    messages: ruRU,
  };
});
