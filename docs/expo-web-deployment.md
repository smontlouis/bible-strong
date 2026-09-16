# Expo Web deployment

The public site stays on Vercel at `https://bible-strong.app`. The Expo study
workspace runs on Cloudflare Workers Static Assets at `https://web.bible-strong.app`.
Both use `smontlouis/bible-strong`, with `master` as the production branch.

## Cloudflare Builds

- Worker: `bible-strong-web`
- Repository root: `/`
- Production branch: `master`
- Non-production branch builds: disabled
- Build variable: `SKIP_DEPENDENCY_INSTALL=true`
- Build command: `corepack enable && yarn install --immutable && yarn workspace @bible-strong/expo web:build`
- Deploy command: `npx wrangler@4.124.0 deploy --config apps/expo/wrangler.jsonc`

The build uses the root Yarn lockfile and patches. `web:build` explicitly loads
`apps/expo/.env.production` and disables Expo's automatic dotenv loading so a local
`.env` cannot supply development settings. Public Firebase configuration is bundled
into the browser application; private credentials must never use `EXPO_PUBLIC_*`.

The Worker serves `apps/expo/dist` without a server script. Unknown navigation
paths fall back to `index.html`, including direct links and browser refreshes.
The custom domain is declared in Wrangler; DNS and TLS are managed by Cloudflare.

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

After a production build, open `/home`, refresh a nested route, read a Bible
chapter, and verify that App Check-protected resource requests succeed. A request
without an App Check token must still be rejected. Inspect the Cloudflare build
commit and the Vercel production deployment to confirm both track `master`.

Vercel project `bible-strong-landing` uses root directory `apps/site` and its existing
Git integration. No second Vercel project is needed for Expo.
