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

- [ ] **1. Baseline.** Run `web:export`; record dist total size, file count, the 10 largest
      files and the JS/CSS/font weight needed for the first paint of `/home`. Find and record a
      working local serving recipe that honours `wrangler.jsonc` (SPA fallback, `_headers`), e.g.
      `wrangler dev` from `packages/resource-service`. Confirm no manifest / SW today. Set the
      precache budget from the numbers (target ≤ 15 MB, justify otherwise).
- [ ] **2. HTML template.** `npx expo customize public/index.html` (single output), keep Expo's
      reset styles, then: `lang="en"`, fix `http-equiv`, viewport with `viewport-fit=cover`,
      `theme-color` for light and dark (from the default theme palettes), `description`,
      `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`,
      `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`, manifest link. Verify the
      exported `dist/index.html`.
- [ ] **3. Icons.** Reproducible script generating `public/icons/` from the app icon: 192 and
      512 (`any`), 512 maskable (80 % safe zone, opaque background), 180 apple-touch-icon
      (opaque), favicon. Inspect the source icon (transparency, rounded corners) first.
- [ ] **4. Manifest + headers.** `public/manifest.webmanifest` (id, name, short_name,
      description, start_url `/home`, scope `/`, display `standalone`, theme/background colors,
      icons, lang `en`, categories). `public/_headers`: no-cache for `/sw.js` and HTML
      navigations, immutable for `/_expo/static/*`, manifest content type. Verify with `curl -I`
      on the local server, including the SPA fallback path `/home`.
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

_(filled by item 1)_

## Blockers

_(none)_

## Final report

_(filled by item 10)_
