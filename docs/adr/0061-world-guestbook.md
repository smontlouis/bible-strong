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
