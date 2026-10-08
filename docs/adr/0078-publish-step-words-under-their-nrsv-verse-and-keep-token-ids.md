# ADR-0078: Publish STEP words under their NRSV verse and keep interlinear token ids

## Status

Accepted. Refines the text policy of
[ADR-0014](./0014-pair-original-language-text-with-localized-interlinear-indexes.md).

## Context

`BHG` and its two interlinear indexes are built from the STEPBible TAHOT and TAGNT files. Each word
is one line whose first field is `Book.chapter.verse#word=type`. Both sources file a word under the
NRSV versification and may add, in brackets, the number the same word has elsewhere:

| Form                      | Where | Meaning, from the upstream field descriptions |
| ------------------------- | ----- | --------------------------------------------- |
| `Gen.31.55(32.1)#01=L`    | TAHOT | the Hebrew numbering                          |
| `Act.13.39(13.38)#01=NKO` | TAGNT | Nestle-Aland                                  |
| `Php.1.16[1.17]#01=NKO`   | TAGNT | the KJV                                       |
| `Rom.16.25{14.24}#01=NKO` | TAGNT | other editions, mostly the Majority text      |

The publisher read the plain and round-bracketed forms and took every other line for a title or a
comment. The 350 lines under the 48 square- and curly-bracketed references were lost without an
error: nine verses were never published (John 7:53, Romans 16:25-27, 2 Corinthians 13:13,
Philippians 1:16-17, 3 John 15, Revelation 12:18) and thirty-nine verses lacked their first or
their last words.

Interlinear tokens carry sequential integer ids in reading order. Ten Strong Bible indexes point at
them (`stepTokenIds`) to name the original words of a span, and neither the app, the site nor the
Resource service checks which index revision those ids were taken from. Numbering the recovered
words in place would have given a different word to every id from Matthew 15:7 to the end of
Revelation.

## Decision

### A word is published in the verse it is filed under

The verse before the brackets is the verse of the word, in every form: `BHG` follows the NRSV
numbering of its sources, as it already did for the Old Testament (Psalm titles are verse 0, and
the Hebrew number is only an alternate). The bracketed number is kept in the authoring ledger as an
alternate reference with the brackets it was written in (`alternateRefs`, `alternateBrackets`); it
never decides where a word is published. `BHG` is not renumbered to match another Bible, and no
other Bible is renumbered to match it.

### A line that claims to be a word is placed or fails the build

A first field that starts like `Book.chapter.verse`, or that carries the `#word=type` marker, is a
token line. A token line whose reference is not one of the four forms above, or whose book is
unknown, fails the build with `step-interlinear-token-reference-unsupported:<file>:<line>:<field>`.
Titles, field descriptions, `# verse` headers, `#_` interlinear rows and blank lines are the only
lines read as something else.

### Published token ids keep their word

A republication never gives a published token id to another word. Words are still numbered in
reading order, in two passes: first the words under plain and round-bracketed references, which
reproduces the ids of every index published so far, then the words under square- and
curly-bracketed references. Segment ids follow their tokens. Verse ids stay in canonical order,
because the concordance pages on them; they are not exposed by the Resource API and no other
publication points at them.

Readers order tokens by their ordinal inside the verse, never by id, so a recovered word reads in
its place whatever its id.

## Consequences

Rebuilding from the same sources yields 31,219 verses instead of 31,210 and 443,542 tokens instead
of 443,239. Every published verse keeps its text or gains words at one end, and every published
token keeps its id, surface, segments, lemma, morphology, Strong identities and English gloss. In
the twenty-one verses that gain words at the start, the character offset and the ordinal of the
existing words move by one constant.

French contextual glosses are aligned with the French witnesses verse by verse, by the number of
occurrences of each Strong number. Completing a verse changes that count: thirty-eight existing
segments in twenty verses change gloss, most of them back to the lexical gloss where the witness
divides the verse as the KJV does. This is the existing policy applied to the complete verse.

A change of the `BHG` text needs a new text revision, both indexes rebuilt against it, the catalog
constants of `@bible-strong/resource-catalog` updated with them, and an app release that carries
those constants before an installed index can be replaced.

The two-pass numbering protects the ids published so far. It does not protect them against a future
upstream edit that adds or removes a word under a plain reference: a rebuild from changed sources
must compare its token ids with the published index before it is published, or the Strong Bible
indexes must be rebuilt with it.

`src/stepOriginals.ts` reads the same reference field for the Strong tagging and lexicon pipelines
and still ignores the square- and curly-bracketed forms. Reading them there changes the evidence
those pipelines are built from and is left to a change of its own.
