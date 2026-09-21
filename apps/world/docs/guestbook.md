# Guestbook

Visitors anywhere on the central island can read and sign its book without an account.
A circular plus button stays anchored to the book and fades/scales in and out when
entering/leaving the island. Activation follows the edited `land-0` ground contour,
excluding bridges. The six resource islands use the same interaction at fixed island centers. The UI is
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

## Administration and notifications

Open `/admin` to browse all, visible or removed entries. An email deep link
uses `?message=<id>` to select one entry. Removing an entry hides it from subsequent
public API reads; restoring makes it visible again. Existing open public dialogs
refresh when reopened. Removal is reversible and records the last actor and time.
No GET request or email link changes visibility. Existing signatures are preserved;
old entries are not retroactively emailed.

The Worker validates Cloudflare Access RS256 JWT signatures against the configured
team's keys, plus issuer, audience, expiry and the exact administrator email. An
email header alone never grants access. Configure an Access application protecting
`/admin`, `/admin/*`, the legacy `/admin-guestbook` alias, and `/api/guestbook/admin`, with the same audience and an
Allow policy restricted to `GUESTBOOK_ADMIN_EMAIL`. Also protect/disable alternate
production hostnames such as the workers.dev hostname. Missing Access configuration
fails closed. Admin writes require a JSON body and the `X-Guestbook-Admin: 1` header;
admin API responses are not CORS-enabled. Serve the admin page on the Worker origin.

Local development: `yarn dev:world` creates an ignored random
`GUESTBOOK_LOCAL_ADMIN_TOKEN` in `.dev.vars`. Set `GUESTBOOK_ADMIN_EMAIL` there.
The Vite-only bridge injects that token server-side exclusively for loopback clients,
loopback Host names and same-origin requests. The browser never receives the token.
The Worker accepts it only on loopback URLs. Restart the dev server after changing
`.dev.vars`; never configure this token in production.

Approved signatures and outbox rows are stored in one SQLite transaction. An alarm
is reserved before this transaction. Notifications are handled by the Durable Object
alarm, never by the signing request. Failed deliveries retry with bounded exponential
backoff (up to one hour); an unconfigured transport retains rows and checks hourly.
An idempotent repost does not enqueue a second email. The administration shows queue
counts and each entry's status (`queued`, `sent`, or `legacy`). `sent` means the mailer
acknowledged delivery/acceptance, not that a human read the email.

### Hostinger Mail API setup

The alarm sends through the [Hostinger Mail API](https://api.mail.hostinger.com/)
using the existing mailbox; SMTP passwords are unnecessary. Create a token scoped
to the sender mailbox in hPanel. The current provider UI grants SMTP/IMAP and webhook
permissions together, so keep the token server-side. Set these ignored local variables
or production Worker secrets:

- `HOSTINGER_MAIL_API_TOKEN`: Hostinger token (secret).
- `HOSTINGER_MAILBOX_ID`: resource ID (`AC...`) of the sender mailbox, available from
  authenticated `GET https://api.mail.hostinger.com/api/v1/me`. Verify its address
  matches `GUESTBOOK_NOTIFICATION_FROM`; Hostinger chooses the sender by mailbox ID.

- `GUESTBOOK_NOTIFICATION_TO`: notification recipient.
- `GUESTBOOK_NOTIFICATION_FROM`: verified sender address.
- `GUESTBOOK_ADMIN_URL`: production HTTPS URL `https://world.bible-strong.app/admin`.
- `ACCESS_TEAM_DOMAIN`: `<team>.cloudflareaccess.com`, without a scheme.
- `ACCESS_AUD`: Access application audience.
- `GUESTBOOK_ADMIN_EMAIL`: the sole allowed administrator email.

The server calls `POST /api/v1/mailboxes/{id}/send` with plain text and a fixed
configured recipient. Only HTTP 204 acknowledges a send. Before each attempt, it
searches `INBOX.Sent` for the notification's unique subject and recipient, recovering
accepted sends whose acknowledgement was lost. Search failures block sending and
are retried. The durable outbox prevents ordinary duplicate publication emails.
Hostinger does **not** document an idempotency key: if sending succeeds but its Sent
copy is missing or delayed, a retry can still duplicate an email. This is at-least-once
notification delivery, not an exactly-once guarantee. Retain the Sent copies.

An optional private `GUESTBOOK_MAILER` service binding still overrides Hostinger.
Its contract is `POST /send`, JSON `{from,to,subject,text}`, stable
`Idempotency-Key: guestbook:<entry-id>`, OK JSON `{messageId: "..."}`. No public
email-sending endpoint is exposed.

Local credentials alone do not activate notifications: `GUESTBOOK_ADMIN_URL` must
also be a real HTTPS admin URL. Finish Cloudflare Access and deploy the server secrets
before enabling production notifications. Do not point real notifications at an
invented URL or assume local configuration has been deployed.

The alarm design follows the [Cloudflare alarm API](https://developers.cloudflare.com/durable-objects/api/alarms/).
Access verification follows the [application token contract](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).
