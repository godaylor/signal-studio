# M22 test-tool provenance

The application dependencies and lockfile did not change. The following binaries
were installed only into ignored `.local/m22-audit/browsers` for local QA, using
the repository's existing Playwright 1.62.0 CLI. They are not application assets,
tracked files or redistributed browser bundles. The existing Chrome installation
and other browser caches were preserved.

Playwright requires browser versions matched to its release; the normal CLI was
used instead of forcing unrelated cached executables. See the official
[browser installation documentation](https://playwright.dev/docs/browsers).

| Tool | Exact download from the official Playwright CDN | License/provenance evidence |
| --- | --- | --- |
| Firefox 153.0, build 1538 | [firefox-win64.zip](https://cdn.playwright.dev/dbazure/download/playwright/builds/firefox/1538/firefox-win64.zip) | Mozilla's principal source license is MPL 2.0; individual bundled components have their own terms. See [Mozilla licensing information](https://www.mozilla.org/en-US/MPL/). This is not a blanket license assertion for every binary component. |
| WebKit 26.5, build 2336 | [webkit-win64.zip](https://cdn.playwright.dev/dbazure/download/playwright/builds/webkit/2336/webkit-win64.zip) | WebKit includes BSD and LGPL portions; see [WebKit licensing](https://webkit.org/licensing-webkit/). The test build is not Safari. |
| FFmpeg, build 1011 | [ffmpeg-win64.zip](https://cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-win64.zip) | Bundled `ffmpeg-1011/COPYING.LGPLv2.1` retained locally. |
| Winldd, build 1007 | [winldd-win64.zip](https://cdn.playwright.dev/dbazure/download/playwright/builds/winldd/1007/winldd-win64.zip) | Official Playwright dependency-inspection helper, installed by the same CLI; not included in the product or release images. |

The existing Playwright package retains its Apache-2.0 `LICENSE` and Microsoft /
Puppeteer `NOTICE` under
`node_modules/.pnpm/playwright-core@1.62.0/node_modules/playwright-core/`.
Local installation URLs and versions are recorded in
`.local/m22-audit/install-browsers.log`. A complete redistribution audit of these
QA-only binary bundles is not claimed; no such redistribution was performed.

The PNG/WebM evidence in this directory was captured from this application's
actual browser UI using explicitly synthetic Orbit data. `board.html` composes
the unmodified screen captures. No new runtime photos, fonts, datasets, browser
bundles or package dependencies were added by M22. Existing M21 visual provenance
and full Umami/MIT attribution remain in the repository.
