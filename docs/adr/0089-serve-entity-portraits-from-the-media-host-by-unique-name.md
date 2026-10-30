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

Each portrait and each stage also has `entity-images/<uniqueName>/<hash>/w512.png`, for the share
images of the atlas (ADR-0081, ADR-0091) only, a stage's for the share image of its card: that image's renderer reads PNG and JPEG, not WebP.
It is transparent like the WebP copies and reduced to a palette by pngquant (about 115 KB). It was
added under the same hash, the build settings unchanged, so no device fetches anything again.

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
loaded. While a portrait loads, the avatar shows only its ground, so a grey face never flashes into
a painted one.

### Cut-out characters and their ground

Amended 2026-10-28. The dusk-blue ground every character was painted on reads well in a dark theme
but makes dark blocks in a light one. Characters, their stages and the placeholders are therefore
published cut out, as WebP with transparency, and the application draws the ground behind every
avatar and portrait card, native screens and Bible DOM alike, as a radial gradient: the dusk blue in
a dark theme; in a light one, the theme's light primary, deepened towards its primary at the centre.
The painted background is not published: a gradient stands in for it. In the Bible DOM, thumbnails
also carry a white contour and a light shadow.

Places keep their painting, which covers the ground, and so does every picture of God, his portrait
and all his stages, and Lucifer, a being of light that leaves nothing to cut out. The catalog does
not say which picture is cut out; a ground behind a painting is simply hidden. A cut-out is 768
pixels wide: its `w1254` copy holds those 768 pixels. The card album (ADR-0090) uses the same
copies.

### Offline

A portrait is cached on the device once displayed: expo-image's disk cache on native screens and on
the web, the web view's HTTP cache in the Bible DOM. Offline, a portrait already seen still shows;
any other shows its placeholder.

On iOS and Android, the reader may also download every portrait ahead, from a card of the Downloads
screen (amended 2026-10-28). The pack holds the 256- and 768-pixel copies of every picture the
catalog names, portraits and stages, about 38 MB for 482 pictures; the 1254-pixel copy stays online.
The copies are stored in the application's documents, one folder per `hash`, and the device keeps
the list of the pictures whose two copies are complete. Once the reader has asked for the pack, it
follows the catalog: each new catalog downloads the pictures it adds and deletes the folders it no
longer names, and a download cut short resumes at the next launch. Removing the pack deletes the
folder.

A picture of the pack is shown from its local file: by expo-image on native screens, and in the
Bible DOM, whose production web view may read the application's files (`allowingReadAccessToURL:
'file://'`, checked on the iOS simulator on 2026-10-28). The development web view, served by Metro
over HTTP, cannot read local files and keeps the media host's addresses. The pack does not exist on
the web, where the browser's cache stands in for it. The pack is not an Offline copy: it has no
Resource identity or revision, and the Resource service knows nothing of it.

### Publication

`yarn resources:entities:images` (Resource Studio) takes a selection file mapping each `uniqueName`,
and each `<uniqueName>#<stage>`, to its validated original, and a data file giving the titles, the
stages with their chapters, the series and the roles. It writes the three copies, uploads and checks
them through the operator's wrangler session, and only then uploads the new catalog. The selection
also maps each `placeholder:<avatarKey>:<n>` to its original, from which `placeholders` writes the
bundled files and the site's copies, a WebP and a PNG of each, in `apps/site/public/atlas/clay/`. It never deletes an earlier version, so a device holding an older catalog still
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
