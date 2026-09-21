# World production deployment

The Worker and its built assets share `world.bible-strong.app`. The guestbook admin
is `/admin` (`/admin/` and the old `/admin-guestbook` remain compatible). Vite uses
root-relative asset URLs so the trailing slash also loads correctly.

## Development tools

Editor controls, panels, the navigation editor chunk, the diagnostic UI and `?debug`
activation are gated by Vite's compile-time `import.meta.env.DEV`. The production
bundle has no editor save URLs. Saved project documents remain public read-only
assets because the scene needs them. Production ignores local editor drafts.
Vite's `configureServer` save handlers are development-only and are not part of the
Worker. The Worker intercepts `/__study-world/*` and returns 404 for every method.

Build and run `node scripts/check-production-build.mjs` from this workspace to verify
the public artifact. Test the built Worker with isolated local persistence before deploy.

## Hosting and access

Wrangler's custom domain is `world.bible-strong.app`; workers.dev and version preview
URLs are disabled. Configure Cloudflare Access before enabling production notifications:

- One self-hosted Access application covering `/admin`, `/admin/*`,
  `/admin-guestbook`, and `/api/guestbook/admin` on the world domain.
- An Allow policy for the owner email only, with email one-time-code login.
- Set `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and `GUESTBOOK_ADMIN_EMAIL` on the Worker.
- Set `AI_GATEWAY_API_KEY`, `HOSTINGER_MAIL_API_TOKEN`, `HOSTINGER_MAILBOX_ID`,
  `GUESTBOOK_NOTIFICATION_TO`, `GUESTBOOK_NOTIFICATION_FROM` and
  `GUESTBOOK_ADMIN_URL=https://world.bible-strong.app/admin` as server settings.
- Never upload `GUESTBOOK_LOCAL_ADMIN_TOKEN` to production.

Without Access configuration, admin requests fail closed with 401. Local configuration
and successful local email tests do not provision these production settings.
See [guestbook operations](guestbook.md) for delivery and authentication details.

## Deployment status — 2026-09-21

The application is deployed on the custom domain. HTTPS assets, `/health`, guestbook
reads and the multiplayer WebSocket were checked live. Editor write routes return
404 and unauthenticated admin routes return 401. The six server secrets for Jev,
Hostinger and the owner/sender/recipient identities have been installed; the local
admin bypass token was not uploaded.

Cloudflare Zero Trust has been activated by the owner. The Access application and
owner-only policy are prepared in the dashboard but await confirmation before
creation. The current Wrangler OAuth session cannot create Access configuration. `GUESTBOOK_ADMIN_URL` is
intentionally not set in production yet, so notifications remain durably queued
instead of sending links to an inaccessible admin page. Activate it after verifying
the owner login and the page/API policy coverage.

## Automatic deployment

`.github/workflows/world-production.yml` tests, builds and deploys World on every
push to `master` (and supports manual dispatch). It uses the existing repository
secret `CLOUDFLARE_WEB_API_TOKEN`, then checks `/health`. Production build validation
rejects editor chunks, diagnostic controls and editor write URLs. Worker secrets
are configured separately and preserved by deployment.
