# Signal Studio design system — M3

Status: implemented shell contract. Analytical feature behavior remains staged in `PLAN.md`.

## Direction

Signal Studio uses the visual language of an analytical instrument: measurement rules,
traces, explicit states and restrained evidence surfaces. The signature primitive is the
Query Spine, a vertical ordered definition that makes query lineage visible. Visual
emphasis is spent there; the surrounding shell is quiet and precise.

The shell does not use decorative gradients, ambient blobs, nested card stacks or pills
for ordinary controls.

## Tokens

| Role | Light | Meaning |
|---|---:|---|
| Instrument canvas | `#F5F7FA` | app background and measurement field |
| Ink | `#172033` | primary text and strong surfaces |
| Measurement grid | `#DCE4ED` | borders, rules and chart grid |
| Signal cobalt | `#2F62F2` | current query, focus and primary links |
| Outcome coral | `#C74735` | loss and actionable error |
| Verified mint | `#27896D` | healthy/fresh state |

Dark mode preserves the semantic relationships with a dark blue canvas, light ink and
higher-luminance accents. It is not a mechanical inversion.

## Typography and provenance

- UI and display: the existing locally built Next `Inter` configuration, with restrained
  weight and tighter heading tracking.
- Data and utility: system monospace (`ui-monospace`, `SFMono-Regular`, `Consolas`).
- No new font, icon file or external visual asset was introduced in M3. Existing
  `lucide-react` icons are reused. The open font decision remains deferred until its
  provenance process is complete.

## Layout and navigation

- Desktop (1100 px and above): persistent navigation rail, top utility bar and content
  canvas.
- Tablet and mobile (below 1100 px): the same six primary destinations are available in
  a modal navigation sheet. It is not a reduced route set.
- Mobile controls retain 40–44 px interactive dimensions and content uses a deliberate
  single-column flow.
- Project switching keeps compatible sections and clears unsupported section state by
  returning to Home.

Primary IA is exactly: Home, Explore, Dashboards, Audiences, Experience and Live.
Website appears only as the connected Source behind the Project facade.

## State patterns

The shared `StudioState` primitive defines:

- loading — names what access or data is being checked and preserves the shell boundary;
- empty — explains why there is no content and offers the next meaningful action;
- error — uses `role=alert`, keeps the analytical question intact and provides recovery;
- permission — states that no project data was loaded and offers a safe project choice.

Next route `loading.tsx` and `error.tsx` files demonstrate the corresponding framework
states. Partial and stale analytical result states begin with M5/M6, when a result
envelope exists; M3 does not pretend they are implemented.

## Accessibility and motion

- semantic links, buttons, labels and headings;
- visible `:focus-visible` treatment and a skip link;
- command palette and mobile navigation trap focus, close with Escape and restore focus;
- the same navigation model is exposed at every breakpoint;
- all icon-only controls have accessible names;
- reduced motion suppresses non-essential transitions and the loading rotation;
- Query Spine order is represented by a semantic ordered list and each block is a button.

## Legal

Every Studio page links to `Legal & notices`. That page states that Signal Studio is
based on Umami 3.3.1 under MIT and points to the unchanged root `LICENSE` and
`THIRD_PARTY_NOTICES.md`.
