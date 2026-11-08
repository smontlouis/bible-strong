# Desktop release

How the desktop app (`apps/desktop`, ADR-0107) is built, signed and delivered. The version is
`apps/desktop/package.json`; raise it before a release.

## Channels

| System | Package | Updates |
| --- | --- | --- |
| macOS | Notarized DMG (universal: Apple Silicon and Intel) | Signed Tauri updater |
| macOS | Mac App Store, in the iOS app's App Store Connect record | The store |
| Windows | NSIS installer for the current user | Signed Tauri updater |
| Linux | AppImage and `.deb` | Updater (AppImage), the package manager (`.deb`) |

The updater reads `https://github.com/smontlouis/bible-strong/releases/download/desktop-latest/latest.json`,
a fixed release that only `Desktop promote` writes, so the repository's other releases never
redirect it. The manifest and every installer are signed with the updater key; its public half is
`plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

## Secrets (GitHub environment `desktop-release`)

| Secret | Content |
| --- | --- |
| `BIBLE_STRONG_ARCHIVE_KEYS` | The Offline-copy keys, as in `apps/expo/.env.local`. Without them the app installs nothing, and the workflow refuses to build. |
| `TAURI_SIGNING_PRIVATE_KEY` | The content of `~/.tauri/bible-strong-updater.key` (generated 2026-11-08, never in the repository). |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Empty: the key has no password. |
| `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD` | The Developer ID Application certificate as a base64 `.p12`, and its password. |
| `APPLE_SIGNING_IDENTITY` | Its name, `Developer ID Application: … (TEAM)`. |
| `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_CONTENT` | An App Store Connect API key for notarization: issuer id, key id, and the `.p8` content. |

Losing the updater key means installed apps can no longer update themselves: keep a copy in the
password manager.

## Release

1. Raise `version` in `apps/desktop/package.json`, merge to `master`.
2. Run **Desktop release** (Actions, on `master`). It exports the web app with the desktop flags,
   builds the three systems, signs and notarizes macOS, and fills the draft release
   `desktop-v<version>` with the installers, their signatures and `latest.json`.
3. Install from the draft on each system and test: sign in, read online, install a Bible and a
   dictionary, read them with the network off, quit and reopen.
4. Run **Desktop promote** with the version. It publishes the release and copies its
   `latest.json` to `desktop-latest`; installed apps offer the update at their next launch.

## Local builds

`yarn workspace @bible-strong/desktop build` builds the installers of the current system on that
machine, with the archive keys of `apps/expo/.env.local` and the updater key of
`~/.tauri/bible-strong-updater.key`. On macOS it skips the DMG window layout, which drives Finder
and needs an automation permission (`CI=true`); the DMG is otherwise the same. Without a Developer
ID certificate in the keychain the app is signed ad hoc: fine to test, not to distribute.

## Mac App Store

The App Store build runs sandboxed (`Entitlements.appstore.plist`), without the updater
(`--no-default-features`), under the bundle identifier of the iOS app, so that it joins its App
Store Connect record and replaces the iPad app on Apple Silicon Macs.

1. In App Store Connect, add the macOS platform to the Bible Strong app.
2. Create a Mac App Store provisioning profile for `com.smontlouis.biblestrong` and save it as
   `apps/desktop/src-tauri/embedded.provisionprofile` (git-ignored).
3. On the Mac: `yarn workspace @bible-strong/desktop build:appstore`, with the Apple Distribution
   certificate in the keychain (`APPLE_SIGNING_IDENTITY="Apple Distribution: …"`).
4. Package it with `xcrun productbuild --sign "3rd Party Mac Developer Installer: …" --component <app> /Applications Bible-Strong.pkg`
   and upload the `.pkg` with Transporter.

## Windows

The installer is not code-signed yet: Windows SmartScreen warns on the first runs until the app
earns a reputation. A Microsoft Store listing needs an MSIX package, which the Store signs; it is
not built yet.

## Services the desktop app needs

Set up on 2026-11-08. A new service the app reads across origins needs the same.

- The desktop origins, `tauri://localhost` and `https://tauri.localhost`, in the CORS allowlists of
  the Resource API (`RESOURCE_WEB_ORIGINS`, then `yarn resources:worker:deploy`), the assistant
  Worker (`AI_WEB_ORIGINS`, in its own repository) and the media bucket `bible-strong-media-prod`
  (`wrangler r2 bucket cors set`), which serves the catalogs of the portraits and of the timeline
  paintings. Without the last one the app shows neither.
- `createDesktopSignInToken` deployed (`npx firebase-tools deploy --only functions:createDesktopSignInToken`,
  Node.js 22). Its runtime service account, the Compute Engine default one, holds **Service Account
  Token Creator** on itself, and the project has the IAM Service Account Credentials API enabled:
  custom tokens need both.
- The web workspace (automatic from `master`) serves the sign-in page at
  `https://web.bible-strong.app/desktop-sign-in/`.
- The Firebase browser API key has no referrer restriction, so it accepts the desktop origins.
