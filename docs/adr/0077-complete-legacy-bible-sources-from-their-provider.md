# ADR-0077: Complete a legacy Bible source from its provider, as a patched content-addressed source

## Status

Accepted. Extends [ADR-0075](./0075-repair-legacy-bible-sources-with-reviewed-anchored-operations.md),
which left text that is absent from a source to "a corrected source from its provider".

## Context

Repairs move, split and renumber rows a legacy source already holds. They cannot write text the
source never had: NLT has no Exodus 38, NET has no Acts 23:26-30, NFC and PDV2017 hold the
translator's prologue where Sirach 1 should be, and OST cuts three verses after their first letter.

These sources were generated from Bible.com's public chapter endpoint
(`events.bible.com/api/bible/chapter/3.1`), by a generator kept outside this repository. The owner
holds the publishers' permissions and decided that missing text is supplied from that provider.

The repository is public and holds no Bible text. Sources are content-addressed and never
rewritten in place ([ADR-0066](./0066-author-words-of-jesus-and-deliver-self-contained-canonical-bibles.md)).

What the provider serves was measured on 2026-10-08, chapter by chapter, against the sources:

- **NLT** (version 116): Exodus 38 is served, 31 verses. Chapters 37 and 39 read as the source:
  same edition.
- **NET** (107): Acts 23:26-30 are served. The 30 other verses of the chapter are identical.
- **NFC** (2367) and **PDV2017** (133): Sirach 1 is `SIR.1_1`; `SIR.1` is the prologue the source
  filed as chapter 1. Chapter 2 is identical.
- **OST** (131): Galatians 3:28, Hebrews 12:11 and Revelation 22:10 are served whole, their first
  word printed `I1`. Daniel 2:23, 1 Thessalonians 1:6 and James 5:10 are absent there too.
- **FMAR** (62): the ten chapters read are byte for byte the source, defects included. Nothing to
  supply.
- **TLV** (314): Jonah 4 has ten rows there too, identical to the source. Nothing to supply.
- **BFC** (63): Baruch has five chapters and there is no Letter of Jeremiah, as
  [ADR-0012](./0012-model-modern-catholic-bible-editions.md) records.
- **FRC97** (2096, retired): `bible.id.not_found`, and absent from the French catalogue. The
  generator already builds FRC97 from BFC 63, which is why both sources hold the same bytes.
- **CHU** and **POV**: no Chouraqui and no Parole vivante version in the French catalogue.

## Decision

### A patch produces a complete new source

`config/ordinary-bible-source-patches.json` records, per Bible, the earlier source (URL and
SHA-256), the provider version, and the chapters completed from the provider.
`resources:publication:bible-source-patches build` writes the patched source: the earlier file with
those chapters rewritten and every other byte kept, serialized the way the earlier file was. Its
SHA-256 is recorded and is its key: `r2://…/sources/<sha256>/bible-<v>.json`.

The record holds no Bible text. For each chapter it keeps the provider reference, the URL, the date
and the SHA-256 of the answer that was read, the hash of every supplied verse, the runs of rows
that changed number, the hash of every dropped row, and a sentence of evidence. `build` fails when
the earlier source, an answer or the outcome of a chapter is not the recorded one. `draft --file`
computes that record from a draft, `report` prints it by reference, length and hash, and
`report --text` shows the supplied verses on the operator's machine only.

### One edition per chapter

A chapter takes the provider's verse numbers. A source row that reads as the provider's verse,
whitespace and typographic variants aside, keeps its bytes under that number. A verse no source row
matches is supplied by the provider. A source row no provider verse matches is dropped and
recorded: the two halves of a cut verse, or the prologue filed as Sirach 1.

Supplied text is read exactly as the generator reads it (notes left out, a block of verses under
its first number, a line break where a paragraph ends) and written the way the source writes
paragraph breaks: as the generator does (NET, NFC, PDV2017), with a space after every break but the
last of the chapter (NLT), or without breaks (OST). The reader in the repository was compared
with the generator on the 6,530 answers cached on 2026-10-08 (171,792 verses) and agrees on all.

A patch is recorded only when the chapters the source and the provider share read the same. A
provider that serves another revision of a translation would need the whole Bible refetched, which
is a separate decision; a chapter would then be replaced whole, never mixed.

### Another edition of the same text

Where the provider lacks a verse as well, a chapter may be read from another published edition of
the same text, named on the chapter (`provider`). Such an edition is retained only when whole
chapters of it read as the source, and the verses on both sides of the gap do.

OST is two texts. Its Old Testament is the Ostervald 1996 text of the Unbound Bible: 23,185 of its
23,212 rows are identical in the OSIS file gratis-bible publishes (`fr/ostv1996`), and in the
eBible.org edition `fra_fob` under another verse numbering. Its New Testament is the Ostervald 1877
text digitised by levigilant.com in 2011: Romans has 431 identical rows of 432 there, James 103 of
107 and the differences are an accent. That site prints James 5:10 behind the number `1O`, which is
how the verse was lost; a chapter records how such a number reads (`labels`), and any other label
that is not a number fails.

An edition publishes whole files, so the answer of a chapter is the file it is read from: one OSIS
file for a Bible, one page for a book. It is recorded and anchored like a chapter answer.

FMAR needs no text: what it lacks is inside its own rows, and repairs split them (ADR-0075).

### Requests to the provider

`fetch` reads only the chapters a patch names, with plain GET requests of the public endpoint, one
at a time and at most one per second across runs, each answer kept in
`outputs/bible-sources/provider-cache/bible.com/` and never requested twice. The file of another
edition is kept beside it, under the name of its host, with a request log of its own. Every request is
logged there and counted against a cap. Any answer that is not the chapter stops the run and is
kept for the operator to read; it is never retried or worked around.

### Repairs apply to the patched source

A patched source is a source: repairs anchor on its SHA-256 and apply after it. A repair that the
provider's text replaces is removed. OST loses its three `join` repairs and the three shifts that
followed them; NET keeps its two splits.

The provider prints the three OST verses with the digit one for the second letter of their first
word, which is how the earlier source came to cut them. A new repair, `misprint`, reads one digit
as one letter at a recorded offset, anchored like the others. It rewrites nothing else.

OST Daniel 2:23, 1 Thessalonians 1:6 and James 5:10, which the provider lacks as well, are
supplied from the two editions above, and the `shift` repairs that renumbered the rows after each
gap are gone. Daniel 2:31 and James 5:7, 5:8 and 5:12 take the reading of those editions, which
differs from the source by one letter or one accent.

### The configuration names uploaded sources only

`config/ordinary-bible-sources.json` keeps naming the earlier source until the patched one is in
R2. Until then every command that reads a patched Bible fails (`bible-source-patch-pending`) unless
it is given the local file: `build` writes `outputs/bible-sources/patched/source-overrides.json`
for `resources:publication:bibles --source-overrides` and `text-overrides.json` for
`resources:words-of-jesus … --text-overrides`. A publication built that way records the R2 location
its source will have, never the local path or the earlier URL.

`upload` puts each patched source under its key. `adopt` reads each one back from R2, proves its
SHA-256, then points the configuration at it.

## Consequences

NLT, NET, NFC, PDV2017 and OST get a new text revision. None has a Strong index and none is the
base text of an interlinear index.

NFC and PDV2017 no longer publish the translator's prologue of Sirach, as BFC never did; their
Sirach 1 has 27 rows, three verses being left out by those editions.

OST Daniel 2:23-48, 1 Thessalonians 1:6-9 and James 5:10-19 move by one, to the reference the
verse has in every other Bible, and Daniel 2:23, 1 Thessalonians 1:6 and James 5:10 are published.

Still missing, because the provider does not carry them: the CHU, POV and TLV items of the
inventory, an FRC97 text of its own, and BFC Baruch 6.

A patched source can be rebuilt only from the answers that were read. The provider may serve
something else later; the cached answers are kept with the operator's sources, and the uploaded
patched source remains the published input either way.
