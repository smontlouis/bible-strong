# STEP TAHOT/TAGNT Interlinear Release

## Runtime product

The downloadable product is the compact projection:

```text
outputs/releases/bible-step-interlinear-runtime-v5/
  bible-step.json
  bible-step-interlinear-fr.sqlite
  bible-step-interlinear-en.sqlite
  catalog.json
```

Build it from the validated authoring ledger with:

```sh
npm run strong:release:step-interlinear:runtime
```

The runtime SQLite files deliberately omit source-line ids, STEP provenance,
edition variants, duplicated original surfaces, and authoring indexes. The
original surface is sliced from `bible-step.json` with the token and segment
offsets.

Each runtime segment keeps only what the viewer needs:

- token and segment offsets;
- exact surface transliteration;
- exact lemma;
- compact STEP morphology code;
- localized gloss;
- optional `strong`, `estrong`, `dstrong`, and `ustrong` code references.

The morphology explanation is not repeated for every occurrence. The compact
code, such as `V-FAI-3S` or `HVqp3ms`, is resolved through the morphology tables
already present in the production lexicon.

The French contextual-gloss policy is deterministic:

1. STEP TAHOT/TAGNT remains the authority for the original occurrence,
   morphology, and identities.
2. The translated exact `dStrong` entry supplies the lexical French sense.
3. Sg1910, Darby revised, and Darby are occurrence-aligned by verse, classical
   Strong, exact cardinality, and source order. A visible aligned carrier such
   as `créa`, `préparera`, or `faites` supplies the inflected contextual form.
4. Sg1910 is the preferred contextual witness. Exact agreement with another
   witness is recorded as `reference-context-consensus`.
5. When occurrence cardinality is different or no visible witness exists, the
   publisher retains the translated lexical `dStrong` gloss rather than
   guessing a French inflection.

The English runtime gloss remains the contextual TAHOT/TAGNT gloss.

Runtime schema:

- `ResourceMetadata`
- `Verses`
- `Tokens`
- `Segments`
- `Transliterations`
- `Lemmas`
- `Morphologies`
- `Glosses`
- `StrongCodes`
- `StrongVerseIndex`

`Segments` contains four nullable code references (`strongCodeId`,
`eStrongCodeId`, `dStrongCodeId`, and `uStrongCodeId`). The source audit proved
that a canonical segment has at most one identity of each kind, so the runtime
does not need a large many-to-many join table.

V5 deliberately keeps those four exact segment references and adds a separate,
verse-level inverted index:

```sql
CREATE TABLE StrongVerseIndex (
  codeId INTEGER NOT NULL REFERENCES StrongCodes(id),
  verseId INTEGER NOT NULL REFERENCES Verses(id),
  kindMask INTEGER NOT NULL CHECK(kindMask BETWEEN 1 AND 15),
  PRIMARY KEY(codeId, verseId)
) WITHOUT ROWID;
```

The primary-key B-tree is the concordance index. There is exactly one row per
Strong code and verse, regardless of how often the identity occurs in that
verse. `kindMask` records the families present: `1=strong`, `2=estrong`,
`4=dstrong`, and `8=ustrong`. Exact occurrence multiplicity and the association
to `Segments.id` and `Tokens.id` remain in the four segment references.

This hybrid representation was chosen instead of a normalized row per
segment/identity. The fully normalized alternative would require both a
`(codeId, verseId, segmentId)` index for concordance and a reverse
`(segmentId, ...)` index for rendering a page. V5 stores only the 704,391
deduplicated code/verse pairs and reuses the existing token/segment indexes
after the 60 verse ids are known.

`StrongCodes.code` has the unique index
`idx_runtime_strong_codes_code`. The publisher runs `VACUUM` and then
`ANALYZE`; the shipped databases include `sqlite_stat1` rows for both
concordance indexes.

The full runtime V5 projection contains all 31,210 JSON verses, 443,239
canonical tokens, and 607,175 segments. The two SQLite files together use
109,416,448 bytes instead of 411,226,112 bytes for the authoring pair, a 73.39%
reduction. French contextual witness forms cover 381,516 segments; the
remaining 225,659 segments retain the exact lexical French fallback. These
fallbacks mainly include grammatical particles, Hebrew sub-word segments,
unrepresented occurrences, and structurally empty segments.

All 2,122 non-empty runtime morphology values resolve to a morphology entry in
the production lexicon. TAHOT sub-word codes inherit their token's Hebrew (`H`)
or Aramaic (`A`) language prefix. TAGNT contracted forms containing more than
one Strong/morphology pair are emitted as logical segments. For example,
`G1473=P-1NS + G2532=CONJ` retains both the pronoun and conjunction analyses
without copying the Greek surface twice.

The JSON hash and source-ledger hashes are embedded in both SQLite files.
Publication verifies SQLite integrity, exact JSON verse coverage, token ranges,
identical French/English structure, and exact parity between the four segment
columns and `StrongVerseIndex` before the runtime folder is renamed into place.

## Concordance SQL for bible-strong-app

All queries use bound integer/text parameters. `Verses.id` is assigned in
canonical `(bookOrder, chapter, verse)` order and publication tests that
invariant. Ordering the inverted primary key by `verseId` is therefore both
canonical and index-native.

Resolve the user-facing code once:

```sql
SELECT id AS codeId
FROM StrongCodes
WHERE code = ?;
```

Count matching verses by book. `count(*)` is correct because the inverted table
has one row per code and verse:

```sql
SELECT v.bookOrder, v.bookId, count(*) AS verseCount
FROM StrongVerseIndex AS i
JOIN Verses AS v ON v.id = i.verseId
WHERE i.codeId = ?
GROUP BY v.bookOrder, v.bookId
ORDER BY v.bookOrder;
```

Load the first 60 canonical locations:

```sql
SELECT v.id AS verseId, v.bookOrder, v.bookId, v.chapter, v.verse, v.ref
FROM StrongVerseIndex AS i
JOIN Verses AS v ON v.id = i.verseId
WHERE i.codeId = ?
ORDER BY i.verseId
LIMIT 60;
```

Prefer keyset pagination for subsequent pages, binding the previous page's last
`verseId`:

```sql
SELECT v.id AS verseId, v.bookOrder, v.bookId, v.chapter, v.verse, v.ref
FROM StrongVerseIndex AS i
JOIN Verses AS v ON v.id = i.verseId
WHERE i.codeId = ? AND i.verseId > ?
ORDER BY i.verseId
LIMIT 60;
```

Finally load the token and segment ranges for the returned verse ids. Generate
one placeholder per id in the `IN` clause. Offsets are UTF-16 code units into
the verse string from `bible-step.json`.

```sql
SELECT
  t.verseId,
  t.id AS tokenId,
  t.readingOrdinal,
  t.startOffset AS tokenStartOffset,
  t.length AS tokenLength,
  s.id AS segmentId,
  s.ordinal AS segmentOrdinal,
  s.startOffset AS segmentStartOffset,
  s.length AS segmentLength,
  strong.code AS strong,
  estrong.code AS estrong,
  dstrong.code AS dstrong,
  ustrong.code AS ustrong
FROM Tokens AS t
JOIN Segments AS s ON s.tokenId = t.id
LEFT JOIN StrongCodes AS strong ON strong.id = s.strongCodeId
LEFT JOIN StrongCodes AS estrong ON estrong.id = s.eStrongCodeId
LEFT JOIN StrongCodes AS dstrong ON dstrong.id = s.dStrongCodeId
LEFT JOIN StrongCodes AS ustrong ON ustrong.id = s.uStrongCodeId
WHERE t.verseId IN (?, ?, /* ... up to 60 */ ?)
ORDER BY t.verseId, t.readingOrdinal, s.ordinal;
```

The first three queries never access `Segments`. The fourth query is bounded to
the selected verses and uses `idx_runtime_tokens_verse_ordinal` followed by
`idx_runtime_segments_token_ordinal`.

## V4 versus V5 benchmark

Run the reproducible desktop benchmark with:

```sh
npm run strong:benchmark:step-interlinear:runtime
```

It writes
`reports/step-interlinear-runtime-v5-benchmark.{json,md}`. On 2026-07-30 with
Node 22.21.1, SQLite 3.50.4, Apple arm64, a 64 MiB SQLite cache, two warmups,
three measured V4 iterations and 25 measured V5 iterations, the warm medians
were:

| Case             | Code     | Verses | V4 count | V5 count | V4 page 60 | V5 page 60 | V5 spans |
| ---------------- | -------- | -----: | -------: | -------: | ---------: | ---------: | -------: |
| very frequent    | `G2316`  |  1,152 |   94.497 |    0.247 |     75.914 |      0.026 |    1.128 |
| medium frequency | `G4459`  |    100 |   93.686 |    0.030 |     81.665 |      0.026 |    1.055 |
| rare             | `G0003`  |      1 |   93.349 |    0.005 |     93.627 |      0.004 |    0.022 |
| `strong` family  | `H9002`  | 15,635 |  101.883 |    2.885 |      0.323 |      0.022 |    1.270 |
| `estrong` family | `H5921a` |  4,482 |   95.504 |    0.916 |      1.110 |      0.026 |    1.313 |
| `dstrong` family | `H3068G` |  7,190 |   97.770 |    1.428 |      0.382 |      0.023 |    1.223 |
| `ustrong` family | `H0776H` |  2,208 |   94.758 |    0.460 |      0.688 |      0.023 |    1.305 |
| absent           | —        |      0 |   94.324 |    0.004 |     96.065 |      0.003 |    0.000 |

Times are milliseconds. The V4 page can stop early for identities common near
the beginning of the canon, explaining its low value for some very frequent
Hebrew identities; its count still traverses the complete
verse/token/segment path. Every V5 count and page uses
`SEARCH i USING PRIMARY KEY (codeId=?)`. The span query uses only the two
existing chapter-loading indexes.

Size comparison:

| Artifact pair | SQLite bytes |  ZIP bytes |
| ------------- | -----------: | ---------: |
| V4 FR + EN    |   93,253,632 | 39,958,694 |
| V5 FR + EN    |  109,416,448 | 45,077,228 |
| Added         |   16,162,816 |  5,118,534 |

In the French V5 database, `StrongVerseIndex` occupies 7,815,168 bytes and
`idx_runtime_strong_codes_code` 266,240 bytes according to `dbstat`.

## Authoring ledger

The STEP interlinear release is generated from one canonical token ledger and
published as three primary artifacts:

```text
outputs/releases/bible-step-interlinear-ledger-v2/
  bible-step.json
  bible-step-interlinear-fr.sqlite
  bible-step-interlinear-en.sqlite
  catalog.json
```

Generate the immutable authoring ledger with:

```sh
npm run strong:release:step-interlinear:ledger
```

Use `--only Gen.1`, `--only Matt.1`, or another book/chapter/reference with a
separate `--output-dir` for a bounded pilot. The publisher refuses to overwrite
an existing directory.

## Product views

- Reading mode reads only `bible-step.json`.
- Strong mode reads the flat verse from the JSON and applies canonical token
  spans plus `SegmentStrongCodes` from either SQLite.
- Interlinear mode expands the same tokens with segment surface,
  transliteration, original lemma, morphology, localized gloss, and Strong
  identities.

Strong mode is therefore a collapsed interlinear view, not an independently
generated Strong Bible.

## Text policy

- TAHOT follows source order and includes the translator-oriented Qere,
  restored (`R`), and LXX-backed (`X`) rows.
- TAGNT uses words whose edition inventory includes NA28. Other TAGNT rows stay
  in `Tokens` with `isCanonical=0` and no flat-text span so that they remain
  available as textual variants.
- Alternative versification coordinates are part of the stable physical token
  id. This distinguishes source rows such as `Ps.51.0(51.1)#01` and
  `Ps.51.0(51.2)#01` without losing either occurrence.

`startOffset` and `length` use UTF-16 code units and always refer to the exact
verse string in `bible-step.json`.

## SQLite schema

Both localized databases have the same structural schema and token ids:

- `ResourceMetadata`
- `Verses`
- `Tokens`
- `TokenSegments`
- `StrongCodes`
- `SegmentStrongCodes`

Only the localized `TokenSegments.gloss`, `glossSource`, and `confidence`
values differ. English glosses come directly from the contextual TAHOT/TAGNT
field. French glosses use the exact translated STEP subentry when available.
Historical unsuffixed codes are resolved through their classical Strong family
and the contextual English gloss; those rows carry
`glossSource=lexicon-v3-fr-classical-context`. Structural empty Qere segments
remain explicit and carry `glossSource=STEP-structural-empty`.

Strong identities use the compact product policy:

- keep the classical `strong`;
- add `estrong`, `dstrong`, or `ustrong` only when the code adds a distinct
  identity;
- preserve STEP suffix case exactly.

The numeric `StrongCodes.kind` values are:

| Value | Identity  |
| ----: | --------- |
|     0 | `strong`  |
|     1 | `estrong` |
|     2 | `dstrong` |
|     3 | `ustrong` |

## Pair validation

Both SQLite files record the exact JSON SHA-256 and the same token
fingerprint. Publication fails unless:

- every canonical token span reconstructs its exact surface from the JSON;
- French and English structural metadata and token tables match;
- verse, token, segment, and identity counts match;
- both SQLite integrity checks return `ok`;
- the source and lexicon digests are recorded in `catalog.json`.

Applications must reject a JSON/SQLite pair when `textSha256` differs. When
both locales are installed, join them by `Tokens.id` and segment `ordinal`.
