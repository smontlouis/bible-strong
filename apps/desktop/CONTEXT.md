# Desktop shell context

## Glossary

**Desktop app** — The study workspace on macOS, Windows and Linux: the web interface, built for desktop, with Offline copies.

**Desktop shell** — The Tauri program that shows the desktop app in a window and stands in for the native modules the Offline-copy pipeline uses.

**Bootstrap state** — What the shell serves before the bundle runs, on every page load: the app's directories, the archive key versions compiled into the binary, and a snapshot of the key-value store.

**Desktop key-value store** — The desktop counterpart of MMKV: a SQLite file in the app's data directory, read through the bootstrap snapshot and written in order by the page.

**Desktop shim** — A module that keeps the contract of a native package (`expo-sqlite`, `expo-file-system`…) over the shell's commands, substituted for that package in the desktop build only.

**Browser sign-in** — Google or Apple sign-in for the desktop app, done in the reader's own browser and handed back to the shell on 127.0.0.1 with a one-time custom token.

**Installer build** — A desktop build that updates itself with the signed updater; the **Mac App Store build** is sandboxed and updated by the store instead.

## Avoid

- Use **Desktop app**, not “Electron app” or “Mac app”: it runs on three systems through Tauri.
- Use **Offline copy**, as in the Study workspace, for what the desktop app installs.

Decisions and their reasons live in `../../docs/adr/0107-ship-a-desktop-app-that-installs-encrypted-offline-copies.md`.
