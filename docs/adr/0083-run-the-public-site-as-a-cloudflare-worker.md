# ADR-0083: Run the public site as a Cloudflare Worker

## Status

Accepted. Replaces the hosting of [ADR-0068](./0068-serve-indexable-resource-pages-from-the-public-site.md)
and where the share images of [ADR-0081](./0081-sign-share-images-into-their-address-and-keep-them-on-cloudflare.md)
are drawn; the addresses, the pages and the images themselves do not change.

## Context

The site ran as one function on Vercel. Two days after its resource pages were announced to search
engines it had answered 1.88 million requests, 83 % of them from crawlers, and 94 % of them for a
page nobody had asked for before, so that no cache could answer. Vercel bills such a function for
the whole time it is open, multiplied by the memory it is given, and bills the transfer apart: the
two days cost 31 dollars, most of it for time the function spent waiting for the Resource API.

Measured on Cloudflare on 11 October 2026, a page takes 5 to 70 milliseconds of computing for 200
to 700 milliseconds of waiting. A Worker is billed for the computing only, and the Resource API,
the media and the share images are already there.

## Decision

The site is a Worker, `bible-strong-site`, built with the Cloudflare plugin of Vite and deployed by
Cloudflare from `master`.

- Public files are answered by Cloudflare without running the Worker.
- The Worker keeps the pages it renders, in the cache of the data centre it runs in, for the
  `s-maxage` each page answers with. The key carries the deployment, since a page names the files
  of the build that rendered it. Cloudflare does not keep the answers of a Worker by itself.
- The Worker asks the Resource API through a binding, without leaving Cloudflare, and gives it
  the address of the reader the page is rendered for, which the API counts requests by.
- The Worker draws the share images itself; the share card service asks it through a binding.

A Worker may not compile WebAssembly while it runs, nor start a timer while it loads. Two
libraries do:

- the layout library of the share images carries HarfBuzz as text and compiles it, and a small
  module per callback, when it starts. Its standalone build is rewritten as it is bundled
  (`apps/site/bundling/satoriForWorkers.ts`) to start modules compiled at build time instead. The
  rewriting names the exact code it replaces and fails the build when a release moves it; the
  version of the library is pinned;
- the animation library of the home page starts a timer when loaded. The server is given an
  empty stand-in: every animation runs from an effect, which only the browser runs.

## Consequences

- The cost follows the computing: at 25 million requests a month, about 20 dollars, against
  several hundred on the previous host. Crawlers are not turned away.
- A page is kept per data centre, not for the whole network, and never served stale while it is
  rendered again: a reader far from the last one meets a first render more often than before. A
  warm-up fills the data centre nearest to the machine that runs it.
- Updating the layout library is a deliberate act: the rewriting must still find its three
  places, and the cards must be looked at again.
- A share image takes about half a second of computing, a second with a photograph, against the
  ten seconds a request may use; the image of an event with a very large picture could be refused.
- Preview deployments exist per version of the Worker rather than per pull request.
- The signing secret of the share images is new on Cloudflare: every page names a new image
  address, drawn again on first request. The images kept under the old addresses stay unused.
- The legal notice and the privacy policy name Cloudflare as the host.
