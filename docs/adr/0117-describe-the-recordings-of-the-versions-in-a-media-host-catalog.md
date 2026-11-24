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
