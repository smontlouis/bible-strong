# ADR-0117: Describe the recordings of the versions in a catalog on the media host

## Status

Accepted

## Context

A Bible version could have one recording, written in the application's code: `hasAudio` and a
`getAudioUrl(book, chapter)` function on six versions (LSG, BDS, KJV, ESV, NIV, NLT). Every file is
streamed from its publisher's host (TopChrétien, bible.audio, WordPocket, Bible Study Tools); Bible
Strong hosts none and will host none.

A version is about to have several: the LSG read, the LSG dramatized, and others to come, some
covering only part of the Bible. With the address in code, each needs an application release, and the
player knows only « the recording » or « the device's voice ».

## Decision

- **A recording is an entry of a catalog**, not a field of a version. It has a durable id, the version
  it reads, a name in French and English, a kind (`reading` or `drama`), the books it covers (every
  book when absent), the publisher's credit, and where its chapters are: address templates with
  `{book}`, `{chapter}`, `{testament}`, `{testamentBook}` and `{bookCode}`, a width padding a number
  (`{chapter:3}`), and one template per group of books where the publisher splits them (the LSG of
  TopChrétien). The type, its validation and the building of an address are pure functions of the
  Resource domain (`@bible-strong/resource-domain/bible-audio`).
- **The catalog is one file on the public media host**, `bible-audio/catalog.json`, as the portraits
  (ADR-0089) and the paintings of the timeline (ADR-0096) are: cached an hour at the edge, read by the
  application once a day and kept on the device. It names addresses only; no recording is put in the
  bucket.
- **The file in the repository is the reference**: `packages/resource-catalog/src/bibleAudioCatalog.json`.
  `yarn resources:audio check` refuses an entry the application would leave out and asks each
  recording for its first chapter; `yarn resources:audio publish` then puts the file in the bucket
  through the operator's wrangler session. The application carries the same file, which it reads until
  the media host answers.
- **The device's voice is offered with every version**, after its recordings. The player holds a
  recording id, or the device's voice, and remembers the reader's choice for each version. A recording
  that does not cover a book gives way to another of the version that does, then to the device's
  voice; within a book, the recording heard plays on from chapter to chapter.
- **« Listen with »**, the first option of the large player, lists the version's recordings (a
  dramatized one says so, one that skips the book is greyed) and the device's voice. The version
  selector shows a speaker beside a version with recordings, and their number when there are several.

## Consequences

- A recording is added, renamed or removed by publishing the catalog, without a release; a reader sees
  it within a day.
- A publisher that changes its addresses breaks only its entry, which `check` reports.
- The search of a publication, revisions and the Resource API are not involved: the list is too small
  and changes too seldom. Should recordings need them, the entry becomes a publication without the
  player changing.
- Amends ADR-0116, whose player knew one recording per version.

## Amendment (2026-11-24): the picture of a chapter on its cover

The catalog also names the picture painted on the cover of a chapter, by `book:chapter`:

- **a scene** under `scenes`, the slug of a timeline event whose painting the media host holds
  (ADR-0096): among the painted events whose passages fall in the chapter, the one that tells most
  of its verses; on a tie, the one spread over fewer chapters, then the one that starts first. The
  passages come from the Resource API (`scriptures` of an event).
- **else a place** under `places`, an entity whose portrait the media host holds (ADR-0089): among
  the painted places that STEPBible's TIPNR names in the chapter, the one named most often; on a
  tie, the one named first; then the best known across the Bible.
- **else the picture of a chapter of the same book**, the nearest one at most three chapters away,
  the earlier one on a tie; beyond that, a cover of type alone.

`yarn resources:audio covers` writes both maps into the catalog file, and
`apps/resource-studio/config/bible-audio-scene-overrides.json` and
`bible-audio-place-overrides.json` name the picture of a chapter the rules get wrong, or `null` for
none. On 2026-11-24, 324 chapters have their own scene, 824 their own place, 258 borrow a
neighbour's: 1,110 of the 1,189 chapters have a picture (93 %).

The application lays the painting under the cover, in the part's hue: the accent over it in the
« color » blend, the ground washing it, a fade clearing the top for the book's name; the chapter
number then takes the ink. A thumbnail keeps the number alone.

## Amendment (2026-11-25): a recording hosted with its publisher's leave, and its mention

Trésors Média (tresorsonore.com) lent its reading of the Louis Segond 1910 in writing, with leave
to host it, on three conditions: « Voix : tresorsonore.com » with a link and its logo with every
chapter heard, listening free of charge, and the number of listens once a year. Its files have no
address by chapter, so Bible Strong hosts them:

- **A hosted recording is the exception, not the rule**: only with the publisher's written leave.
  Its chapters go once in the media bucket under `bible-audio/<recording>/v1/{book:2}_{chapter:3}.mp3`,
  cached as immutable (a new take gets a new `v<n>`); its address template names the media host like
  any other. `yarn resources:audio host <recording> --from <folder>` finds each chapter in the
  publisher's files by `apps/resource-studio/config/bible-audio-hosted/<recording>.json`, refuses a
  missing or doubled chapter, and puts the chapters and the logo. The publisher's download link is
  never written in the repository.
- **A recording may carry an `attribution`**: a label in French and English, the address it opens
  and a logo. The large player shows it under its controls, linked, while one of its chapters plays,
  and the lock screen names it. An entry whose attribution is malformed is left out, never played
  without it.
- **The catalog moves to `bible-audio/catalog-v2.json`.** `catalog.json` stays published for the
  applications older than 28.2.8, without the recordings that carry an attribution: those
  applications cannot show it, so they never offer them. `publish` writes both.
- **Every chapter heard is counted** by recording in the application's analytics
  (`bible_audio_listen`: recording, version, book, chapter), once each time a chapter starts. The
  yearly figure a publisher asks for is read there.
- **Such a recording stays free**: it is never put behind Premium.

The Trésor sonore recording (`lsg-tresorsonore`) is read by Jean-Micaël Saltzmann (Old Testament but
Genesis; Proverbs and John in their versions without music) and Alain Moreau (Genesis, the New
Testament but John). It comes first among the recordings of the LSG. The takes with music of
Proverbs (Alain Moreau) and John (Jean-Micaël Saltzmann) make a second, partial recording,
`lsg-tresorsonore-music`, with `books`; `host` takes a partial recording through `covers`.

**A partial recording says what it covers.** In « Écouter avec », its row names its books (one to
three by name, a whole testament as such, more by their count): « Proverbes et Jean » where it can
be heard, « Seulement Proverbes et Jean » where it is greyed, so that a reader neither takes it for
the whole Bible nor wonders why it is unavailable.

TopChrétien's LSG (`lsg-topchretien`) is the same Trésor sonore reading, so `catalog-v2.json` no
longer names it. It stays in `catalog.json` only, through
`apps/resource-studio/config/bible-audio-first-catalog-only.json`, so that the applications older
than 28.2.8, which never hear Trésor sonore, keep a recording of the LSG.

**A partial recording is heard through its own books.** While one plays, the chapter before and
after, and the next one at the end of a chapter, stay among its books: Proverbs 31 is followed by
John 1, and playback stops after John 21. Choosing it in « Écouter avec » from a book it skips
opens the first chapter of the first book it covers (Proverbs 1); its row shows an arrow rather
than being greyed.

## Amendment (2026-11-25): background music, and the pills above the transport

- **The catalog lists background music** under `music`: an id, a name in French and English, and
  the address of a seamless loop on the media host (`bible-audio/music/<id>-<take>.mp3`, immutable).
  `yarn resources:audio music generate` composes the pieces of
  `apps/resource-studio/config/bible-audio-music.json` with ElevenLabs Music (instrumental, cleared
  for commercial use on a paid plan), fades their last six seconds into their first, and evens
  their loudness at -23 LUFS; `music host` puts them on the media host once listened to. Six pieces
  on 2026-11-25: soft piano, strings, ambient pad, acoustic guitar, harp, soft organ.
- **A recording says where it already has music**: `music: "all"`, or the `book:chapter` keys of
  the chapters that have some. Measured by the share of silence between sentences (under 3 % with
  music, 6 to 45 % without): Trésor sonore avec musique, the KJV and BSB musical versions and Jordan
  Gilbert with music have it throughout; Trésor sonore has none in its 1,189 chapters; the NIV's
  ambience and WordPocket's are not music and take some.
- **The music is a player of its own, apart from the Bible audio**, as in HelloBible: the reader
  plays it to read, pray or listen, from a note beside the play button of the reading footer
  (bars that move while it plays), and pauses it by its own button; the Bible audio's pause leaves
  it playing. Its panel shows the piece's disc to play and pause, the piece before and after, and a
  low, medium or high volume. With no passage loaded, the small player shows the music alone; the
  lock screen shows it then, and the Bible audio's player takes it back.
- **It fades down under a voice**: when the Bible audio starts, recorded or read by the device, the
  music fades in under a second to 45 % of its volume, and back up when the voice stops; under a
  chapter that already has music it fades out. The sleep timer stops it with the voice.
- **Two pills above the transport of the large player**, as in Audibible: the microphone with the
  name of what is heard, opening « Écouter avec », and the music, in the accent while it plays,
  opening the music's panel. « Écouter avec » leaves the row of options below.

## Amendment (2026-11-25): a recording streamed with its publisher's mention

Bibles et Publications Chrétiennes (editeurbpc.com) let Bible Strong use its reading of the Darby
in writing, as long as the application and the site stay free for the reader, with the mention
« © Bibles et Publications Chrétiennes, editeurbpc.com ». Its chapters have public addresses, so
the recording (`dby-bpc`) is streamed from its host like any other, not hosted: a written leave
does not by itself make a recording hosted. It carries the mention as its `attribution`, without a
logo, so it reaches only the applications from 28.2.8.

Its addresses were checked once against the publisher's 1,189 chapter pages: all match, but for
Malachi 4, whose page plays chapter 1 while the file of chapter 4 exists at its own address; the
catalog names that one.
