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
- Build command: `yarn workspace @bible-strong/expo web:build`
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
without an App Check token must still be rejected. Inspect the GitHub Actions run
commit and the Vercel production deployment to confirm both track `master`.

Vercel project `bible-strong-landing` uses root directory `apps/site` and its existing
Git integration. No second Vercel project is needed for Expo.
