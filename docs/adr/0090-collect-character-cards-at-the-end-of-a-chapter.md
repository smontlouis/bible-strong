# ADR-0090: Collect character cards at the end of a chapter

## Status

Accepted (2026-10-28).

## Context

Since ADR-0089, about 300 persons and supernatural beings have a painted portrait, and 23 of them
have life-stage portraits (37 stages) tied to chapter ranges, such as « David · Le chef en fuite »
for 1 Samuel 18–31. The quality of these portraits calls for a light, playful collection: a card
for each painted character, kept in an album.

What the application knows today, measured on 2026-10-28:

- It records no reading outside Reading plans. A Plan participation stores which days and elements
  are read, without dates, in the `plan` field of the user document (`OngoingPlan`,
  `firestoreMiddleware.ts`). An element counts as read once opened or ticked.
- History is device-local, bounded to 50 chapters, recorded on display and cleared at logout.
- The end of a chapter in the Bible DOM already shows the chapter's entities (`ChapterEntities`),
  read from the entity references of the Strong lexicon: three stacked avatars, then an overlay
  grouping persons, places and groups. The block is absent when contextual information is turned
  off, in the focused-verse mode, and while the entity module is neither installed nor reachable.
- There is no trophy, badge or account-wide streak anywhere.

The product intent, decided with the owner:

- Portraits stay visible to everyone, everywhere. One owns the card, never the picture.
- A card marks a discovery, not a possession: God, Jesus, angels, Satan and the gods of the
  nations are cards like every other painted character.
- The collection is a playful touch, not a retention device: no streak, no pressure, no random
  booster.
- Rarity comes from how little a character appears in the text, never from spiritual importance.

## Decision

### A card is collected by tapping it at the end of a chapter

The chapter's entity block takes the painted characters out of the stacked group and shows them
one by one, as small cards in a grid where every card is visible, new cards first. Everything
without a portrait, and every place and group, stays in the stacked group and its overlay as
today. A chapter has a median of 4 painted characters, 10 or fewer in nine chapters out of ten,
and 30 at most (Matthew 1, 1 Chronicles 6), so the grid takes a few lines at worst.

A card has two states:

- **collected**: drawn plainly; a tap opens the character's page, as an avatar does today;
- **new**: drawn with a shine. A tap opens an overlay where the card grows to its 768-pixel
  portrait under « Nouvelle carte débloquée », with a haptic on native. The card is collected at
  that moment. Tapping the enlarged card opens the character's page.

Nothing checks that the chapter was read: no scroll position, no duration. A reader who opens
chapters only to collect cards may do so. A reader who hides contextual information, or who
reads without the entity module, collects nothing, and that is accepted. A card is collected
nowhere else: not from the character's page, the Strong entries or the relation graph.

The collection starts empty for everyone when the feature ships. Nothing is granted from plans,
History or any earlier reading.

### Which card a chapter offers

A chapter offers a card for each entity it lists that is in the card catalog. For a character
with life stages, the chapter offers the stage whose ranges contain the chapter, and otherwise the
base card. A chapter therefore shows each character once, under one card, and a reader who has
David's base card still finds a new card in 1 Samuel 20.

### The card catalog

Cards are persons and supernatural beings with a portrait, and their life stages: 302 characters
on 2026-10-28, among them God (`LORD@Gen.1.1-Rev`), Jesus and his three stages, the angels, Satan
and thirty gods and idols. Places are not cards, though they have portraits. The Holy Spirit has
no entity in the entity data, so it has no card until one is authored.

God's card is in every collection from the start, the guest's included. It is never stored nor
offered as new: at the end of a chapter it is drawn as collected.

A card's identity is the entity's `uniqueName` (ADR-0016) for a base card, and
`<uniqueName>~<stageKey>` for a stage, the same key the portrait gallery already uses.

Resource Studio writes `entity-cards/catalog.json` to the media bucket of ADR-0089, next to the
portrait manifest and after it, with the same delivery rules: mutable, cached for an hour at the
edge, fetched by the application at most once a day and kept on the device. For each card it
holds:

- its identity, and for a stage its label and chapter ranges (from `stages.json`);
- its rarity tier, computed at generation from the number of distinct chapters in which the
  entity appears in the entity references; stage cards are at least rare;
- the books where it appears, for the album's hints and sorting;
- its era, as the portrait data already classes every character (Origines, Patriarches, Exode,
  Juges et royauté, Prophètes et exil, Nouveau Testament, Êtres spirituels, Dieux et idoles,
  Créatures);
- the closed series it belongs to (kings of Judah, writing prophets, the twelve tribes…), each
  series being an ordered list kept with the portraits.

A card is added to the catalog only once its portrait is in the manifest. A card withdrawn from
the catalog stays collected in the account but is no longer drawn or counted.

### Storage and synchronization

The collection is a map from card identity to the time it was collected:
`cards: { [cardId]: collectedAt }`. It only grows; there is no way to give a card back.

It lives in the user's Redux state, persisted on the device like the rest of it, and is synced as
a field of the user document, which the account sync already listens to: collecting a card writes
that single entry with a merging write, and no new listener or Firestore read is added. Two
installs that collect cards at the same time keep the union. About 400 entries make roughly 15 KB.

A guest collects cards locally, like every other guest data. The collection is part of the
Guest-adoption snapshot for a genuinely new account. Entering an existing account follows the
current rule: the account's collection becomes authoritative and the guest's is not adopted.
Logging out clears it with the rest of the account state.

### The album

A « Mon parcours » screen, opened from the profile, shows the album:

- God's card first, collected from the start;
- every card of the catalog, a silhouette for a missing one with a hint (« Se rencontre dans
  2 Rois »); since pictures are never locked, a silhouette opens the character's page too;
- sorting by book of first appearance, or by era;
- counters such as « 142 / 302 personnages · 18 / 37 étapes de vie »;
- the series, each marked complete once all its cards are collected;
- a collected card opens large, then leads to the character's page.

Account trophies (days of reading, account age, plans completed, a meditation, the whole Bible)
are left for a later decision. The screen keeps room for a Trophées tab beside the album.

## Consequences

- The feature needs no reading tracking, and no new Firestore collection or listener.
- A portrait published later becomes a new card in its chapters with no migration.
- Collecting is deliberate, so the shine and the overlay must stay short and quiet; with reduced
  motion the card is shown enlarged without animation.
- A chapter full of painted characters (genealogies, Matthew 1) shows a grid of a few lines; new
  cards come first.
- Readers without the entity module cannot collect: the block's download offer is the way in.
- The catalog becomes a second file to publish with the portraits; a device without it shows no
  cards, only today's avatars.
- The unique names that contain `@`, `.` or `'` must be checked as keys of the user document's
  map, written through an object and never through a dotted field path.
- Album counts depend on the catalog, so they move when portraits are added.
