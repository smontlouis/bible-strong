# Expo Web deployment

The public site stays on Vercel at `https://bible-strong.app`. The Expo study
workspace runs on Cloudflare Workers Static Assets at `https://web.bible-strong.app`.
Both use `smontlouis/bible-strong`, with `master` as the production branch.

## GitHub Actions

- Worker: `bible-strong-web`
- Workflow: `.github/workflows/expo-web-production.yml`
- Repository root: `/`
- Production branch: `master`
- Trigger: every push to `master`, or a manual workflow dispatch
- Runtime: Node 22, Corepack, Yarn from the root manifest
- Build command: `yarn workspace @bible-strong/expo web:build` (Expo export, then the service
  worker build, see [PWA](#pwa))
- Deploy command: `yarn workspace @bible-strong/resource-service exec wrangler deploy --config ../../apps/expo/wrangler.jsonc`
- Repository secret: `CLOUDFLARE_WEB_API_TOKEN`

The dedicated Cloudflare token has Workers Scripts Edit and Account Settings Read
on the account, and Workers Routes Edit on `bible-strong.app`. Only the deploy step
receives it. Builds run in GitHub Actions; Cloudflare's own Git build integration
is intentionally not connected. Production deployments are serialized so an older
build cannot finish after a newer deployment. Pull requests cannot deploy production.

The build uses the root Yarn lockfile and patches. `web:build` explicitly loads
`apps/expo/.env.production` and disables Expo's automatic dotenv loading so a local
`.env` cannot supply development settings. Public Firebase configuration is bundled
into the browser application; private credentials must never use `EXPO_PUBLIC_*`.

The Worker serves `apps/expo/dist` without a server script. Unknown navigation
paths fall back to `index.html`, including direct links and browser refreshes.
The custom domain is declared in Wrangler; DNS and TLS are managed by Cloudflare.

## PWA

The web app is installable and starts offline (ADR-0067). Its files live in `apps/expo`:

- `public/index.html`, `public/manifest.webmanifest`, `public/icons/` (regenerate with
  `yarn workspace @bible-strong/expo web:icons`, ImageMagick 7) and `public/_headers`.
- `service-worker/sw.ts`, bundled into `dist/sw.js` by `scripts/build-web-sw.mjs` at the end of
  `web:export` and `web:build`. It precaches the shell (HTML, JS/CSS chunks, startup fonts, icons)
  within 30 MiB and never caches Resource API, Firebase or other cross-origin responses.
- `src/features/app/ServiceWorkerUpdates.web.tsx` registers the worker in production builds and
  shows a reload banner when a new deployment is waiting.
- `scripts/check-pwa.mjs` validates the export; the deploy workflow runs it before `wrangler deploy`.

Test locally with the Resource API's allowed local origin (`http://localhost:9090`), not
`127.0.0.1`. The local workerd may not support the configured compatibility date yet; override it
on the command line:

```sh
yarn workspace @bible-strong/expo web:export
node apps/expo/scripts/check-pwa.mjs
yarn workspace @bible-strong/resource-service exec wrangler dev --config ../../apps/expo/wrangler.jsonc --port 9090 --ip localhost --compatibility-date 2026-08-22
```

Use Chrome for service-worker checks (Application panel, offline network emulation). Development
(`yarn web`, same origin) unregisters any worker left by a local production export.

To retire the service worker, replace `service-worker/sw.ts` with a worker that unregisters itself
and deploy it. Never just delete `sw.js`: the SPA fallback would answer with `index.html`, the
browser would reject the update and keep the old worker.

```ts
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope
self.addEventListener('install', () => void self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key)
      await self.registration.unregister()
      for (const client of await self.clients.matchAll({ type: 'window' })) {
        ;(client as WindowClient).navigate(client.url)
      }
    })()
  )
})
export {}
```

Known limitation: Google and Apple sign-in use `signInWithPopup` with the `firebaseapp.com` auth
domain. In an iOS home-screen app the popup may not return the credential; email and password
sign-in works. The fix needs Firebase's `/__/auth` handler served from `web.bible-strong.app`, the
redirect flow in standalone mode and new redirect URIs in the Google and Apple consoles.

## Firebase and Resource API

- Firebase Auth must authorize `web.bible-strong.app`.
- The existing Firebase Web app uses reCAPTCHA Enterprise for App Check.
- The reCAPTCHA key allows `bible-strong.app`, which also covers its subdomains.
- Domain verification and production App Check remain enabled; do not deploy debug tokens.
- Resource API `RESOURCE_WEB_ORIGINS` must include `https://web.bible-strong.app`.

## Verification

Run `yarn workspace @bible-strong/expo web:build`, then validate the assets/config:

```sh
npx wrangler@4.124.0 deploy --config apps/expo/wrangler.jsonc --dry-run
```

After a production build, run `node apps/expo/scripts/check-pwa.mjs`, open `/home`, refresh a
nested route, read a Bible chapter, and verify that resource requests succeed without an App Check token
(ADR-0065); only Offline-copy downloads still require one. Inspect the GitHub Actions run
commit and the Vercel production deployment to confirm both track `master`.

Vercel project `bible-strong-landing` uses root directory `apps/site` and its existing
Git integration. No second Vercel project is needed for Expo.
