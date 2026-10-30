# ADR-0092: Browse every card and open packs on the public atlas

## Status

Accepted (2026-10-30).

## Context

The atlas of the public site (ADR-0091) shows a character's cards (ADR-0090) on that character's
page only: a card is found by someone already looking for its character. The 362 cards (318
characters and 44 life stages, measured on 2026-10-30) are gathered nowhere.

The owner wants every card in one place, to browse, sort and filter. Each card should open on what it
leads to: its character, its verses, its Strong number. Packs should also be opened at random, for
fun. ADR-0090 refused random boosters and rarity for the application's collection: there, a card
marks a discovery made by reading, at the end of a chapter, and nowhere else.

The application does not show this gallery for now: it is a page of the site only.

## Decision

### A gallery of every card

`/atlas/:language/cards` shows every card in the order of the Bible, grouped by era. A
character's place is its first mention, the one its unique name opens on (`Israel@Gen.25.26-Rev`);
its life stages follow its base card. The gallery offers:

- three orders: the Bible's, A to Z, and the most named;
- filters by family, era, series, role, and the characters with life stages;
- a search over the name, the title, the original name without its points, the transliteration and
  the Strong number (`1732` finds `H1732`).

The filters live in the fragment of the address (`#family=idol&sort=named`). A filtered gallery can
be shared, while the server, which never sees a fragment, keeps one page and one cached copy.

The site reads the two catalogs as the atlas does (an hour per server instance) and sends the page
every card with what its two faces and its links need. Searching, filtering and opening a card then
ask the server for nothing: the browser keeps the gallery, the server keeps nothing for a reader.

A card in the grid is drawn as on a character's page, still, without its moving foil. It takes the
small copies of its pictures, which ADR-0089 publishes for the portraits. For the backdrops, the card
catalog's command now writes a 384-pixel copy beside the 768-pixel one, under the same hash. On a phone
the grid takes the small copies even at three pixels per point: a little softer, the whole gallery
weighs about 10 MB of pictures instead of 27.

Every card is drawn up front. Rendering cards only as they come near the screen
(`content-visibility`) was measured on 2026-10-30 on a phone emulated with its processor slowed four
times: with it, scrolling the gallery stayed at 30 frames a second, with about 160 long tasks; without
it, scrolling holds 60 frames a second with none. Loading took the same main-thread time either way.

### A card at its own address

A card opens over the gallery at `/atlas/:language/cards/:id`. Its id is the entity's unique name,
followed by `~stage` for a life stage. The open card:

- rises from its place in the grid, tilts under the pointer and turns over when touched;
- moves to the card before or after it, in the gallery as filtered, with a swipe or the arrow keys;
- leads to the character's page, the verse of its sentence, its first mention, its Strong number and
  its series.

Closing it, or the browser's back button, returns to the gallery where it was.

The address of a card exists to be shared. Its share image is drawn as an entity's, with the card's
sentence, its title and its own picture: each life stage now has a PNG copy on the media host too
(ADR-0089). It has a title and a description of its own, but it is not indexed (`noindex, follow`):
it only shows a card over the gallery, and the character's page holds what can be found. The gallery
is indexed and listed in the atlas sitemap.

A character's page links to its own card over the gallery, and the entry of the atlas to the gallery.

### Packs, kept by no one

A pack holds five cards of five different characters, drawn from every card or from one era. Two are
drawn among the better known characters of the pack and three among the others, so that a pack mixes
Moses with Jael. The reader:

- tears the pack open, then turns its cards over one by one;
- opens a turned card as from the grid;
- opens another pack.

Cards already seen during the visit come back only once every card of the pack has been drawn.

Nothing is kept: no album, no count, nothing in the browser's storage. No card is worth more than
another, and no pack is rarer than another. This is how a pack fits ADR-0090. A pack is a way of
meeting characters one would not have looked for. It is never a second collection, gained by
chance where the application's is gained by reading.

## Consequences

- The gallery is one page of about 1 MB of HTML before compression (130 KB compressed), kept by the
  page cache like the other atlas pages. Its pictures load as the reader scrolls.
- A card published later reaches the gallery like the atlas pages, once `/atlas` is rendered again.
- The 384-pixel backdrops and the stage PNGs are published by `yarn resources:entities:cards` and
  `yarn resources:entities:images`. Neither changed a hash: no device fetches anything again.
- If the application one day shows this gallery, its own album (ADR-0090) remains the only place where
  a card is collected; a pack there would need its own decision.
