# Яснослед — visual asset provenance

Date: 2026-10-17. Product redesign M20. Original working name Signal Studio; new selected product identity Яснослед. Name availability is a preliminary product decision, not trademark registration.

## Original generated assets

| Project file | Role | Dimensions | Source |
| --- | --- | --- | --- |
| `docs/design/m20-yasnosled/concept-a-home-light.png` | Selected A, desktop Home light | 1536 × 1024 | imagegen `exec-9e7fe46a-68b3-4a96-a3ef-ca2832ca2580.png` |
| `docs/design/m20-yasnosled/concept-b-home-dark.png` | Alternative B, desktop Home dark | 1536 × 1024 | imagegen `exec-6efc20cb-6a3b-4054-97c7-b994367dc019.png` |
| `docs/design/m20-yasnosled/selected-a-explore-dark-mobile.png` | Selected A, dark Explore + light Home/mobile Explore board | 1838 × 856 | imagegen `exec-d4cf83e4-b30b-4505-bbe1-b69b524c0a62.png` |
| `docs/design/m20-yasnosled/selected-a-dashboards-light-dark-mobile.png` | Selected A, Dashboard light desktop + dark mobile; generated design reference only | 1604 × 980 | imagegen `exec-0ae285d9-c16f-4f2a-a7ea-0858711282bf.png` |
| `public/brand/yasnosled/optical-flow.png` | Runtime decorative glass-flow illustration | 1983 × 793, RGBA | imagegen `exec-ded5c0c2-3c10-44e8-bc7a-9d996851bf8e.png` |
| `public/brand/yasnosled/yasnosled-mark.png` | Runtime original folded optical ribbon brand mark | 1254 × 1254, RGBA | imagegen `exec-dba2a0c6-3722-44c0-a17f-a5b8000f388c.png` |

All original source images are preserved under `C:/Users/lapha/.codex/generated_images/01a146ff-91ea-7af2-9494-d3ffeed78503/`. The original five exact prompts remain in the unchanged, hash-pinned PROMPTS.md. The supplemental Dashboard prompt is recorded separately in DASHBOARD-PROMPT.md and uses the project's selected A mockups and real Dashboard screenshots as four explicit input references, all inspected before generation. It adds no runtime asset or behavior. No external image reference, third-party stock asset, trademark artwork, icon or font file was embedded in the runtime images. Generated mockup typography and figures are raster review material only.

Supplemental Dashboard reference: 1,535,689 bytes; SHA256 `6edcfa91934edbb2873830fcd8a84e3c3a90e65446cd754a9b7dd442b26389d4`. Its provenance is documentation-only and does not alter the runtime inventory's original five-generation set.

Root-owned WebP/favicon derivatives may be created with the already installed Sharp dependency; they retain this provenance. Conversion/resizing must preserve the composition and transparency and add no new semantic visual content. No generated video exists: motion is implemented in the application using its image/HTML/SVG layers and motion preferences.

## Alpha inspection

Sharp, resolved through the installed Next dependency, reported:

- Hero: 4 channels, `hasAlpha: true`; 1,035,456 fully transparent pixels and 536,485 partially transparent pixels.
- Mark: 4 channels, `hasAlpha: true`; 1,000,839 fully transparent pixels and 570,475 partially transparent pixels.

The same PNG files were rendered on pearl `#F6F7FB` and deep ink `#111326` in ASSET-PREVIEW.html, then visually inspected in asset-preview-light-dark.png. The mark was checked at 24, 32, 48 and 64 CSS pixels. No background-removal script or manual image editing was used.

## Fonts and existing dependencies

The implementation owner selected Unbounded for strong Cyrillic display text and Golos Text for readable UI. Root owns downloading and recording the official OFL font files and notices; no font binaries were introduced by this asset task. Preserve the font packages' OFL notices in the shipped distribution. Native rendered text must remain HTML, not baked into a generated logo/hero.

The application already has its chosen motion integration; this task adds no package or browser bundle. The preview uses system fonts and local files. Root LICENSE and Umami attribution remain intact.
