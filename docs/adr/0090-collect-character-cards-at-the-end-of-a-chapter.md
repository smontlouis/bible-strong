# ADR-0090: Collect character cards at the end of a chapter

## Status

Accepted (2026-10-28).

## Context

Since ADR-0089, 318 persons and supernatural beings have a painted portrait, and 22 of them
have life-stage portraits (44 stages or manifestations) tied to chapter ranges, such as
« David · Le chef en fuite » for 1 Samuel 18–31. The quality of these portraits calls for a light, playful collection: a card
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
- No card is worth more than another. A rarity would reward the characters the text mentions least,
  and a rank of importance would have the application judge who counts in Scripture; the cards have
  neither.

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

Cards are persons and supernatural beings with a portrait, and their life stages: 318 characters
on 2026-10-28, among them God (`LORD@Gen.1.1-Rev`), Jesus and his three stages, the angels, Satan
and thirty gods and idols. Places are not cards, though they have portraits. The Holy Spirit has
no entity in the entity data, so it has no card until one is authored.

God's card is in every collection from the start, the guest's included. It is never stored nor
offered as new: at the end of a chapter it is drawn as collected.

A card's identity is the entity's `uniqueName` (ADR-0016) for a base card, and
`<uniqueName>~<stageKey>` for a stage, the same key the portrait gallery already uses.

Resource Studio writes `entity-cards/catalog.json` to the media bucket of ADR-0089, next to the
portrait manifest and after it, with the same delivery rules: mutable, cached for an hour at the
edge, fetched by the application at most once a day and kept on the device.

The portraits' working folder generates the cards (`portraits/cards/build_catalog.py`, which reads
the entity data, the lexicon and the Bible texts); `yarn resources:entities:cards` checks and
publishes them. The published catalog is `{ version: 1, cards, backdrops }`:

- a card names its portrait by its identity alone; the application finds the picture in the
  portraits' catalog it already reads (`entities[uniqueName].hash`, or the hash of the stage whose
  key is the card's stage), so republishing a portrait never republishes the cards;
- a card carries its texts in both languages (`text.fr`, `text.en`), its sentence (`line`: kind,
  both texts, LSG and BSB references, speaker, and the source line it prints), its family, era,
  stage rank, chapter count, original name, Strong number and series ranks, its backdrop key, and
  `fadeTop` when its portrait was cut at the top; its finish is not stored, the application reads
  it from the family and the life stages;
- `backdrops` maps each key a card names to the hash of its painting, served at
  `entity-cards/backdrops/<key>/<hash>/w768.webp`, 768 by 1152 pixels, never changed under its
  address.

The command writes nothing while one card lacks a reviewed sentence, a language, a sentence of at
most 120 characters, a portrait on the media host or a painted backdrop. Before it puts the
catalog, it checks that every backdrop and every card's portrait answers.

Every text on a card comes from data or from a reviewed editorial table; the generator writes
nothing of its own. The card is in French and in English: the catalog holds each of its texts in
both languages, and the application shows the card in the language of its interface. For each card
the catalog holds, with its source:

| Field | Source |
|---|---|
| Identity, entity, stage key | portrait `selection.json` |
| Name | entity data (`EntityTranslations`, `fr`; `Entities`, its English base), or the editorial table where the portrait names the character otherwise (God, Jacob, John the Baptist) |
| Original name and its script (Hebrew, Aramaic, Greek) | entity data (`EntityNames.original`), the name matching the entity's Strong number |
| Strong number | entity data (`Entities.uStrong`) |
| Transliteration | Strong lexicon (`StepEntries.transliteration`, the entry of that original name) |
| Meaning of the name | Strong lexicon (`LexiconNameMeanings`, `fr` and `en`), absent when the lexicon has none |
| Family | entity type and portrait era (below) |
| Era, roles | portrait `characters.json` (`era`, `roles`) |
| Series and position (« Les rois d’Israël uni · 2 / 3 ») | portrait `series.json` |
| Title of the card: the portrait's title, the stage's label, or the entity's brief | portrait `characters.json` and `stages.json`, entity data; in English, and when a brief is too long for two lines, the editorial table |
| Chapters of the card: the title's chapters, or the stage's ranges | portrait `characters.json` and `stages.json` |
| Number of chapters where the entity appears | entity references, counted at generation |
| Books where it appears, book of first appearance | entity references |
| First mention | entity references, its first verse in canonical order |
| Short presentation | entity data (`EntityTranslations.brief`, `fr`; `Entities.brief`) |
| Sentence of the card, its kind, reference and speaker | editorial table |
| Backdrop | backdrop table, kept with the editorial table (below) |
| English of the fixed words: eras, roles, series titles, book names | a vocabulary kept with the editorial table |
| Images: cut-out subject, backdrop | the published portraits, which are the matted cut-outs (their WebP keeps the matte exactly), and painted backdrops, published like the portraits |

The number of chapters is a plain fact on the enlarged card (« Apparaît dans un seul chapitre »),
never a tier.

The editorial table lives with the portrait data, one row per card, and holds only what no data
gives: the sentence, a short title where the entity's brief does not fit the two
title lines (44 characters), the English of the portrait titles and stage labels and of
the few names the portrait gives otherwise than the entity data, and the few overrides that the data
cannot express (God's type line and presentation, whose entity data is a list of divine names;
Jesus's type line). A card without a reviewed row is not published.

The images are prepared once for every portrait: the subject is cut out (BiRefNet), the painted
blue field is removed while foreground objects stay with the subject, the edges are matted
(ViTMatte) and cleared of the blue, and enclosed gaps of sky between strands are opened. God's
cards stay whole scenes, and so does any card whose painted ground belongs to its story.

### The sentence of a card

Each card carries one sentence, an editorial text frozen on the card: the Louis Segond 1910 (LSG)
in French and the Berean Standard Bible (BSB) in English, both in the public domain, whatever
version the reader has chosen. The sentence is one of three kinds, in this order of preference:

- **citation** (`citation`): the words the character says in the moment the card tells (its stage,
  or its portrait title, with their chapters), copied word for word. A part of a verse is allowed
  when it is a whole sentence, with « … » for a cut. Words said to the character, or by someone
  else, are allowed when they tell its moment (« Femme, voilà ton fils » for Mary at the cross).
  Among the sentences of that moment the famous one comes first (« Je puis tout par celui qui me
  fortifie » for Paul), but a famous sentence outside the card's chapters never replaces the
  moment. God's words through a prophet count as the prophet's own, their speaker named
  « L’Éternel par Jérémie »;
- **paraphrase** (`paraphrase`): only when the original sentence is too long or too dated,
  shortened without adding anything to its meaning;
- **verse** (`verset`): for those who never speak (kings, minor judges, idols…), a verse chosen for
  what it says of the character, whole or as a whole sentence, never a cut beginning.

A citation or a verse is shown in quotation marks with its reference alone (« 1 S 17.43 »); a
paraphrase without quotation marks, in italics, its reference after « d’après » / « after »; a
speaker other than the character comes before the reference (« Abraham à Isaac · Gn 22.8 »). A
sentence has at most about 120 characters, so that it fits four lines of the card without a cut.
Each text keeps its own verse numbering, which differs where the LSG of Bible Strong follows the
Hebrew one (Psalm titles, Genesis 32, Daniel 4 and 6, Malachi 3–4).

The sentence was first a verse reference, shown in the reader's version. A reference has to be
chosen without reading it in every version, so the generator took the first verse of the card's
chapters, and the cards read cut verses and plain narration. A sentence chosen by hand is chosen for
one text: its cut, its length and its speaker do not hold in another version, so the card keeps the
text it was chosen in. These sentences, about a hundred characters each from public-domain texts,
are the only Bible text the catalog copies. Before the catalog is generated, every citation and
verse is checked word for word against the LSG and BSB verses it names, and every sentence against
the length.

### Card families

Cards differ by the nature of the character, never by a rank:

- **God and Jesus** have a card of their own, drawn apart from every other. It marks a different
  nature, not a greater importance than Abraham's; a Holy Spirit card would take it too.
- **Humans**, the great majority.
- **Spiritual beings**: angels, Satan, the demons, and the creatures of the poetic books
  (Leviathan, Behemoth, Rahab the monster).
- **Gods and idols** of the nations.

The family sets the card's palette and the glow around an opened card. Importance shows by depth: a
major figure has life stages, so two to four cards that the album keeps together, where a minor
figure has one. A stage card is drawn like its base card, with its stage label and an « Étape de
vie » mention, and is worth no more. Every card of a human with life stages, base card included,
takes an emerald frame instead of the night blue of the other humans, so the major figures read as
a set apart.

Every card has a foil finish and a glow, read from its family and from whether its character has
life stages, never chosen card by card:

| Cards | Finish | Glow |
|---|---|---|
| God and Jesus | holo on the image and reverse holo on the frame | white gold |
| Humans with life stages | wide pastel bands that climb as the card tilts, on the image and the frame | sea green |
| Other humans | glitter on the image and the frame | silver blue |
| Spiritual beings | cosmos | soft blue violet |
| Gods and idols | reverse holo on the frame only | dull bronze |

The rainbow holo and the white gold light stay God's alone: the humans first shared that holo and
had a gold glow, and read as divine. The emerald and the bands follow the life stages, which the
portrait data already gives, so the application makes no judgment of its own about who counts. The
bands come from the « V » cards of pokemon-cards-css; four other finishes of that project (radiant,
rainbow, shiny, secret gold) were compared on 2026-10-29 and set aside. Every card also keeps the light glare that follows the
tilt, and the three depths of its image: the backdrop behind, the original name halfway, the
person in front.

A card is added to the catalog only once its portrait is in the manifest. A card withdrawn from
the catalog stays collected in the account but is no longer drawn or counted.

### How a card is drawn

Every card has one layout, chosen on 2026-10-29 after a prototype of all the cards:

- the image covers the top of the card from edge to edge; the name, in capitals and foil, and the
  title, at most two lines and half the card's width, sit at its top left on a dark shade;
- below the image, the type line, then the sentence on a parchment panel, then the series or the
  chapters and the number of chapters;
- the back carries the family, the original name with its transliteration, Strong number and
  meaning, the short presentation, and the facts of the card (stage and chapters, first mention,
  number of chapters, place in the collection and in its series).

The person stands lower than the top of the image, so the head clears the name and the title. Many
portraits were painted with the head cut by the top edge (152 of the 354 cut-outs on 2026-10-29,
found from the shape of each cut-out's top edge and checked by eye); on those cards the top of the
person fades into the dark shade, so no straight cut shows. A solid band holding the name was tried
and set aside: it hides every cut but takes the top of every image.

Behind the person stands a backdrop: a painted setting, seen from a standing person's eye, for the
moment the card tells rather than the place the data names most often. Moses with the tablets stands
at the foot of Sinai, not in Egypt; Goliath in the valley of the battle; Jesus on the cross under the
darkness over the land; Ezekiel in the valley of dry bones. The portraits of places were tried first,
blurred and then sharp: they are wide views of cities from above, which do not match a person painted
at eye level, and the place most often named tells the wrong moment. The backdrops are a library of
115, from deserts and mountains to palaces, sanctuaries and skies, painted once in the portraits'
style, one painting each, which every card of that moment shares. A backdrop table
kept with the editorial table gives each card its backdrop, reviewed like its sentence. A backdrop is
a full scene, framed for a standing person, though a card shows mostly its upper part, so that it can
serve elsewhere. The card draws it sharp, as painted.
God's cards, and any card whose painted ground belongs to its story, keep their whole scene and take
no backdrop.

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
- every card of the catalog; a missing one shows the clay placeholder the entity shows elsewhere
  (ADR-0089) instead of its portrait, with a hint (« Se rencontre dans 2 Rois »); since
  pictures are never locked, a missing card opens the character's page too;
- sorting by book of first appearance, or by era;
- counters such as « 142 / 318 personnages · 18 / 44 étapes de vie »;
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
- A card's sentence does not follow the reader's Bible version: a reader of another version sees
  the LSG or the BSB on the card, named by its reference only.
- Changing a sentence or its English is a catalog republication, not an application release.
- A portrait published later needs its sentence, in both languages, and its backdrop before its
  card is published; a moment no backdrop fits needs a new one painted.
- The backdrops are a third set of images to publish with the portraits and the catalog.
