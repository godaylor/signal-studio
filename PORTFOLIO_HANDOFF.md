# Signal Studio — portfolio handoff

**Repository:** https://github.com/godaylor/signal-studio

**Live:** pending hosting account setup; do not present a localhost URL as public.

Current hosting target: **Vercel Hobby + Supabase Free**, $0 within provider quotas.
No paid Railway deployment is authorized. See [free deployment](docs/FREE_DEPLOYMENT.md).
The readiness scores below describe the M17 checkpoint, not a completed M18 rollout.

## Portfolio copy

Signal Studio is a product intelligence workspace for PLG teams. It turns raw
product events into reusable questions, saved insights, dashboards and audiences.
Its Query Spine keeps the definition of an analysis visible and shareable.

Built with Next.js, React, TypeScript, TanStack Query, PostgreSQL and Prisma.
Includes authenticated APIs, scoped permissions, two-factor policy, exact analytics,
background exports and a free serverless deployment profile; container deployment
remains available for self-hosting.

My contribution is the Studio product model and interface, analysis contracts and
executors, saved entities, identity/permission hardening, source onboarding and
release infrastructure. This is an MIT-licensed transformation of Umami; retained
collection, authentication, legacy reports and dependencies are explicitly credited.
See [code origins](docs/CODE_ORIGINS.md).

## Demonstration sequence

1. Sign in, create a project, copy its tracker and receive a real event.
2. Explore events with Query Spine; change filters or breakdown and share its URL.
3. Save an insight, add it to a dashboard and reopen it.
4. Inspect an audience and its evidence; export scoped data.
5. Show Live updates and Home activation/retention with explicit metric definitions.

Seeded portfolio records are synthetic and must be labeled as such. Do not expose
administrator credentials for a public tour. Self-registration is not implemented.

## Assets

- [Explore](docs/screenshots/explore-desktop.png)
- [Home](docs/screenshots/home-desktop.png)
- [Mobile Russian Home](docs/screenshots/home-mobile-ru.png)
- [Source installation](docs/screenshots/sources-desktop.png)
- [Login](docs/screenshots/login-desktop.png)

These are screenshots of the running application, not mockups. They use synthetic
portfolio data; source URLs in the local screenshot are illustrative local origins.

## Readiness assessment

Judgment based on verified behavior, not a percentage of files implemented.
Equal-weight arithmetic mean: (95+90+90+88+93+0+95+75)/8 = **78.25%**.

| Category | Score | Finished / verified | Remaining |
|---|---:|---|---|
| Concept and purpose | 95% | PLG question-to-insight workflow and scope documented | Real user feedback |
| UX/UI | 90% | Studio, first-run, responsive RU/EN; browser and axe checks | Manual assistive-technology review |
| Core functionality | 90% | Sources, queries, insights, dashboards, audiences, live, exports; integration/E2E | Deferred requirements explicitly tracked |
| Testing, security, quality | 88% | Unit, components, PostgreSQL, auth/permissions, browser, packaging | Current 1M benchmark and manual accessibility |
| Backend/DB/Auth | 93% | Persistent PostgreSQL, scoped auth, queue worker; Docker export passed | Production backup/recovery exercise |
| Public production deploy | 0% | Hosting image and instructions prepared | Account, actual deployment and public acceptance |
| GitHub/docs/licensing | 95% | Own repo, CI, documentation, unchanged MIT, packaged notices | Verify latest published CI; add live URL |
| Personal Portfolio №09 | 75% | Copy, contribution statement, screenshots and demo sequence | Live link and final public walkthrough |

Public deployment is a blocking gap; M17 is not complete. Full evidence and
limitations: [release report](docs/PRODUCT_RELEASE.md). Exact operator actions:
[deployment guide](docs/FREE_DEPLOYMENT.md).
