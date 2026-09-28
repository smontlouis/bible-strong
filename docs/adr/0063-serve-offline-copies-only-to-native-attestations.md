# ADR-0063: Serve Offline copies only to native App Check attestations

- Status: Accepted
- Date: 2026-09-28

## Context

[ADR-0008](./0008-serve-versioned-resources-through-domain-api.md) protects the Resource API with Firebase App Check. The Worker accepted any allow-listed App ID on every protected route, including the Web App ID added with [ADR-0047](./0047-host-expo-web-on-cloudflare.md).

A Web App Check token is the easiest attestation to obtain: it can be copied from a browser session and reused for its lifetime. Because `/v1/offline-catalog` is public and each Offline copy is a complete resource, one Web token was enough to download the whole corpus. Web never installs Offline copies; its download manager is a no-op.

The goal is to deter bulk reuse of resources, not to make extraction impossible. A legitimate installation still receives complete Offline copies.

## Decision

`/v1/offline-artifacts/` accepts only verified tokens whose `sub` is an Android or iOS App ID. The platform is read from the App ID format Firebase signs into the token, never from a client-declared header. A valid Web token receives `403` before any rate-limit counter, cache or R2 access. Missing or invalid attestation still receives `401`. Online reading and search keep accepting the Web App ID.

The publication workflow downloads Offline copies during its smoke check. Its `RESOURCE_FIREBASE_APP_ID` must therefore be a native App ID; the CLI rejects another value before minting a token, during preflight.

## Consequences

The easiest extraction path is closed without a client release. Native extraction still requires a native attestation, or files copied from a device where an Offline copy was legitimately installed. Bulk Online reading through a Web token remains possible, limited by the existing counters.

A future Web Offline-copy feature would require revisiting this decision. `resource request forbidden for attested application` Worker logs identify refused App IDs.
