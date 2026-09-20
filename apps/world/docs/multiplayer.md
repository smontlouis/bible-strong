# Event multiplayer

World uses `partyserver` on Cloudflare Durable Objects and `partysocket` in the browser. All visitors join `asi-europe`; the room admits up to 100 connections. This is a presence experience: avatars can pass through each other and resource discoveries remain local.

## Local development

`yarn dev:world` starts Vite on port 5186 and the local Worker on port 8791. Vite proxies `/parties` so phones on the same network can use the Vite Network URL. Open two browsers, choose names, and move with the joystick or keyboard. `yarn workspace @bible-strong/world dev:client` and `dev:multiplayer` can also run separately. If Vite is already running, start only `dev:multiplayer`.

## Deploy

`yarn workspace @bible-strong/world deploy` builds and deploys the app, static assets, and room Worker together as `bible-strong-world`. No external multiplayer subscription or database is needed. Cloudflare credentials must belong to the intended account.

To keep a separate frontend host such as Vercel, set `VITE_WORLD_MULTIPLAYER_HOST` to the Worker HTTPS URL **at frontend build time**, and add the exact frontend origin to the Worker's comma-separated `ALLOWED_ORIGINS`. Same-origin deployments work without this variable. The Worker permits only the event room route; arbitrary public room creation is disabled.

## Behavior

- Each arrival receives a server-reserved random, walkable position on the saved central island. Avatar visual footprints stay at least 70 px apart horizontally or 56 px vertically. Reservation and publication are synchronous, so concurrent arrivals cannot select overlapping positions. If the island has no free position, joining returns the full status until space is available; existing visitors can still move freely.
- Movement/collisions stay local for immediate joystick response. Publish changed positions at up to 15 Hz, with immediate final stops.
- The server validates profiles, finite map coordinates, directions, sequence numbers, message sizes and message rates. It assigns participant IDs and never accepts a claimed player ID. It does not simulate navigation or prevent a modified client from moving through scenery; no shared rewards or competitive state relies on these positions.
- The server batches changed participants every 50 ms. Browsers interpolate buffered snapshots with a 100 ms delay. Teleports snap; packet loss holds the last position instead of extrapolating through obstacles.
- Avatars reuse the existing animation assets, tint, ground-depth ordering and zoom-aware labels. Transient movement never enters React state.
- Profile edits synchronize. Opening a resource keeps the visitor present and stationary. World editors leave the room to avoid publishing experimental navigation.
- Backgrounding leaves the room cleanly; returning rejoins on a free central-island position with a fresh full snapshot. Socket interruption reconnects automatically. Heartbeats detect stalled connections; server alarms remove abandoned sessions. Old movements are never queued for replay.
- Room state lives in WebSocket attachments so hibernation retains current participants. No movement history is stored. Empty rooms stop scheduling cleanup alarms.
- A full room allows solo exploration and offers a retry button. Network failure never blocks movement.

## Validation

`yarn workspace @bible-strong/world test` covers parsing, interpolation and client transport behavior. `yarn workspace @bible-strong/world typecheck` checks both runtimes.

For isolated live WebSocket checks, run:

```sh
yarn workspace @bible-strong/world wrangler dev --assets public --port 8792 --persist-to /tmp/world-multiplayer-tests
WORLD_TEST_URL=ws://127.0.0.1:8792/parties/world-room/asi-europe yarn workspace @bible-strong/world test:multiplayer
```

The script checks joins/snapshots, movement, profile edits, stale sequence rejection, departures/rejoins, invalid payloads, rate limiting, 30 simultaneous moving clients at 15 Hz, and the 100-connection limit. Run against an **empty, dedicated test instance**, never against the event room in use. A local protocol load test does not measure mobile rendering or venue Wi-Fi capacity.

## Verification on 2026-09-20

- World: 86 tests pass (30-second test timeout used while other workspace checks and browsers were running), client/server typecheck, lint, build, and Wrangler deployment dry-run pass.
- Live local Worker: 30 clients publish at 15 Hz for five seconds, and every client receives the final positions of all peers; 100 concurrent joins and room-full handling pass. This validates the protocol, not 100-avatar mobile FPS.
- Two desktop browser sessions show each other's distinct avatars and movement; the same UI was inspected at 390 × 844. Simulated network loss returns to the online state automatically.
- Immutable Yarn installation, root typecheck and root build pass. Root tests stop in Expo: `StrongCard-test.tsx`, `sources-test.ts`, and `pickerSelection-test.ts` fail outside this feature. Root lint was interrupted after more than seven minutes in Expo ESLint; World lint passes.
- No production deployment was performed. Physical phones and the event network still need an on-site smoke test.

Arrival-position follow-up: 91 World tests pass. A live burst of 30 join attempts reserved 15 non-overlapping central-island positions and rejected the remaining arrivals until space was available. The 100-connection test moves each visitor off the central island before admitting the next one.
