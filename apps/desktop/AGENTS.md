# Desktop app (`@bible-strong/desktop`)

Bible Strong for macOS, Windows and Linux: a Tauri 2 shell (`src-tauri/`, Rust) that shows the Expo web export built for desktop (`apps/expo/dist-desktop`) and stands in for the native modules of the Offline-copy pipeline. Read `CONTEXT.md` and ADR-0107 first.

## Where things live

| What | Where |
| --- | --- |
| Rust commands: files, downloads, archives, SQLite, key-value store, browser sign-in, menu | `src-tauri/src/` |
| Archive keys compiled into the binary | `src-tauri/build.rs` (from `BIBLE_STRONG_ARCHIVE_KEYS`) |
| Shims of `expo-file-system/legacy`, `expo-sqlite`, `rn-fetch-blob`, `react-native-zip-archive` | `apps/expo/src/desktop/shims/` |
| Desktop module resolution, and the `.web` files the desktop takes the shared file for | `apps/expo/desktopResolution.cjs` |
| Desktop variants of app files | `apps/expo/**/<name>.desktop.ts(x)` |
| `isDesktop`, `supportsOfflineCopies`, `IS_BROWSER` | `apps/expo/src/desktop/isDesktop.ts` |
| Browser sign-in page | `apps/expo/public/desktop-sign-in/`; its token: `apps/api/functions/src/desktop-sign-in.ts` |
| Release workflow | `.github/workflows/desktop-release.yml`; how to release: `docs/desktop-release.md` |

## Commands

| Task | Command |
| --- | --- |
| Desktop web dev server, port 9090 (the port the APIs allow) | `yarn web:dev` (root: `yarn dev:desktop:web`) |
| Run the app against it | `yarn dev` (root: `yarn dev:desktop`) |
| Export the web app for desktop | `yarn web` |
| Build the installers of the current OS | `yarn build` |
| Release: build in CI and publish to the readers (`--draft` stops at the draft, `--publish` publishes it) | root: `yarn desktop:release` |
| Build the Mac App Store app | `yarn build:appstore` |
| Rust tests | `yarn test` |
| Archives the Rust tests decrypt | `yarn fixtures` |
| Icons and installer images, from the app icon and the Icon Composer file (macOS) | `yarn icons` |

`yarn dev` and `yarn build` read `BIBLE_STRONG_ARCHIVE_KEYS` from the environment or from `apps/expo/.env.local`; never print it. A build without keys cannot install any Offline copy, and `yarn build` refuses it unless `--allow-missing-keys`.

## Rules

- The mobile pipeline is the one that runs. Fix a bug of Offline copies in the shared code, not in a desktop copy of it; change a shim only when the package contract it mirrors changes.
- A new `.web` file that only hides Offline copies needs its base path in `SHARED_ON_DESKTOP`, and a new `Platform.OS === 'web'` gate on Offline copies uses `supportsOfflineCopies` instead.
- Desktop-only code (`@tauri-apps/*`, `~desktop/bridge`) is imported from `.desktop` files or `src/desktop/` only, so the public web bundle never carries it. `desktopResolution-test.ts` checks the resolution rules.
- Rust error messages keep the words `resourceDeviceCondition.ts` and `sqliteErrors.ts` match (`timed out`, `could not connect to the server`, `No space left`, `SQLITE_CORRUPT`, `already released`).
- Keep `derive_password` in `archive.rs` pinned to the same test vector as `ArchivePassword.swift` and `encryptedOfflineArchive.ts`.
- The window's origin (`tauri://localhost`, `https://tauri.localhost` on Windows) is permanent: changing it loses the webview's stored data.
- On macOS the window has no title bar: its buttons sit over the sidebar's header (`create_main_window` in `lib.rs`, `WINDOW_CONTROLS_INSET` and `WINDOW_CONTROLS_STRIP_HEIGHT` in `src/desktop/windowControls.ts`; move them together), and the workspace's page headers drag the window. A new page header passes `dataSet={windowDragRegion(useWorkspaceHeaderInset())}` from `~features/app-switcher/windowChrome`. The window is never narrower than 800 points, so the narrow layout, which leaves no room for the buttons, never shows.
- On macOS the window is also transparent over the system's sidebar material: the shell marks the page `data-window-material` before the bundle runs, `windowMaterial.css` clears the page's grounds, and the workspace's shell lays the theme's canvas over the material at 40% in a light theme and 65% in a dark one (`useWindowMaterialTint` in `windowChrome.desktop.ts`). The main panel and the overlay sidebar stay opaque; a new full-window surface outside the main panel needs a ground of its own.
- The Bible menu's items carry no native key equivalent: their shortcuts are bare keys (arrows, letters), which a native menu would take from every text field.

## Testing

- macOS has no DevTools protocol for the webview and this Mac grants agents no screen capture. Read the app's console in the Metro log of `yarn web:dev`; inspect `~/Library/Application Support/com.smontlouis.biblestrong.dev/` (the dev build's data: `desktop-kv.sqlite`, `SQLite/`, `fr/`, `en/`).
- To look at the page, a development build answers `invoke('dev_snapshot', { name })` with a PNG in `~/Library/Caches/com.smontlouis.biblestrong.dev/dev-snapshots/` (WKWebView's own snapshot; release builds refuse it, nothing listens on the network). Drive a check with a temporary component mounted in `FullAppRuntime.desktop.tsx` that steps through routes, `__BIBLE_STRONG_AGENT__` tools and `desktop://menu` events and takes a snapshot at each; remove it before committing. A bundled build has no Metro: such a component leaves its results in the key-value store, read with `sqlite3`.
- `tauri dev` restarts the app when a file under `src-tauri/` changes, and Fast Refresh may reload the page: don't edit while a download scenario runs.
- Windows: WebView2 exposes the DevTools protocol with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`, which argent on the PC can drive.
- Static checks: the Expo app's `typecheck`, `lint` and Jest suite, `yarn test` here, and `yarn workspace @bible-strong/expo web:export` to prove the public bundle carries no desktop code.
