# M16 license/provenance result — 2026-09-09

Application inventory generation passes locally: 1029 installed build/runtime
components, 478 unique notice texts, zero missing notice texts and zero unknown
license declarations. This is a conservative installed dependency inventory, not
a claim that every build dependency ships in the traced runner.

- ua-parser-js is pinned to 1.0.41 (MIT), with @types/ua-parser-js 0.7.39.
  Device golden tests pass 16/16. No claim that former v2 is MIT.
- Inter is self-hosted from immutable upstream revision
  353b61b9f4430d5f420d56605a6e7993e0941470. Font and full OFL-1.1 notice
  hashes are checked on every inventory build. No Google Fonts request is needed.
- DiceBear Lorelei design is CC0 (Lisa Wischofsky), its code MIT (Florian Körner).
  Other installed collection styles retain their actual full licenses, including
  CC-BY obligations. rrweb/rrweb-player and @umami/react-zen MIT notices are retained.
- Inherited icons/flags/browser images retain the exact upstream Umami MIT source
  snapshot and local hashes; this records the available upstream provenance, not
  an independent guarantee of ultimate origin or trademark rights.
- Datamaps MIT, Natural Earth public domain, country/language list MIT sources are
  recorded. GeoLite2 is absent by default; licensed operator opt-in remains required.
- Sharp/libvips license and corresponding-source/build information are preserved;
  dynamically linked third-party libraries are not relabeled MIT.
- Five packages publish a MIT/ISC declaration but no standalone LICENSE:
  @open-draft/deferred-promise@2.2.0, @prisma/dev@0.24.17,
  eastasianwidth@0.2.0, is-node-process@1.2.0, stackback@0.0.2.
  Their supplemental records explicitly identify declaration-only evidence,
  package author/integrity and standard SPDX text. No copyright year is invented.

Source records/full texts: docs/licenses/. Generated downloads: public/legal/.
Build artifacts: generated/legal/application.cdx.json, DEPENDENCY_LICENSES.txt,
NOTICE_REVIEW.json, BUILD_METADATA.json and ASSET_PROVENANCE.json.
Build metadata includes a source SHA256 covering dirty implementation files;
the base Git revision alone is explicitly not the build identity.

Normal build is offline for license/font preparation. The explicit maintenance
scripts fetch immutable sources with bounded network timeouts. Installed stale
virtual-store folders not present in the lockfile are excluded. Linux native
package notices are resolved from the same-version monorepo license where needed.

Root LICENSE remains unchanged, including Umami Software attribution. Legal UI
links full notices/SBOM/metadata and states Based on Umami. Final Linux image SBOM
counts and image identities belong in M16_FINAL_REPORT.md; do not substitute the
earlier image's 312-component Scout inventory for the rebuilt release.

