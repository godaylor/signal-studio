import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { getBaseUrl } from '@/lib/get-base-url';
import { Providers } from './Providers';
import '@umami/react-zen/styles.full.css';
import './global.css';

const inter = localFont({
  src: '../assets/fonts/InterVariable.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
  preload: false,
});

const golos = localFont({
  src: '../assets/fonts/GolosTextVariable.woff2',
  weight: '400 900',
  display: 'swap',
  variable: '--font-golos',
});
const unbounded = localFont({
  src: '../assets/fonts/UnboundedVariable.woff2',
  weight: '200 900',
  display: 'swap',
  variable: '--font-unbounded',
  preload: false,
});

export default function ({ children }) {
  if (process.env.DISABLE_UI) {
    return (
      <html>
        <body></body>
      </html>
    );
  }

  return (
    <html
      lang="ru"
      className={`${inter.className} ${inter.variable} ${golos.variable} ${unbounded.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.ico?v=m21" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=m21" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=m21" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=m21" />
        <link rel="manifest" href="/site.webmanifest?v=m21" crossOrigin="use-credentials" />
        <meta name="msapplication-TileColor" content="#136e95" />
        <meta name="theme-color" content="#f0f6f8" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#061b2c" media="(prefers-color-scheme: dark)" />
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body>
        <Suspense>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();

  return {
    metadataBase: getBaseUrl(headerStore),
    title: {
      template: '%s | Кинорит',
      default: 'Кинорит — от событий к пониманию продукта',
    },
    description:
      'Кинорит — продуктовая аналитика: исследуйте поведение, находите точки роста и сохраняйте решения.',
  };
}
