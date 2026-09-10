# Third-party notices

Signal Studio is based on Umami 3.3.1, Copyright (c) 2022 Umami Software, Inc.,
and is distributed under the MIT License included in the root `LICENSE` file.

Runtime and build dependencies retain their respective licenses. The build
generates `legal/application.cdx.json`, `legal/DEPENDENCY_LICENSES.txt`,
`legal/ASSET_PROVENANCE.json` and `legal/BUILD_METADATA.json`. These files are
included in the distribution and available from the application's Legal page.
The application SBOM is an installed build/runtime superset; separate image
SBOMs describe the actual runner, worker and migration images.

- `ua-parser-js` is exactly 1.0.41, MIT, Copyright (c) 2012–2025 Faisal Salman.
  The inherited AGPL v2 is no longer a resolved dependency.
- DiceBear core/collection retain their package notices. The actually displayed
  Lorelei artwork is CC0 1.0 by Lisa Wischofsky; its code is MIT by Florian Körner.
  Other installed collection styles retain their own design licenses and authors
  in DEPENDENCY_LICENSES.txt; collection code licensing does not override artwork.
- rrweb 2.0.1 and rrweb-player 2.0.0-alpha.20 are MIT, rrweb contributors.
  Their upstream license texts, source revisions and hashes are in `docs/licenses`.
- `@umami/react-zen` 0.249.0 is MIT, Umami Software, Inc. Its package omits LICENSE,
  so the original notice is supplied from published source revision
  55bb53ab2dfc9ca6038ec89dbbfe972212228c52.
- Inter is Copyright The Inter Project Authors, SIL Open Font License 1.1.
  The unmodified font and full OFL text are pinned to Inter source revision
  353b61b9f4430d5f420d56605a6e7993e0941470, with verified Git blob and SHA256 hashes.
- Lucide icons retain their ISC notice. Inherited UI icons, PNG flags/device/
  browser/OS illustrations, translations and subdivision data retain their Umami
  source snapshot and MIT attribution. Per-file hashes and modifications are
  inventoried; trademarks are not licensed or endorsed by this project.
- World topology is inherited through Datamaps (MIT, Mark DiMarco), using Natural
  Earth public-domain geography. Country/language labels retain the MIT notices
  of umpirsky/country-list and umpirsky/language-list and the inherited snapshot.
- JSZip is used under its MIT alternative, not its alternative GPL grant.
- Sharp/libvips retain Apache/LGPL notices. They are unmodified dynamically
  loaded dependencies; replacement/relinking is not restricted by this project.
  Corresponding upstream source and build recipes: https://github.com/lovell/sharp,
  https://github.com/lovell/sharp-libvips and https://github.com/libvips/libvips.
  Exact distributed versions are recorded in the image SBOM and bundled versions.json.

Five small dependencies publish a MIT/ISC declaration and author metadata but
no separate copyright/license file. Their notices explicitly preserve that
declaration with the standard SPDX text; no copyright year or recovered upstream
document is invented. These evidence types are distinguished in
`docs/licenses/sources.json`. License inventory is provenance evidence, not a
warranty of third-party trademark rights.

Container Node is pinned by digest; Alpine/Node and their components are recorded
in image SBOMs. CI actions are build tooling, not application dependencies or
browser assets. Their source coordinates remain visible in `.github/workflows`.

Accessibility browser checks use `@axe-core/playwright` 4.10.2 and its
`axe-core` dependency from Deque Systems. Both declare the Mozilla Public
License 2.0 (MPL-2.0); they are development/test tooling and are not shipped in
the application browser bundle.

GeoLite2 data is not downloaded by the default build. Operators who provide a
licensed database are responsible for complying with MaxMind's terms and for
recording its immutable source, checksum, license and redistribution notice.
