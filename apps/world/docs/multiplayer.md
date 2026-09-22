# Event multiplayer

World uses `partyserver` on Cloudflare Durable Objects and `partysocket` in the browser. All visitors join `asi-europe`; the room admits up to 100 participants (plus 16 bounded pending connections for handshakes and transport replacement). This is a presence experience: avatars can pass through each other and resource discoveries remain local.

## Local development

`yarn dev:world` starts Vite on port 5186 and the local Worker on port 8791. Vite proxies `/parties` so phones on the same network can use the Vite Network URL. Open two browsers, choose names, and move with the joystick or keyboard. `yarn workspace @bible-strong/world dev:client` and `dev:multiplayer` can also run separately. If Vite is already running, start only `dev:multiplayer`.

## Deploy

`yarn workspace @bible-strong/world deploy` builds and deploys the app, static assets, and room Worker together as `bible-strong-world`. No external multiplayer subscription or database is needed. Cloudflare credentials must belong to the intended account.

To keep a separate frontend host such as Vercel, set `VITE_WORLD_MULTIPLAYER_HOST` to the Worker HTTPS URL **at frontend build time**, and add the exact frontend origin to the Worker's comma-separated `ALLOWED_ORIGINS`. Same-origin deployments work without this variable. The Worker permits only the event room route; arbitrary public room creation is disabled.

## Behavior

- Each arrival receives a server-reserved random, walkable position inside the central island's large paving circle, excluding the table and other navigation obstacles. The same bounds apply to local solo arrivals. Avatar visual footprints stay at least 70 px apart horizontally or 56 px vertically. Reservation and publication are synchronous, so concurrent arrivals cannot select overlapping positions. If the circle has no free position, joining returns the full status until space is available; existing visitors can still move freely.
- Movement/collisions stay local for immediate joystick response. Publish changed positions at up to 15 Hz, with immediate final stops.
- The server validates profiles, finite map coordinates, directions, sequence numbers, message sizes and message rates. It assigns participant IDs and never accepts a claimed player ID. It does not simulate navigation or prevent a modified client from moving through scenery; no shared rewards or competitive state relies on these positions.
- The server batches changed participants every 50 ms. Browsers interpolate buffered snapshots with a 100 ms delay. Teleports snap; packet loss holds the last position instead of extrapolating through obstacles.
- Avatars reuse the existing animation assets, tint, ground-depth ordering and zoom-aware labels. Transient movement never enters React state.
- Profile edits synchronize. Opening a resource keeps the visitor present and stationary. World editors leave the room to avoid publishing experimental navigation.
- Backgrounding keeps the connection and avatar session, publishes a final stop, and marks the connection hidden. Hidden connections tolerate up to 24 hours without application heartbeats; visible connections retain the 45-second stale timeout. On return, heartbeats resume with a fresh grace period. If the browser or network closes the socket, a private server-issued token restores the same participant ID and last server-known position for 24 hours after disconnection, with a fresh snapshot and continuing movement sequence. The token stays in tab-scoped sessionStorage (or memory if storage is unavailable), never in public player broadcasts. A resumed connection replaces any older transport for that token. Old movements are never queued for replay.
- Room state lives in WebSocket attachments so hibernation retains current participants. No movement history is stored. Disconnected session snapshots are stored for resumption and deleted on resume or expiry. Empty rooms with retained sessions run hourly expiry cleanup; rooms with neither connections nor saved sessions stop scheduling alarms.
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

## Avatar reactions

The bottom-right reaction picker sends one of seven fixed reaction identifiers. The room
assigns the sender from its admitted connection, limits reactions to one every 1.5 seconds
(in the hibernating session attachment), and broadcasts only to admitted, visible visitors.
Reactions are transient: they are not stored, included in welcome snapshots, or replayed
after reconnecting. Clients clear them on departure, backgrounding and disconnect.
Each reaction follows its avatar for three seconds, with screen-sized artwork above scenery.
Reduced-motion users see a static reaction for the same duration.

The first set uses the approved slime artwork for every avatar shape, tinted with the
sender's profile color. Colored hearts, tears and confetti are a separate untinted layer.
The fourteen lossless WebP layers are 128 × 128 and total about 36 KB. Rebuild with
`node scripts/build-reactions.mjs <approved-image-directory>` from `apps/world`; the source
filenames and hashes are recorded in `public/assets/reactions/slime/provenance.json`.
Full-resolution concepts are not served by the application.

### Avatar activity badges

The current open UI publishes one public activity (`menu`, `exploration`, `game`,
`board`, `book`) or `null` through the existing presence socket. Only the category
is shared. Player snapshots include it for newcomers; the client republishes its
current UI state after reconnecting. Closing the UI clears the activity.

The reaction renderer also draws a compact blue badge with a white icon at the
same screen-sized avatar anchor. Reactions temporarily replace it. Activity badges
persist until the UI closes, follow interpolated avatars, disappear with departed
visitors, and respect reduced motion.
