# ADR-0107: Ship a desktop app that installs encrypted Offline copies

## Status

Accepted.

## Context

The study workspace runs on iOS, Android and the Web. Readers asked for a computer version that
keeps working without a network. The Web gets no Offline copies (ADR-0063, ADR-0065), and
nothing runs the mobile app on Windows since Microsoft retired its Android subsystem. Apple
Silicon Macs can run the iPad app, but with its touch interface: no keyboard shortcuts, no
hover, a generic menu bar.

Expo Desktop (`react-native-macos` and `react-native-windows` under Expo) was considered and
rejected. It trails the app by five React Native versions, its Windows modules are stubs, and
the libraries the app depends on (`expo-sqlite`, `expo-file-system`, Expo Router, Reanimated,
MMKV, Firebase) have no Windows implementation.

The web workspace is already designed for a mouse and a keyboard. The whole Offline-copy
pipeline (queue, installation journal, atomic swap, registry, local readers) talks to the device
through five native packages, each used through a small surface: `expo-file-system/legacy`,
`expo-sqlite`, `rn-fetch-blob`, `react-native-zip-archive` and the `bible-strong-archive` module.

## Decision

`apps/desktop` is a Tauri 2 app for macOS, Windows and Linux that shows the Expo web export,
built with the desktop flags, and gives it the device the Offline-copy pipeline expects.

- **One pipeline.** In the desktop build only, Metro substitutes the five native packages with
  shims over the shell's Rust commands (`apps/expo/desktopResolution.cjs`). A
  `<name>.desktop.<ext>` file replaces its sibling, and a short list of `.web` files that only
  remove Offline copies give way to the shared file. The mobile code runs unchanged; the public
  web bundle contains no desktop code. `EXPO_PUBLIC_DESKTOP` tells the shared code it runs on
  desktop (`~desktop/isDesktop`).
- **Encrypted copies only.** The desktop app downloads the public encrypted archives of
  ADR-0065. The shell derives each password and extracts the archive in Rust; the master key is
  compiled into the binary from `BIBLE_STRONG_ARCHIVE_KEYS`, masked as on mobile, and never
  reaches JavaScript. It attests nothing: plain archives stay behind native App Check, and the
  assistant takes App Check as optional.
- **Synchronous state from the shell.** The mobile code reads its directories and its key-value
  store synchronously, some of it as modules load. The page loads a blocking `bootstrap.js` from
  the shell's `bsboot` protocol before the bundle, on every load, with those values and a
  snapshot of the key-value store. The store itself is a SQLite file in the app's data
  directory: writes go there in order and in batches, and the shell asks for a last flush before
  quitting. It has no size cap, unlike `localStorage`.
- **SQLite and files in Rust.** `rusqlite` with FTS5 serves one connection per open and one per
  exclusive transaction, as `useNewConnection` asks. Downloads stream to disk with progress; a
  response outside 2xx resolves with its status, and a cancelled one resolves to nothing, as
  `expo-file-system` does. Error messages carry the words `resourceDeviceCondition.ts` and
  `sqliteErrors.ts` recognise.
- **Sign-in through the browser.** Google refuses OAuth inside an embedded webview. For Google
  and Apple the app opens `web.bible-strong.app/desktop-sign-in/` in the reader's browser with
  the port of a one-time listener on 127.0.0.1 and a random state (RFC 8252). The page signs in
  with a Firebase instance kept in memory, and `createDesktopSignInToken` exchanges a sign-in
  younger than five minutes for a custom token, which the browser hands back to the listener.
  Email and password stay in the app.
- **Origins.** The window's origin is `tauri://localhost` on macOS and Linux and
  `https://tauri.localhost` on Windows, for good: changing it would lose the webview's data. The
  Resource API and the assistant allow both.
- **Shell.** A native menu runs the workspace's shortcuts through the listeners of `keymap.ts`;
  a single instance takes the `biblestrong://` links; the window remembers its frame.
- **Distribution.** Installers (DMG, NSIS, AppImage, `.deb`) update themselves through the
  signed Tauri updater from the repository's GitHub Releases. The Mac App Store build turns the
  updater off, runs sandboxed and joins the iOS app's App Store Connect record, so Apple Silicon
  Macs get the desktop app instead of the iPad one. GitHub Actions builds the three systems.

## Consequences

A fix to the Offline-copy pipeline reaches the desktop app without desktop work, and a change to
the surface of one of the five packages needs its shim updated. A new `.web` file that only hides
Offline copies must join `SHARED_ON_DESKTOP`, or the desktop app loses that feature.

The desktop app has no OTA: a JavaScript change ships with a new version through the updater or
the Mac App Store. Its key versions are fixed at build time, like the mobile binaries'.

Entity portraits keep the browser's behaviour on desktop: the webview's cache stands in for the
portrait pack (ADR-0089).

`createDesktopSignInToken` needs the permission to sign custom tokens for its service account.
A Windows installer without a code signature shows a SmartScreen warning until it earns a
reputation; the Microsoft Store signs its own package.
