# Create a world

Bible Strong World holds several worlds in one application: the archipelago at `/` and Valence 1876 at `/valence-1876`. Visitors travel between them through portals without reloading the page ([ADR-0085](../../../docs/adr/0085-travel-between-worlds-inside-one-world-application.md), [portals](portals.md)). A new world reuses everything the first two share. It brings its map, its documents and what is its own.

| Shared | Where |
| --- | --- |
| Walking (keys, joystick, held pointer, click-to-walk), camera and arrival zoom, multiplayer room, visitors, reactions, stand passers-by, walking markers, name label, map tiles, bushes, ambient zones, shorelines, navigation diagnostics | `src/world-scene.ts` (`WorldScene`, `startWorldGame`) |
| Scene life from loading to the journey's ready signal, joystick, explorer profile, language, presence line | `src/world-shell.tsx` |
| Pinch, wheel and tap on the map | `src/use-camera-zoom-gestures.ts` |
| Workshop: tab bar, access, shoreline and ambient editors, save bar, sliders | `src/workshop/WorldWorkshop.tsx`, `src/workshop/editors.ts`, `src/workshop/workshop.css` |
| Saving workshop documents in development | `src/workshop/documents.ts`, `vite.config.ts` |
| Journeys, the veil, Back and Forward | `src/universes.ts`, `src/UniverseHost.tsx` |

Valence 1876 is the reference for a world added after the archipelago. Its files are under `src/valence/`, `public/valence-1876/` and `scripts/valence/`.

## 1. The map

Pick an identifier, used for the address, the folder and the room: `jerusalem-30` below.

1. Keep one source image of the whole map. Its size in pixels at 1× becomes the world's coordinates (the archipelago is 1671 × 941, Valence 1672 × 941). Navigation, landmarks and cut-outs are all expressed in these units.
2. Build the progressive map from the high-resolution source, the way `scripts/valence/build-map-tiles.mjs` does for Valence. It writes `public/jerusalem-30/map/preview.webp`, the tiles under `public/jerusalem-30/map/tiles/` and the tile manifest under `src/jerusalem-30/generated/map-tiles.json`. The source image is not committed.
3. A world without scenery past its map can hang as a painting: `src/world-frame.ts` draws a frame, a wall and a plaque around it, and widens the zoom-out to them ([Valence's frame](valence-1876/frame.md)). Build the frame image for the map with `scripts/build-world-frame.py`.
4. Cut-outs the avatar passes behind (roofs, canopies) come from offline segmentation, as `scripts/valence/build_navigation.py` does. The browser only ships reviewed cut-outs and their metadata.

## 2. The documents

Each world keeps its editable documents in `public/<id>/`:

- `navigation.json`: walkable and blocked polygons, edited in the workshop's access tab. Describe the world's bounds in a `NavigationSpec`, like `VALENCE_NAVIGATION` in `src/valence/valence-documents.ts`.
- `shorelines.json` and `ambience.json`: foam along the water and ambient zones (particles, butterflies, glows, dragonflies).
- Any document of its own, like Valence's `layout.json` (landmarks) and `effects.json` (water and light).

Add the world's entries to `src/workshop/documents.ts` with `worldDocuments('jerusalem-30', 'jerusalem-30', …)` plus its own documents. The development server then accepts their saves, validated by each entry's `parse`, and the production build check refuses any of their save addresses.

## 3. The scene

Subclass `WorldScene` in `src/jerusalem-30/jerusalem-game.ts`, and export a `createJerusalem` that returns `startWorldGame(new JerusalemScene(…))`.

The constructor's options describe the world:

| Option | Meaning |
| --- | --- |
| `key` | The Phaser scene key, the world's identifier |
| `width`, `height` | The map, in source units: walking, spawning and the camera's follow stay inside it |
| `scenery` | Only when the drawn scenery reaches past the map (the archipelago's sky) |
| `cameraLift` | How far above the feet the camera looks, in screen pixels |
| `avatarSize` | 52 in the archipelago, 35 in Valence, to match the townsfolk's scale |
| `look` | Background, avatar shadow, name label, walking arrow tint, shoreline foam |
| `room` | The multiplayer room (see step 6) |
| `preview`, `tiles` | The progressive map from step 1 |
| `hiddenBy` | The cut-outs: while the avatar is behind one, a faint outline shows it through |

The hooks hold what is the world's own:

| Hook | Use |
| --- | --- |
| `arrival()` | Where a visitor first appears |
| `resetPosition()` | Where "start again" puts them; `arrival()` by default |
| `preloadScenery()`, `createScenery()` | The world's images and objects: cut-outs, animated scenes, props |
| `updateScenery(frame)` | Every frame, once the avatar and the camera have moved. `frame` gives the camera, zoom, pause and arrival target |
| `createCrowd()`, `createBushes()` | Stand passers-by and rustling shrubs |
| `freeCamera()` | When the workshop moves the camera itself |
| `drawDebug(layer, frame)` | Diagnostics drawn over the walkable zones |
| `publishState(frame)` | The state React reads, ten times a second |

DOM elements laid over the map (place labels, portal buttons) are positioned in `updateScenery` with `this.project(point)`.

## 4. The React application

`src/jerusalem-30/JerusalemApp.tsx` default-exports a component that receives `UniverseProps`. It keeps its own look and dialogs, and builds on the shared shell:

- `useWorldScene` with the scene's `create…` function, `documentsLoaded`, the `arrival` and `onReady` from the props. It returns `state`, `ready`, `revealing`, `failed` and `fail`.
- `useJoystick` in the world's colours, `useCameraZoomGestures`, `useExplorerProfile` with `AvatarEditor`, `useWorldLanguage`, and `WorldPresence` with the world's wording.
- `createShoreEditor` and `createAmbientEditor` pointed at the world's files and save addresses.
- On arrival through a portal, set `controls.portalArrival` to the portal's arrival point before the scene starts.
- To leave, pause the controls and call `onTravel(destination, origin)`.

The workshop is development only: load it with `lazy` behind `import.meta.env.DEV`. Build it with `WorldWorkshop` and `commonTabs`, adding the world's own tabs (Valence adds its landmarks and its water). Switch modes with `selectEditors`. Never import workshop components from code that ships in production: `yarn workspace @bible-strong/world build` fails if an editor chunk or a save address reaches the production artifact.

## 5. The registry

- `src/universes.ts`: the world's `path`, its `name` and the `travel` line shown under the veil.
- `src/UniverseHost.tsx`: its lazy import in `imports` and `worlds`.

The Worker serves the application for any address, so the new path needs no server route.

## 6. The room

- `src/multiplayer-protocol.ts`: the room's name, added to `ROOMS`. The Worker only accepts these rooms.
- `server/index.ts`: the room's arrival. The server chooses where a new visitor appears, from the world's navigation and arrival point. It currently tells the archipelago from Valence with `hasGames`: give the new room its own spawn, and decide whether it hosts Bible games.

## 7. The portals

A portal leads from an existing world to the new one, and one leads back. Each world sets its portal's position, its walkable surroundings and its arrival point. Add both to the table in [portals](portals.md).

## 8. Checks

```bash
yarn workspace @bible-strong/world typecheck
yarn workspace @bible-strong/world test
yarn workspace @bible-strong/world build
```

Then in the browser, at `yarn dev:world`:

- Open the world's address directly: loading screen, arrival zoom, walking, click-to-walk, presence.
- Travel there and back through the portals, then use Back and Forward.
- Open the workshop: every tab, free camera, saving each document.
- Open it at `?stand` for an exhibition stand, and at `?debug` for the navigation diagnostics.

Remember that `CONTEXT.md` is the glossary: add the world's terms there.
