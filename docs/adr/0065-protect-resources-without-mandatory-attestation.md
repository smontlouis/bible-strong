# ADR-0065: Protect resources without mandatory application attestation

## Status

Accepted. Supersedes the attestation requirements of [ADR-0008](./0008-serve-versioned-resources-through-domain-api.md) and [ADR-0063](./0063-serve-offline-copies-only-to-native-attestations.md) once the migration below completes.

## Context

ADR-0008 made Firebase App Check mandatory for every protected Resource API route. On Android, each App Check token requires a Play Integrity attestation, and Play Integrity enforces a project quota of 10,000 token requests per day and 27 per minute by default. Adjusting that quota requires a manual request to Google; the Cloud Console only allows lowering it.

From 2026-09-25, online reading multiplied attestations and exhausted the daily quota every day. Sentry recorded Play Integrity `-8 TOO_MANY_REQUESTS` for up to 2,200 Android users per day. Every affected user lost online reading and downloads until the quota reset at midnight Pacific time. Attestation refusals (`403 App attestation failed`) affected about 70 users per day, mostly non-certified or modified devices.

The protection goal is deterrence of bulk reuse, not prevented extraction (ADR-0063). A mandatory third-party attestation makes the whole application unavailable whenever that provider fails, throttles, or refuses a legitimate device. Once online reading is public, the corpus is obtainable by crawling it anyway; Offline copies only add a structured format and a single request.

## Decision

The Resource service never requires an App Check token to serve editorial content.

| Surface | Protection |
|---|---|
| Online reading and text search | Public. Cloudflare rate limits sized so that normal reading and searching never reach them. |
| Semantic search and the study assistant | Require an authenticated account. A semantic search request without an account receives `200` with an empty result set, never `401`, so older clients neither show an error nor force an App Check refresh. |
| Encrypted Offline copies | Public, with download-specific rate limits by count and bytes. |
| Plain Offline copies | Remain behind native App Check (ADR-0063) for clients that cannot decrypt archives. Removed once those clients are marginal. |
| Web | Still receives no Offline copies. |

Offline copies are encrypted as AES ZIP archives. Each archive key is derived from a master key, the resource identity, and the archive SHA, so resources published after a client release remain installable without a new key. The master key lives in native code, not in the JavaScript bundle. This is obfuscation: it raises extraction effort to reverse-engineering the application, comparable to defeating App Check today, without refusing any legitimate device. Extracted databases stay unencrypted on the device.

Clients never block a request on App Check acquisition. They send the request without a token when acquisition fails, and acquire a token only for routes that still use one (the assistant and plain Offline copies). Online reading no longer consumes attestations.

A client-declared header, User-Agent, or Origin is never treated as proof of the calling application.

## Migration

1. The Worker accepts requests without App Check on public routes while older clients keep sending tokens, which it ignores.
2. Publication produces encrypted archives alongside plain ones. The catalog exposes encrypted archives through an additive field that only new clients read (ADR-0034).
3. A new client release decrypts archives, stops requiring tokens for reading, and gates semantic search behind an account.
4. Plain archives and their App Check route are removed after the older population declines.

Older clients that fail to acquire a token remain blocked until they update, because they do not send the request. OTA updates are not checked automatically, so this population declines slowly.

## Consequences

The application no longer becomes unavailable when Play Integrity, App Attest, or Firebase throttles, fails, or refuses a device. Play Integrity usage falls with client adoption, so quota exhaustion stops mattering.

Rate limits become the primary abuse control for public routes. They are per location and approximate (Cloudflare), and shared addresses such as carrier NAT require generous thresholds. Anyone with patience or many addresses can crawl the public corpus.

A leaked master key exposes every encrypted archive. Rotation requires a new native release and republication, and the Worker must serve every key version still used by installed clients.

Visitors without an account lose semantic search and the assistant. Costly Workers AI and assistant usage is bounded by account creation instead of attestation.
