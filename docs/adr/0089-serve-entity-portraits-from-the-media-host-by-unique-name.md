# ADR-0089: Serve the portraits of biblical entities from the media host by unique name

## Status

Accepted.

## Context

Every biblical entity is drawn today with one of eleven bundled pictures chosen from its avatar key
(`strongEntityAvatars.ts`): the entity card (40 and 48 points), the relation graph (54 and 76 points)
and the chapter introduction of the Bible DOM (62 pixels).

Painted pictures now exist for part of the entities, measured on 2026-10-27:

- 318 persons and supernatural beings and 120 places have a portrait, out of 4,232 entities, and 22
  of them have 44 stages or manifestations;
- 23 placeholders in grey clay stand in for the others: five each for men, women and groups, so that
  neighbours in a chapter differ, and one for each of the eight other avatar keys;
- an original is a 1254-pixel PNG; a 256-pixel WebP at quality 80 weighs about 9 KB, a 768-pixel
  one about 46 KB.

The choice of a portrait may change after publication, and portraits will keep being added. That
choice is artwork, not editorial data: it must not wait for a Resource publication or an
application build, and the entity data should not have to name it.

The public media bucket of ADR-0080 already serves the pictures of the timeline at
`https://media.bible-strong.app`, without the Resource API in between.

## Decision

### Where and in which sizes

Store each portrait in the media bucket, under `entity-images/`, in three WebP copies made in advance:

| Key | Used for |
| --- | --- |
| `entity-images/<uniqueName>/<hash>/w256.webp` | every avatar (76 points at 3x is 228 pixels) |
| `entity-images/<uniqueName>/<hash>/w768.webp` | an enlarged portrait, a card |
| `entity-images/<uniqueName>/<hash>/w1254.webp` | the full painting: a place behind a page, a large card on a tablet |

The third size is the original's own width, about 110 KB a copy, and is decided now: adding
a width later would change every hash and make every device fetch every portrait again.

`uniqueName` is the entity's durable identity (ADR-0016); the address percent-encodes it. `hash` is
a short hash of the original's bytes and of the build settings, so a changed portrait gets a new
address. These objects are immutable and cached for a year
(`public, max-age=31536000, immutable`). No size is computed on request: Cloudflare Images is not
used.

### How the application learns which entities have one

One file, `entity-images/catalog.json`, says everything the application knows of the portraits. It
is the only mutable object of the folder, cached for an hour at the edge:

- `entities` maps each `uniqueName` that has a portrait to its current `hash`, and, when it has them,
  the portrait's title (« Le berger de Bethléhem »), its roles and its stages;
- a stage is the same entity at another moment of its life (David « Le chef en fuite »), or, for God,
  one of his manifestations (« Le buisson ardent »): a key, a title, its own `hash`, stored under the
  entity's folder like the portrait, and the chapters it covers, as ranges `{book, from, to}` with
  `book` the application's book number (1 to 66) and, when two pictures share a chapter,
  `fromVerse` and `toVerse`;
- `series` lists the closed, ordered series of the card album (ADR-0090), every member included,
  painted or not, and `roles` names the roles;
- every text it holds, titles, stages, series and roles, is given in each language of the
  application, as `{fr, en}`; the application shows the one of its current language.

In a chapter that one of an entity's stages covers, the application shows that stage; everywhere
else, the portrait. At the level of a whole chapter, a stage that starts after its first verse does
not apply. No two stages of one entity share a chapter.

The application fetches the catalog the first time a launch draws an entity, when its copy is more
than a day old, and keeps the last copy on the device. An entity absent from that copy has no
portrait: the application shows its placeholder without a request. Until a first catalog has
arrived, every entity shows its placeholder. The entity data, the Resource API and the Offline
copies know nothing of portraits.

### Placeholders

The 23 placeholders are bundled, as 256-pixel WebP files `entity-avatars/<avatarKey>-<n>.webp`
replacing the eleven PNG files. An entity's placeholder is chosen from its avatar key and a stable
hash of its `uniqueName`, modulo the number of placeholders of that key, by one function shared by the native screens and the Bible
DOM, so an entity keeps the same face everywhere.

A placeholder is shown for an entity without a portrait, and for an entity whose portrait cannot be
loaded. While a portrait loads, the avatar shows its empty disc, so a grey face never flashes into a
painted one.

### Offline

A portrait is cached on the device once displayed: expo-image's disk cache on native screens and on
the web, the web view's HTTP cache in the Bible DOM. Nothing is downloaded ahead. Offline, a portrait
already seen still shows; any other shows its placeholder. The 768-pixel copy is fetched only when an
enlarged portrait is opened.

### Publication

`yarn resources:entities:images` (Resource Studio) takes a selection file mapping each `uniqueName`,
and each `<uniqueName>#<stage>`, to its validated original, and a data file giving the titles, the
stages with their chapters, the series and the roles. It writes the three copies, uploads and checks
them through the operator's wrangler session, and only then uploads the new catalog. The selection
also maps each `placeholder:<avatarKey>:<n>` to its original, from which `placeholders` writes the
bundled files. It never deletes an earlier version, so a device holding an older catalog still
finds its pictures. Removing an entity from the selection returns it to its placeholder. Nothing of
it runs in CI and no portrait is committed; the originals and the data file are produced outside
the repository, from the portraits' working folder.

## Consequences

- A portrait is added, replaced or withdrawn by running one command, without a Resource publication,
  an application build or an update.
- Ninety per cent of entities never cause a request.
- The catalog grows with each portrait and stage, about 37 KB for 438 portraits, 44 stages and 13 series.
- A device that has not been online since a portrait was added keeps the placeholder until its next
  catalog.
- Old versions accumulate in the bucket; at about 175 KB per version this needs no cleanup for now.
- A new placeholder set is an application change, shipped with a build.
- The media bucket is public; portraits, like the timeline pictures, may be used by the public site
  from the same addresses.
- The web application reads the catalog across origins: the media bucket needs a CORS rule allowing
  `GET` from the web application's origins before the first catalog is published. Images need none.
- Whether the Bible DOM web view on Android caches these images across launches must be checked on
  a device. The percent-encoded `@` reaches the right R2 keys (checked on 2026-10-28); no painted
  entity has a `'` in its unique name yet.
- A new language of the application needs every text of the catalog in that language before the
  catalog can be published again.
