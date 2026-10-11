# ADR-0082: Open the public pages of a resource in the installed application

## Status

Accepted. Builds on the public pages of [ADR-0068](./0068-serve-indexable-resource-pages-from-the-public-site.md)
and on the share images of [ADR-0081](./0081-sign-share-images-into-their-address-and-keep-them-on-cloudflare.md).

## Context

The application shares the address of a public page. Whoever receives it and has the application
was sent to the browser all the same: the application has declared `bible-strong.app` as its domain
on iOS and Android since January 2026, but the site never published the two documents that let
each system trust that declaration.

The site and the application do not have the same pages. The application has a screen for a
chapter, a Strong entry, a dictionary entry, a topic, a commentary on a chapter and the timeline.
It has none for the lists and indexes of the site, its home page, its legal pages or a shared
study. On Android, the builds already installed claim every path of the domain.

## Decision

The site publishes `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`,
from `apps/site/features/appLinks`. A link to a resource the application has a screen for opens
that screen; every other page stays in the browser.

- iOS reads the list of paths from the site. It names the resources and leaves out the lists and
  indexes that share their prefix.
- Android reads no path from the site: the application declares the families it opens
  (`/bible/`, `/strong/`, `/dictionary/`, `/nave/`, `/commentary/`, `/timeline/`). The document
  names the key Google Play signs with and the key builds are signed with before it.
- The application reads every link the system hands over in one place
  (`apps/expo/src/navigation/systemLinks.ts`, called from `app/+native-intent.ts`). A page it has
  a screen for opens there. A Strong entry is read in the language of the reader's lexicon,
  whatever language the link names. A page it has no screen for is shown as the site draws it, in
  a screen of the application, so that no link ends on a missing screen.

## Consequences

- The documents take effect on the applications already installed, without an update. On Android
  those builds claim the whole domain until a build carrying the narrower declaration replaces
  them: until then the home page, the legal pages and shared studies open in the application, in
  the screen that shows a page of the site.
- The list of paths exists twice, once on the site for iOS and once in the application. They
  cannot share a module across the two contexts; each has tests over the same examples, and a
  disagreement only sends a page to the screen that shows the site.
- Each system keeps its own copy of the documents for a day or more: a change to the list of
  paths is not seen at once, and a wrong certificate silently turns the links back into plain
  web links.
- A link typed in the address bar, or followed inside the same site in a browser, does not open
  the application: both systems only hand over links followed from elsewhere.
