# ADR-0075: Repair legacy Bible sources with reviewed, anchored operations

## Status

Accepted. Extended by
[ADR-0077](./0077-complete-legacy-bible-sources-from-their-provider.md), which supplies text a
source lacks from its provider and adds the `misprint` operation.

## Context

Thirty-five ordinary Bibles are published from legacy JSON sources
(`{book: {chapter: {verse: text}}}`) declared in `config/ordinary-bible-sources.json`. Sources are
content-addressed and read-only: `assets.bible-strong.app` is never written again, and a new source
goes to `r2://…/sources/<sha256>/…` ([ADR-0066](./0066-author-words-of-jesus-and-deliver-self-contained-canonical-bibles.md)).

Two defects made published text go missing without any error.

The converter skipped every verse key that was not a plain number. Three sources name a block of
verses translated as one `<first verse>+<USFM book code>` (`"1+GEN"` for Genesis 14:1-4, read from
a provider reference `GEN.14.1+GEN.14.2+…`): 75 blocks in EASY, 24 in NLT and 3 in GW were never
published, so EASY Genesis 14 began at verse 5.

Some source rows are wrong in themselves. A verse holds the next one behind a literal verse number
(S21 Jeremiah 23:18 contains `19`, and has no row 19). A verse is cut after its first letter and
the rows that follow are numbered one too high (OST Galatians 3:28). Two verses share one row and
the rows that follow are numbered one too low (FMAR Romans 3:22). A row is filed under another book
(CHU Nehemiah 7:65 under Esther 7:65).

Correcting the source file itself would publish bytes nobody can compare with the provider's, and
would hide each correction inside a five-megabyte file. The repository is public and holds no Bible
text.

## Decision

### The converter publishes every key or fails

`buildCanonicalBibleFromLegacy` publishes a combined block under its first verse number, which is
how the legacy sources already represent every other grouped verse (BDS, BFC, NFC, PDV2017): the
text sits under the first number and the other numbers have no row. The book code of the key must
name the book it is filed in.

Any other book, chapter or verse key, and two keys for one verse number, fail the build
(`legacy-bible-verse-key-unsupported`, `legacy-bible-verse-duplicate`, …). A key is never skipped.

### Source repairs are a reviewed list of operations

`config/ordinary-bible-source-repairs.json` lists, per Bible, the SHA-256 of the source the repairs
were reviewed against and an ordered list of operations on verse rows:

- `split`: the verse holds the next verse behind a literal marker at a given offset; the marker is
  dropped and the rest becomes the next verse, whose row must be missing;
- `join`: the next row is appended to the verse, with a declared separator;
- `move`: a row goes to another reference, which must be missing;
- `shift`: a run of rows of one chapter is renumbered by a constant;
- `misprint`: one digit, at a given offset, is read as one letter.

Each operation states its evidence in words and anchors the verses it reads and writes by the
truncated SHA-256 of their text, as words-of-Jesus decisions do. A marker is a verse number and its
spacing, a separator is spacing: the file holds no Bible text. The build fails when the source is
not the reviewed one, when a verse no longer matches its anchor, or when an operation would
overwrite a row.

Repairs are applied to the parsed source in `loadBibleText`, before conversion, so publication,
`words-of-jesus check` and every other command read the same text. The source bytes, their location
and their SHA-256 in the provenance are unchanged. A canonical source with repairs fails: repairs
correct legacy rows only.

`yarn workspace @bible-strong/resource-studio resources:publication:bible-repairs report` prints
every repair with the verses before and after, from the local source cache, for review. Its output
holds Bible text and stays on the operator's machine. `draft --file` applies an unanchored draft
and prints the anchors to record once the report has been read.

### What may be repaired

An operation is recorded only when the source itself shows the defect:

- a `split` needs the literal number of the missing verse inside the text. Two verses that share a
  row without such a marker stay grouped under the first number: where one ends is an editorial
  choice, not a repair;
- a `shift` needs a chapter one row short or long, a last row that is the last verse of the
  chapter, and every renumbered row checked against another translation of the same language;
- a `move` needs a row whose reference cannot exist and a missing row it fits between;
- a `join` needs a row that is a fragment of the next. Characters the source lost are not written
  back;
- a `misprint` needs a digit printed inside a word where the edition has a letter. Nothing else is
  rewritten: the three OST verses whose first word the provider prints `I1` read `Il`.

Text that is absent from a source is never written, reconstructed or taken from another
translation. It needs a corrected source from its provider, built as ADR-0077 describes. The three
OST verses first joined here (`I` and the rest of the verse) are now supplied whole by that source,
and their `join` repairs are gone.

### Decisions and Offline copies follow the repaired text

`words-of-jesus carry-repairs` carries decisions through the repairs: a decision follows its text
to the verse it is now numbered, and its spans are cut where a verse was split. Decisions made
against a chapter that was numbered wrong are then reviewed like any other.

A Bible without headings or words of Jesus kept its source file as its Offline copy. That is no
longer true of a source that was repaired or holds combined keys: its Offline copy is the canonical
JSON, since the file no longer reads as the publication.

## Consequences

EASY, NLT, GW, S21, NET, FMAR, OST and CHU get a new text revision. None has a Strong index, and
none is the base text of an interlinear index.

A renumbered verse keeps its text and changes its reference: FMAR Romans 3:23-30 and 8:21-38, OST
Matthew 11:3-29, Romans 3:23-30, Galatians 3:30, Hebrews 12:13-30 and Revelation 22:12-22 move by
one, as do OST Daniel 2:23-48, 1 Thessalonians 1:6-9 and James 5:10-19 since ADR-0077. Study data
a reader attached to one of these references now sits on the neighbouring verse, which is the verse
the reference names in every other Bible.

The Resource service keeps its own copy of the legacy converter, used to check an Offline copy that
is still legacy JSON. It skips the keys this converter now publishes. Such a copy can no longer be
produced for a source with combined keys, and the service copy should fail on them too.

A publication manifest can name its text, pericope and words-of-Jesus sources only. The repair file
that shaped a publication is known from the repository revision that built it, not from the
manifest, until the bundle contract accepts another source role.

Tools that read a legacy source directly, such as a Strong tagging run reading
`data/bibles/bible-fmar.json`, do not see the repairs. A Strong index for a repaired Bible must be
built from the repaired text.
