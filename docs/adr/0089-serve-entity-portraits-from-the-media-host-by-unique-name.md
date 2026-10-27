# ADR-0089: Serve the portraits of biblical entities from the media host by unique name

## Status

Accepted.

## Context

Every biblical entity is drawn today with one of eleven bundled pictures chosen from its avatar key
(`strongEntityAvatars.ts`): the entity card (40 and 48 points), the relation graph (54 and 76 points)
and the chapter introduction of the Bible DOM (62 pixels).

Painted pictures now exist for part of the entities, measured on 2026-10-27:

- about 300 persons and supernatural beings and 120 places have a portrait, out of 4,232 entities;
- 55 placeholders in grey clay, five per avatar key, stand in for the others;
- an original is a 1254-pixel PNG; a 256-pixel WebP at quality 80 weighs about 9 KB, a 768-pixel
  one about 46 KB.

The choice of a portrait may change after publication, and portraits will keep being added. That
choice is artwork, not editorial data: it must not wait for a Resource publication or an
application build, and the entity data should not have to name it.

The public media bucket of ADR-0080 already serves the pictures of the timeline at
`https://media.bible-strong.app`, without the Resource API in between.

## Decision

### Where and in which sizes

Store each portrait in the media bucket, under `entity-images/`, in two WebP copies made in advance:

| Key | Used for |
| --- | --- |
| `entity-images/<uniqueName>/<hash>/w256.webp` | every avatar (76 points at 3x is 228 pixels) |
| `entity-images/<uniqueName>/<hash>/w768.webp` | an enlarged portrait, and larger uses to come |

`uniqueName` is the entity's durable identity (ADR-0016); the address percent-encodes it. `hash` is
a short hash of the original's bytes and of the build settings, so a changed portrait gets a new
address. These objects are immutable and cached for a year
(`public, max-age=31536000, immutable`). No size is computed on request: Cloudflare Images is not
used.

### How the application learns which entities have one

One file, `entity-images/manifest.json`, maps each `uniqueName` that has a portrait to its current
`hash`. It is the only mutable object of the folder, cached for an hour at the edge.

The application fetches it at launch when its copy is more than a day old and keeps the last copy on
the device. An entity absent from that copy has no portrait: the application shows its placeholder
without a request. Until a first manifest has arrived, every entity shows its placeholder. The
entity data, the Resource API and the Offline copies know nothing of portraits.

### Placeholders

The 55 placeholders are bundled, as 256-pixel WebP files `entity-avatars/<avatarKey>-<n>.webp`
replacing the eleven PNG files. An entity's placeholder is chosen from its avatar key and a stable
hash of its `uniqueName`, modulo five, by one function shared by the native screens and the Bible
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

`yarn resources:entities:images` (Resource Studio) takes the validated selection, one original per
`uniqueName`, writes both copies, uploads and checks them through the operator's wrangler session,
and only then uploads the new manifest. It never deletes an earlier version, so a device holding an
older manifest still finds its pictures. Removing an entity from the manifest returns it to its
placeholder. Nothing of it runs in CI and no portrait is committed; the originals stay outside the
repository.

## Consequences

- A portrait is added, replaced or withdrawn by running one command, without a Resource publication,
  an application build or an update.
- Ninety per cent of entities never cause a request.
- The manifest grows by one line per portrait, about 15 KB for 420 portraits.
- A device that has not been online since a portrait was added keeps the placeholder until its next
  manifest.
- Old versions accumulate in the bucket; at about 55 KB per version this needs no cleanup for now.
- A new placeholder set is an application change, shipped with a build.
- The media bucket is public; portraits, like the timeline pictures, may be used by the public site
  from the same addresses.
- Whether the Bible DOM web view on Android caches these images across launches, and whether the
  percent-encoded `@` and `'` of some unique names reach the right R2 keys, must be checked on a
  device when this is implemented.
