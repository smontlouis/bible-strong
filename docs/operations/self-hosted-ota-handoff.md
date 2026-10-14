# Self-hosted OTA: what differs from the plan, to handle later

Written on 14 October 2026, at the end of the session that moved updates from EAS Update to our Open
OTA server. The decision is [ADR-0085](../adr/0085-serve-app-updates-from-our-own-server-on-cloudflare.md);
the change is pull request smontlouis/bible-strong#442. This page lists only what remains open.

## State at hand-off

- The server is deployed: `https://updates.bible-strong.app/manifest`, dashboard
  `https://ota.bible-strong.app` (Cloudflare Access, the owner's email only).
- The fork is `smontlouis/open-ota`, cloned at `~/Projects/bible-strong/open-ota`. It deploys with
  `nvm use 24 && corepack pnpm cloud:deploy:prod --yes`.
- One test update was published to the `staging` branch (group `fb8b77e3-0664-4984-aab6-98e56767fc5f`).
  No build points at the server yet, so it reached nobody.
- The CI secret `OTA_PUBLISH_TOKEN` is set on the repository. The local token is in
  `apps/expo/.env.local`.

## To do before 28.0 ships

1. **Back up the signing key.** `~/Projects/bible-strong/open-ota/.keys/private-key.pem` only exists
   on this machine and in the Worker's secret. Losing it means a new build for every reader. Put it
   in the password manager.
2. **Test on devices with a 28.0 staging build** (iOS and Android):
   - Settings → check for updates → the update downloads and loads after a relaunch.
   - The Bible reader (Expo DOM) renders after the update. Inspect the WebView (Safari, or Chrome
     `chrome://inspect`) for 404s on `.js`, `.css` and fonts.
   - Rollback from the dashboard: to the previous update, then to the embedded JavaScript.
   - In the built native config, `EXUpdatesURL` (iOS) / the Android manifest show
     `https://updates.bible-strong.app/manifest` and the `expo-channel-name` header. It is not verified
     that `eas build --local` leaves both alone when the address is not EAS's.
3. **Android fonts, icons and avatars in the reader after an update.** Read in the `expo-updates` code,
   not observed: those files are also embedded in the APK, and Android does not copy them into the
   updates folder (`EX_UPDATES_COPY_EMBEDDED_ASSETS` defaults to false), so the reader's relative URLs
   may 404 after an update. The same would happen with EAS. If confirmed, set
   `EX_UPDATES_COPY_EMBEDDED_ASSETS=true` (native, needs a build) and test again.

## Differences from the plan

- **No download counts in the dashboard.** Open OTA mints an Analytics Engine token at deploy time;
  Alchemy's OAuth login cannot create API tokens, so the deploy runs with `OTA_DELIVERY_STATS=off`
  (in the fork's `.env`). Adoption, devices, failures and rollbacks still work. To get the counts:
  log Alchemy in with a Cloudflare API token allowed to create tokens, remove the line, redeploy.
- **The Alchemy login was patched by hand.** Its default OAuth scopes lack Access and DNS, which the
  dashboard and custom domains need. `access:read`, `access:write`, `dns_records:read`,
  `dns_records:edit` and `workers:read` were added to `DEFAULT_SCOPES` in both copies of
  `node_modules/.pnpm/alchemy@2.0.0-beta.76*/node_modules/alchemy/lib/Cloudflare/Auth/AuthProvider.js`
  in the fork. Any `pnpm install` loses it. The OAuth token refreshes on its own, so this only matters
  for a new login. Durable fix: commit a `pnpm patch` in the fork, or log in with an API token.
- **The npm CLI declares loose versions.** `open-ota@0.3.0` needs, in this monorepo, a root
  `resolutions` pin of `@effect/platform-node-shared` to `4.0.0-rc.112` and a `redis` package extension
  in `.yarnrc.yml`. Worth reporting upstream; drop both once a fixed release exists.
- **`updates.url` ends with `/manifest`.** `open-ota doctor` requires it; the plan had the bare host.
- **PR previews still publish to EAS Update.** `.github/workflows/pr-preview.yml` is untouched. Not
  verified: whether a development build that now checks signatures can still open an unsigned EAS
  preview. Either move previews to an Open OTA branch or drop the workflow.
- **The Open OTA stack runs on beta software**: Alchemy 2.0.0-beta.76 and Effect 4 release
  candidates. Upgrades in the fork should be deliberate, with `pnpm cloud:plan` before any deploy.

## After 28.0 is in the stores

- Builds of runtime 27.x keep asking EAS; nothing more is published there. Downgrade the EAS plan to
  the free tier once the 28.0 adoption makes it safe.
- `EXPO_TOKEN` stays needed by `pr-preview.yml` until previews move.

## Suggested skills

- `argent-react-native-app-workflow` and `argent-test-ui-flow` for the device tests.
- `wrangler` or `cloudflare` for anything on the Cloudflare side.
- `qa-checklist` before marking #442 ready.
