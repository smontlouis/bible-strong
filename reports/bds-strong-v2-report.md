# BDS Strong Generation V2 Report

Generated on 2026-06-10.

## Summary

V2 adds an original-language verification layer on top of the V1 French reference-transfer pipeline.

Run:

```sh
npm run generate:strong:v2 -- --bible bds
```

Generated local artifacts:

- `outputs/bible-bds-strong-v2.tsv`
- `outputs/bible-bds-strong-v2.metrics.json`
- `outputs/bible-bds-strong-v2.diagnostics.json`

These files are ignored by Git because they contain generated Bible du Semeur text.

## External Sources

The following open sources were downloaded under `data/external/`, which is ignored by Git:

| Source                 | Local path                    | URL                                            | License notes                                                                                         |
| ---------------------- | ----------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Clear-Bible Alignments | `data/external/Alignments`    | <https://github.com/Clear-Bible/Alignments>    | Code MIT; data CC BY 4.0 per repository license.                                                      |
| MACULA Greek           | `data/external/macula-greek`  | <https://github.com/Clear-Bible/macula-greek>  | CC BY 4.0 per repository license. Downloaded for inspection and future expansion.                     |
| MACULA Hebrew          | `data/external/macula-hebrew` | <https://github.com/Clear-Bible/macula-hebrew> | Downloaded for inspection and future expansion; V2 currently uses Clear-Bible Alignments source TSVs. |

V2 directly uses these Clear-Bible Alignments source files:

- `data/external/Alignments/data/sources/WLC.tsv`
- `data/external/Alignments/data/sources/SBLGNT.tsv`

These files provide original-language token IDs, text, Strong numbers, glosses, lemmas, POS, and morphology. This gives V2 a verse-level original Strong inventory for the Old and New Testaments.

## Method

V1 transferred Strong tags from local French Strong references:

- `data/strongs/Sg1910.csv`
- `data/strongs/Darby.csv`
- `data/strongs/DarbyR.csv`

V2 keeps that practical alignment layer, but constrains and annotates it with original-language evidence:

1. Parse BDS JSON as target text.
2. Parse local French Strong references.
3. Parse Clear-Bible original source TSV files:
   - WLC for Old Testament Hebrew/Aramaic.
   - SBLGNT for New Testament Greek.
4. Build a per-verse set of original Strong numbers from WLC/SBLGNT.
5. Generate candidate tags from French references and the conservative global lexicon.
6. Mark tags as original-confirmed only when their Strong number is present in that verse's original source inventory.
7. Lower confidence for fallback tags that are not confirmed by original-source inventory.
8. Render tags with audit metadata:

```html
<w
  strong="H0430"
  data-confidence="0.99"
  data-source="Sg1910+Darby+DarbyR+WLC"
  data-method="exact"
  data-original="true"
  >...</w
>
```

## Metrics

From `outputs/bible-bds-strong-v2.metrics.json`:

| Metric                                 |      V1 |      V2 |    Delta |
| -------------------------------------- | ------: | ------: | -------: |
| Input verses                           |  31,112 |  31,112 |        0 |
| Generated verses with at least one tag |  31,054 |  31,044 |      -10 |
| Verse coverage                         |  99.81% |  99.78% | -0.03 pp |
| Tagged words                           | 324,804 | 311,825 |  -12,979 |
| Tagged-token coverage                  |  41.47% |  39.82% | -1.65 pp |
| Average tagged confidence              |  95.20% |  95.89% | +0.69 pp |
| Low-confidence verses                  |   3,076 |   4,289 |   +1,213 |
| Failed/no-tag verses                   |      58 |      68 |      +10 |

V2-specific original-source metrics:

| Metric                                          |   Value |
| ----------------------------------------------- | ------: |
| Original-source verses available                |  31,101 |
| WLC verses                                      |  23,213 |
| WLC tokens                                      | 475,012 |
| SBLGNT verses                                   |   7,939 |
| SBLGNT tokens                                   | 137,741 |
| Original-confirmed tagged words                 | 296,906 |
| Fallback tagged words                           |  14,919 |
| Original-confirmed token coverage               |  37.91% |
| Original confirmation rate among generated tags |  95.22% |

Diagnostics summary:

| Diagnostic                  | Count |
| --------------------------- | ----: |
| `low-confidence`            | 3,967 |
| `low-original-confirmation` |   322 |
| `no-tags`                   |    68 |

Example references without BDS text excerpts:

| Bucket                          | Reference            | Notes                                                                     |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| Original-confirmed low coverage | `Gen.3.18`           | 3 tags, all original-confirmed; flagged for low verse coverage.           |
| Low original confirmation       | see diagnostics JSON | 322 verses have less than 50% original confirmation among generated tags. |
| No generated tags               | see diagnostics JSON | 68 verses have no generated tags.                                         |

## Quality Assessment

V2 is objectively better than V1 on original-source auditability and expected precision:

- 95.22% of generated tags are confirmed against WLC/SBLGNT verse-level Strong inventories.
- Generated tags now carry `data-original="true"` or `data-original="false"`.
- V2 documents external source URLs, licenses, and local paths.
- V2 distinguishes original-confirmed tags from fallback tags, making review workflows more reliable.

The tradeoff is lower recall:

- Tagged-token coverage drops from 41.47% to 39.82%.
- V2 intentionally avoids some V1 tags that cannot be confirmed against the verse's original Strong inventory.

## Limitations

This is not yet a full semantic word alignment from BDS French tokens to Hebrew/Greek tokens. It is a verse-level original Strong constraint over a French-reference transfer pipeline.

Important remaining limits:

- Original confirmation proves that the Strong appears in the same original verse, not that the exact BDS word is the correct translation of that exact original token.
- BDS paraphrase and dynamic-equivalence wording still reduce recall.
- Clear-Bible Alignments cloned source TSVs include original source inventories, but this implementation does not yet consume prebuilt target-language alignment bundles.
- MACULA Greek/Hebrew were downloaded for inspection and future work, but V2 uses the simpler Clear-Bible WLC/SBLGNT TSVs because they already expose Strong numbers in a direct TSV format.

## Recommended V3

The next quality jump requires true word alignment:

1. Use SimAlign or eflomal to align BDS tokens directly to WLC/SBLGNT token glosses, lemmas, or a pivot translation.
2. Use Clear-Bible alignment bundles if a compatible French or close-language target becomes available.
3. Add an LLM review pass only for diagnostics, especially `low-original-confirmation` and `no-tags`.
4. Add manual review export by reference and book.
5. Evaluate against Sg1910 by generating from untagged Segond text and comparing with known Strong tags.
