# Яснослед — Optical Trace design contract

Date: 2026-10-17. M20 replaces the assembled, static M19 appearance with a coherent animated analytical instrument. The explicit user brief in the attached Russian text takes precedence over the previous visual direction. Product behavior, authentication, permissions and real analytical calculations remain governed by the existing application contracts.

## Decision

A — Optical Trace is selected by the implementation lead after image inspection. B — Kinetic Observatory is kept as a clearly different dark orbital alternative for comparison. A has the stronger connection between the product's event-to-insight loop and its visual identity, and adapts cleanly to a pearl light theme. B is more atmospheric but more easily reads as a scientific/space instrument.

Subject: product and growth teams finding the behavior that turns a new user into a successful user. The primary job remains asking a question, changing a real query, understanding the result and preserving it as an Insight/Dashboard.

The characteristic visual is one glass optical path: several event traces become one clear stream. It is a brand illustration, with no data values or axes. The actual chart remains a separate, legible HTML/SVG result calculated by the application.

## Visual system

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | Pearl `#F6F7FB` | Ink `#111326` |
| Main integrated surface | White / barely raised pearl | `#191C33` |
| Text | `#111326` | `#F2F4FF` |
| Muted text | contrast-checked slate | contrast-checked light slate |
| Primary trace/action | Cobalt `#6857F3` | Periwinkle/cobalt `#6857F3` |
| Secondary trace | Icy cyan `#8DE1E7` | Icy cyan `#8DE1E7` |

Cyan is a trace/plot accent, not small body text on white. Use the root accessibility tokens for final text/focus/disabled states. Contrast-check dynamic state combinations.

Typography: root-selected Unbounded for expressive Cyrillic display and Golos Text for UI/body; tabular numerals for metrics. Display size 44–56px desktop and 28–34px mobile with intentional line breaks; questions should lead without consuming the whole mobile viewport. Do not use the display face for dense table cells or long descriptions. Render the wordmark with native text and the original folded mark, not an avatar letter or old three bars.

## Composition

Desktop: horizontal six-destination primary navigation and a thin project/session context row. A single broad pearl or ink canvas extends across the product. Hierarchy comes from spacing, alignment and fine separators. Do not rebuild the old thick purple sidebar or a nested card grid with a new palette.

Home: question and meaningful actual answer beside the optical-flow illustration, immediately followed by a continuous lifecycle track and wide analytical evidence. Recent work is a compact table/list sharing the same baseline, not a group of decorative cards. Synthetic context is visible and concise.

Explore: horizontal connected Query Spine, one focused result surface and one clear primary Save action. Secondary actions are quiet. Query settings edit meaningful operations, then the result chart/table transitions as the actual response changes. Keep filters, modes, exactness, definitions, errors, stale results and export available.

Supporting views: Audiences remains a first-class inspectable table. Experience keeps identity, timeline, performance/replay capabilities honest. Live shows one actual timestamped snapshot; empty data must not be replaced with invented animation/data. All pages use the same edge treatment, heading scale, control rhythm and motion grammar.

Mobile: result first; short context row, reachable primary action and compact query summary. Complex editing opens into its own sheet/full-screen space. Lifecycle stages stack on one connected path. Real numbers should appear early. All six navigation destinations remain available, through primary bottom links and a complete drawer as needed. No horizontal page overflow at 390px.

## Motion grammar

Motion is implemented in code; no generated video was created. The available `useVisualMotion()` context exposes `animate` and `ambient` and owns the user's pause preference, reduced motion and hidden-document behavior.

| Motion | Purpose | Bound |
| --- | --- | --- |
| Optical scene slow transform / pointer response | Make the event-to-insight identity tangible | Small translation/rotation, pointer only on capable devices, no layout shift; ambient only |
| Trace sweep and event pulses | Make the signature path visibly alive | One controlled sequence/slow loop in the hero; stop when ambient is false |
| Page/result entry | Connect navigation and new evidence | 240–420ms explicit tween, 8–12px translation only for text-containing routes/widgets/stages; no opacity fade, so text contrast remains stable throughout entry; reduced motion renders final state immediately |
| Active nav/tab indicator | Explain location and selected audience | Shared-layout underline/selection, 180–260ms; focus remains stable |
| Actual data row/shape transition | Explain changed results | Animate only the newly returned response, never fabricate intermediate analytical claims for screen readers |
| Drawer/editor transition | Preserve spatial context on mobile | Reachable controls, focus trap/restore, bounded 220–320ms |
| Hover/focus | Indicate action without a button wall | 120–180ms, subtle fill/translation; no motion required for understanding |

Avoid perpetual movement in dense tables. Pause nonessential loops when the tab is hidden, the scene is off-screen or the user/OS requests less motion. Screen readers receive final accurate values with restrained announcements. Data freshness must never be simulated by decorative motion.

Only decorative optical paths may fade. Text-containing routes, widgets and stages keep full opacity at all times: a translucent ancestor can temporarily lower text contrast even when the final colors pass. Use an explicit tween for bounded entry transitions rather than inheriting a spring unintentionally.

## Actual data authority

The mockup's reference funnel is 336 → 252 → 168 (50%) over the fictional 42-day dataset. A Home lifecycle metric can legitimately use a different mature cohort (for example 28 of 56) according to its server definition. Never hardcode the mockup's counts or transplant the denominator into another query. Generated chart trajectories, dates, table examples and icon choices are illustrative; calculate all displayed results through the existing services.

In the dark responsive board, the flowing stage illustration is a visual composition sample. The implemented funnel's lengths, axis/reference and captions must follow actual converted/entrant values and preserve an equivalent data table.

## Runtime assets and provenance

Use `/brand/yasnosled/optical-flow.png` (or its root-managed WebP derivative) as the transparent illustrative layer and `/brand/yasnosled/yasnosled-mark.png` (or derivative) as the mark. They were generated from original prompts, inspected in light/dark, and their genuine alpha was verified. ASSETS.md records exact files, dimensions, source IDs and dependency ownership; PROMPTS.md records every exact prompt.

Do not place a generated UI/graph image in the runtime in place of working analytics. No new dependency, external stock art or public guest was created by the asset task. Preserve root LICENSE and explicit Umami provenance.

