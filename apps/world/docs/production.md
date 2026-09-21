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

Cloudflare Access is configured with application `3149cd6f-cad0-4f62-a875-856421d1c8fa`
and an owner-only email policy. It covers `world.bible-strong.app/admin*` and
`world.bible-strong.app/api/guestbook/admin*`, accepts only email one-time PIN,
and uses a 24-hour session. `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are installed
on the Worker. Public pages and guestbook reads return 200; all admin entry points
redirect to Access. The owner confirmed that the admin login works.

`GUESTBOOK_ADMIN_URL=https://world.bible-strong.app/admin` is now installed, enabling
Hostinger notifications to the configured owner address. Previously queued messages
resume on their next durable alarm (up to one hour after an unconfigured attempt).
New messages schedule an alarm within one second; actual delivery depends on the
mail provider. The Hostinger transport was tested earlier; no synthetic public
guestbook message was created during activation.

## Automatic deployment

`.github/workflows/world-production.yml` tests, builds and deploys World on every
push to `master` (and supports manual dispatch). It uses the existing repository
secret `CLOUDFLARE_WEB_API_TOKEN`, then checks `/health`. Production build validation
rejects editor chunks, diagnostic controls and editor write URLs. Worker secrets
are configured separately and preserved by deployment.
