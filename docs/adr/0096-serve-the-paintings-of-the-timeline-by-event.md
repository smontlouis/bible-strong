# ADR-0096: Serve the paintings of the timeline by event from the media host

## Status

Accepted.

## Context

Every event of the timeline and every period now has a painting of its own, measured on 2026-11-02:

- 625 events and 13 periods, each original a 1254-pixel square PNG;
- a 256-pixel WebP at quality 80 weighs about 13 KB, a 768-pixel one about 66 KB, a 1254-pixel one
  about 136 KB.

The pictures of an event reach a reader by four roads today:

- the drawn timeline of the application shows the publisher's 2013 thumbnail, over plain HTTP, from
  an address written in the bundled `events.txt`;
- the event page, the search and the site build an address from the file names of the Timeline
  resource, at the 480 and 1200 pixels of ADR-0080;
- a share image takes the original JPEG, since its renderer reads no WebP;
- the images of the periods are bundled in the application and in the site.

A painting is artwork, not editorial data, as ADR-0089 says of the portraits: replacing one must not
wait for a Resource publication or an application build. The two widths of ADR-0080 are also too few:
the drawn timeline needs far less than 480 pixels and the event page more than 1200 on a tablet.

Most pictures of the publication are later art that a painting now replaces. Some are real documents:
an artefact, a map, a photograph of a place, a portrait made in the person's lifetime.

## Decision

Treat the paintings as the portraits of ADR-0089 are treated: copies made in advance, on the public
media bucket, and one catalog saying which exist. Paintings have no Offline form.

### Where and in which sizes

| Key | Used for |
| --- | --- |
| `timeline-paintings/<slug>/<hash>/w256.webp` | the drawn timeline, the search |
| `timeline-paintings/<slug>/<hash>/w768.webp` | a card, the head of an event, the chronology of an entity |
| `timeline-paintings/<slug>/<hash>/w1254.webp` | the whole painting: the pictures of an event, a tablet |
| `timeline-paintings/<slug>/<hash>/w768.jpg` | the share image of an event only |

`slug` is the event's durable identity in the publication. `hash` is a short hash of the original's
bytes and of the build settings. These objects are immutable and cached for a year.

### The catalog

`timeline-paintings/catalog.json` is the only mutable object of the folder, cached for an hour at the
edge:

```json
{
  "version": 1,
  "events": {
    "isaac": { "hash": "0123456789ab", "documents": ["Isaac's Tomb_5-13-2013 5-24-47 PM.jpg"] }
  }
}
```

`documents` lists the files of the publication to keep beside the painting. The Timeline resource is
unchanged: it still names every file, and only the catalog decides which are shown. An event absent
from the catalog keeps the pictures of the publication.

### What a reader sees

An event of the catalog shows its painting everywhere, then its documents in the order the publication
gives them. The other pictures of the publication are no longer shown by a version that reads the
catalog, and stay in the bucket for those that do not.

The application fetches the catalog the first time a launch needs it, when its copy is more than a day
old, and keeps the last copy on the device. Until a first catalog has arrived or failed, an event
shows no picture rather than flashing the old one. If it fails, the event keeps the publication's
picture. The site reads the catalog on the server and keeps it for an hour.

A share image takes the JPEG copy. Periods stay bundled in the application and the site, as 768-pixel
square JPEG files under the same names: they are the first thing the timeline draws, and thirteen
files do not need a catalog.

### Publication

`yarn resources:timeline:paintings` (Resource Studio) takes a selection file mapping each slug to its
original and documents. It writes the copies, uploads and checks them through the operator's wrangler
session, and only then uploads the catalog. It never deletes an earlier version. `periods` writes the
bundled files of the application and the site. Nothing of it runs in CI and no painting is committed; the originals and the selection
are produced outside the repository, from the portraits' working folder.

## Consequences

- A painting is added or replaced by one command, without a Resource publication, a build or an update.
- Versions of the application released before this change, 27.x and 28.0, keep the publication's
  pictures until they are updated, and the publisher's thumbnail on the drawn timeline.
- The public pages keep the catalog they were rendered with: a painting replaced later reaches them
  once their folders are refreshed (`yarn cache:invalidate --site /timeline`, and `/atlas`).
- A new image of a period is shipped with an application build and a deployment of the site.
- The bucket holds about 195 MB more; old versions accumulate as ADR-0089 accepts for portraits.
- ADR-0080 still holds for the documents and for earlier versions of the application: its copies are
  never deleted.
- The pictures the catalog hides remain listed by the Timeline resource and its public API.
