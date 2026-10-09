# ADR-0081: Let each page sign its share image into an address, draw it on the site and keep it on Cloudflare

## Status

Accepted. Builds on the share cards of the design system (`design-system/project/components/ShareCard…`)
and on the media bucket of [ADR-0080](./0080-serve-timeline-pictures-from-our-own-media-host.md).

## Context

Every public page shared the same 2019 banner, named under a relative address and announced as a
small thumbnail. The application shares links to the site for verses, Strong entries, commentaries,
dictionaries and topics, so every share showed that banner.

A share image is fetched by a network once and kept by it for weeks; the image of a verse does not
change for months. The site runs as one function on Vercel, whose CDN is emptied by every
deployment: an image kept only there would be drawn again after each one, and a deployment that
broke the drawing would take every image with it.

Three ways of drawing were tried on 2026-10-09:

- on the site, with a native rasteriser: works locally; the native binary has to be traced into
  the function by the bundler, which could not be checked without deploying;
- in a Cloudflare Worker: the layout library shapes Hebrew through HarfBuzz, whose loader cannot
  start in a Worker (it expects a browser location and compiles WebAssembly at run time); making
  it start meant patching `WebAssembly` and `fetch` globally around a dependency;
- on the site, with the WebAssembly rasteriser read from the site's own static files: works, and
  nothing of it is bundled.

## Decision

**A page describes its own image, in the address of that image.** Each head builder passes a
`ShareCardContent` to `shareCardMeta`, which signs it with the site's secret and names the image at
`https://cards.bible-strong.app/v1/<description>.<signature>`. A page that says nothing gets the
default card, at `/v1`. The image is drawn from its address alone: nothing is read back, from the
page or from the Resource API, and no address makes the drawing write a text the site did not sign.

A first version wrote the description in a meta element and had the drawing fetch the page to read
it. Measured on Vercel on 2026-10-09, that read took 0.2 to 0.6 s when the page was in the CDN of
the function's region and up to 10 s when it was not, on a fresh deployment. The drawing itself is
steady; what it waited for was not.

**The site draws.** `/share-card/<description>.<signature>` checks the signature, lays the card out
with satori and rasterises it with resvg (WebAssembly), from the fonts and the module of its own
`/fonts/` and `/wasm/` folders. Flat cards are PNG; cards with photographs are JPEG. Readers never
call this route. The native rasteriser was tried: the server bundler reads its binary as code and
the build fails.

**Cloudflare keeps.** The share card service (`packages/share-card-service`) is a small Worker in
front of the media bucket. It serves a stored image; it asks the site for a missing one, stores it
and serves it, carrying the drawing to its end even when the asker stops waiting. An image is kept
under a digest of its description and never changes. A failure of the site is never stored.

**A new text, or a new design, is a new address.** A page whose content changes signs another
description, hence names another image. `SHARE_CARD_DESIGN` (`v1`) is part of every address, of
every signature and of every storage key: raising it gives every page a new image, which is the
only way to reach the networks that kept the old one.

**The secret is `SHARE_CARD_SECRET`**, set on the site's server. Head builders also run in the
browser, where it is absent and not needed. A site without it names the default card everywhere.

## Consequences

- An image is drawn once and outlives the deployments of the site. A broken drawing leaves every
  stored image in place.
- A corrected text reaches its image the next time its page is rendered, without a purge and
  without a schedule.
- Changing the secret gives every page a new address and makes every earlier address unanswerable
  for images not yet stored; stored ones stay served.
- An address is as long as what it describes: 250 to 500 characters for most cards, close to 1,000
  for the timeline, whose card names six pictures.
- The Worker is deployed by hand from `master`, like the Resource API. It has no dependency.
- The site commits the rasteriser module (2.4 MB) and two fonts for Greek and Hebrew, since its
  Literata has neither script.
- Timeline cards read the original of a picture: the rasteriser does not read WebP. A JPEG copy
  made for cards would be lighter.
- Images of old texts and old designs stay in the bucket until someone removes them.
