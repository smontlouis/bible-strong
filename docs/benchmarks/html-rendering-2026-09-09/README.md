# HTML rendering comparison — 2026-09-09

Preliminary measurements on the iPhone 17 Pro Max simulator, iOS 26.5,
Hermes **development** build, using the existing Metro server. These are not
physical-device or Release/TestFlight measurements. Do not extrapolate their
absolute timings to production.

## Reproduce

Open the development playground, then **HTML : Native / Expo DOM**. Tap
**Lancer 5 passages**. The `.argent/flows/html-rendering-benchmark.yaml` fragment
records this action for the tested simulator layout. Fixtures load before timing;
no resource request is included in the measured interval.

The benchmark mounts the existing `StylizedHTMLView` implementation for native
HTML and the existing `HTMLContentDOM` inside a separate Expo DOM benchmark entry.
Production screens are untouched. They retain their current typography, sanitizing,
and link-processing differences: this compares the app's rendering paths, not
identically styled bare engines. The DOM benchmark also waits for document fonts.

Four fixtures are shared byte-for-byte between the engines during each run:

- Dictionary Aaron's first paragraph: 1,534 JavaScript string code units.
- Full dictionary Aaron: 22,537 code units.
- Full Nave Aaron: 4,924 code units, with many reference links.
- Synthetic stress case: the full dictionary article repeated five times,
  112,685 code units. This is not a real editorial entry.

Five alternating-order rounds, one renderer mounted at a time, with a 350 ms
unmounted interval. The first round is retained in `baseline.json` but excluded
from the medians below because of first-use bundle/module/font initialization.
Four warm samples per engine and fixture remain. These are fresh **component**
mounts, not cold app launches. This small sample gives a direction, not a stable
population percentile or production threshold.

`readyMs` starts immediately before scheduling the mount in the native runtime.
Native readiness is the first non-empty layout followed by two animation frames;
DOM readiness is populated content plus loaded fonts and two browser animation
frames, followed by receipt of the native callback. It is a rendering-readiness
proxy, not a measured first visible pixel. No clocks from different runtimes are
subtracted.

`maxJsGapMs` is the longest interval observed by a 16 ms heartbeat on the RN JS
thread. It is not UI-thread frame time. Scroll checks issue the same six animated
native scroll commands (300, 600, 900, 1200, 600, 0 points; 180 ms apart). A short
article may not have enough content to traverse every requested offset.

## Baseline results

Medians in milliseconds, excluding the first round:

| Fixture | Native ready | DOM ready | Native longest JS interval | DOM longest JS interval |
| --- | ---: | ---: | ---: | ---: |
| Short paragraph | 66 | 492 | 50 | 24 |
| Dictionary Aaron | 208 | 484 | 188 | 28 |
| Nave Aaron | 208 | 483 | 186 | 21 |
| Synthetic 5× dictionary | 833 | 500 | 814 | 25 |

All 40 mounts reported readiness before the 20-second timeout. During scrolling,
median longest JS intervals stayed around 17–18 ms for both engines. This does
**not** establish equivalent UI FPS: native animations and the WebView renderer
can operate independently of this heartbeat.

The native path opens small/medium samples faster but occupies the RN JS thread
while parsing and building the view tree. DOM has a substantial mount cost but
isolates most of the HTML work from that thread. The link-heavy Nave fixture
also shows why string length alone is not a suitable renderer-switch threshold.

## Native trace and memory limits

A separate instrumented round was captured with Argent / Instruments; it is
excluded from the baseline times. See `instruments.md` for the raw generated
analysis. Yoga layout, native paragraph drawing, and view clipping appear in the
stacks. The detector also flags 30-second and 10.7-second intervals containing
run-loop waits across idle/measurement periods. Those alerts do not support an
engine-specific claim of a 30-second frozen interface. There is no clean,
per-engine UI FPS measurement here.

`memory.json` contains simulator RSS snapshots (app plus all same-simulator
WebKit processes), collected with the adjacent script after timing. Five retained
views use the full dictionary fixture; four are invisible but mounted. This is a
stress proxy, not the application's actual tab cache policy.

| Phase | App RSS MiB | App + WebKit RSS MiB | WebKit process count |
| --- | ---: | ---: | ---: |
| Empty after measurements | 648.4 | 1266.3 | 4 |
| Five native views | 1264.3 | 1882.0 | 4 |
| Cleared after native | 1195.8 | 1813.7 | 4 |
| Five DOM views | 806.3 | 2850.6 | 9 |

Native allocations were not promptly reclaimed after unmount; the DOM phase
also overlaps reclamation of that memory. RSS includes shared pages and existing
WebViews, and is not physical footprint. `vmmap -summary` failed to retrieve task
DYLD information. Therefore these values demonstrate extra WebKit processes and
large development overhead, but cannot quantify production memory savings or
prove a leak. A fresh-process Release test on an actual iPhone is needed.

Manual dictionary preview showed rendered paragraphs and links in both engines.
Tapping a native `Frère` link and a DOM `Moïse` link delivered their href to the
playground without leaving it. Text-selection quality and VoiceOver traversal
have not been systematically validated.

## Real commentary follow-up

A fifth fixture was subsequently added to the playground: Bible annotée,
Matthieu 4:1 (4,655 code units). `commentary.json` stores five alternating rounds
of this fixture only; the first round is again excluded. There were no timeouts.

| Fixture | Native ready | DOM ready | Native longest JS interval | DOM longest JS interval |
| --- | ---: | ---: | ---: | ---: |
| Bible annotée, Matthieu 4:1 | 83 | 475 | 64 | 18 |

All measurements together cover 50 uninstrumented mounts, plus one separate
8-mount Instruments round. The current playground button runs all five fixtures;
the original 40-sample baseline predates addition of the real commentary.

## Decision supported by this experiment

Keep the current native commentary renderer: this actual section opens much
faster with it in development. Native rendering is a plausible candidate for
Nave/dictionary opening latency, but it can stall RN JavaScript for approximately
190 ms on these real samples and longer on large content. A blanket migration
based only on "native is faster" is not justified. Retain DOM as an option for
very long/rich documents; do not infer a cutoff from this small corpus.

Before a production migration, repeat using the same typography and font-loading
conditions, physical iPhone Release builds, representative large real entries,
clean-process memory measurements, and text selection/accessibility checks.
The development-only playground itself is intentionally unavailable in current
Release builds; enabling a dedicated internal benchmark build is a separate step.

Validation: TypeScript, targeted ESLint, style guard and five existing playground/
HTML component tests pass. React Doctor reported only existing findings outside
these new playground components. No production renderer was migrated.

## Later style harmonization

The playground now compares `StylizedHTMLViewNative` with `HTMLContentDOM`,
using shared Bible typography and editorial styles. The JSON measurements above
were collected **before** this change and are historical; they are not results
for the harmonized components. Rerun the playground to compare the new versions.
