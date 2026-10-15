# Portals

Portals lead from one world to another without reloading the page ([ADR-0085](../../../docs/adr/0085-travel-between-worlds-inside-one-world-application.md)). The registry of worlds is `src/universes.ts`; the host that runs a journey is `src/UniverseHost.tsx`, with the veil's styles in `src/universe-travel.css`.

| World | Portal | Leads to | Where it is set |
| --- | --- | --- | --- |
| Archipelago | Stone arch on the central plaza, east of the Bible, opposite the app's phone stand, where shrubs grew ([ground patch](../public/assets/map/edits/plaza-portal-ground.prompt.md)) | Valence 1876 | `src/world-portal.ts` (position, pillars, arrival point), `public/navigation/archipelago.json` (pillars) |
| Valence 1876 | The Lyon train at the end of the station platform | Archipelago | `public/valence-1876/layout.json` (`portal`, `portalLabel`), `public/valence-1876/navigation.json` (« Quai de la gare »), editable in the workshop |

A journey arrives at the destination's portal: the scene starts there and ignores the first spawn the multiplayer room suggests. A world reached by a portal skips its loading screen and tells the host when it is drawn, so the veil opens on it.

## The arch

`public/assets/portals/arch-valence.webp` was generated with codex-imagegen (`edit`, 1024 × 1024, high quality) from two style references, a 2× crop of the central plaza and `public/assets/app-download/phone.webp`, then cropped to its opaque pixels and scaled to 440 pixels high. The working files stay in `art-workbench/experiments/portals/`.

> Draw ONE freestanding prop for an illustrated isometric game map, in exactly the same flat hand-drawn cartoon style as the reference images: crisp dark outlines, simple soft shading, warm cheerful colours, the same three-quarter elevated camera. The prop: a small stone archway portal, about as tall as two people, made of pale warm cream stone blocks with a rounded top, a few sprigs of green ivy on one pillar, standing on a low round stone base. The front of the arch faces the viewer. Inside the opening, instead of the view behind, an old sepia photograph comes to life: a soft warm glow of aged paper tones in browns and creams showing faint silhouettes of 1870s town rooftops and a small steam locomotive with a puff of smoke, slightly swirling at the edges like a gentle magic portal, with a few golden sparkles. Background: a perfectly flat, uniform, solid pure magenta (#FF00FF) filling the whole canvas around the prop, with no gradient, no ground, no cast shadow, no frame, no text, no letters. Never use magenta in the prop. The prop is centered and fills about 80% of the canvas height.

The scene draws it with its base on the painted circle and its depth at the pillars' ground line, and `src/portal-glow.ts` adds a breathing light and rising sparks in its opening.
