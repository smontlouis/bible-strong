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
- [ ] **3. Icons.** Reproducible script generating `public/icons/` from the app icon: 192 and
      512 (`any`), 512 maskable (80 % safe zone, opaque background), 180 apple-touch-icon
      (opaque), favicon. Inspect the source icon (transparency, rounded corners) first.
- [ ] **4. Manifest + headers.** `public/manifest.webmanifest` (id, name, short_name,
      description, start_url `/home`, scope `/`, display `standalone`, theme/background colors,
      icons, lang `en`, categories). `public/_headers`: no-cache for `/sw.js` and HTML
      navigations, immutable for `/_expo/static/*`, manifest content type. Verify with `curl -I`
      on the local server, including the SPA fallback path `/home`.
- [ ] **4b. Split the web bundle.** Analyse first: export with `EXPO_ATLAS=true` (Expo Atlas)
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
- [ ] **5. Service worker.** Worker source + its own tsconfig (WebWorker lib), outside the app
      typecheck if needed. `scripts/build-web-sw.mjs`: esbuild bundle, then `injectManifest`
      over `dist` (hashed `_expo/static` assets not cache-busted, startup fonts, icons, manifest,
      `index.html` for the navigation fallback), within the precache budget. Navigations:
      network-first with timeout, fallback to the precached `index.html`. No runtime caching
      of cross-origin requests (Resource API, Firebase, auth, analytics). Outdated precaches
      cleaned up. No `skipWaiting` on install (the update prompt drives it). Hook the script
      into `web:export` and `web:build`.
- [ ] **6. Registration + update prompt.** Register only in production web builds with
      `@serwist/window`. When a new worker is waiting, show a non-blocking prompt
      ("A new version is available" / reload, fr + en via i18n extraction); reload once the new
      worker controls the page. Check for updates on focus/visibility and periodically. Unit
      test any extracted state logic.
- [ ] **7. Offline startup.** With the SW active and the network offline, reloading `/home`
      must render the shell. Audit `RootLayout.web.tsx` startup (`initializeResourceAppCheck`,
      `loadWebFonts`, `setI18n`, Sentry, Firebase) for awaits that hang or throw offline and
      make them resilient. Show a clear offline state in the workspace; online-only content
      must use the existing unavailable views, not the error boundary.
- [ ] **8. Standalone polish.** Safe-area insets with `viewport-fit=cover` (check
      `react-native-safe-area-context` on web), no overscroll/pull-to-refresh in standalone,
      external links leave the app correctly, `navigator.storage.persist()` request. Check how
      `Login.web.tsx` signs in (popup vs redirect) and document/fix the standalone iOS behaviour.
- [ ] **9. Gate, CI, docs.** `scripts/check-pwa.mjs` (manifest fields, icon files and sizes,
      `sw.js` present, precache entries count/bytes within budget and same-origin only,
      `index.html` links, `_headers` present). Add it to `.github/workflows/expo-web-production.yml`
      after `check-web-assets.mjs` (and to PR checks if they export web). ADR-0067 (installable
      PWA, app-shell SW, no editorial caching, Serwist, update prompt, kill switch). Update
      `docs/expo-web-deployment.md` (PWA section, kill-switch procedure) and
      `docs/agents/validation.md`.
- [ ] **10. Final verification.** Fresh `web:build` (production env) on the local server:
      manifest without errors, installability, SW activated, offline reload, update flow across
      two builds, no SW in `expo start --web`. iOS Simulator Safari via argent: Add to Home
      Screen, standalone launch, safe areas. Full checks: typecheck, lint, test,
      `agents:styles:check`, `agents:architecture:check`. Write the final report.

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
- **Precache budget** (provisional, to be revised by item 4b now that splitting is allowed):
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

_(filled by item 10)_
