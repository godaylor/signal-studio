# Финальный аудит — закрытие публикационных блокеров

Дата: 2026-09-10. Этот статус заменяет исходный аудит от 2026-09-09.
Основание: пользователь разрешил исправления PUB-01–PUB-09 и честное исключение
необязательных требований из первой публичной portfolio-версии.

## Вердикт

| Объект | Итог |
|---|---|
| Существующая локальная демонстрация | **ГОТОВА / СОХРАНЕНА**: app и PostgreSQL healthy, worker работает, /api/ready на 32109 возвращает 200. После перезапуска Docker пользователем доступность восстановлена. |
| Исправленный локальный publication candidate | **Локальные исправления и targeted acceptance завершены**: native/Linux build, security negatives, non-root/offline Prisma, release metadata проверены. Это отдельные образы, не обновление демонстрации. |
| Публичная публикация/deploy | **ОЖИДАЕТ внешнего этапа**: owned Git/release commit/CI, hosting/domain/TLS/storage/secrets и ручные device/screen-reader/deployed проверки. Commit, push, publish и deploy не выполнялись. |

В старом установленном образе нет новых security-исправлений. Не выставлять его
в интернет как исправленный release. Общая история Git остаётся upstream HEAD
`ca661c7057984aa98ed4f7083d84dae2f65bfcb0` плюс сохранённая незакоммиченная
трансформация. Исторический GREEN M16 не означает полную приёмку каждой FR.

## PUB-01–PUB-09

| ID | Статус | Исправление / минимальное оставшееся действие |
|---|---|---|
| PUB-01 | **CLOSED** | `src/lib/auth.ts` больше не принимает share JWT вместо application session. Legacy `/api/share/[slug]` возвращает 410 без выпуска JWT; записи сохранены. Studio-share сохраняет TTL/audience/issuer/live revocation/version; internal-share повторно проверяет membership и 2FA assurance. Unit и реальные native/Linux HTTP negatives проходят. |
| PUB-02 | **DEFERRED EXPLICITLY** | FR-SHELL-05/06 и FR-CAT-01–06 перенесены за portfolio-v1 с исходными критериями и владельцами D1/D2. Palette — только navigation search, favorite — общий, не личный. Нет ложного заявления об реализации catalog/search/recents. |
| PUB-03 | **CLOSED LOCALLY** | CD зависит от reusable CI того же commit, включая три image targets. Production build fail-closed на TypeScript; workflow contract проверен. Реальное выполнение на GitHub остаётся внешним gate. |
| PUB-04 | **EXTERNAL / NOT AUTHORIZED HERE** | Выбрать owned repository, оформить reviewable commits/release revision и push на следующем разрешённом этапе. Не публиковать upstream HEAD как реализацию Studio. |
| PUB-05 | **CLOSED LOCALLY** | Fingerprint v2 охватывает source/tests/build configs/workflows/licenses, нормализует пути и учитывает Docker proxy один раз. SOURCE_MANIFEST, ARTIFACT_HASHES, обязательный verifier; Docker получает revision build arg. Native и три Linux targets имеют одинаковый source fingerprint, но отдельные buildProfile/артефакты. |
| PUB-06 | **CLOSED** | Удалён неработающий app.json, Heroku one-click явно неподдерживаемый. Поддерживаемый контракт: app + same-version worker + private PostgreSQL + durable shared export storage + независимые secrets + explicit migration/bootstrap. |
| PUB-07 | **EXTERNAL / MANUAL** | GitHub CI/permissions, HTTPS hosting/domain, secret injection/shared storage, deployed revoke/export/restore smoke и human screen-reader/real-device проверки остаются обязательными и непройденными. |
| PUB-08 | **CLOSED** | Все targets — nextjs UID 1001. Migration/worker берут подготовленные зависимости builder с корректным владельцем; Prisma engine материализуется при build. Offline Prisma работает; read-only migrate status: 35 migrations, schema up to date. CI проверяет все targets и offline engine. |
| PUB-09 | **CLOSED** | Согласованы AGENTS, PLAN, spec/architecture, README, M16 historical status и новый release report. Матрица содержит все 76 FR ровно один раз: восемь deferred, остальные 68 со ссылками на историческое evidence, без утверждения 76/76 verified. |

Локально исправимых незакрытых дефектов из исходного списка PUB-01–PUB-09
после указанных проверок не осталось. Это ограниченный closure исходного аудита,
не обещание отсутствия любых возможных дефектов в приложении.

## Проверенные доказательства

- Native typecheck и production build PASS; Next действительно выполнил TypeScript.
- Focused Vitest: 5 файлов / 33 tests PASS; поздняя усиленная проверка share-service
  отдельно 9/9 PASS заменяет ранний результат этого файла.
- Parsed release/requirements contract: 2/2 PASS; включён в CI.
- Lint: ошибок нет; старые warnings/infos сохранены, autofix не запускался.
- Native HTTP: 3 подписанных legacy-token запроса к stats/events/sessions — 401.
- Linux final build: TypeScript 19.0s, 71 static pages; runner/worker/migration собраны.
- Все три Linux targets: UID 1001, LICENSE/notices присутствуют, .env отсутствует,
  packaged artifact checksums PASS. Migration/worker Prisma version проходит с
  `--network none`; migration status только читает существующую БД.
- Отдельный runner на 127.0.0.1:32151: dependency readiness 200 и 3 подписанных
  legacy-token запроса — 401. Probe остановлен/автоудалён; установленный сайт
  32109 после проверки по-прежнему readiness 200.
- Все четыре native legal locations (generated, public, standalone/legal,
  standalone/public/legal) сверены с source/lock/LICENSE и artifact manifest.
- Application inventory: native 1029 компонентов / Linux 1038, 478 текстов лицензий,
  ноль missing notices. Различие числа компонентов обусловлено platform packages.
- Image SBOM: финальная запись результатов — в RELEASE_CLOSURE_REPORT.md.
- Точные команды, ограничения и промежуточные диагностические ошибки:
  [release-отчёт](docs/RELEASE_CLOSURE_REPORT.md).

Fingerprint текущего source candidate:
`ca3597779c1167ffb755e52436ab7387a7bb3548f4af66624c00b019220521d6`.

| Локальный tag | Docker image ID (sha256) |
|---|---|
| signal-studio:pub-closure-runner | b433f19bea78da0bc9974c181ca0d2add4015a7e33fbd19c1c7287a670cd6a07 |
| signal-studio:pub-closure-worker | 1f01de9dc4fbe079610cedb148bf259edcfa7057fb2e3c12697f41382dfc2c6a |
| signal-studio:pub-closure-migration | f53692933c50a3ba19f1c0c14ae5e0ae33aaedf1bc63b67283244b43501b0e3c |

Это локальные image IDs, не опубликованные registry digests. При release сохранять
новые immutable digests, source manifests, SBOM и provenance точного GitHub build.

## Переиспользованные GREEN и сохранность

Не повторялись неизменённые полные PostgreSQL/E2E/axe/performance/backup-restore
наборы из M16_FINAL_REPORT. Пересборки затронутой упаковки потребовались после
расширения fingerprint и обнаруженного Prisma engine permission defect; cache
использован между targets. Нет циклов timeout/повторения неизменённых GREEN.

Данные, secrets, credentials, схема и миграции не менялись. Чужие процессы и
контейнеры не останавливались; installed app/worker/DB не заменялись. Использованы
только существующие 32109/32110 и временные 32150/32151. Удалён только устаревший
app.json (восстановим из Git) и task-owned probe containers; candidate images сохранены.

LICENSE SHA-256 неизменён:
`2a2a42dba0334d768c61edc8f5bb5d3732d94de23d99a7e539a719b1d5117ba0`.
Полный MIT notice, Umami copyright и based-on-Umami attribution сохранены.
Dirty worktree проверен до/после; сторонние существующие изменения не откатывались.

## Необязательные улучшения и минимальные дальнейшие действия

- Опционально: CSP hardening, immutable SHA для Actions, line-ending policy,
  собственная product version/owner metadata без удаления upstream attribution.
- Deferred: D1 personal recents/favorites/entity-action search; D2 governed catalog.
- Не заявлять ClickHouse parity, 10M+ scale, field INP и manual accessibility certification.
- Следующий обязательный этап требует разрешения: owned repository/release commit,
  GitHub CI, ручная accessibility/device приёмка и hosting/domain/TLS/storage/secrets,
  затем deployed smoke/restore. Только после этого publish/deploy.
