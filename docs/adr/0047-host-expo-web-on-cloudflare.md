# ADR-0047: Host Expo Web on Cloudflare

- Status: Accepted
- Date: 2026-09-16

## Context

The Expo study workspace now supports browsers from the same source as the native
applications. The public TanStack Start site already deploys through Vercel. The
study workspace needs economical static delivery and automatic production updates.

## Decision

Keep the public site on Vercel at `bible-strong.app`. Serve Expo's single-page web
export through Cloudflare Workers Static Assets at `web.bible-strong.app`. Use
GitHub Actions and the existing Vercel Git integration to deploy from `master`.
GitHub Actions uses a dedicated Cloudflare deployment token and avoids granting
additional permissions to manage Cloudflare Builds. The workflow lives in the
repository and deploys production only from the production branch.

Keep Firebase Authentication and reCAPTCHA Enterprise App Check for the browser
client. Add the web origin to the Resource API CORS allowlist without relaxing
token verification. Keep build settings in `docs/expo-web-deployment.md` and asset
routing/domain configuration in `apps/expo/wrangler.jsonc`.

## Consequences

The two web products deploy independently from one repository. Expo does not need
a server runtime for its interface. Client routing requires an HTML navigation
fallback; protected data remains served by the Resource API. Production web builds
must explicitly use production environment settings and preserve Yarn patches.
