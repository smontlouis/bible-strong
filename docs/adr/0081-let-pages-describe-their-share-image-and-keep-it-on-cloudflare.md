# ADR-0081: Let each page describe its share image, draw it on the site and keep it on Cloudflare

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

**A page describes its own image.** Each head builder passes a `ShareCardContent` to
`shareCardMeta`, which writes it in a `bible-strong:share-card` meta element and names the image at
`https://cards.bible-strong.app/v1/<path of the page>`. A page that says nothing gets the default
card. An image can therefore only show what a page of the site shows: no address makes the service
write arbitrary text.

**The site draws.** `/share-card/<path>` fetches its own page, reads that element, lays the card out
with satori and rasterises it with resvg (WebAssembly), from the fonts and the module of its own
`/fonts/` and `/wasm/` folders. Flat cards are PNG; cards with photographs are JPEG. Readers never
call this route.

**Cloudflare keeps.** The share card service (`packages/share-card-service`) is a small Worker in
front of the media bucket. It serves a stored image as it is; it asks the site for a missing one,
stores it and serves it; past seven days it serves the stored one and has it drawn again in the
background. An address that is no page has no image, and a failure of the site is never stored.

**A new design is a new address.** `SHARE_CARD_DESIGN` (`v1`) is part of every image address and of
every storage key. Raising it gives every page a new image, which is the only way to reach the
networks that kept the old one.

## Consequences

- An image is drawn once and outlives the deployments of the site. A broken drawing leaves every
  stored image in place.
- A corrected text reaches its image within a week, without a purge.
- The Worker is deployed by hand from `master`, like the Resource API. It has no dependency.
- The site commits the rasteriser module (2.4 MB) and two fonts for Greek and Hebrew, since its
  Literata has neither script.
- Timeline cards read the original of a picture: the rasteriser does not read WebP. A JPEG copy
  made for cards would be lighter.
- Old designs stay in the bucket under their prefix until someone removes them.
