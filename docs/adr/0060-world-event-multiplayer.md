# ADR-0060: Coordinate event-world presence with PartyServer

- Status: Accepted
- Date: 2026-09-20

## Context

Event visitors need to see each other's avatars moving in the illustrated World. The user chose existing Cloudflare infrastructure instead of a new multiplayer service subscription. The current Phaser scene already owns responsive movement, navigation collisions and sprite animation.

## Decision

Keep multiplayer within the Event exploration world context. Use PartyServer on a SQLite-backed Cloudflare Durable Object per room, and PartySocket in the browser. The first deployment exposes one event room, `asi-europe`, capped at 100 connections. This cap is a resource bound, not a mobile-performance guarantee.

Treat movement as transient social presence. Clients retain their own navigation and publish positions up to 15 Hz. The server validates and rate-limits frames, assigns identities, and batches participant changes. Remote rendering interpolates snapshots outside React. Server-authoritative physics and shared progression are outside this feature.

Use hibernating WebSocket attachments for session state, plus alarms to clean up stale connections. The server reserves random, non-overlapping arrival positions on the walkable central island before publishing participants. If no safe position is available, the room refuses the arrival instead of stacking avatars. Backgrounded clients leave and foregrounded clients rejoin at a newly reserved central-island position. Reconnection starts with a fresh snapshot and never replays queued movement. Do not write movement history to persistent tables.

## Consequences

The experience remains usable alone during network failure. Room capacity and connection state are visible in French and English. The frontend can remain separately hosted, with an explicit Worker endpoint and origin allowlist, or deploy with the Worker assets. The code introduces no external multiplayer subscription; usage remains subject to Cloudflare billing.

Gameplay requiring trusted positions would need server-owned simulation before building on this presence protocol. See `apps/world/docs/multiplayer.md` for operation and verification.
