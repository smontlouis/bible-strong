# Self-hosted OTA: what was verified, and what remains

Started on 14 October 2026 with the move from EAS Update to our Open OTA server, completed on
18 October 2026. The decision is [ADR-0085](../adr/0085-serve-app-updates-from-our-own-server-on-cloudflare.md);
the change is pull request smontlouis/bible-strong#442.

## State

- The server is deployed: `https://updates.bible-strong.app/manifest`, dashboard
  `https://ota.bible-strong.app` (Cloudflare Access, the owner's email only). In the Cloudflare
  dashboard its Workers are named `openota-updates-production-…` and `openota-dashboard-production-…`.
- The fork is `smontlouis/open-ota`, cloned at `~/Projects/bible-strong/open-ota`. It deploys with
  `nvm use 24 && corepack pnpm cloud:deploy:prod --yes`, logged in to Cloudflare with an API token
  (`pnpm cloud:login`, "API Token"). Plan first with `pnpm cloud:plan --stage production`: without
  the stage, the plan compares against an empty stage.
- Download counts are on. A Worker secret that Alchemy no longer sets stays on the Worker: removing
  `OTA_DELIVERY_STATS=off` from `.env` did not remove it, it had to be deleted in the dashboard.
- The `staging` branch holds the test updates of 18 October, then a rollback to the embedded
  JavaScript for both platforms. Nothing was published to `production`.
- The CI secret `OTA_PUBLISH_TOKEN` is set on the repository. The local token is in
  `apps/expo/.env.local`.
- The signing key (`~/Projects/bible-strong/open-ota/.keys/private-key.pem`, also the Worker's
  secret) is backed up in the password manager since 18 October 2026.

## Verified on 18 October 2026

With a staging Release build on the iOS simulator (`expo run:ios --configuration Release`) and a
staging release APK on the Android emulator (`gradlew assembleRelease`):

- The native configuration holds `https://updates.bible-strong.app/manifest`, the certificate with
  keyid `main`, the `staging` channel header and `NEVER`.
- Every served manifest verifies against `apps/expo/certs/certificate.pem`.
- Settings, then "check for updates", then a relaunch runs the new update. The Bible reader renders
  after an update, with its fonts and icons.
- Rollback to the previous update (the dashboard's call) and rollback to the embedded JavaScript
  (`yarn update:rollback-to-embedded:staging`) both bring the application back.
- The check at launch downloads a new update, then a rollback, without any tap.

Then, with a staging simulator build made by EAS (`yarn build:ios:staging-sim`) and the same APK:

- The EAS build holds the same native configuration and the `com.smontlouis.biblestrong.staging`
  identity.
- A device that runs the previous update receives the next one as a patch: the Android log says
  "Applied diff", and the delivery numbers count one patch of 1.3 to 2.0 MB per update, on both
  platforms, against 8.3 MB for the full bundle.
- A broken update (an error thrown at render) lands on the error screen. Once a rollback to the
  embedded JavaScript is published, the next launch of the broken update fetches it from the error
  screen ("Mise à jour effectuée"), and the launch after that runs the build's JavaScript again.

Found and fixed on the way:

- `.easignore` dropped the certificate, so `eas build --local` failed at prebuild.
- A rollback to the embedded JavaScript never reached the application: the settings, the error
  screen and the launch check only looked at `isAvailable`.
- On Android the reader lost its icon font after an update. `EX_UPDATES_COPY_EMBEDDED_ASSETS=true`
  is now set through `apps/expo/plugins/gradleProperties.js`.
- Delta patches never got stored ("0 uploaded, 2 skipped, 10 failed" at each publish): the server
  refused every upload with `400 "The patch engine is not loaded."`. The Worker loaded bsdiff only
  when `globalThis.__ALCHEMY_RUNTIME__` was set, and the bundler folds that flag to `true` only when
  it is written exactly so; `apps/updates/src/worker.ts` wrapped `globalThis` in a cast. Loading the
  engine would not have been enough: rebuilding a 20.7 MB bundle grows its memory to 91 MB, and
  with the base and the result held in JavaScript the Worker would pass its 128 MB. The fork
  (commit `d9e638f`, deployed on 18 October) now checks only the patch's header: BSDIFF40, bzip2
  blocks, the size of the target bundle. The CLI still rebuilds each patch before uploading it, and
  the device checks the rebuilt bundle's hash and downloads the full bundle when it does not match.
  `open-ota patches --branch staging` then stored 10 patches, 0.5 to 2.3 MB against 7.9 MB for the
  full download (6% to 28%). A bundle fetched like a device does (`A-IM: bsdiff`,
  `Expo-Current-Update-ID`) came back as `226` on both platforms, and the system `bspatch` rebuilt
  the exact target bundle from it. Upstream (`focux/open-ota`) has the same bug.
- The EAS "preview" environment, which the staging profile uses, shared `APP_NAME`,
  `BUNDLE_IDENTIFIER`, `EAS_BUILD_CHANNEL` and the Firebase file paths with "production". eas-cli
  lets EAS values win over `.env.staging` when it reads the app config, so it named the Xcode scheme
  `BibleStrong` while the build made `stagingBibleStrong`. Those five variables now belong to
  "production" only, like "development", which has none: `.env.staging` decides for staging.

## Known warning: "Uploaded 7 of 12 bundles and sourcemaps"

Each publish ends with this Sentry warning; nothing is lost. `sentry-expo-upload-sourcemaps dist`
pairs a bundle with its map by file name (`x.js` with `x.js.map`). The two native bundles keep
matching names, so both go up with their maps. The Bible reader's five DOM scripts and their five
maps, in `dist/www.bundle`, are renamed after the MD5 of their own content at export, which the
reader needs to find its pages; a script and its map no longer share a name. The upload then skips
the five scripts ("Sourcemap … not found") and sends the five maps alone: 2 + 5 = 7 of 12. Each map
carries the same debug ID as its script, which is what Sentry matches a stack trace against. The
reader's WebView does not report errors to Sentry today anyway; if it ever does, pair the files by
debug ID before uploading.

## Still open

1. **The error screen keeps its spinner** next to "Mise à jour effectuée. Merci de redémarrer
   l'application." once the update is ready (`apps/expo/src/common/ErrorBoundary.tsx`).
2. **The production publish workflow** (`.github/workflows/expo-update-production.yml`, by hand
   only) has never run against Open OTA.
3. **A physical device** has not run a 28.0 build yet: worth one look at the first store build.
4. **The npm CLI declares loose versions.** `open-ota@0.3.0` needs a root `resolutions` pin of
   `@effect/platform-node-shared` and a `redis` package extension in `.yarnrc.yml`. Report upstream;
   drop both once a fixed release exists.
5. **The Open OTA stack runs on beta software**: Alchemy 2.0.0-beta.76 (beta.83 exists) and Effect 4
   release candidates. Upgrade the fork deliberately, with a production plan before any deploy.

## After 28.0 is in the stores

- Builds of runtime 27.x keep asking EAS; nothing more is published there. Downgrade the EAS plan to
  the free tier once the 28.0 adoption makes it safe. No workflow needs `EXPO_TOKEN` any more.
