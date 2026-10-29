# ADR-0091: Publish an atlas of biblical entities on the public site

## Status

Accepted.

## Context

The entity publication holds 4,232 biblical entities, measured on 2026-10-29: 3,040 persons, 1,014
places (1,011 with coordinates), 77 groups and about a hundred others (supernatural beings, idols,
times, titles), with 9,458 relations and 34,363 verse references. The Resource service imports it
into Neon (`strong_lexicon_entities` and its tables) and the application reads it as the entity
module of the Strong lexicon. The public site shows none of it.

Since ADR-0089 and ADR-0090 the entities also have pictures and cards: 318 persons and supernatural
beings and 120 places are painted, 22 characters have life stages, the others take one of 23 clay
figures, and the portrait catalog and the card catalog live on the media host, outside the
publication.

A prototype of a public atlas was built from these files as a static page whose data is one
script and whose views are reached through `#/` addresses. Nothing in it can be indexed, and it
lives outside `bible-strong.app`.

## Decision

### A public section

The atlas is a public section of `apps/site`, like the lexicon, the dictionaries or the timeline
(ADR-0068): server-rendered pages, in French and in English, kept by the page cache in front of the
Worker (ADR-0084), listed in the sitemaps, with a share image. Their « Open in the app » leads to
the entity in the web workspace; the installed application opens them (ADR-0082) once it has a
route for `/atlas/`, which it does not have yet.

| Route | Page |
| --- | --- |
| `/atlas/:language` | the entry of the atlas: its families, the painted characters by series, the map of places |
| `/atlas/:language/people`, `/places`, `/groups`, `/beings`, `/others` | every entity of a family, the painted ones first; `beings` are God, angels, Satan and the gods of the nations, `others` the times, titles, languages, stars and words |
| `/atlas/:language/:uniqueName` | one entity |

An entity's address is its `uniqueName` (ADR-0016), percent-encoded where it must be: six names
hold an apostrophe. Every unique name holds `@`, so it never meets the words of the other routes.
A readable slug was considered and refused: names repeat (29 Zechariahs, 26 Shemaiahs), and a slug would
need a table of its own that the publication does not keep.

### Where each part comes from

- **The entity** comes from the Resource API. `/v1/strong-lexicon/entities/:uniqueName` already
  gives its name, descriptions, article, place and relations. Two reads are added:
  `/v1/strong-lexicon/entities` lists every entity of the publication with what a list needs (name,
  family, type, short description, number of chapters, coordinates of a place), and
  `/v1/strong-lexicon/entities/:uniqueName/passages` gives the chapters and verses where an entity
  is named.
- **The portraits and stages** come from `entity-images/catalog.json` on the media host (ADR-0089).
- **The cards** come from `entity-cards/catalog.json` on the media host (ADR-0090): a card names its
  picture by its entity and stage, read in the portrait catalog, and its backdrop by a key whose
  hash the card catalog gives. Until it is published, the pages show no card.
- **The clay figures** are copies of the application's 23 placeholders, served by the site and
  chosen as the application chooses them, so an entity wears the same figure everywhere.

The site reads the two catalogs and the list of entities once an hour per server instance; a card
catalog not yet published is asked for again after five minutes. A page whose catalog could not be
read is shown without it and kept a minute only, like any page missing a part.

### How an entity is shown

A character is cut out over the ground the application draws (ADR-0089); a place, God and Lucifer
keep their painting. An entity's cards stand under its portrait as the application draws them: one
layout, the palette of their family, the foil of their finish, tilting under the pointer, coming
forward when touched and turning over when touched again. The entity page opens on its picture and its name, then gives its stages and
cards, its description, its relations as links to their own pages, its Strong numbers as links to
the lexicon, and the chapters that name it as links to the Bible. A place also shows where it lies.

The pages are designed as the timeline's: a showcase of the product, not a column of text with a
list under it. They take their values from the design system and its two themes.

### The map, in the application too

The map of the places is one drawing for the site and the application. The projection, the windows
a map opens on and the rule that places names (from the place in focus and the most named down,
none covering another or a painting) live in `@bible-strong/resource-domain/biblical-map`. The
ground is drawn once from Natural Earth by `apps/site/scripts/build-atlas-map.py`, as an SVG for the
site and as path strings in `packages/biblical-map`.

The map travelled with the fingers is one React component for the web, `@bible-strong/biblical-map`:
the site renders it, and the application shows it in a DOM component (`'use dom'`), so it is
delivered by an over-the-air update. It redraws its view on every move, which a browser does within
a frame, and keeps its names and marks at their size; a lifted finger lets it glide and slow down,
as a scroll view does. A first version drew it with react-native-svg, moving the drawing as a
picture during a gesture and drawing it again when the fingers lifted: drawing a thousand places
took up to two seconds, the edges stayed blank while zooming out, names grew with the picture, and
the map had no glide. The still map on a place's page stays drawn with react-native-svg.

The package holds no copy of React: Vite dedupes it on the site and Metro finds the application's.
It carries React's types only, for the application's type check; the site's `tsconfig.json` points
`react` at its own types. The application's must not: Expo resolves modules through those paths, and
`react` would then lead Metro to a package of types.

In the application:

- the page of a place shows where it lies, with its neighbours, and opens the map of every place;
- that map moves under the fingers and zooms with them; a place touched opens its page;
- the end of a chapter that names places opens the same map with those places brought forward.

The places come from the entity module on the device once it is downloaded, from the list of the
Resource API otherwise: the map works offline, with no tiles and no map service.

## Consequences

- About 8,500 new indexable pages. Their first visit by crawlers reads Neon; later ones are
  answered by the page cache.
- What the entity data says of minor persons, relations of low certainty included, becomes public
  and indexed as it is.
- A portrait, a stage or a card published later reaches the server within the hour, with no
  deployment; the pages already kept by the page cache show it once the `/atlas` folder is
  rendered again (`yarn cache:invalidate --site /atlas`).
- The clay figures exist twice, in the application and on the site; a new figure is copied to both.
- The prototype is no longer the public atlas: it stays a design reference.
- The map is drawn from Natural Earth by `apps/site/scripts/build-atlas-map.py`, without tiles
  or a map service; a place outside the region it covers (Tarshish, India) is listed but not drawn.
- On a development machine the site asks the deployed Resource API through its binding; a local
  API is asked directly, so new reads can be tried before the API is deployed. `ENTITY_CARD_BASE_URL`
  likewise points the site at a local build of the card catalog.
- The card mechanics and the « V » bands follow pokemon-cards-css by Simon Goellner, as the cards
  prototype did; that project is under the GPL-3.0, which the site's own code is not.
