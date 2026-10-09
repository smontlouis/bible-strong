# ADR-0080: Serve the pictures of the timeline from our own media host

## Status

Accepted.

## Context

The events of the timeline name picture files; they do not carry them. The site and the application
loaded each picture from the timeline's publisher, `timeline.biblehistory.com`: the site over HTTPS,
the application over plain HTTP, with an App Transport Security exception declared for that host.

Measured on 2026-10-09:

- 625 events name 1,172 distinct pictures, about 135 MB in all;
- the publisher answers a picture in about one second, with no caching header, from files last
  changed in 2014;
- its only small copy is 100 by 80 pixels, too small for a card on a dense screen or for a share
  image.

A publisher that closes would take every picture of the timeline with it, in the site and in every
installed application. The share images of the site (design system, `ShareCardTimeline`) need a
picture they can fetch quickly and reliably.

The only storage we had, the Resource artifacts bucket, is private: it holds Offline copies behind
application attestation and must stay so.

## Decision

Keep a copy of every picture in a second, public bucket, `bible-strong-media-prod`, served by
Cloudflare at `https://media.bible-strong.app`, without the Resource API in between. A picture is not
an editorial read: it needs no attestation, no revision and no Worker.

Each picture is stored three times under `timeline-images/`, under the file name the events know:

| Key | What |
| --- | --- |
| `original/<file>` | the publisher's file, unchanged |
| `w1200/<file>.webp` | WebP, 1200 pixels wide at most |
| `w480/<file>.webp` | WebP, 480 pixels wide at most |

A copy is never wider than its original. Objects are immutable and cached for a year: a picture that
changes gets a new name, as it does at the publisher.

`yarn resources:timeline:images` (Resource Studio) makes the copies: `fetch` downloads what the
events name, one request at a time, and stops at the first answer that is not a picture; `build`
writes the WebP copies; `upload` puts them in the bucket through the operator's wrangler session.
Nothing of it runs in CI and no picture is committed.

The site and the application build their addresses from the file name: `w480` for a card, `w1200`
for an event page, a detail view and a share image.

## Consequences

- The site and the application no longer depend on the publisher being up, fast or served over
  HTTPS. The application's App Transport Security exception can be removed once no installed build
  needs it.
- Application versions released before this change keep loading from the publisher.
- A picture added to the timeline must be copied before the event that names it is published;
  `fetch` reports what the publisher no longer has.
- The media bucket is public by design. Nothing private may ever be put in it.
- Captions and credits stay in the events, where they were.
