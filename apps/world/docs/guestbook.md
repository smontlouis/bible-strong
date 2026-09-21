# Guestbook

Visitors near the central book can read and sign it without an account. The UI is
French/English, keeps a local draft and pauses movement while the dialog is open.
Names and messages are public after automatic Jev admission; there is no manual
approval queue. Text is rendered as plain text, never HTML.

## Server

`GET /api/guestbook?cursor=<sequence>` returns up to 20 newest entries and an opaque
pagination cursor. `POST /api/guestbook` accepts a UUID submission id, an avatar
profile and a message (1–500 UTF-16 code units after trimming). Reuse the same id
when retrying an unchanged submission. A published id cannot be changed.

The `Guestbook` SQLite Durable Object stores only approved entries and their policy
version, independently of transient multiplayer connections. It evaluates both
name and message through `typesafe-ai/jev` on Vercel AI Gateway. Server-only rules
live in `server/guestbook-moderation.ts` in this repository. They are absent from the
browser bundle, but are visible to anyone who has access to the repository.

Any category at or above 0.35 rejects publication. Invalid/missing provider responses,
timeouts and missing configuration fail closed. Responses: 422 rejected, 503
verification unavailable, 429 rate limited, 400 invalid input, 409 retry/conflict.
The browser keeps the draft in each case. The policy explicitly includes isolated vulgar insults without a named target. These thresholds are an initial policy;
use representative multilingual examples when tuning them.

Bodies are limited to 8 KiB before forwarding. Attempts are limited to 20/minute
per source address and 120/minute per book, before provider calls. These are abuse
bounds, not authentication; attendees behind a shared NAT share a limit. Address
hashes rotate each minute and expired counters are deleted on subsequent attempts.
No raw messages or provider credentials are logged.

## Configuration

Local: copy `.dev.vars.example` to `.dev.vars` and set `AI_GATEWAY_API_KEY`.
Production: `yarn exec wrangler secret put AI_GATEWAY_API_KEY` from `apps/world`.
The key must never have a `VITE_` prefix. Deploy with the existing World deployment
command, which applies the `v2` Guestbook SQLite migration and `/api/*` asset routing.
The local Vite server proxies this endpoint to port 8791. A separately hosted
frontend uses the existing `VITE_WORLD_MULTIPLAYER_HOST` host and the Worker origin
allowlist. Reading and signing do not require a multiplayer WebSocket connection.
