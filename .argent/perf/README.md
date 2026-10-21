# Performance test protocol (Bible Strong, iOS)

Written for issue lane `perf-blocages-ios-v28` (2026-10-21). Replays the measurements on a simulator
or on the user's iPhone 15 Pro Max.

## Setup

- Account: the heavy test account (about 3318 highlights, 504 notes, 141 tags, 11 tabs). The user
  signs in; the simulator template `bs-template-heavy` already carries the session for the
  production app (`com.smontlouis.biblestrong`).
- Production build for the simulator, from the lane's worktree (`apps/expo`):
  ```bash
  export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 EXPO_PUBLIC_AUTOMATIC_UPDATES=0 SENTRY_DISABLE_AUTO_UPLOAD=true
  node_modules/.bin/dotenv -c production -- yarn expo prebuild -p ios --clean
  node_modules/.bin/dotenv -c production -- yarn expo run:ios --configuration Release -d <udid> --no-bundler --no-install
  ```
  Installing a newer build over the template with `xcrun simctl install` keeps the session.
- Deep links: use the production scheme `com.smontlouis.biblestrong://…`. On a simulator,
  `biblestrong://` is also claimed by the dev and staging apps.

## Scenarios

| # | Scenario | How | What to read |
|---|---|---|---|
| 1 | Idle on the reader | Leave the Bible reader alone 10 s | `idle_cpu.sh`: CPU of the app and of its WebContent process |
| 2 | Home and More drawers | Flow `perf-home-more` (3 open/close cycles) | Time Profiler: app main thread, JS thread |
| 3 | Resume from background | Home button, wait, reopen, tap Home right away | Does the first tap answer; JS thread saturation after resume |
| 4 | Background activity | Home button, then `ps -o %cpu,state -p <pid>` | A suspended app shows state S and 0 % |
| 5 | Tabs and parallel views | Switch between the 11 tabs, 3-4 versions side by side | Injections into the WebView per action (dev client) |
| 6 | Highlights list | `com.smontlouis.biblestrong://highlights`, scroll, sort | Time Profiler |

## Baseline (2026-10-21, `origin/master` cc80f49ff, simulator on an Apple Silicon Mac)

| Measure | Value |
|---|---|
| Production app at rest, foreground | 12–19 % CPU, 0.8–1.0 GB RSS |
| Its Bible WebView at rest | 18–40 % CPU |
| Production app in background | 60–80 % CPU, memory +40 MB/min; frozen (taps dead, scroll alive) at 2.2–2.8 GB after ~30 min |
| Dev client in background, avatar loop cut from the debugger | 1.5 % CPU, memory stable |
| `requestAnimationFrame(tick)` calls from the avatar in background | ~140 000 in a few seconds |
| Redux `user` slice / whole state, JSON | 2.1 MB / 3.4 MB (10 ms per stringify on the Mac) |
| WebView injections (dev): startup / tab switch / select verse / highlight | 36 (789 KB) / 16 (333 KB) / 5 (146 KB) / 4 (146 KB) |
| WebView injections (dev), 4 parallel versions: chapter change | 14 (574 KB) |
| Highlights screen opening (dev React commits) | 566 + 434 + 379 + 379 ms; 45 sheet hosts of the hidden reader re-render |
| Files skipped by React Compiler (eslint-disable of react-hooks) | 48, including BibleViewer, BibleDOMComponent, BibleScreen, CompactAppSwitcherScreen |

## After the fixes (same simulator, branch `issue/perf-blocages-ios-v28`)

| Measure | Value |
|---|---|
| JS thread at rest, production build | 1 % (the avatar now samples its frames on the UI thread) |
| Production app in background | 1.2–1.6 % CPU, state S, memory going down |
| Main thread at rest | about 14 % spent in the avatar's frame callback (open question) |
| Bible WebView at rest | still 15–19 % CPU: an internal loop of the page, no props are sent at rest |
| WebView injections (dev): select verse / highlight | 2 (0.4 KB) / 1 (2 KB) |
| WebView injections (dev), 4 parallel versions: chapter change / tab switch | 5 (47 KB) / 8 (36 KB), no WebView reload |
| Highlights screen opening (dev React commits) | 282 + 93 + 198 + 228 ms |

## Tools in this folder

- `analyze_time_profile.py <file.trace> [bucket_ms]`: CPU per thread over time and hottest native
  frames for the app main thread, the app JS thread and the WebViews.
- `idle_cpu.sh <udid> [seconds]`: average CPU of the app and of its Bible WebView at rest.
- `webcontent_owners.sh`: which simulator each WebContent process belongs to.
- `hermes_inclusive.py <cpu.json> [top] [filter]`: inclusive JS time from a Hermes CPU profile
  (argent `react-profiler-stop` saves one under `$TMPDIR/argent-profiler-cwd/`).
- `react-compiler-check.cjs <files…>` (run from `apps/expo`): which components React Compiler
  compiles, and why it skips the others.

Recording Time Profiler directly, when argent's native profiler session is torn down by another
agent sharing the tool-server:

```bash
xcrun xctrace record --template 'Time Profiler' --attach <pid> --time-limit 30s --output run.trace
```

## Dev-client instrumentation (Metro debugger)

Count what React Native pushes into the Bible WebView (module ids differ per bundle; look them up
with `__r.getModules()` and the verbose name `RNCWebViewNativeComponent`):

```js
const C = __r(<id>).Commands, orig = C.injectJavaScript
globalThis.__perfInject = { count: 0, bytes: 0, since: Date.now() }
C.injectJavaScript = function (ref, js) { __perfInject.count++; __perfInject.bytes += js.length; return orig.apply(this, arguments) }
```

## On the iPhone

The production App Store / TestFlight build cannot be attached by Instruments (no
`get-task-allow`). Use a Release build signed for development (`expo run:ios --configuration Release
--device`), or Xcode Organizer's hang reports. The flows replay with argent on a cabled iPhone, but
tap coordinates come from the simulator and may need adjusting for the 430 × 932 pt screen.
