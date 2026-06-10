# BDS Strong Generation Report

Generated on 2026-06-10.

## Summary

The project now includes a repeatable TypeScript pipeline that generates a local Strong-tagged Bible du Semeur TSV from `data/bibles/bible-bds.json`.

Run:

```sh
npm run generate:strong -- --bible bds
```

Generated local artifacts:

- `outputs/bible-bds-strong.tsv`
- `outputs/bible-bds-strong.metrics.json`
- `outputs/bible-bds-strong.diagnostics.json`

These files are ignored by Git because they include generated Bible text and diagnostics derived from local source data.

## Method

The implemented method is a pragmatic reference-transfer pipeline:

1. Parse `data/bibles/bible-bds.json` as the target Bible.
2. Parse the local Strong-tagged references:
   - `data/strongs/Sg1910.csv`
   - `data/strongs/Darby.csv`
   - `data/strongs/DarbyR.csv`
3. For each BDS verse, align target French tokens against the same verse in the Strong references.
4. Transfer Strong codes on exact normalized matches, conservative stem matches, and conservative prefix-window matches.
5. Build a global fallback lexicon from statistically dominant French word-to-Strong pairs in the references.
6. Render the target verse as TSV text with `<w>` tags.

Generated tags include audit metadata:

```html
<w
  strong="H0430"
  data-confidence="0.99"
  data-source="Sg1910+Darby+DarbyR"
  data-method="exact"
  >...</w
>
```

No external datasets were downloaded for this pass. The implementation used only the local source files already present in `data/`.

## Metrics

From `outputs/bible-bds-strong.metrics.json`:

| Metric                                 |   Value |
| -------------------------------------- | ------: |
| Input verses                           |  31,112 |
| Generated verses with at least one tag |  31,054 |
| Failed verses with no generated tags   |      58 |
| Verse coverage                         |  99.81% |
| Target word count                      | 783,143 |
| Tagged target words                    | 324,804 |
| Tagged-token coverage                  |  41.47% |
| Low-confidence verses                  |   3,076 |
| Low-confidence tagged words            |   3,302 |
| Average confidence on tagged words     |  95.20% |
| Global exact lexicon entries           |   9,753 |
| Global stem lexicon entries            |   2,825 |

Diagnostics summary:

| Diagnostic               | Count |
| ------------------------ | ----: |
| `low-confidence`         | 3,076 |
| `no-tagged-target-words` |    58 |

Example references without BDS text excerpts:

| Bucket            | Reference    | Notes                                                |
| ----------------- | ------------ | ---------------------------------------------------- |
| High confidence   | `Gen.1.2`    | 11 tags, average confidence about 98.27%.            |
| Medium confidence | `Gen.3.3`    | 11 tags, average confidence about 89.82%.            |
| Low coverage      | `Gen.3.18`   | 3 tags; flagged because verse-level coverage is low. |
| No generated tags | `Exod.16.36` | Flagged as `no-tagged-target-words`.                 |

## Output Format

The generated TSV keeps the same top-level shape as the local Strong CSV files:

```txt
book_id	num_chapter	num_verse	text
```

The `text` field preserves the BDS verse text with generated Strong tags around matched words. Tabs are normalized to spaces and line breaks are escaped as `\n` so each verse remains one TSV row.

## Quality Notes

This is a working local generation pipeline, not a final scholarly-grade Strong edition.

Strengths:

- Runs across the full BDS input without crashing.
- Preserves book, chapter, and verse references.
- Avoids committing generated copyrighted Bible text.
- Produces confidence, source, and method metadata on each generated tag.
- Provides diagnostics for low-confidence and failed verses.

Known limitations:

- The method transfers tags from French references instead of aligning directly to Hebrew/Greek source tokens.
- Token coverage is partial at 41.47%; many paraphrastic BDS words do not appear in the same wording as Sg1910 or Darby.
- Confidence is strongest for exact agreement between references, but it is not a semantic correctness proof.
- Verse-level differences and alternate phrasing reduce recall.
- The fallback lexicon intentionally favors precision over coverage and skips ambiguous word-to-Strong mappings.

## Recommended Next Steps

1. Add an optional original-language alignment backend using Macula Greek/Hebrew or Clear.Bible data.
2. Add an LLM review pass only for low-confidence diagnostics, not for the full corpus.
3. Evaluate by running the same transfer pipeline against a known Strong-tagged French Bible and comparing generated tags to the existing tags.
4. Add richer diagnostics by book and testament.
5. Add a review UI or export for human correction of low-confidence verses.
