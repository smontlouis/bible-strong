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

## Indexing

The workspace is not indexed (ADR-0069); public reading lives on the site.
`apps/expo/public/_headers` declares the response header for every path:

```txt
/*
  X-Robots-Tag: noindex
```

Expo copies `apps/expo/public/` into `apps/expo/dist` on export. Workers Static
Assets reads `_headers` from the asset directory, applies its rules to every
response it serves, including the `index.html` fallback of client routes, and
never serves the file itself. Rules that match the same request are combined, so
path-specific headers can be added to the same file.

Do not publish a `robots.txt` that disallows crawling: a crawler that cannot
fetch a page never sees its `noindex` header.

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

The export must contain `apps/expo/dist/_headers`.

After a production build, open `/home`, refresh a nested route, read a Bible
chapter, and verify that resource requests succeed without an App Check token
(ADR-0065); only Offline-copy downloads still require one. Inspect the GitHub Actions run
commit and the Vercel production deployment to confirm both track `master`.

Check that a client route is served with `x-robots-tag: noindex`:

```sh
curl -sI https://web.bible-strong.app/bible/lsg/john/3/16 | grep -i x-robots-tag
```

Vercel project `bible-strong-landing` uses root directory `apps/site` and its existing
Git integration. No second Vercel project is needed for Expo.
