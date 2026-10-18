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
  the exact target bundle from it.

## Still open

1. **The EAS "preview" environment holds production values** (`APP_NAME`, `BUNDLE_IDENTIFIER`,
   `EAS_BUILD_CHANNEL=production`, the production Firebase files). The staging profile resolves to
   it, so `yarn build:ios:staging-sim` fails: eas-cli names the Xcode scheme `BibleStrong` from the
   EAS value while the prebuild, run with `.env.staging`, makes `stagingBibleStrong`. Align that
   environment on `.env.staging` or delete those variables from it, then build staging once with
   EAS and check that the channel header says `staging`.
2. **No device has received a delta patch yet.** Publish a staging update, check for updates on a
   device that runs the previous one, and look for the `226` in the dashboard's delivery numbers
   or the device log. The fix is commit `d9e638f` on `smontlouis/open-ota`; upstream
   (`focux/open-ota`) has the same bug.
3. **Sentry receives 7 of 12 source maps** at each publish. Check which files are skipped.
4. **The first 28.0 builds made with EAS** should be checked once on a device: an update loads, and
   `EXUpdatesURL` and the channel header are as above. The tests ran on local builds.
5. **The npm CLI declares loose versions.** `open-ota@0.3.0` needs a root `resolutions` pin of
   `@effect/platform-node-shared` and a `redis` package extension in `.yarnrc.yml`. Report upstream;
   drop both once a fixed release exists.
6. **The Open OTA stack runs on beta software**: Alchemy 2.0.0-beta.76 (beta.83 exists) and Effect 4
   release candidates. Upgrade the fork deliberately, with a production plan before any deploy.

## After 28.0 is in the stores

- Builds of runtime 27.x keep asking EAS; nothing more is published there. Downgrade the EAS plan to
  the free tier once the 28.0 adoption makes it safe. No workflow needs `EXPO_TOKEN` any more.
