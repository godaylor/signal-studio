# Варианты глубокой продуктовой трансформации

## 1. Контекст выбора

Umami 3.3.1 уже содержит traffic analytics, custom events, sessions, identity stitching, realtime, goals, funnels, journeys, retention, segments, cohorts, revenue, attribution, Web Vitals, replay, heatmaps и custom boards. Поэтому косметический redesign или добавление пары charts не создаст продукт, существенно отличный от оригинала.

Трансформация должна менять:

- главный job-to-be-done;
- единицу анализа;
- информационную архитектуру;
- рабочий цикл пользователя;
- модель сохранения и совместной работы с insights;
- визуальный язык и ощущение commercial SaaS.

Одновременно она должна переиспользовать сильное analytics kernel: tracker, custom events, sessions, typed properties, filters, date ranges, PostgreSQL queries, near-realtime и permissions.

## 2. Критерии и шкала

Каждый вариант оценён по шкале 1-5. Все критерии имеют одинаковый вес.

- **Скорость реализации** — сколько коммерчески убедительной ценности можно показать ранними vertical slices.
- **Wow-effect** — насколько продукт визуально и концептуально впечатляет в portfolio/demo.
- **Техническая глубина** — насколько хорошо раскрываются frontend, backend, data/query, security, performance и testing skills.
- **Ценность для работодателя** — насколько проект демонстрирует Middle+/Senior-ready product engineering.
- **Отличимость от Umami** — насколько изменяется основной продукт, а не только внешний вид.

## 3. Вариант A — Signal Studio: Product Intelligence Workspace

Рабочее название требует отдельной trademark/domain проверки перед публичным релизом.

### Позиционирование

Commercial product intelligence platform для product, growth и customer-success команд. Продукт отвечает не на вопрос «сколько было посещений?», а на вопросы:

- какие пользователи и аккаунты активировались;
- какие функции приводят к удержанию и выручке;
- где ломается adoption journey;
- какие сегменты растут или деградируют;
- какие sessions/replays объясняют изменение метрики;
- какой insight нужно сохранить, обсудить, поставить на dashboard или alert.

### Новая единица анализа

Не website/session, а связка:

```text
Workspace → Project → Account → User → Event → Session → Insight
```

Website остаётся tracking source, но перестаёт быть главным объектом интерфейса.

### Основной рабочий цикл

```text
Question
  → Explore query
  → Segment/cohort
  → Breakdown/compare
  → Insight
  → Save/share/dashboard/alert
  → Drill-down to account/user/session/replay
```

### Ключевые capabilities

#### Commercial SaaS shell

- workspace/project switcher;
- role-aware navigation;
- onboarding checklist и data health;
- command palette;
- saved views, recent items, favorites;
- polished empty/loading/error/permission states;
- responsive desktop/tablet/mobile behavior.

#### Explore

- единый query builder для trends, breakdowns, funnels и retention;
- metric + event + aggregation + breakdown + filters;
- fully URL-serializable state;
- compare previous period/custom segment;
- table/chart toggle;
- save as Insight;
- add to dashboard;
- CSV/JSON export.

#### Event catalog

- event definitions, description, owner и status;
- property schema и observed types;
- volume/unique users trend;
- first/last seen;
- data-quality badges;
- sample payloads без раскрытия чувствительных значений.

#### Funnels

- ordered 2-8 steps;
- conversion window;
- breakdown и segment compare;
- conversion trend;
- time-to-convert distribution;
- drop-off users/accounts;
- drill-down до session/replay.

#### Cohorts и retention

- behavioral cohort builder;
- acquisition/activation/return definitions;
- daily/weekly/monthly granularity;
- N-day и unbounded return modes;
- retention matrix + curve;
- cohort comparison;
- account/user samples.

#### Accounts и users

- account profile, members, traits, lifecycle stage;
- user profile и stitched sessions;
- activation/health score;
- recent activity timeline;
- feature adoption;
- saved segment membership;
- replay/performance evidence.

#### Dashboards и collaboration

- executive, product и growth templates;
- grid widgets из saved insights;
- global date/segment state;
- annotations;
- comments/owners как later-stage capability;
- public/internal shares;
- role-aware export;
- alert rule and last evaluation status.

#### Experience layer

- Web Vitals, replay и heatmap не отдельные silos;
- переход из funnel drop-off/segment anomaly к affected sessions;
- friction evidence на account/user profile;
- issue-like view «что изменилось и кого затронуло».

### Что сохраняется из Umami

- tracker и ingestion contract;
- custom events и identify;
- typed event/session properties;
- session stitching;
- date/timezone/filter primitives;
- funnels/retention/revenue SQL как starting point;
- boards, shares, teams и permissions как architectural foundation;
- replay/heatmap/performance data.

### Что делает вариант существенно другим

- website больше не центр IA;
- единый Explore заменяет каталог несвязанных reports;
- account/user lifecycle становится first-class;
- Insight становится сохраняемой и переиспользуемой сущностью;
- dashboards собираются из analytical questions, а не только predefined widgets;
- experience data объясняет product outcomes;
- product строится для multi-role команды, а не только владельца сайта.

### Portfolio signal

Вариант демонстрирует:

- сложный React/Next UI и design system;
- URL state, server state и optimistic interactions;
- reusable query contracts;
- charts, heatmaps, matrices, virtualized tables;
- RBAC и tenant isolation;
- exports и background jobs;
- data modelling для accounts/users/insights;
- caching, pagination, query budgets и realtime;
- unit/integration/E2E/accessibility/performance testing.

### Риски

- scope легко превращается в клон Mixpanel/Amplitude;
- без opinionated lifecycle templates интерфейс может стать слишком generic;
- account model требует ясного identity contract;
- универсальный query builder усложняет SQL parity;
- необходимо жёстко ограничить MVP vertical slices.

### Почему можно реализовать быстро

Первый убедительный vertical slice строится поверх уже существующих events, sessions, filters и boards:

1. новый shell;
2. canonical URL query state;
3. Explore trend/breakdown;
4. save Insight;
5. dashboard widget;
6. account/session drill-down.

Для этого не нужны внешние integrations.

## 4. Вариант B — RevenueGraph: B2B Revenue Journey Intelligence

### Позиционирование

Platform для B2B SaaS marketing, growth и revenue operations. Главный вопрос: «какие marketing и product touchpoints создают pipeline, expansion и revenue?»

### Новая единица анализа

```text
Workspace → Account → Contact/User → Campaign/Touchpoint → Opportunity → Revenue
```

### Основной рабочий цикл

```text
Acquisition source
  → account journey
  → product activation
  → opportunity/revenue outcome
  → attribution model
  → segment/export/playbook
```

### Ключевые capabilities

- account and contact identity resolution;
- campaign hierarchy и UTM governance;
- lifecycle stages: visitor, signup, activated, PQL, opportunity, won, expansion;
- account-level funnel;
- first/last/linear/time-decay attribution;
- revenue cohorts и payback views;
- product-qualified account scoring;
- source/campaign/account tables;
- CRM/ad-spend import contract;
- scheduled executive exports;
- owner/team permissions;
- realtime high-intent account feed.

### Сильное переиспользование baseline

- UTM, revenue и attribution reports;
- distinct ID и session linking;
- custom events;
- links/pixels;
- teams/shares;
- revenue tables и queries.

### Что делает вариант существенно другим

- web traffic становится только верхом revenue journey;
- центр интерфейса — accounts, pipeline и revenue;
- появляется multi-touch attribution и коммерческий lifecycle;
- dashboards ориентированы на executives и RevOps;
- product и marketing data соединяются в одном графе journey.

### Portfolio signal

- сложная domain model;
- temporal attribution SQL;
- account identity resolution;
- data imports и background jobs;
- large tables, grouping, exports;
- RBAC и audit trail;
- executive-grade dashboards.

### Риски

- полноценная ценность требует CRM/ad integrations;
- identity matching и financial correctness повышают требования к качеству;
- attribution легко становится спорной «магией» без transparent model;
- demo data сложнее объяснить;
- scope значительно тяжелее для первой версии.

### MVP boundary

Чтобы не зависеть от внешних API, первая версия могла бы использовать seeded CRM/spend imports через CSV. Однако даже такой MVP требует account/opportunity models и ingestion reconciliation.

## 5. Вариант C — Experience Command Center

### Позиционирование

Behavioral experience observability platform для product и frontend команд. Главный вопрос: «где пользователи испытывают friction, почему это происходит и как проблема влияет на conversion?»

### Новая единица анализа

```text
Experience signal → affected segment → session/replay → issue → business impact
```

### Основной рабочий цикл

```text
Anomaly/friction signal
  → affected pages/users
  → replay/heatmap/performance evidence
  → issue triage
  → owner/status
  → verify impact after fix
```

### Ключевые capabilities

- experience health dashboard;
- Web Vitals trends и percentile breakdowns;
- rage click/dead click/error/custom frustration signals;
- click/scroll heatmaps;
- session replay queue;
- issue inbox с severity, owner и status;
- affected segment/users;
- conversion impact estimation;
- before/after compare и annotations;
- realtime incident feed;
- shareable evidence bundles.

### Сильное переиспользование baseline

- rrweb recorder/player;
- heatmap storage и UI;
- Web Vitals ingestion;
- journeys, sessions и custom events;
- near-realtime log;
- filters и segments.

### Что делает вариант существенно другим

- reports превращаются в triage workflow;
- replay, heatmap и performance объединяются;
- появляется issue lifecycle;
- аналитика привязывается к product friction и business impact;
- UI ближе к observability/quality SaaS, чем к web analytics.

### Portfolio signal

- самый высокий визуальный wow-effect;
- canvas/overlay/heatmap и media-like replay UI;
- realtime feed;
- correlation между signals и sessions;
- issue workflows и collaboration;
- frontend performance domain depth.

### Риски

- automatic frustration detection требует новых event semantics;
- replay/privacy увеличивают security/compliance scope;
- storage быстро растёт;
- сложнее показать глубокий generic BI/query builder;
- часть ценности конкурирует с Clarity/FullStory/Sentry Session Replay.

### MVP boundary

Первый slice может объединить Web Vitals, existing replay и heatmaps в issue-like detail page без автоматического ML/anomaly detection. Это визуально сильно, но product analytics breadth будет ниже варианта A.

## 6. Сравнительная оценка

| Вариант | Скорость | Wow-effect | Тех. глубина | Ценность работодателю | Отличимость | Итого |
|---|---:|---:|---:|---:|---:|---:|
| A. Signal Studio | 4 | 5 | 5 | 5 | 5 | **24/25** |
| B. RevenueGraph | 2 | 5 | 5 | 5 | 5 | **22/25** |
| C. Experience Command Center | 3 | 5 | 4 | 4 | 5 | **21/25** |

### Обоснование баллов

#### Скорость

- Signal Studio может начать с существующих events/sessions/filters/boards без integrations.
- RevenueGraph требует account/opportunity/spend/CRM layer.
- Experience Command Center переиспользует replay/heatmap/performance, но требует correlation и issue model.

#### Wow-effect

Все три варианта способны на сильную visual demo. Signal Studio получает 5 благодаря сочетанию Explore, funnels, retention, dashboards и replay drill-down, а не одному типу visualization.

#### Техническая глубина

- Signal Studio наиболее равномерно покрывает frontend, API, SQL, state, permissions, exports, realtime и testing.
- RevenueGraph глубже в identity/attribution/integrations, но меньше показывает behavioral UX.
- Experience Command Center особенно силён во frontend/canvas/replay, но слабее в BI/query breadth.

#### Ценность работодателю

Signal Studio лучше всего демонстрирует работу на пересечении product thinking, design systems, data-intensive frontend и full-stack engineering. RevenueGraph также силён, но его demo зависит от сложной доменной подготовки. Experience вариант более специализирован.

#### Отличимость

Все варианты меняют job-to-be-done. Signal Studio остаётся ближе всего к analytics core, но существенно меняет сущности, navigation и workflow, поэтому не является redesign Umami.

## 7. Выбор

Выбран **вариант A: Signal Studio — Product Intelligence Workspace**.

### Причины

1. Максимально использует сильные части текущего ядра.
2. Не требует внешних integrations для убедительного MVP.
3. Позволяет показать наиболее широкий Middle+/Senior frontend/full-stack skill set.
4. Даёт много визуально сильных surfaces: Explore, funnel, retention matrix, accounts, realtime, dashboards, replay drill-down.
5. Поддерживает небольшие проверяемые vertical milestones.
6. Меняет не только UI, но и основную продуктовую модель.
7. Позволяет позже добавить RevenueGraph и Experience Command Center как специализированные modules, не меняя foundation.

## 8. Принцип продуктовой дифференциации

Чтобы выбранный вариант не превратился в «Umami с новым sidebar», обязательны пять контрактов:

1. **Project/account/user first** — website не является главным объектом IA.
2. **Explore first** — новый анализ начинается в едином builder, а не в одном из 17 report screens.
3. **Insight as entity** — любой значимый analysis можно сохранить, переиспользовать, поставить на dashboard, поделиться и экспортировать.
4. **URL-complete state** — ссылка воспроизводит весь analysis context.
5. **Evidence loop** — aggregate insight ведёт к affected accounts/users/sessions/replays.

Если milestone не усиливает хотя бы один из этих контрактов, он не считается частью глубокой трансформации.

## 9. Что сознательно не входит в первую волну

- AI-generated insights;
- external CRM/ad integrations;
- billing/subscriptions;
- full collaborative comments;
- arbitrary SQL editor;
- mobile native application;
- complete ClickHouse/Kafka production deployment;
- automatic anomaly ML;
- redesign всех legacy screens до готовности нового vertical slice.

Эти ограничения сохраняют реалистичную скорость и делают качество основного workflow проверяемым.
