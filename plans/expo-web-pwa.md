# Expo Web PWA — loop checklist

Source of truth for the `/loop` that turns `https://web.bible-strong.app` (Expo single-page
export on Cloudflare Workers Static Assets, ADR-0047) into a working PWA. Each loop iteration
reads this file, does **one** unchecked item, validates it, updates this file and commits.

## Decisions (agreed 2026-10-01)

- **Scope**: installable + offline app shell + update prompt. **No caching of editorial
  content or Resource API responses** (no chapter cache). Web stays online-only for content
  (ADR-0063 / ADR-0065 unchanged).
- **HTML**: `lang="en"` by default. Manifest `start_url: "/home"`, `scope: "/"`.
- **Service worker tooling**: Serwist (actively maintained Workbox fork; Workbox 7.4.x only
  ships dependency bumps). `serwist` in the worker, `@serwist/build` `injectManifest` after
  `expo export`, `@serwist/window` for registration and the update prompt. The worker source
  is TypeScript bundled with esbuild (add `esbuild` as an explicit devDependency).
- **Git**: branch `feat/expo-pwa`, one Conventional Commit per iteration, **never push**
  (a push to `master` deploys production). Never stage `apps/expo/.sim-fleet/`.
- **Bundle splitting allowed** (2026-10-01): the web entry may be split (item 4b). Native
  bundles must not change behaviour.

## Loop protocol

1. Read this file. Pick the first unchecked item; do only that item.
2. Read the files it touches first. Follow `AGENTS.md`, `apps/expo/AGENTS.md` (React Compiler:
   no `useMemo`/`useCallback`/`memo`; Uniwind `className`; i18n for user-facing strings).
   Lint fixes: never add hook deps (use eslint-disable), keep `==`/`!=`.
3. Validate with the smallest relevant set, always including what the item lists:
   - `yarn workspace @bible-strong/expo typecheck`
   - `yarn workspace @bible-strong/expo eslint <touched files>`
   - `yarn workspace @bible-strong/expo web:export` + `node apps/expo/scripts/check-web-assets.mjs`
   - `node apps/expo/scripts/check-pwa.mjs` once it exists
   - Browser check on the local Cloudflare server (recipe recorded in **Baseline**) with the
     built-in browser or chrome-devtools MCP.
4. Tick the item, add a short **Evidence** line (command + result), commit.
5. If an item needs a user decision, cannot be validated, or fails twice the same way:
   write it under **Blockers**, stop the loop and report. Do not work around it.
6. When every item is ticked and the final verification passes: write the **Final report**,
   stop the loop.

## Checklist

- [x] **1. Baseline.** Run `web:export`; record dist total size, file count, the 10 largest
      files and the JS/CSS/font weight needed for the first paint of `/home`. Find and record a
      working local serving recipe that honours `wrangler.jsonc` (SPA fallback, `_headers`), e.g.
      `wrangler dev` from `packages/resource-service`. Confirm no manifest / SW today. Set the
      precache budget from the numbers (target ≤ 15 MB, justify otherwise).
      **Evidence**: `web:export` exit 0; `wrangler dev` (recipe below) serves `/home` 200;
      browser Resource Timing on `/home` = 37 same-origin requests, 27.56 MB decoded,
      `navigator.serviceWorker.controller` null, no `link[rel=manifest]`. Budget set to
      ≤ 30 MB decoded / ≤ 6 MB transfer (see Baseline).
- [x] **2. HTML template.** `npx expo customize public/index.html` (single output), keep Expo's
      reset styles, then: `lang="en"`, fix `http-equiv`, viewport with `viewport-fit=cover`,
      `theme-color` for light and dark (from the default theme palettes), `description`,
      `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`,
      `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`, manifest link. Verify the
      exported `dist/index.html`.
      **Evidence**: `apps/expo/public/index.html`; `web:export` exit 0, `dist/index.html` carries
      every tag, Expo still injects favicon/CSS/JS; `check-web-assets` OK; `/home` renders on
      `localhost:9090` with 26/26 Resource API calls 200. `theme-color` = default theme `reverse`
      (`#ffffff` / `#122d42`). No `color-scheme` meta: it would darken native controls for users
      who chose the light theme on a dark system. Status bar style `default` until item 8 checks
      safe areas (`black-translucent` always uses white text, unreadable on the light theme).
      Item 8: keep `theme-color` in sync with the selected in-app theme at runtime.
- [x] **3. Icons.** Reproducible script generating `public/icons/` from the app icon: 192 and
      512 (`any`), 512 maskable (80 % safe zone, opaque background), 180 apple-touch-icon
      (opaque), favicon. Inspect the source icon (transparency, rounded corners) first.
      **Evidence**: `yarn workspace @bible-strong/expo web:icons` (`scripts/generate-web-icons.mjs`,
      ImageMagick 7, PNGs committed). `icon-2.png` is opaque full-bleed, so `any` + apple icons
      are plain resizes. Maskable 192/512 = `background-image.png` gradient + the white disc
      cut out of the icon at 76 % (source disc is 83 %, beyond the 80 % safe zone); forced sRGB
      because the gradient source is Gray. `identify`: all opaque sRGB, right sizes. The favicon
      stays Expo's `favicon.ico` from `web.favicon`.
- [x] **4. Manifest + headers.** `public/manifest.webmanifest` (id, name, short_name,
      description, start_url `/home`, scope `/`, display `standalone`, theme/background colors,
      icons, lang `en`, categories). `public/_headers`: no-cache for `/sw.js` and HTML
      navigations, immutable for `/_expo/static/*`, manifest content type. Verify with `curl -I`
      on the local server, including the SPA fallback path `/home`.
      **Evidence**: `curl -I` on `localhost:9090`: manifest `application/manifest+json` +
      `no-cache`; `/_expo/static/*` and `/assets/*` (all content-hashed, checked) `immutable`;
      `/sw.js` `no-cache`; `/home` keeps `max-age=0, must-revalidate`; `_headers` itself is not
      served. Browser: manifest parsed, 4 icons decode at their declared sizes, apple icon
      180x180, no manifest console warning. **Kill-switch note for item 9**: a missing `/sw.js`
      falls back to `index.html` (HTML), so the browser keeps the old worker; retiring the SW
      must ship a self-unregistering `sw.js`, never just delete it.
- [x] **4b. Split the web bundle.** Analyse first: export with `EXPO_ATLAS=true` (Expo Atlas)
      or a source map explorer and record in **Baseline** the 15 heaviest packages/modules in
      the entry and what pulls them into startup (root layout, `FullAppRuntime`, workspace).
      Then pick the smallest set of changes with the biggest gain, likely a mix of: Expo Router
      `asyncRoutes: { web: true, default: 'development' }` (Suspense fallbacks must look right),
      and `import()`/`React.lazy` of heavy, non-startup dependencies (editor, markdown/mermaid,
      assistant UI, media players, drag and drop, Lottie…), with `.web.tsx` variants when native
      must keep static imports. This item may span several iterations: commit each step, keep it
      unticked until done. Done when: the startup JS of `/home` drops significantly (record
      before/after decoded and compressed bytes), the entry is well under the 25 MiB Cloudflare
      limit, navigating to every top-level route works in the browser with no console errors,
      native typecheck/lint unchanged, `web:export` + `check-web-assets` pass. Revise the
      precache budget in **Baseline**: precache all JS/CSS chunks (downloaded in the background
      after first paint, so routes keep working offline) except heavyweight optional ones.
      **Evidence**: Atlas (`EXPO_ATLAS=true`) top offenders were whole-library imports:
      `lucide-react` 2.21 MB (barrel, 36 icons used), `effect` 1.83 MB + `fast-check` 0.42 MB
      (already `effect/Schema`, which itself pulls Arbitrary/fast-check: nothing to gain without
      tree shaking), `date-fns` 1.12 MB (locale barrel + `format` barrel), HeroUI/React Aria
      1.23 MB only for the web date picker, assistant UI 1.52 MB exclusive. Tried and rejected:
      `asyncRoutes` (shared code is hoisted into a 21 MB `__common` loaded at startup, gain
      ~1–2 MB for 99 chunks) and Expo tree shaking (25.2 → 18.7 MB but still experimental in
      SDK 56, needs `experimentalImportSupport`, 166 s and 6.8 GB RSS per export). Done instead:
      per-icon lucide imports (`study-assistant/lucideIcons.ts` + `global.d.ts` typing),
      per-function/per-locale `date-fns` imports, lazy `ReadingDatePickerField.web` (36 px
      placeholder, CSS kept in the wrapper), lazy `AssistantLauncher` in `FullAppRuntime.web`.
      **Result**: entry 25.20 MB → 18.85 MB raw (−25 %, 17.97 MiB vs the 25 MiB limit), new
      lazy chunks `AssistantLauncher` 1.62 MB and `ReadingDatePickerField` 1.31 MB; all JS+CSS
      22.6 MB raw / 3.7 MB brotli. Browser: client-side navigation through 72 static routes,
      0 console errors, 0 failed chunk loads, both lazy chunks load. `/local-search` and
      `/bible-compare-verses` crash when opened without params: pre-existing, unrelated (flagged
      as a separate task). typecheck, eslint and prettier on touched files OK; Jest 2925 pass,
      the same 4 env-dependent failures with and without this change
      (`mobileResourceCatalog-test`, `strongBibleDownloadPlan-test`).
- [x] **5. Service worker.** Worker source + its own tsconfig (WebWorker lib), outside the app
      typecheck if needed. `scripts/build-web-sw.mjs`: esbuild bundle, then `injectManifest`
      over `dist` (hashed `_expo/static` assets not cache-busted, startup fonts, icons, manifest,
      `index.html` for the navigation fallback), within the precache budget. Navigations:
      network-first with timeout, fallback to the precached `index.html`. No runtime caching
      of cross-origin requests (Resource API, Firebase, auth, analytics). Outdated precaches
      cleaned up. No `skipWaiting` on install (the update prompt drives it). Hook the script
      into `web:export` and `web:build`.
      **Evidence**: `service-worker/sw.ts` (own `tsconfig.json`, WebWorker lib, excluded from the
      app tsconfig, checked by `typecheck`), `scripts/build-web-sw.mjs` (esbuild IIFE +
      `injectManifest`, fails on warnings or over budget), hooked into `web:export`/`web:build`.
      Navigations: `NetworkOnly` 4 s timeout + precached `/index.html` fallback;
      `directoryIndex: null` so `/` is not served cache-first. Same-origin `/assets` and
      `/_expo/static` misses: `CacheFirst` (300 entries, 60 days). Cross-origin and `HEAD`
      requests untouched. Two traps fixed: `@serwist/build` ignores `**/node_modules/**` by
      default (Expo exports icon fonts under `assets/node_modules`) → `globIgnores: []`; and the
      browser requests `%40expo` → manifest URLs rewrite `@` to `%40`. Result: 48 entries,
      24.92 MiB. Chrome (chrome-devtools, isolated context; the built-in browser pane refuses SW
      registration): manual `register('/sw.js')` → activated, controls the page, 48 precached;
      offline reload of `/plans` renders the shell with icon fonts (screenshot), only the
      `HEAD /` probes fail. typecheck, eslint, prettier OK.
- [x] **6. Registration + update prompt.** Register only in production web builds with
      `@serwist/window`. When a new worker is waiting, show a non-blocking prompt
      ("A new version is available" / reload, fr + en via i18n extraction); reload once the new
      worker controls the page. Check for updates on focus/visibility and periodically. Unit
      test any extracted state logic.
      **Evidence**: `src/features/app/ServiceWorkerUpdates.web.tsx`, mounted next to
      `ThemedToaster` in `FullAppRuntime.web`. Production only; in development it unregisters
      any worker left by a local export (same `localhost:9090` origin as `yarn web`). Update
      checks on `visibilitychange` (visible) and hourly; failures logged at debug (normal
      offline). Prompt = own bottom banner with `Button` + close (`role="status"`, both exposed
      as buttons), keys `app.webUpdateAvailable` / `app.webUpdateReload` added by hand (fr/en):
      `yarn i18n` reorders the whole catalogue, so it was not committed. A sonner-native toast was
      tried first and rejected: v0.22.2 turns `duration: Infinity` into an immediate dismissal
      after any gesture (`setTimeout(…, Infinity)`), and its RNGH tap gesture swallows the action
      `Pressable` on web (no `SKIP_WAITING` was ever posted; existing toast actions on web may be
      affected too). Chrome, fresh profile: automatic registration, 48 precached; simulated
      deploy (changed precached file + `build-web-sw`) → `waiting` → banner; « Recharger » →
      `SKIP_WAITING`, reload, new revision active, no waiting worker. No extracted pure logic,
      so no unit test. typecheck, eslint, prettier OK.
- [x] **7. Offline startup.** With the SW active and the network offline, reloading `/home`
      must render the shell. Audit `RootLayout.web.tsx` startup (`initializeResourceAppCheck`,
      `loadWebFonts`, `setI18n`, Sentry, Firebase) for awaits that hang or throw offline and
      make them resilient. Show a clear offline state in the workspace; online-only content
      must use the existing unavailable views, not the error boundary.
      **Evidence**: no code change needed. Startup awaits are offline-safe:
      `initializeAppCheck` is synchronous, fonts come from the precache, i18n is bundled, and
      NetInfo's `HEAD /` probes reach the network (the SW only routes GET) and report offline.
      The existing offline UI covers the workspace: `OfflineNotice` ("Vous êtes hors ligne")
      on `/home`, `resource.web.connectionRequired` / `app.youAreOffline` views elsewhere.
      Chrome offline cold start of `/home`: shell in 2.3 s (2.0 s online; a first offline load
      right after activation took 4.1 s, cold code cache), no console errors. Client-side
      navigation offline through 14 routes (`/bible-view`, `/search`, `/plans`, `/daily-verse`,
      `/lexique`, `/dictionnaire`, `/nave`, `/timeline`, `/commentaries`, `/studies`,
      `/highlights`, `/more`, `/downloads`, `/home`): 0 error boundary, 0 console error, offline
      message on content routes. The CDN-hosted dotlottie wasm simply fails offline (decorative
      animations, no error surfaced), so it is tolerated rather than self-hosted.
- [x] **8. Standalone polish.** Safe-area insets with `viewport-fit=cover` (check
      `react-native-safe-area-context` on web), no overscroll/pull-to-refresh in standalone,
      external links leave the app correctly, `navigator.storage.persist()` request. Check how
      `Login.web.tsx` signs in (popup vs redirect) and document/fix the standalone iOS behaviour.
      **Evidence**: `global.web.css` `@media (display-mode: standalone)` sets
      `overscroll-behavior: none` on html/body (in the exported CSS). `RootLayout.web` keeps
      every `theme-color` meta on the selected theme's `reverse` colour: Chrome check, dark
      `rgb(18,45,66)` then light `rgb(255,255,255)` after switching the colour scheme.
      `ServiceWorkerUpdates.web` calls `navigator.storage.persist()` only in standalone (no
      Firefox prompt in tabs). Safe areas: `react-native-safe-area-context` reads
      `env(safe-area-inset-*)` on web, and `BottomTabBar`, sheets and the assistant modal
      already pad with insets, so `viewport-fit=cover` feeds them real values (to confirm on
      the iOS Simulator in item 10). External links use `Linking`/`target=_blank`, out of scope
      URLs leave the app (to confirm in item 10). **Known limitation**: Google/Apple sign-in uses
      `signInWithPopup` (`FireAuth.web.ts`) with a `*.firebaseapp.com` auth domain; in an iOS
      home-screen app the popup opens in a separate browser sheet and may not hand the
      credential back. Email/password is unaffected. The fix (same-origin `/__/auth` proxy on
      `web.bible-strong.app`, `authDomain` switch, redirect flow in standalone, new OAuth
      redirect URIs in Google/Apple consoles) needs console access: documented in item 9, not
      done here.
- [x] **9. Gate, CI, docs.** `scripts/check-pwa.mjs` (manifest fields, icon files and sizes,
      `sw.js` present, precache entries count/bytes within budget and same-origin only,
      `index.html` links, `_headers` present). Add it to `.github/workflows/expo-web-production.yml`
      after `check-web-assets.mjs` (and to PR checks if they export web). ADR-0067 (installable
      PWA, app-shell SW, no editorial caching, Serwist, update prompt, kill switch). Update
      `docs/expo-web-deployment.md` (PWA section, kill-switch procedure) and
      `docs/agents/validation.md`.
      **Evidence**: `apps/expo/scripts/check-pwa.mjs` (manifest fields, any+maskable 192/512
      icons read from PNG headers, apple icon 180, `lang`/`viewport-fit`/manifest/theme-color/
      apple links in `index.html`, `_headers` rules, precache entries same-origin and present in
      `dist`, entry bundle and shell included, ≤ 30 MiB) → "48 files, 24.93 MiB", exit 0.
      Added to `.github/workflows/expo-web-production.yml` after the asset size check, so a
      broken PWA blocks the deploy. PR checks and PR previews never export web (PR previews are
      native EAS updates), so nothing to add there. ADR-0067 written; deployment doc gains a PWA
      section (files, local recipe on `localhost:9090`, kill-switch worker, iOS sign-in
      limitation); validation matrix gains an "Expo Web PWA" row. eslint/prettier OK on the
      script and new docs (`validation.md` was already not Prettier-formatted at HEAD).
- [x] **10. Final verification.** Fresh `web:build` (production env) on the local server:
      manifest without errors, installability, SW activated, offline reload, update flow across
      two builds, no SW in `expo start --web`. iOS Simulator Safari via argent: Add to Home
      Screen, standalone launch, safe areas. Full checks: typecheck, lint, test,
      `agents:styles:check`, `agents:architecture:check`. Write the final report.
      **Evidence**: see Final report.

## Baseline

Measured 2026-10-01 on `master` @ `992a95d14` (`web:export`, 53 s).

- **dist**: 38 MB, 194 files. `_expo/static`: 9 JS + 22 CSS (0.21 MB). `assets/`: 12 MB
  (5.1 MB `node_modules` icon fonts/images, 6.6 MB `src` images/fonts/json).
- **Largest files**: `entry-*.js` 24.04 MiB raw (5.38 MB gzip, 3.59 MB brotli; Cloudflare
  serves `br`), MaterialCommunityIcons.ttf 1.25 MB, `shaka-player-*.js` 0.93 MB (lazy),
  `audibible-reader.png` 0.68 MB, onboarding PNGs 0.30–0.45 MB, FontAwesome6_Solid.ttf
  0.40 MB, Ionicons.ttf 0.37 MB, MaterialIcons.ttf 0.34 MB, `passage-media.json` 0.32 MB,
  `eina-03-bold.otf` 0.32 MB.
- **Entry vs Cloudflare limit**: 24.04 MiB against the 25 MiB per-file limit
  (`check-web-assets.mjs`). Pre-existing risk, out of scope here, but the PWA work must not grow it.
- **First load of `/home`** (same-origin, 37 requests): 27.56 MB decoded, 7.09 MB transferred
  locally (gzip). The entry is 25.2 MB of it. Startup also loads `__common`, `__expo-metro-runtime`,
  one `index-*.js`, all CSS, the icon fonts MaterialCommunityIcons / Ionicons / MaterialIcons /
  Feather, the fonts `eina-03-bold`, `FiraCode-Regular`, `LiterataBook-Regular`,
  `audibible-icon.png` and `plans/bible-project-plan.txt`. i18n JSON is bundled, not fetched.
- **Cross-origin at startup**: reCAPTCHA Enterprise (google.com/gstatic), Firebase (webConfig,
  installations, Firestore Listen), GA4 (googletagmanager, google-analytics), Resource API
  (`api.bible-strong.app`), and **`cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web@0.44.0/dist/dotlottie-player.wasm`**
  (Lottie runtime fetched from a CDN, so it fails offline: item 7 should self-host it or
  tolerate its absence).
- **Other startup facts for later items**: the app sends `HEAD /` connectivity probes
  (NetInfo-style reachability; the SW must not answer them from cache, item 7), and
  `shaka-player-*.js` is actually fetched at startup, so it is not lazy in practice (item 4b).
- **Today in production**: no manifest (`/manifest.json` returns the SPA `index.html`), no
  service worker, `lang="en"`, `httpEquiv` typo. Every asset, hashed or not, is served with
  `Cache-Control: public, max-age=0, must-revalidate`.
- **Precache budget (revised by 4b)**: precache every `_expo/static` JS/CSS chunk (22.6 MB raw,
  3.7 MB brotli), `index.html`, the startup fonts, icons and manifest: about 25.5 MB decoded and
  5 MB transferred, fetched in the background after the first paint. Budget kept at ≤ 30 MB
  decoded / ≤ 6 MB transfer. Other `/assets/**` files stay runtime-cached.
- **Initial budget (superseded)**:
  the entry is the application and cannot shrink without code splitting, so the ≤ 15 MB target
  is not reachable as-is. Budget: **≤ 30 MB decoded
  and ≤ 6 MB compressed transfer**, limited to `index.html`, `_expo/static/**/*.{js,css}`
  except lazy heavyweight chunks (`shaka-player`), the startup fonts listed above, the PWA
  icons and the manifest. Other same-origin `/assets/**` files (hashed) are runtime-cached
  cache-first with an entry cap. Cross-origin requests are never cached.

### Local serving recipe

```bash
# from the repository root, after web:export / web:build
yarn workspace @bible-strong/resource-service exec wrangler dev \
  --config ../../apps/expo/wrangler.jsonc --port 9090 --ip localhost \
  --compatibility-date 2026-08-22
```

Open **`http://localhost:9090`** (not `127.0.0.1`): the Resource API CORS allowlist
(`RESOURCE_WEB_ORIGINS` in `packages/resource-service/wrangler.jsonc`) only accepts
`http://localhost:9090` locally, so any other origin gets CORS errors on every content
request. Do not run `yarn web` (same port) at the same time.

The local workerd binary (wrangler 4.124.0) supports dates up to 2026-08-22; the config's
`2026-09-16` makes it refuse to start, hence the CLI override (config file unchanged).
It honours the SPA fallback (`/home`, `/bible/LSG` give 200 `text/html`) and serves `br`.
Before starting it, check whether it is already up: `curl -sI http://localhost:9090/`.
`localhost`/`127.0.0.1` is a secure context, so service workers work there.

## Blockers

_(none)_

## Final report

Done on `feat/expo-pwa` (not pushed), verified 2026-10-02 on a fresh production `web:build`
served by `wrangler dev` on `localhost:9090`.

- **Build gate**: `web:build` → `sw: precached 48 files, 24.93 MiB`; `check-web-assets` largest
  17.99 MiB (was 24.04); `check-pwa` valid.
- **Chrome 154** (chrome-devtools): `beforeinstallprompt` fires (`platforms: ["web"]`) in a
  normal profile (isolated/incognito contexts never fire it); worker activated and controlling;
  offline cold start renders the shell with the offline notice; update banner → reload → new
  worker (item 6); `yarn web` (development, same origin) unregisters the production worker and
  registers none.
- **iOS 26.5 Simulator** (iPhone 17 Pro, argent): Safari share sheet shows the 180 px icon and
  "Bible Strong"; "Sur l'écran d'accueil" offers "Ouvrir comme app web" (manifest recognised);
  the home-screen icon launches standalone (no Safari UI), content below the status bar, bottom
  floating button clear of the home indicator; an out-of-scope link opens Safari's in-app view
  with "Fermer" / "Ouvrir dans Safari". Status bar: stays light at launch with
  `status-bar-style: default` and only follows `theme-color` after an app switch (iOS quirk,
  documented; `black-translucent` would be unreadable on light themes).
- **Checks**: `yarn typecheck` 0; `format:check` 0; `agents:styles:check` 0;
  `agents:architecture:check` 0; `agents:quality:check` 0; site/api-functions/world lint 0;
  resource-domain, resource-catalog, site, resource-service, world tests 0. Expo Jest: 2925 pass,
  the same 4 env-dependent failures as on `master` (`mobileResourceCatalog-test`,
  `strongBibleDownloadPlan-test`). Expo `eslint .`: never finished locally because it lints the
  git-ignored `apps/expo/.scratch/` minified bundles; with `--ignore-pattern '.scratch/**'` it
  reports 183 errors, none in files changed on this branch (all touched files lint clean).
- **Known limitations** (documented in ADR-0067 and `docs/expo-web-deployment.md`): Google/Apple
  sign-in popup in an iOS home-screen app; iOS launch status-bar colour; the dotlottie wasm comes
  from a CDN and is unavailable offline (decorative).
- **Pre-existing issues found**: `/local-search` and `/bible-compare-verses` crash when opened
  without params (separate task suggested); sonner-native 0.22 toast actions are swallowed on web
  and `duration: Infinity` dismisses on first gesture.
