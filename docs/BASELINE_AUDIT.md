# Baseline audit: Umami 3.3.1

Дата аудита: 2026-08-27  
Baseline commit: `ca661c7057984aa98ed4f7083d84dae2f65bfcb0`  
Исходный remote: `https://github.com/umami-software/umami.git`  
Ветка: `master`  
Статус исходников до аудита: clean  
Лицензия: MIT, Copyright (c) Umami Software, Inc.

## 1. Назначение документа

Документ фиксирует исходное состояние проекта перед глубокой продуктовой трансформацией. Это не список обещанных изменений и не попытка оценить Umami как плохой или хороший продукт. Цели baseline:

- отделить фактически существующие возможности от будущей реализации;
- зафиксировать воспроизводимость установки, сборки и запуска;
- обозначить сильные части аналитического ядра, которые нельзя потерять;
- записать подтверждённые продуктовые, архитектурные, security, UX и performance gaps;
- определить измеримый нулевой уровень для следующих milestones.

Аудит выполнен статически по текущему checkout и динамически на локальном production build. Исходный код приложения не изменялся. После build был восстановлен единственный tracked-файл, которому upstream build временно изменил line endings; итоговое tracked tree осталось чистым.

## 2. Методика и границы

Пять независимых read-only аудитов покрыли:

1. архитектуру, стек, frontend/backend, API, data flow и deployment;
2. продуктовые экраны, аналитические механики, фильтры и UX;
3. storage/query/aggregation/cache/pagination/realtime/performance;
4. tests, security, auth/authz, accessibility, observability и technical debt;
5. MIT obligations, сторонние библиотеки, assets и provenance.

Динамическая проверка включала:

- frozen-lockfile install;
- unit/component/API-route tests;
- production build;
- отдельный TypeScript no-emit check;
- Biome lint;
- production HTTP smoke с dummy DB;
- PostgreSQL 15, все migrations, admin login и authenticated `/api/me`;
- Playwright E2E на чистой временной БД в CI-mode.

Не выполнялись:

- внешний CVE/SCA/license scan;
- penetration test;
- ручной screen-reader и contrast audit;
- нагрузочные тесты на миллионах событий;
- ClickHouse/Kafka/Redis runtime deployment;
- проверка опубликованного OCI image и его SBOM.

## 3. Репозиторий и runtime snapshot

| Параметр | Baseline |
|---|---|
| Приложение | Umami `3.3.1` (`package.json:2-3`) |
| Framework | Next.js `16.3.0`, React `19.2.8` (`package.json:93-104`) |
| Язык | TypeScript `6.0.3`, ESM (`package.json:11`, `package.json:147-148`) |
| Локальный Node | `22.15.1` |
| Локальный npm | `10.9.2` |
| Проверочный pnpm | `10.15.1`, как в upstream CI (`.github/workflows/ci.yml:16-19`) |
| Dockerfile pnpm | `11.21.0` (`Dockerfile:1-4`) |
| PostgreSQL | временный `postgres:15-alpine`, image digest `sha256:fe0737...` |
| Docker Engine | `29.6.2` |
| Source files | около 1072 файлов в `src` |
| API routes | 127 `route.ts` |
| Unit/component test files | 95 |
| E2E specs | 7 |

### Toolchain drift

- README заявляет Node `18.18+` и PostgreSQL `12.14+`: `README.md:26-32`.
- CI фактически использует Node 22 и pnpm 10.15.1: `.github/workflows/ci.yml:16-25`.
- Dockerfile фиксирует Node 22 и pnpm 11.21.0: `Dockerfile:1-4`.
- `package.json` не содержит `engines` и `packageManager`.
- DB validator допускает PostgreSQL 9.4+, что расходится и с README, и с compose: `scripts/check-db.js:8-9`, `scripts/check-db.js:55-69`.

Вывод: lockfile воспроизводим, но canonical local toolchain не зафиксирован единым контрактом.

## 4. Результат воспроизводимой установки и запуска

### 4.1 Install

Команда:

```powershell
npx.cmd -y pnpm@10.15.1 install --frozen-lockfile
```

Результат:

- `PASS`, exit code 0;
- lockfile признан актуальным, resolution пропущен;
- установлено 1031 package;
- tracked-файлы не изменились;
- pnpm сообщил, что build scripts ряда зависимостей были ignored, однако последующий `prisma generate`, tests и build завершились.

Первый `pnpm test` без env завершился до запуска тестов: Prisma config требует `DATABASE_URL`. После добавления dummy URL, идентичной upstream CI, тесты прошли. Это скрытая обязательная предпосылка test command.

### 4.2 Unit/component/API-route tests

```powershell
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/dummy'
npx.cmd -y pnpm@10.15.1 test
```

Результат:

- `PASS`;
- 95/95 test files;
- 739/739 tests;
- duration 23.02 s.

Vitest использует jsdom и colocated `*.test.ts(x)`: `vitest.config.ts:10-14`.

### 4.3 Production build

```powershell
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/dummy'
$env:SKIP_DB_CHECK='1'
npx.cmd -y pnpm@10.15.1 build
```

Результат:

- `PASS`;
- tracker и recorder bundles собраны;
- GeoLite2-City скачан;
- Next production compilation завершена за 11.2 s;
- 68 static pages generated;
- production route inventory собран;
- build явно сообщил `Skipping validation of types`.

Полный build не является чисто локальной компиляцией: он генерирует Prisma client, может подключаться к БД и применять migrations, скачивает GeoLite, собирает browser bundles и Next application (`package.json:15`, `package.json:24-38`). GeoLite fallback загружается из mutable GitHub URL без закреплённого revision/checksum: `scripts/build-geo.js:19-39`.

Upstream build также запускает formatter для `src/tracker/index.d.ts` (`package.json:23`), поэтому на Windows временно обновляет working-tree metadata/line endings. Содержимое blob осталось идентично HEAD; файл был восстановлен до baseline.

### 4.4 TypeScript и lint

```powershell
npx.cmd -y pnpm@10.15.1 exec tsc --noEmit
npx.cmd -y pnpm@10.15.1 lint
```

| Gate | Результат | Наблюдение |
|---|---|---|
| TypeScript no-emit | `PASS` | exit code 0 |
| Biome lint | `FAIL` | 1 error, 13 warnings, 11 info; ещё 5 diagnostics скрыты лимитом |

Главный lint error — hook в анонимном default component: `src/app/not-found.tsx:6`. Также конфигурация ссылается на Biome schema 2.3.6 при установленном CLI 2.5.5: `biome.json:2`. Production build не блокируется type errors из-за `ignoreBuildErrors: true`: `next.config.ts:223-226`, хотя текущий standalone `tsc --noEmit` проходит.

### 4.5 Production HTTP smoke без живой БД

Production bundle запущен на `127.0.0.1:3100` с dummy URL.

| Endpoint | Результат |
|---|---|
| `/api/heartbeat` | 200, `{"ok":true}` |
| `/api/config` | 200, валидный config payload |
| `/login` | 200, HTML 10,314 bytes |

Next вывел предупреждение, что `next start` не является рекомендуемым launcher для `output: standalone`; canonical production launcher должен использовать `.next/standalone/server.js` либо существующий Docker startup path. Standalone output задаётся в `next.config.ts:218-221`.

### 4.6 PostgreSQL migrations и authenticated smoke

На чистом временном PostgreSQL 15:

- container health стал `healthy`;
- connection/version check прошёл;
- найдены и применены 24/24 Prisma migrations;
- дефолтный `admin/umami` получил auth token;
- authenticated `/api/me` вернул `username=admin`, `role=admin`;
- `/api/heartbeat` вернул 200.

Вывод: текущий checkout воспроизводимо устанавливается, компилируется, мигрирует чистую PostgreSQL и запускает основной auth/runtime flow. Установка не полностью hermetic из-за сетевых downloads и toolchain drift.

### 4.7 Playwright E2E baseline

Первый запуск подтвердил, что browser binary не входит в обычный install. После `playwright install chromium`, на чистой БД и с CI settings (`workers=1`, retries=2):

| Статус | Количество |
|---|---:|
| Passed | 22 |
| Failed | 7 |
| Flaky | 1 |
| Did not run | 7 |
| Duration | 6.0 min |

Подтверждённые причины:

- user API test ожидает поле `password`, которое API корректно больше не возвращает: `tests/e2e/api-user.spec.ts:29-38`;
- login test ожидает redirect `/dashboard`, фактический route — `/websites`: `tests/e2e/login.spec.ts:9-16`;
- blank validation locator неоднозначен, потому что на странице два текста `Required`: `tests/e2e/login.spec.ts:19-24`;
- user UI test ожидает устаревший `Create user` copy/entry state: `tests/e2e/user.spec.ts:12-16`;
- website UI tests ждут отсутствующие старые test ids: `tests/e2e/website.spec.ts:5-12`, `tests/e2e/website.spec.ts:28-37`, `tests/e2e/website.spec.ts:56-65`;
- retry повторяет stateful create без cleanup, поэтому первоначально успешный create user становится flaky на retry.

CI workflow сейчас вообще не запускает E2E, lint или accessibility checks: `.github/workflows/ci.yml:25-27`.

## 5. Архитектурный baseline

### 5.1 Общая схема

```text
Tracked website
  ├─ script.js (page/custom/identify/performance)
  └─ recorder.js (rrweb/replay/heatmap)
           │
           ▼
Next.js Route Handlers
  /api/send /api/batch /api/record
           │
  validation, privacy IDs, geo/device enrichment
           │
     ┌─────┴────────────────────┐
     ▼                          ▼
PostgreSQL analytics      ClickHouse analytics
Prisma + raw SQL          optional Kafka ingestion
     │                          │
     └──────────┬───────────────┘
                ▼
        analytics query modules
                ▼
       authenticated REST API
                ▼
TanStack Query + Zustand + URL state + Chart.js UI
```

Control-plane entities — users, teams, websites, permissions, reports, segments, boards и shares — остаются в PostgreSQL/Prisma даже при ClickHouse analytics.

### 5.2 Frontend

- Next App Router, server layouts и большое client-side authenticated shell: `src/app/layout.tsx:16-45`, `src/app/(main)/App.tsx:1-25`.
- UI/design system: `@umami/react-zen`: `package.json:68`, `src/app/Providers.tsx:2-8`.
- Server state: TanStack Query; retry/focus refetch выключены, stale time 60 s: `src/app/Providers.tsx:10-18`.
- Client state: Zustand + Immer; persistence в local/session storage: `src/store/app.ts:14-49`, `src/lib/storage.ts:1-24`.
- URL state: date, compare, dimensions, property filters, segments, cohorts, search и pagination: `src/components/hooks/useNavigation.ts:5-54`, `src/components/hooks/useFilterParameters.ts:16-47`.
- Visualization: Chart.js, maps, resizable panels, virtualization и Motion: `package.json:71-72`, `package.json:90`, `package.json:106-108`.
- i18n: `next-intl`, locale управляет `lang` и `dir`: `src/app/Providers.tsx:20-32`.

### 5.3 Backend и API

- Отдельного backend service нет; backend реализован Next route handlers.
- Общий request parser выполняет Zod validation и auth: `src/lib/request.ts:16-59`.
- Единые response/error helpers: `src/lib/response.ts:3-81`.
- Клиент отправляет Bearer token и share context через `useApi`: `src/components/hooks/useApi.ts:18-36`.
- Analytics fetch принудительно использует `cache: 'no-cache'`: `src/lib/fetch.ts:18-41`.

### 5.4 Storage

- Prisma/PostgreSQL: `prisma/schema.prisma:7-10`.
- Основные facts: `Session`, `WebsiteEvent`, `EventData`, `SessionData`, `Revenue`, replay и heatmap: `prisma/schema.prisma:39-212`, `prisma/schema.prisma:287-304`, `prisma/schema.prisma:382-446`.
- Analytics backend выбирается в `src/lib/db.ts:12-40`.
- Read replica поддерживается через `DATABASE_REPLICA_URL`: `src/lib/prisma.ts:717-758`, `src/lib/prisma.ts:862-912`.
- ClickHouse использует MergeTree, AggregatingMergeTree, materialized views и projections: `db/clickhouse/schema.sql:2-55`, `db/clickhouse/schema.sql:112-273`.
- Kafka и Redis опциональны: `src/lib/kafka.ts:7-16`, `src/lib/redis.ts:105-151`.

## 6. Продуктовый baseline

Umami 3.3.1 уже существенно шире простого privacy web analytics.

### Фактически реализовано

- dashboard и custom boards;
- websites, links и pixels;
- traffic overview, pageviews и dimensions;
- custom events и typed event properties;
- sessions, distinct ID и session stitching;
- near-realtime с 10-second polling;
- goals, funnels, journeys и retention;
- segments и cohorts;
- UTM, revenue и attribution;
- Web Vitals/performance;
- session replay и heatmaps;
- teams, roles, shares и exports API.

Website navigation содержит около 17 экранов в Traffic, Behavior, Audience и Growth: `src/components/hooks/useWebsiteNavItems.tsx:35-163`.

### Сильные стороны

- лёгкий privacy-oriented tracker;
- широкая event/session property model;
- reusable filters/date/query layer;
- shareable URL state для основных filters и ranges;
- drill-down из events в sessions/properties;
- identity stitching через `distinctId`;
- готовые funnel/retention/revenue primitives;
- board component registry;
- replay/heatmap/performance как сильный visual foundation.

### Главные product/UX gaps

1. Нет единого цикла `Explore → save insight → dashboard → share/alert`.
2. Advanced reports хранят часть состояния локально, поэтому deep link не воспроизводит анализ полностью.
3. Funnel не показывает breakdown, trends, compare, time-to-convert и converted-user drill-down.
4. Retention фиксирован по daily acquisition cohorts и не является configurable behavioral retention.
5. Segments/cohorts не показывают audience size, freshness, sample users и usage dependencies.
6. Export API существует, но export control почти не включён в product UI: `src/app/(main)/websites/[websiteId]/WebsiteControls.tsx:10-25`, `src/components/input/ExportButton.tsx:17-63`.
7. Нет annotations, anomaly/alert workflow и insight collaboration.
8. Desktop/mobile information architecture расходится: mobile navigation не содержит Dashboard: `src/app/(main)/MobileNav.tsx:20-45`.
9. Clear filters может удалить весь query state, включая date/compare/search: `src/components/input/FilterBar.tsx:49-51`, `src/components/hooks/useNavigation.ts:24-28`.

### Подтверждённые UI defects

- `utm_cmapaign` вместо `utm_campaign` в Attribution campaign panel: `src/app/(main)/websites/[websiteId]/(reports)/attribution/Attribution.tsx:116`.
- Sessions `Last seen` рендерит `createdAt`, а не `lastAt`: `src/app/(main)/websites/[websiteId]/sessions/SessionsTable.tsx:62-63`.

## 7. Data/query/performance baseline

### Query patterns

- 70+ analytics modules имеют PostgreSQL/ClickHouse dispatch через `runQuery`.
- PostgreSQL выполняет raw aggregations с exact distinct; ClickHouse часто использует approximate `uniq`, поэтому KPI могут немного различаться между backends: `src/queries/sql/getWebsiteStats.ts:135-204`.
- Hourly ClickHouse aggregates используются только для совместимых filters/ranges; minute и event-property filters откатываются к raw tables: `src/queries/sql/pageviews/getPageviewStats.ts:57-99`.
- Funnels строят CTE/self-join chain для 2-8 steps: `src/queries/sql/reports/getFunnel.ts:95-189`.
- Retention повторно сканирует события cohort users: `src/queries/sql/reports/getRetention.ts:46-172`.
- Property filters строятся поверх EAV subqueries/HAVING: `src/lib/prisma.ts:338-714`, `src/lib/clickhouse.ts:391-633`.

### Caching и pagination

- Redis не кеширует общие analytics result sets; в основном он хранит auth/metadata/lookups: `src/lib/load.ts:6-50`.
- Client cache — TanStack Query, stale time 60 s; HTTP cache выключен.
- Entity и analytics lists используют offset/limit и отдельный count query: `src/lib/prisma.ts:761-817`, `src/lib/clickhouse.ts:636-670`.
- UI часто передаёт `maxResults=10000`, а server-side hard maximum отсутствует: `src/lib/constants.ts:30-31`, `src/lib/schema.ts:81-85`.

### Realtime

- range 30 min, polling 10 s: `src/lib/constants.ts:35-36`.
- один realtime request запускает три analytics queries: `src/queries/sql/getRealtimeData.ts:16-21`.
- minute mode обходится без hourly aggregate.
- один открытый realtime screen создаёт примерно 18 analytics queries/min плюс active-user polling.

### Приоритетные bottlenecks

- PostgreSQL raw scans/exact distinct на больших диапазонах;
- duplicated count + data aggregation;
- deep offset pagination;
- EAV property filters;
- realtime polling fan-out без shared cache;
- sequential `/api/batch` до 500 payloads: `src/app/api/batch/route.ts:7-46`;
- N sequential upserts для session properties: `src/queries/sql/sessions/saveSessionData.ts:35-115`;
- event/properties/revenue не объединены одной PostgreSQL transaction;
- Kafka errors могут быть залогированы и проглочены: `src/lib/kafka.ts:90-143`;
- нет configurable storage TTL/retention;
- ClickHouse reset скрывает historical rows, но физически их не удаляет.

### Date contract risks

- UI преобразует local ranges в UTC и передаёт timezone: `src/components/hooks/useDateParameters.ts:12-32`.
- schema принимает `startAt/endAt` или `startDate/endDate`: `src/lib/schema.ts:16-42`.
- downstream normalizer читает только `startAt/endAt`: `src/lib/request.ts:70-83`.
- большинство queries используют inclusive `BETWEEN`; для adjacent ranges безопаснее единый half-open contract `[start, end)`.

## 8. Security, auth и authorization baseline

### Сильные стороны

- общий auth parser и Zod validation;
- roles admin/user/view-only и team roles: `src/lib/constants.ts:173-225`;
- owner/team/share-aware website permissions: `src/permissions/website.ts:8-40`;
- negative permission tests;
- bcrypt password hashing: `src/lib/password.ts:1-10`;
- AES-256-GCM для TOTP secret: `src/lib/two-factor/crypto.ts:20-48`;
- hashed backup codes, replay prevention и 2FA rate limiting;
- CSV formula escaping в export: `src/app/api/websites/[websiteId]/export/route.ts:43-67`;
- recorder body/event limits.

### Критические риски

#### P0: required 2FA enforced только во frontend

Login выдаёт full token до выполнения обязательной 2FA: `src/app/api/auth/login/route.ts:37-61`. Требование вычисляется отдельным endpoint, а UI блокирует контент modal/pointer events: `src/app/(main)/App.tsx:25-26`, `src/app/(main)/App.tsx:78-84`. Общий API guard не проверяет 2FA assurance: `src/lib/request.ts:51-57`.

Следствие: direct API client может обойти обязательную настройку 2FA.

#### P1

- auth и share tokens создаются без expiry/revocation: `src/lib/jwt.ts:4-13`, `src/app/api/share/[slug]/route.ts:130-178`;
- stateless logout не отзывает token: `src/app/api/auth/logout/route.ts:12-14`;
- post-2FA token не содержит password fingerprint: `src/app/api/2fa/verify/route.ts:129-136`;
- token хранится в localStorage, CSP допускает `unsafe-inline` и `unsafe-eval`: `src/lib/client.ts:4-13`, `src/lib/csp.ts:17-25`;
- login rate limiting не найден;
- recorder cache token недостаточно привязан к target website: `src/app/api/record/route.ts:132-148`;
- `APP_SECRET` не обязателен и fallback строится из `DATABASE_URL`: `src/lib/crypto.ts:56-58`;
- compose и README содержат небезопасные bootstrap defaults.

### P2 hardening

- CORS `*` применяется ко всем `/api/*`, включая management API: `next.config.ts:65-96`;
- HSTS зависит от `FORCE_SSL`;
- отсутствуют явные `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`;
- arbitrary event data использует `z.any()` и не имеет явного application body-size contract: `src/lib/schema.ts:105`;
- replay moderate masking может сохранять DOM text с PII.

## 9. Accessibility baseline

Позитивно:

- Testing Library convention требует role/label queries;
- OTP inputs имеют labels;
- некоторые controls используют native button и aria state;
- ErrorBoundary использует `role=alert`;
- часть charts/sparklines имеет `role=img`.

Gaps:

- Biome a11y rules отключены: `biome.json:18-24`;
- нет axe/pa11y/WCAG CI gate;
- legend rows, filter delete icons, performance cards и journey nodes не имеют полноценной keyboard/button semantics;
- основной Chart.js canvas не имеет достаточной text alternative: `src/components/charts/Chart.tsx:143-150`;
- icon-only controls местами полагаются только на tooltip;
- ручной screen-reader/contrast/focus audit не выполнен.

## 10. Observability baseline

- `/api/heartbeat` всегда возвращает `{ok:true}` и не проверяет PostgreSQL/ClickHouse/Redis/Kafka: `src/app/api/heartbeat/route.ts:1-3`.
- Docker healthcheck использует этот shallow endpoint: `docker-compose.yml:17-21`.
- Есть opt-in debug namespaces и `LOG_QUERY`.
- Server errors в основном unstructured console logs: `src/lib/response.ts:66-80`.
- Kafka/session-link/heatmap failures могут подавляться как best-effort.

Не обнаружены:

- structured JSON logs;
- request/correlation IDs;
- OpenTelemetry traces;
- Prometheus metrics;
- error tracker;
- dependency-aware readiness;
- ingestion loss/error SLO;
- scanned rows/bytes и query-latency dashboards.

## 11. Лицензия и third-party baseline

### Обязательства

MIT разрешает использование, изменение и коммерческое распространение, но требует сохранять copyright и permission notice: `LICENSE:1-20`. При трансформации обязательно:

- не удалять и не заменять `LICENSE`;
- сохранять Copyright (c) Umami Software, Inc.;
- сохранять сведения об open-source основе;
- включать license notice в source/archive/image distribution;
- отделить новый бренд от имени/логотипа Umami, права на которые MIT отдельно не предоставляет.

### Provenance gaps

Отдельной внешней проверки требуют:

- `ua-parser-js@2`;
- GeoLite2-City license/redistribution;
- DiceBear `lorelei` style;
- maps, flags, browser/OS/device icons;
- `rrweb`/`rrweb-player` bundled notices;
- `@umami/react-zen`;
- locale datasets из mutable GitHub branches;
- base images и GitHub Actions.

В репозитории нет `NOTICE`, `THIRD_PARTY_NOTICES`, SBOM, license scan или provenance manifest. Docker runner stage явно не копирует root `LICENSE`: `Dockerfile:74-83`.

## 12. Technical debt register

| Priority | Подтверждённый debt |
|---|---|
| P0 | 2FA requirement обходится direct API client |
| P0 | Kafka enqueue failure может выглядеть как успешный ingestion |
| P0 | Нет единой физической deletion/retention semantics для ClickHouse |
| P1 | Бессрочные auth/share tokens и слабая revocation model |
| P1 | Нет login rate limit и обязательной secret validation |
| P1 | Analytics raw scans, EAV filters, offset/count и realtime fan-out |
| P1 | Нет result cache/single-flight и query budgets |
| P1 | E2E/lint/a11y/security gates отсутствуют в CI |
| P1 | Observability не позволяет измерять ingestion/query/SLO health |
| P1 | Advanced report state не полностью сериализуется в URL |
| P1 | Export почти отсутствует в UI workflow |
| P2 | PostgreSQL exact vs ClickHouse approximate semantic drift |
| P2 | README/CI/Docker runtime drift |
| P2 | `reactStrictMode=false`, ослабленные TS/lint rules |
| P2 | i18n hardcoded copy и inconsistent desktop/mobile IA |
| P2 | Missing SBOM/NOTICE/asset provenance |

## 13. Baseline guardrails для трансформации

Следующие качества считаются активами и должны сохраняться:

- privacy-oriented collection без обязательных cookies;
- lightweight tracker и custom events;
- PostgreSQL self-hosted path;
- typed event/session properties;
- date/timezone/filter semantics после их нормализации;
- teams, roles, scoped permissions и public sharing как концепции;
- funnels, retention, revenue и attribution query primitives;
- near-realtime capability;
- replay/heatmap/performance data;
- MIT license и явная attribution исходному Umami.

Следующие baseline значения становятся regression floor:

- unit tests: не ниже 739 passing;
- TypeScript no-emit: passing;
- production build: passing;
- clean PostgreSQL migrations: 24/24 до появления новых migrations;
- heartbeat/config/login production smoke: passing;
- tracked source должен оставаться чистым после audit-only commands.

## 14. Итог

Проект воспроизводимо устанавливается, собирается и запускается на Node 22 с PostgreSQL 15. Аналитическое ядро уже зрелое и широкое. Главный потенциал трансформации находится не в добавлении ещё одного isolated report, а в создании связного commercial SaaS workflow поверх существующих events, identity, segments, funnels, retention, boards и experience data.

До production-grade релиза новой версии обязательны server-side 2FA enforcement, token lifecycle, ingestion observability, canonical toolchain, CI gates, data lifecycle contract и third-party provenance. Эти работы включены в будущий план, но в рамках baseline-аудита не реализовывались.
