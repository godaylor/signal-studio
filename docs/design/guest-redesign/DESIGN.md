# Signal Studio: Precision Violet

Date: 2026-10-17. Scope: real guest workspace and product interface redesign.

## Selected direction

The audience is a product or growth analyst investigating trial activation. The single job is to turn a question into an inspectable result and saved work. The interface starts with that question, gives editable analytical controls a recognizable Query Spine, and reserves most screen area for results and evidence.

Three generated alternatives were inspected:

| Concept | Strength | Decision |
| --- | --- | --- |
| A — Precision Violet | Distinctive dark shell, recognizable editable vertical Query Spine, strong separation between controls and results | Selected |
| B — Graphite Ledger | Exceptionally legible funnel and factual answer panel; horizontal lineage works well for short queries | Retain its result clarity; horizontal editor scales less well to advanced queries/mobile |
| C — Marine Instrument | Precise funnel drop-off explanation and calm table | Clear, but less distinct from an engineering administration tool |

Selected artifacts:

- `selected-home-desktop.png`
- `selected-explore-desktop.png`
- `selected-dashboard-desktop.png`
- `selected-mobile-board.png` — Home, Explore, full-screen editor, dashboard

## Tokens

| Role | Value |
| --- | --- |
| Navigation ink / primary text | `#211B2E` |
| Canvas | `#F5F4F1` |
| Result surface | `#FFFFFF` |
| Secondary text | `#6E697A` |
| Border | `#DDD9E3` |
| Action / Query Spine / primary plot | `#7251D8` |
| Query background | `#ECE7FA` |
| Comparison / attention plot only | `#D97764` |

Use flat colors in code. Generated button shading is not part of the contract. Existing Inter remains the UI face, system mono or tabular numerals carry exact values; no new font dependency. Use 36–40px desktop question headings, 26–30px mobile headings, 14px body, 12px utility labels. Heading tracking approximately -0.04em, body line height 1.45–1.55. Corner radius 6–8px; no decorative gradients, excessive pills or nested cards.

Computed sRGB contrast for the static palette: white/violet 5.41:1, muted/canvas 4.82:1, ink/canvas 15.14:1, white/navigation ink 16.65:1. Runtime states and chart series still require screenshot/axe checks. Comparison coral is a plot encoding with text labels, not small body text.

Final implementation refinement: muted text is darkened to `#655F73` for legibility on lavender surfaces (5.05:1 on `#ECE7FA`, 5.55:1 on the canvas). Action text uses `#6541C6`; attention text uses `#B84E42`. The concept images retain their original generated colors. `comparison-board.png` was visually inspected after the final production recapture; its source references Explore and query-editor views, so a subsequent data/performance-only Home recapture does not require a composition change.

## Composition and responsive behavior

Desktop shell: approximately 224px dark navigation with the required Home, Explore, Dashboards, Audiences, Experience and Live destinations. White compact breadcrumb bar. Synthetic guest context and expiry remain visible, short and factual. Settings/source and Help remain accessible. Preserve account navigation and permissions.

Home: a product question and direct Explore action; connected signup → activation → retention summary, then current evidence and recent work. Data health becomes compact context. Metric definitions belong in Help or an expandable definition, not a paragraph above every chart.

Explore: editable lavender Query Spine at left (approximately 280px) and white result canvas at right. Each numbered node represents a real query operation, never decoration. Header names the question and provides Save insight/Export. Results show unit, period and denominator when applicable, a meaningful figure, chart and equivalent data table. Inline language describes the result; technical adapter, snapshot or codec explanations move to Help/details.

Dashboards: a clear named collection of saved Insights, direct Add insight and export controls, a calm grid of results, contextual links back to editable analysis. Dashboard widgets reference Insights; the design does not imply arbitrary unsaved embedded queries.

Audiences: tables are primary; search and filters lead into inspectable entity evidence. Experience: evidence lists and permitted replay/performance capabilities remain distinct. Live: visible snapshot timestamp and connection state, restrained updates. Insight library: readable work table and consistent actions.

Mobile: result-first Explore with a compact query summary and Edit query action. Complex editing can open as a full-screen workflow, with focus trapping/restoration and a reachable Run analysis action. Home lifecycle stacks vertically, dashboard surfaces stack, tables scroll locally when necessary. Primary navigation stays accessible through the drawer and/or bottom links. Preserve every destination and capability; never compress the desktop sidebar into a narrow unreadable column. Target 44px controls, 390px viewport verification, no page-wide horizontal overflow.

## Content and states

- A conspicuous Try without signing up action opens the private guest workspace directly.
- State that events are synthetic; do not call the dataset customer data.
- Keep session expiry/persistence accurate to the implemented server contract.
- Technical details, resource limits and metric definitions have Help/details destinations.
- Preserve loading, empty, error, partial, stale and permission states.
- Name actions consistently across controls, toasts and audit events.
- Only display conclusions calculated from the actual response. A mockup is not a data fixture.

## Generated-image limitations and implementation authority

The image generator rendered some illustrative text or figures imperfectly: concept A's plan-share percentages are labeled as activation rates; the Home sample table calls 34% an activation rate instead of a collaboration rate; the dashboard sample mini-bars introduce unrequested percentages. Those details must not be copied into the implementation. Use actual metric definitions, numerators and denominators from application contracts. The mockup trend curves are visual composition samples, not computed event results or evidence of acceptance.

Mockups are English for design consistency; the working application retains its existing Russian/English localization. Generated sample event names, date windows, 24-hour expiry and counts are illustrative. Implemented server/session/data contracts take precedence.

## Provenance

All images were created with the built-in `image_gen.imagegen` tool on 2026-10-17 from original prompts recorded in `PROMPTS.md`. No downloaded stock assets, browser bundle, font file or new icon dependency was added for this design. Existing repository fonts and icon assets retain their existing provenance. Generated images are review artifacts, not product runtime assets. Original generated files remain in the Codex generated-images directory; requested deliverables are copied into this repository.

Root LICENSE and Umami attribution are unaffected by these design artifacts.

## Verification handoff

Compare live desktop/mobile screenshots to the selected images for shell contrast, visual hierarchy, query/results separation, chart/table legibility and overflow. Functional acceptance must separately prove real server persistence, private guest authorization, resource bounds, computed analytics, export, error recovery and expiry.

## Review artifacts

`REVIEW.html` is the standalone Russian gallery of alternatives, selected mockups and real desktop/mobile screenshots. `compare.html` places the original and final analysis views beside each other, followed by selected Explore mockup versus implementation. All images link to the full local originals. Generated images and application screenshots are labeled separately; mockup numbers are illustrative. The working fictional fixture contains 1,281 events and the actual funnel is 336 → 252 → 168 (50%).

`comparison-board.png` is rendered from the comparison page after final application recapture. `gallery-preview.png` is the desktop preview of the gallery itself. Both HTML documents use local assets and system fonts, with no network or runtime dependency. The gallery and comparison page were checked at 1600px and 390px: no document overflow, missing image or broken local file link.

The final `hosted-*.png` set shows the actual HTTPS deployment of application revision
`194eab4ba` on Vercel with Neon. Explore desktop and Home/Dashboard mobile were compared
to the selected direction: the shell, Query Spine, result hierarchy and readable stacked
layout are preserved. The mobile dashboard keeps the existing creation controls above
widgets, so the first widget's figures require scrolling. Public acceptance separately
passed the complete guest workflow, real Home/CSV results and all six pages at 1440/390px.
The updated gallery's 21 images and comparison's seven images have no missing local files,
broken anchors or document overflow at 1600/390px. See the M19 report for scope and limits.
