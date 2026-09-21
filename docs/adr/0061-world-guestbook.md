# ADR-0061: Publish event guestbook notes after server-side Jev admission

- Status: Accepted
- Date: 2026-09-21

World owns the guestbook interaction and persistent visitor notes. Keep its Jev
integration and server-only moderation policy in this repository, as requested,
without coupling the guestbook to the private study-assistant service or its
Bible-study admission rules. Server-only does not imply secrecy from repository readers.

Use a dedicated SQLite Durable Object in the existing World Worker. An HTTP API
keeps guestbook availability independent from transient multiplayer presence.
Validate the name and message, then automatically publish only when Jev accepts.
There is no manual approval queue. Provider failures preserve the draft and block
publication until a successful retry. Persist approved content, server timestamps,
submission identities and policy versions. Never persist rejected content or log
raw submissions. Idempotent submission identities prevent duplicate publications.

See `apps/world/docs/guestbook.md` for configuration and operational limits.

## Administration and notification follow-up

A signature can be removed from public reads and restored by the authenticated owner.
Cloudflare Access identity is verified cryptographically in the Worker; the UI is not
the authorization boundary. The local developer bridge is restricted to loopback
and uses an ignored random token never bundled into the browser.

Persist a notification outbox row atomically with each new signature. Use the
Guestbook object's own alarm for retries, independently of multiplayer. Hostinger's HTTPS Mail API owns delivery from the selected mailbox; an optional
private mailer binding can override it. Reconcile the unique notification subject
against the Sent folder before retrying. Hostinger does not document idempotent sends,
so ambiguous failures can still produce duplicates when the Sent copy is unavailable.
Unconfigured notifications remain queued and the admin page says so explicitly. No SMTP provider or credentials are inferred from the sender
address. Existing messages are not retroactively queued.
