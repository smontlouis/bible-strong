# Original Alignment Strong Report

Generated on 2026-06-11.

## Summary

This iteration adds a complete original Strong occurrence generator.

Run:

```sh
npm run generate:strong:align -- --bible nbs
npm run generate:strong:align -- --bible bds
```

Generated local artifacts:

- `outputs/bible-nbs-strong-align.tsv`
- `outputs/bible-nbs-strong-align.metrics.json`
- `outputs/bible-nbs-strong-align.diagnostics.json`
- `outputs/bible-bds-strong-align.tsv`
- `outputs/bible-bds-strong-align.metrics.json`
- `outputs/bible-bds-strong-align.diagnostics.json`

The generated Bible text outputs remain ignored by Git.

## What Changed

V1 and V2 counted how many French words could be tagged. This version changes the primary target:

> Every original Strong occurrence should be represented in the output.

For each compatible verse, the generator now:

1. Reads original WLC/SBLGNT source tokens with Strong numbers.
2. Builds original Strong occurrences, preserving duplicates.
3. Uses French-reference and lexicon evidence to attach some occurrences to real French words.
4. Emits empty `<w>` tags for original Strong occurrences that are not aligned to a real French word.
5. Reports real-word vs empty-tag rates separately.

This means `strongCoverage` is now an occurrence-based source coverage metric, not a French token coverage metric.

## External Sources

| Source                 | Local path                                         | URL                                            | License notes                                                     |
| ---------------------- | -------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| Clear-Bible Alignments | `data/external/Alignments`                         | <https://github.com/Clear-Bible/Alignments>    | Code MIT; data CC BY 4.0 per repository license.                  |
| WLC source TSV         | `data/external/Alignments/data/sources/WLC.tsv`    | <https://github.com/Clear-Bible/Alignments>    | Used for OT original Strong occurrences.                          |
| SBLGNT source TSV      | `data/external/Alignments/data/sources/SBLGNT.tsv` | <https://github.com/Clear-Bible/Alignments>    | Used for NT original Strong occurrences.                          |
| MACULA Greek           | `data/external/macula-greek`                       | <https://github.com/Clear-Bible/macula-greek>  | Downloaded locally for inspection/future backend work; CC BY 4.0. |
| MACULA Hebrew          | `data/external/macula-hebrew`                      | <https://github.com/Clear-Bible/macula-hebrew> | Downloaded locally for inspection/future backend work.            |

## Output Format

Real-word tag:

```html
<w
  strong="H7225"
  data-empty="false"
  data-original-token="o010010010012"
  data-original-occurrence="o010010010012:0"
  data-confidence="0.99"
  data-method="exact"
  data-source="Sg1910+Darby+DarbyR+original"
  data-fallback="false"
  >commencement</w
>
```

Empty original occurrence tag:

```html
<w
  strong="H0853"
  data-empty="true"
  data-original-token="o010010010041"
  data-original-occurrence="o010010010041:0"
  data-confidence="0.35"
  data-method="empty-original"
></w>
```

Multiple Strong occurrences on one French word are supported:

```html
<w strong="H7970 H3967" data-empty="false" data-original-token="... ...">130</w>
```

## Metrics

### NBS

From `outputs/bible-nbs-strong-align.metrics.json`:

| Metric                         |   Value |
| ------------------------------ | ------: |
| Verse count                    |  31,169 |
| Processed verses               |  31,152 |
| Skipped/source mismatch verses |      17 |
| French token count             | 733,829 |
| Tagged French token count      | 311,048 |
| Tagged French token rate       |  42.39% |
| Original Strong occurrences    | 612,753 |
| Represented Strong occurrences | 612,753 |
| Missing Strong occurrences     |       0 |
| Strong coverage                | 100.00% |
| Real-word Strong occurrences   | 315,231 |
| Empty Strong occurrences       | 297,522 |
| Real-word Strong rate          |  51.45% |
| Empty Strong rate              |  48.55% |
| Multi-Strong French words      |   3,737 |

Evaluation against `Sg1910` occurrence sets:

| Metric                |   Value |
| --------------------- | ------: |
| Evaluated verses      |  31,152 |
| Expected occurrences  | 422,213 |
| Generated occurrences | 612,753 |
| True positives        | 399,973 |
| False positives       | 212,780 |
| False negatives       |  22,240 |
| Precision             |  65.27% |
| Recall                |  94.73% |
| F1                    |  77.29% |

### BDS

From `outputs/bible-bds-strong-align.metrics.json`:

| Metric                         |   Value |
| ------------------------------ | ------: |
| Verse count                    |  31,112 |
| Processed verses               |  31,101 |
| Skipped/source mismatch verses |      11 |
| French token count             | 783,143 |
| Tagged French token count      | 266,153 |
| Tagged French token rate       |  33.99% |
| Original Strong occurrences    | 611,887 |
| Represented Strong occurrences | 611,887 |
| Missing Strong occurrences     |       0 |
| Strong coverage                | 100.00% |
| Real-word Strong occurrences   | 269,890 |
| Empty Strong occurrences       | 341,997 |
| Real-word Strong rate          |  44.11% |
| Empty Strong rate              |  55.89% |
| Multi-Strong French words      |   3,258 |

Evaluation against `Sg1910` occurrence sets:

| Metric                |   Value |
| --------------------- | ------: |
| Evaluated verses      |  31,101 |
| Expected occurrences  | 421,684 |
| Generated occurrences | 611,887 |
| True positives        | 399,474 |
| False positives       | 212,413 |
| False negatives       |  22,210 |
| Precision             |  65.29% |
| Recall                |  94.73% |
| F1                    |  77.30% |

### Generic Compatibility Smoke Test

The same command also ran successfully on `fmar`:

```sh
npm run generate:strong:align -- --bible fmar
```

Result:

| Metric                |           Value |
| --------------------- | --------------: |
| Processed verses      | 30,924 / 31,057 |
| Strong coverage       |         100.00% |
| Real-word Strong rate |          53.18% |
| Empty Strong rate     |          46.82% |

## Interpretation

The generator now satisfies the complete Strong representation requirement for compatible verses:

- NBS: `missingStrongOccurrenceCount = 0`
- BDS: `missingStrongOccurrenceCount = 0`

The key tradeoff is visible in the empty-tag rate:

- NBS: 48.55% of original Strong occurrences are represented as empty tags.
- BDS: 55.89% of original Strong occurrences are represented as empty tags.

This is expected because the current real-word alignment still uses conservative French-reference and lexicon evidence. When it cannot confidently attach an original Strong occurrence to a French word, it preserves the occurrence as an empty tag rather than dropping it.

## Diagnostics

Diagnostic files:

- `outputs/bible-nbs-strong-align.diagnostics.json`
- `outputs/bible-bds-strong-align.diagnostics.json`

Current diagnostic categories:

- `sourceTextMismatch`: target verse exists but no compatible original source verse is available.
- `mostlyEmptyStrongOccurrences`: more Strong occurrences are represented as empty tags than real-word tags.
- `missingStrongOccurrences`: reserved for any future failure to represent source occurrences.

Observed counts:

| Bible | sourceTextMismatch | mostlyEmptyStrongOccurrences | missingStrongOccurrences |
| ----- | -----------------: | ---------------------------: | -----------------------: |
| NBS   |                 17 |                       14,083 |                        0 |
| BDS   |                 11 |                       19,090 |                        0 |

## Known Limits

This version is a complete occurrence representation pipeline, but the real-word alignment backend is still heuristic.

What is strong:

- Every original Strong occurrence is preserved.
- Empty tags are explicit and measurable.
- Multiple Strong numbers on one French word are supported.
- Output is generic for French Bible JSON files.
- NBS and BDS both run full-corpus.

What still needs improvement:

- Many occurrences become empty tags because real-word alignment is conservative.
- Precision against Sg1910 is lowered by generating all WLC/SBLGNT source occurrences, including occurrences that Sg1910 may not expose the same way.
- NT source text differences are counted as source mismatch only when the whole verse is unavailable; fine-grained Textus Receptus vs SBLGNT token differences are not fully classified yet.
- No neural aligner is currently used; a SimAlign/eflomal backend remains the next major quality step.

## Recommended Next Step

The next improvement should focus on reducing `emptyStrongRate` while keeping `missingStrongOccurrenceCount = 0`.

Best next backend:

1. Use original token glosses/lemmas plus French reference alignments to train or infer better French-to-original token positions.
2. Add SimAlign or eflomal as a real alignment backend.
3. Keep empty tags as the safety net for unaligned original occurrences.
4. Evaluate per book and by morphology to understand where empty tags remain high.
