# Carte v1 : prompts de génération

[`carte-v1.webp`](./carte-v1.webp) a été générée le 14 octobre 2026 avec `codex-imagegen` (modèle `gpt-image-2`, qualité haute, taille demandée 1536 × 864, sortie 1672 × 941), en trois passes. Chaque passe part de l’image produite par la précédente. Les images intermédiaires ne sont pas conservées.

## Passe 1 : l’essai « hybride »

Cinq essais de style ont été comparés. Celui-ci a été retenu. Image d’entrée : `apps/world/public/assets/map/preview.webp`, comme référence de cadrage seulement.

```bash
codex-imagegen edit --prompt-file passe-1.txt --image apps/world/public/assets/map/preview.webp --out 2-hybride.png --size 1536x864 --quality high
```

```text
REFERENCE IMAGE: the input image is ONLY a reference for camera angle, scale of buildings, cozy readability and level of detail. Do NOT reuse its islands, its buildings, its colors or its layout: create an entirely new scene as described below.

SUBJECT: an explorable game map of the French town of Valence (Drôme) in the year 1877, seen from a high three-quarter bird's-eye view, the same camera angle as a cozy top-down adventure game map. Wide 16:9 landscape composition, the whole town readable at phone size.

LAYOUT (west on the left, east on the right):
- LEFT EDGE: the wide Rhône river flowing top to bottom, with a single 1830 suspension bridge crossing it (one tall limestone portal pylon standing in the middle of the river, hanging cables, two long spans). On the far bank, low hills and the ruined medieval castle of Crussol on its rocky ridge.
- Along the river: two-level stone quays, small wooden pontoons, one small paddle steamer, washerwomen kneeling at the water's edge with laundry.
- Steep stone stairways climbing from the riverside up to the old town on its plateau.
- LOWER LEFT, on a terrace above the river: the Champ de Mars, a wide open esplanade with trees, a small simple bandstand on thin cast-iron columns, and a bronze statue of a general on a pedestal.
- LOWER CENTER: the cathedral Saint-Apollinaire, a Romanesque nave of ochre-grey stone with a taller, newer, pale white stone bell tower; wooden scaffolding on part of it. Next to it a small square Renaissance funerary chapel without a roof.
- UPPER LEFT: remains of an old citadel, just one stone tower and a section of wall. Nearby, a Protestant church (temple): a plain classical facade with a bare triangular pediment, a round-arched doorway between pilasters, two round-arched windows and a small round oculus, and NO bell tower.
- CENTER: dense old-town streets of tall narrow houses with tiled roofs, a main commercial street, and a lively market square with stalls, awnings, and one small bookstall table covered in books and pamphlets.
- RIGHT SIDE: new boulevards under construction where the old ramparts were, a few remaining stretches of rampart wall and ditch, a military barracks with cannons in the yard.
- RIGHT EDGE: the railway station, a stone facade with five arched bays between Doric pilasters, a balustrade on top, two lower wings, a small metal canopy, and a steam locomotive with carriages on the tracks.
- A faint dotted path on the ground winds through the town linking the station, the temple, a house, the cathedral, the tower, the esplanade, the market square and the river, like a route on a game map.
- Small ambient figures, tiny and simple: soldiers in 1870s uniforms, market women, boatmen, a mule cart, pigeons, a dog.

TIME AND LIGHT: one late-afternoon light, low and warm, coming from the west over the river. A breeze: laundry and flags flapping in the wind.

STRICT EXCLUSIONS: no text, no letters, no labels, no signs with writing, no compass rose, no UI. No electric lights, no bicycles, no cars, no tramways, no stone bridge, no Eiffel-style metal halls, no modern elements. No people in close-up. No border or frame.

STYLE: match the camera angle, readability, scale of buildings and cozy rounded composition of the reference image (a game map of small islands), but redraw everything as a hand-drawn storybook illustration: scratchy, slightly irregular dark brown ink outlines from a nib pen, gently crooked whimsical architecture, rounded soft masses, trees with curling silhouettes. SEPIA palette only: one family of warm browns and ochres, cream paper for light walls, roads and pages, dark brown-black ink for lines. No other hue at all: no blue water, the river is drawn in pale sepia washes with ink ripple lines. Subtle parchment paper grain, light crosshatching for shadows, a soft vignette. Warm, inviting, clearly readable, like a game world on aged paper.
```

## Passe 2 : la carte jouable, niveau de style léger

Images d’entrée : le résultat de la passe 1, puis `preview.webp` pour la logique de composition. Trois niveaux de style ont été essayés (léger, moyen, fort). Le niveau léger a été retenu.

```bash
codex-imagegen edit --prompt-file passe-2.txt --image 2-hybride.png --image apps/world/public/assets/map/preview.webp --out B1-leger.png --size 1536x864 --quality high
```

```text
INPUT IMAGES:
- Image 1 is our previous illustration of Valence (Drôme) in 1877. Keep its sepia palette, its warm late-afternoon light, its paper texture, its landmarks and their positions (river and suspension bridge on the left, Crussol castle on the far bank, temple and old tower upper-left, market square in the center, cathedral lower-center with the roofless square chapel beside it, esplanade with bandstand and statue lower-left above the quays, railway station upper-right, barracks right).
- Image 2 is the existing map of our game. Use it ONLY for its composition logic and density: a few large, clearly separated landmark areas, each one big and readable, connected by wide empty walkways, with generous open ground around everything. Do NOT copy its islands, its blue water or its colors.

GOAL: redraw Valence 1877 as a WALKABLE GAME MAP in which a small player avatar will walk around. The player must always be visible and must be able to walk between all landmarks.

COMPOSITION:
- Same high three-quarter top-down camera as image 2. 16:9.
- Eight landmark areas, each one a large distinct "zone" with open paved or packed-earth ground in front of it where an avatar can stand: (1) the railway station with a short platform and a locomotive, (2) the Protestant temple (classical facade, triangular pediment, round-arched door, oculus, NO bell tower), (3) a modest family house with a small courtyard, a table under a vine and a lamp in the window, (4) the cathedral with its tall pale stone bell tower and scaffolding, the small roofless Renaissance chapel beside it, (5) one old citadel tower with a piece of wall, (6) the Champ de Mars esplanade with the small cast-iron bandstand and a STANDING bronze statue of a general (not on horseback), (7) the market square with a few stalls and one bookstall covered in books, (8) the river quay with wooden pontoons, a small paddle steamer, laundry drying on lines.
- The suspension bridge with its single limestone pylon in the river stays on the left edge.
- Between zones: a few WIDE, simple, empty streets and plazas. The rest of the old town is suggested by a small number of compact house clusters with tiled roofs at the edges of the zones, NOT hundreds of houses. Roughly a quarter of the image is open walkable ground.
- Buildings are BIG relative to the map, few in number, easy to recognize at phone size.
- A faint dotted path on the ground links the eight zones in this order: station, temple, house, cathedral, tower, esplanade, market, river.
- NO people, NO animals, NO carts: the ground is empty, ambient characters will be added later as separate sprites.

STRICT EXCLUSIONS: no text, no letters, no labels, no compass rose, no UI, no flags with colors. No electric lights, bicycles, cars, tramways, stone bridge, metal market halls or modern elements. No border or frame. Sepia only: no blue water, no green trees, no other hue.

STYLE LEVEL: LIGHT whimsy. Keep the gentle hand-drawn storybook look of image 1, but with bigger rounder simplified masses, cleaner silhouettes, thin dark-brown ink outlines, slightly crooked rooflines only here and there. Cozy, calm and very readable.
```

## Passe 3 : la retouche

Image d’entrée : le résultat de la passe 2.

```bash
codex-imagegen edit --prompt-file passe-3.txt --image B1-leger.png --out C1-final.png --size 1536x864 --quality high
```

```text
EDIT THE INPUT IMAGE. Keep EVERYTHING identical: same camera, same composition, same position and size of every zone, same sepia palette, same paper texture, same light, same line style, same open walkable ground. Change ONLY the following five points:

1. RIVERBANK: replace the big natural rocky cliff on the left (under the old tower, above the bridge) with built terraces: the old town stands on a low plateau above the river, held by tall stone retaining walls with stone stairways climbing up to it, and two levels of stone quays along the water. No raw rock face on the town side. The far bank (Crussol hill and castle) stays as it is.

2. CATHEDRAL BELL TOWER: replace the ornate lantern top with a sober Romanesque square bell-porch tower in pale white stone: square plan, tiers of paired round-arched openings, a low pyramidal stone roof. The scaffolding next to it stays. The rest of the cathedral and the roofless square chapel beside it stay unchanged.

3. MARKET SQUARE: remove the tall column monument in the middle of the market square and leave that spot as open empty paved ground. Keep the stalls and the bookstall.

4. RIGHT EDGE: in the lower-right area, replace a few of the generic houses with the edge of the new boulevards: a short stretch of old rampart wall with a ditch, and part of a plain military barracks building with a yard and two small cannons. Keep it modest and at the edge of the map.

5. DOTTED PATH: remove the dotted path entirely. The walkways stay as plain open ground.

Still: no people, no animals, no carts, no text, no letters, no flags, no frame, sepia only.
```
