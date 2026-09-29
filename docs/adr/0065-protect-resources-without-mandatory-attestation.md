# ADR-0065: Protect resources without mandatory application attestation

## Status

Accepted. Supersedes the attestation requirements of [ADR-0008](./0008-serve-versioned-resources-through-domain-api.md) and [ADR-0063](./0063-serve-offline-copies-only-to-native-attestations.md) once the migration below completes.

## Context

ADR-0008 made Firebase App Check mandatory for every protected Resource API route. On Android, each App Check token requires a Play Integrity attestation, and Play Integrity enforces a project quota of 10,000 token requests per day and 27 per minute by default. Adjusting that quota requires a manual request to Google; the Cloud Console only allows lowering it.

From 2026-09-25, online reading multiplied attestations and exhausted the daily quota every day. Sentry recorded Play Integrity `-8 TOO_MANY_REQUESTS` for up to 2,200 Android users per day. Every affected user lost online reading and downloads until the quota reset at midnight Pacific time. Attestation refusals (`403 App attestation failed`) affected about 70 users per day, mostly non-certified or modified devices.

The protection goal is deterrence of bulk reuse, not prevented extraction (ADR-0063). A mandatory third-party attestation makes the whole application unavailable whenever that provider fails, throttles, or refuses a legitimate device. Once online reading is public, the corpus is obtainable by crawling it anyway; Offline copies only add a structured format and a single request.

## Decision

The Resource service never requires an App Check token to serve editorial content.

| Surface                           | Protection                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Online reading                    | Public. Cloudflare rate limits per client address, sized so that normal reading never reaches them.                                           |
| Search, including semantic search | Public. Searches that may call Workers AI have their own lower limit per client address, and Workers AI spend is monitored.                   |
| Study assistant                   | Unchanged: its private backend keeps its own authentication.                                                                                  |
| Encrypted Offline copies          | Public, with a request-count limit per client address. Downloaded volume is logged per address; a byte budget is added only if abuse appears. |
| Plain Offline copies              | Remain behind native App Check (ADR-0063) for clients that cannot decrypt archives. Removed once those clients are marginal.                  |
| Web                               | Still receives no Offline copies.                                                                                                             |

Offline copies are encrypted as AES-256 ZIP archives. This is obfuscation: it raises extraction effort to reverse-engineering the application, comparable to defeating App Check today, without refusing any legitimate device. Extracted databases stay unencrypted on the device.

- **Key derivation.** Each archive password is `HKDF-SHA256(masterKey, salt = "bible-strong-offline-archive", info = "<catalog id>\n<plain archiveSha256>")`, encoded as lowercase hex. The catalog id (for example `bible:LSG`) and the plain archive SHA are what the client already holds, so resources published after a client release stay installable without a new key.
- **Master key.** It never enters the repository or the JavaScript bundle. A config plugin reads `BIBLE_STRONG_ARCHIVE_KEYS` (`<version>:<base64 key>` pairs) from the build environment, `apps/expo/.env.local` for local builds, and generates obfuscated native source inside the ignored generated folders of the `bible-strong-archive` module. Publication reads the same variable. A build without keys still works: the module reports the key as unavailable and the client keeps using plain archives.
- **Native extraction.** The `bible-strong-archive` Expo module derives the password and extracts the archive in one native call, with SSZipArchive on iOS and zip4j on Android. The password never crosses into JavaScript. The module refuses archives whose entries are not encrypted.
- **Stable encrypted artifacts.** AES ZIP uses random salts, so publication encrypts each plain archive once per key version and reuses the result while the plain SHA is unchanged. Encrypted objects live under immutable `revisions/<encrypted sha256>/` keys.
- **Catalog.** An optional `encryptedArchive` field (`url`, `file`, `sha256`, `bytes`, `keyVersion`) is additive. A client with the module and the key version verifies the encrypted SHA before extraction, but still records the plain `archiveSha256` as the installed revision.

Clients never block a request on App Check acquisition. They send the request without a token when acquisition fails, and acquire a token only for routes that still use one (the assistant and plain Offline copies). Online reading no longer consumes attestations.

A client-declared header, User-Agent, or Origin is never treated as proof of the calling application.

## Migration

1. The Worker accepts requests without App Check on public routes while older clients keep sending tokens, which it ignores.
2. Publication produces encrypted archives alongside plain ones. The catalog exposes encrypted archives through an additive field that only new clients read (ADR-0034).
3. A client update stops requiring tokens for public routes. A later native release decrypts archives.
4. Plain archives and their App Check route are removed after the older population declines.

Older clients that fail to acquire a token remain blocked until they update, because they do not send the request. OTA updates are not checked automatically, so this population declines slowly.

## Consequences

The application no longer becomes unavailable when Play Integrity, App Attest, or Firebase throttles, fails, or refuses a device. Play Integrity usage falls with client adoption, so quota exhaustion stops mattering.

Rate limits become the primary abuse control for public routes. They are per location and approximate (Cloudflare), and shared addresses such as carrier NAT require generous thresholds. Anyone with patience or many addresses can crawl the public corpus.

A leaked master key exposes every encrypted archive. Rotation requires a new native release and republication, and the Worker must serve every key version still used by installed clients.

Workers AI usage behind semantic search is bounded only by per-address limits. Gating it behind an account remains possible if spend or abuse requires it.
