# M23 — provenance of review material

No application dependency, font, icon set, dataset or runtime image was added.
The UI uses the existing Kinorit assets, Golos Text and Motion package. Upstream
Umami MIT attribution and the complete root LICENSE remain intact.

Screenshots and videos are captures of this application's actual interface with
the explicitly synthetic Orbit dataset. The final after-images and clips use
the native production build of `bc1147851b6a254edf45071e2e8e0d78f57b2f8a`.
Before-images are honestly labeled as the early-M23 baseline before visual
integration; they are not presented as a pristine M22 release capture.
`board.html` composes unmodified screenshots, and its PNG is a browser capture.
Video posters are frames extracted from the corresponding actual recordings.
No generated mockup is used as evidence of an implemented screen.

QA uses the repository's existing Playwright 1.62.0 and installed Chrome
155.0.8059.85. WebKit 26.5/build2336 and FFmpeg build1011 reuse the isolated
M22 QA installation. Their exact upstream URLs and license evidence are in
[M22 test-tool provenance](../m22-comprehension/TEST_TOOLS.md). These QA binaries
are not shipped with the application. WebKit testing is not Safari certification.

The 42-case viewport smoke and 20-second motion-cost diagnostic used the local
Next development server. Production acceptance, final screenshots, recordings
and the two motion regressions were run separately. No all-device, physical
display FPS, manual screen-reader or million-event performance claim is made.
