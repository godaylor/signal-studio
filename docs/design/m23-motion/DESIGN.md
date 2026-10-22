# M23 — исследование в движении

Subject: a product team following the path from signup to useful feature use.
Motion should explain arrival, comparison, navigation and successful actions;
the displayed figures remain the actual server result at every frame.

Keep the established identity: midnight `#061b2c`, paper `#f0f6f8`, ink
`#0e293d`, water `#35e0cf`, cobalt `#5089ff`, loss `#ffb381`. Existing Golos
Text for headings/UI and tabular numerals for data; no new fonts or assets.

One signature is the continuous participant stream. Make its changing geometry
clear, use a quiet staged arrival for the question and evidence, and give
navigation/loading/selection useful feedback. A large result arrives with its
final value; no fake counting or fabricated live events. Keep tables precise.

Composition: question → answer → evidence → detail. Entry text and flow enter
as one scene. Sections settle when first visible; new result values receive a
short emphasis. Layout and controls stay available during every transition.
Mobile keeps deliberate local chart/table scrolling and full-screen editing.

Implementation limits: existing Motion plus bounded native transform
animations; no per-frame React state, no global scroll listener, no new runtime
dependencies. Finish transient effects on pause/reduced/hidden changes and
pause ambient streams offscreen. Honor saved motion preference before enabling
effects. Record real browser frames, not generated mockups, as final evidence.

Text surfaces remain fully opaque during motion, including nested route/result/
value arrivals. This preserves their contrast throughout the transition. Plot
reveals affect only the marks; axes, labels and equivalent data tables remain
available. Surface arrivals last 620 ms, plot reveals 660 ms with a bounded
stagger, and flow geometry settles in 620 ms. Pausing finishes each transient
at its real target. Resuming does not replay already-seen results.

Functional companion fixes are deliberately narrow: preserve unsaved Explore
and dashboard context drafts, retain failed Insight renames, and explicitly load
later pages in the dashboard's saved-analysis picker. No analytics semantics,
authentication, guest limits or persistence schema change.
