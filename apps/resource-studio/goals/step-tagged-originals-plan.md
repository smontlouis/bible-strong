# Plan: STEP Tagged Originals for Precise Strong Enrichment

## Goal

Use STEP Bible tagged original texts (`TAHOT` for Hebrew OT and `TAGNT` for Greek NT) to enrich our generated Strong TSV data with more precise STEP identifiers:

- classical Strong code (`H7225`, `G3056`)
- extended Strong (`eStrong`)
- disambiguated Strong (`dStrong`)
- unified Strong/concept (`uStrong`)
- original word and lemma data
- full morphology code when available

This is not a replacement for the current French alignment pipeline. It is a stronger original-language reference layer that helps the pipeline choose the correct STEP entry for each verse/token.

## Why This Matters

Our current TSVs usually know the classical Strong number. That is enough to open a dictionary entry, but not always enough to choose the exact sense.

Example:

```text
H0430
```

can map to several STEP entries in `StepEntries`, depending on context and disambiguation.

`TAHOT/TAGNT` should let us know which STEP entry is actually used in the original verse, so the app can eventually display:

```text
H0430 + eStrong + dStrong + uStrong
```

instead of only:

```text
H0430
```

## Current State

We already have:

- `data/dictionaries/strong_lexicon.sqlite`
- `StepEntries`: main Greek/Hebrew lexicon entries from `TBESG/TBESH`
- `LexiconResources`: extended TFLSJ Greek layer linked by `stepEntryId`
- `MorphologyCodes`: explanations for brief and full morphology codes from `TEGMC/TEHMC`

The next missing piece is a per-verse/per-token original text table.

## Proposed DB Additions

### `OriginalTaggedTokens`

Stores tagged original-language tokens from STEP.

```sql
CREATE TABLE OriginalTaggedTokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  testament TEXT NOT NULL,       -- OT / NT
  language TEXT NOT NULL,        -- hebrew / greek / aramaic
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  tokenIndex INTEGER NOT NULL,
  surface TEXT NOT NULL,         -- original visible token
  normalizedSurface TEXT,
  transliteration TEXT,
  morphologyCode TEXT,
  strong TEXT,                   -- classical Strong, if present
  eStrong TEXT,
  dStrong TEXT,
  uStrong TEXT,
  stepEntryId INTEGER,
  source TEXT NOT NULL,          -- TAHOT / TAGNT
  raw TEXT NOT NULL,
  FOREIGN KEY (stepEntryId) REFERENCES StepEntries(id) ON DELETE SET NULL
);
```

Indexes:

```sql
CREATE INDEX idx_OriginalTaggedTokens_ref
  ON OriginalTaggedTokens(book, chapter, verse);

CREATE INDEX idx_OriginalTaggedTokens_stepEntryId
  ON OriginalTaggedTokens(stepEntryId);

CREATE INDEX idx_OriginalTaggedTokens_strong
  ON OriginalTaggedTokens(strong);
```

### Optional Later Table: `StrongTsvEnrichment`

Stores mapping from our generated TSV token/row to the original STEP token.

```sql
CREATE TABLE StrongTsvEnrichment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bibleId TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  tsvTokenIndex INTEGER NOT NULL,
  originalTokenId INTEGER,
  confidence REAL NOT NULL,
  method TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (originalTokenId) REFERENCES OriginalTaggedTokens(id)
);
```

This table should come after we understand the `TAHOT/TAGNT` format and how it aligns with our TSVs.

## Implementation Phases

### Phase 1: Source Inspection

Download/cache:

- `TAHOT`
- `TAGNT`
- any older `TOTHT` files only if they contain data not present in `TAHOT/TAGNT`

Tasks:

- inspect file format
- identify verse reference format
- identify token separators
- identify fields for original word, morphology, Strong, `eStrong`, `dStrong`, `uStrong`
- document known caveats, especially Greek textual variants

Output:

- small parser notes in the plan or a separate report
- sample rows for Genesis 1:1, Psalm 1:1, John 1:1, Romans 8:1

### Phase 2: Import Parser

Extend `scripts/importStepBibleDictionaries.ts` or create a dedicated importer if the format is large/complex.

Preferred if simple:

```text
scripts/importStepBibleDictionaries.ts
```

Preferred if complex:

```text
scripts/importStepTaggedOriginals.ts
```

Tasks:

- download/cache STEP tagged original files
- parse tokens
- populate `OriginalTaggedTokens`
- link each token to `StepEntries.id` using exact match:

```text
language + eStrong + dStrong + uStrong
```

Fallback match:

```text
language + eStrong
```

only if exact fields are missing and the result is unambiguous.

### Phase 3: Coverage Checks

Produce a report with:

- token count by testament/language
- tokens with classical Strong
- tokens with `eStrong`
- tokens linked to `StepEntries`
- tokens not linked
- morphology codes missing from `MorphologyCodes`
- verses missing from expected Bible canon

Minimum acceptance:

- no parser crashes
- high link rate to `StepEntries`
- all missing-link patterns explained

### Phase 4: TSV Enrichment Prototype

Pick one Bible/TSV first.

Suggested test sets:

- Genesis 1
- Psalm 23
- Isaiah 53
- John 1
- Romans 8

For each generated TSV row:

1. read the existing classical Strong
2. load candidate original tokens for the same verse
3. filter by same base Strong
4. choose exact token if there is only one candidate
5. mark ambiguous if multiple candidates remain
6. keep the current Strong if no confident enrichment exists

Output columns could become:

```text
strong
eStrong
dStrong
uStrong
originalTokenId
enrichmentConfidence
enrichmentMethod
```

### Phase 5: Alignment Upgrade

Use original tagged tokens as a gold reference in the existing alignment pipeline.

Possible methods:

- verse-level candidate set restriction
- phrase alignment against original token order
- morphology-aware tie-breaking
- `uStrong` grouping when French words map to multiple related Strong entries
- confidence scoring for ambiguous repeated Strong codes in the same verse

Important rule:

Do not force precision when the evidence is ambiguous. Store uncertainty explicitly.

## Open Questions

- Does `TAHOT/TAGNT` use the same `eStrong/dStrong/uStrong` fields as `TBESG/TBESH`?
- How are Greek textual variants represented?
- Are compound words represented as one token or multiple linked Strong codes?
- Are ketiv/qere or Aramaic OT sections represented distinctly in `TAHOT`?
- Do verse references match our book naming exactly, or do we need a mapping table?
- Should original tagged tokens live in `strong_lexicon.sqlite`, or in a separate `strong_originals.sqlite` if the data is large?

## Recommendation

Start by importing `TAHOT/TAGNT` into the same `strong_lexicon.sqlite` while the project is still exploratory.

If the DB becomes too large or the app only needs dictionaries offline, split later:

```text
strong_lexicon.sqlite
strong_originals.sqlite
```

The practical next step is Phase 1: inspect the STEP tagged original files and confirm their exact field structure before finalizing the importer.
