# ADR-0093: Move between the pages of the site inside the document

## Status

Accepted (2026-10-30).

## Context

The public site is rendered by TanStack Start (ADR-0083), yet its pages linked to each other with
plain `<a href>`: 134 links for one `Link` of the router. Every click threw the document away and
loaded the next one, header included. The reader saw the page cut to the next, with nothing shown
while it loaded, and the scripts of the site were started again on every page.

Measured on 2026-10-30, the change of page was a clean cut in Chrome and in Safari on iOS: no blank
frame, no change of font. The flicker the owner sees in Arc was not reproduced. This decision does
not rest on it: moving inside the document is how the framework is meant to be used.

## Decision

### Links

A link inside the site is a `Link` of the router, through `SiteLink`, which takes the address the
pages already build. A link that leaves the site, or an anchor of the page, stays a plain link. The
HTML a crawler reads is unchanged: the links of the pages compared before and after are the same.

The links written in a published text are plain HTML. A listener at the root of the document gives
their clicks to the router. The cards of the gallery stay plain links too: they open over the page
by themselves, and 360 `Link` would follow every move of the router for nothing.

A page reached with other parameters starts anew (`defaultRemountDeps`), as a loaded document did:
no state of the previous chapter stays in the next one.

### The fade

A change of page goes through a view transition of 180 milliseconds, with the header of the resources
left in place. The router decides it (`defaultViewTransition`): a change of parameters or a card
opening over the gallery does not fade, since Motion carries the card. The reveal of the theme uses
the same browser feature and keeps its own rules. A browser without view transitions cuts to the
page, and a reader asking for reduced motion gets no animation.

While the next page loads the current one stays on screen, and after 200 milliseconds a thin line at
the top of the window says so. The language of the interface follows the page on screen, not the
address being loaded.

### The reads

A move inside the document does not reach the page cache (ADR-0084): the route asks a server
function for its data. Those reads are GET requests under the same key as a page, so they are kept
like the page they fill, for a month, or a minute when incomplete or STALE (`keptLikeAPage`). What is
the reader's own, the theme and a study, stays unkept.

The address of a read says nothing of its page, so refreshing any folder of pages also refreshes
every read (`path:_serverFn`).

### A page that fails

A tab older than the last deployment asks for scripts that are gone, where a loaded document never
could. A page that fails is loaded whole, once, before the error is shown.

## Consequences

- Moving between pages takes a read of the data and of the code of the next page. Both start when
  the pointer comes near the link (`defaultPreload: 'intent'`).
- More requests reach the CDN, one or more for each link hovered, nearly all answered from its cache.
- A page must clean up what it starts: a listener on `window`, a style on `<html>`, an animation. It
  no longer ends with the document.
- A `<script>` written in a page runs only when the page is loaded, not when it is reached by a link.
- Main-thread time at load grew by about 20 ms on a processor slowed four times, for pages of 100 to
  270 links.
