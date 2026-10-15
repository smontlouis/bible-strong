# ADR-0085: Travel between worlds inside one World application

## Status

Accepted on 15 October 2026.

## Context

Bible Strong World had two universes, the archipelago at `/` and Valence 1876 at
`/valence-1876`. Both were built and served by the same Vite application and the same Worker,
`bible-strong-world`, with one multiplayer room each, but going from one to the other was an
ordinary link: the page reloaded, the visitor met a loading screen, and Valence kept a separate
avatar. More worlds are planned, and visitors should pass from one to another through portals
drawn on the maps, with an animation, as one journey.

Two shapes were possible. Separate applications per world would duplicate the engine (tiles,
cut-outs, walking, avatars, multiplayer, reactions), multiply deployments and keep portals as
redirects. One application can keep a world's code out of the others' downloads by loading it on
demand, which it already did for Valence.

## Decision

World stays one application, one Worker and one domain, and gains a notion of travel.

- **Registry.** `src/universes.ts` lists the worlds: an identifier, an address, a name and the
  world each portal leads to. The address decides the world on arrival, so a link to
  `/valence-1876` still opens Valence directly. Adding a world means one entry and one folder.
- **Host.** `src/UniverseHost.tsx` owns the page. Travelling covers the screen with an animation
  that grows from the portal, unmounts the current world, loads the next world's code while the
  screen is covered, records the address with `history.pushState`, then uncovers the new world
  from where the visitor arrives. The browser's Back button travels back the same way.
- **One game per world.** Each world keeps its own Phaser game, created on arrival and destroyed
  on departure, which also frees its textures. The continuity is carried by the overlay, not by
  sharing a canvas between worlds.
- **Portals.** A portal is a place on a map: in the archipelago, a stone arch on the central
  plaza, east of the Bible and opposite the app's phone stand; in Valence, the train at the station. Arriving through a portal
  places the visitor at the destination's portal. The multiplayer server still chooses a spawn
  when a visitor joins a room; the client ignores that first spawn after a portal, so the server
  is unchanged.
- **One traveller.** The avatar profile is shared by every world. The profile Valence kept apart
  until now is adopted once, when no World profile exists yet.
- **Rooms.** Each world keeps its multiplayer room. Leaving a world closes its connection;
  arriving opens the next one.
- **Styles.** Shared tokens and components stay global; each world keeps its own rules under its
  root class (`.world-shell`, `.valence-shell`) so that a world's styles do not leak into another
  after a journey without reload.
- **Code.** The archipelago is loaded on demand like Valence, so the first download of any world
  carries only the host, React and what the worlds share.

## Consequences

- No server change and no new deployment unit: the Worker already serves every address with the
  single-page fallback and keeps one room per world.
- A journey keeps the page, the language and the profile, and costs only the destination's code
  and the tiles it shows.
- Each world must report when it is ready to be uncovered and accept an arrival through a portal;
  a new world implements both before it gets a portal.
- Link previews still need one HTML entry per world address, as `valence-1876/index.html` does.
- A world reached by a direct link keeps its own loading screen; one reached by a portal shows
  the travel animation instead.
