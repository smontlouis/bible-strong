# Reader-Mode Strong Generation

## Purpose

The previous `strong-align` pipeline is an audit/interlinear mode: every WLC/SBLGNT Strong occurrence is represented, and unaligned original occurrences become empty tags.

The new reader-mode pipeline is calibrated against the existing French Strong editions (`Sg1910`, `Darby`, `DarbyR`). Its goal is a fluent Bible reading experience:

- transfer Strong tags to visible French words when the local references support the mapping;
- use WLC/SBLGNT only as validation, not as a requirement to represent every original occurrence;
- add empty Strong tags only when at least two local Strong references use an empty tag for the same verse/code;
- preserve diagnostics and confidence metadata.

This matches the editorial behavior documented by concordance.bible: untranslated original words may appear on empty words, and multiple Strong numbers may be attached to one translated word when relevant. Source: https://concordance.bible/Sg1910/download/

The complete original/morphological sources remain useful for validation. Projects such as OSHB/MorphHB explicitly target lemma and morphology analysis of the WLC, which is a different product surface from a fluent reader Bible. Source: https://github.com/openscriptures/morphhb

## Command

```sh
npm run generate:strong:reader -- --bible nbs
npm run generate:strong:reader -- --bible bds
npm run generate:strong:reader -- --bible fmar
```

## Outputs

- `outputs/bible-nbs-strong-reader.tsv`
- `outputs/bible-nbs-strong-reader.metrics.json`
- `outputs/bible-nbs-strong-reader.diagnostics.json`
- equivalent files for `bds` and `fmar`

`outputs/` remains ignored by Git.

## Reference Profile

Local reference profile:

| Source | Strong tags | Empty tags | Empty rate |
| ------ | ----------: | ---------: | ---------: |
| Sg1910 |     417,322 |      8,093 |      1.94% |
| Darby  |     417,874 |      4,446 |      1.06% |
| DarbyR |     417,236 |      6,447 |      1.55% |

Average:

- `423,322` Strong occurrences
- `1.50%` empty Strong rate

## Generated Reader Metrics

| Bible | Verses generated | Tagged words | Strong occurrences on words | Empty tags | Empty rate | Original confirmation |
| ----- | ---------------: | -----------: | --------------------------: | ---------: | ---------: | --------------------: |
| NBS   |  31,130 / 31,169 |      360,055 |                     365,495 |      4,570 |      1.23% |                95.30% |
| BDS   |  31,044 / 31,112 |      311,825 |                     316,788 |      4,526 |      1.41% |                95.22% |
| F-MAR |  30,731 / 31,057 |      374,994 |                     379,495 |      3,090 |      0.81% |                95.43% |

## Comparison With Complete Mode

NBS complete original mode:

- `600,668` rendered `<w>` tags
- `255,094` empty tags
- `42.47%` rendered empty tags

NBS reader mode:

- `364,625` rendered `<w>` tags
- `4,570` empty tags
- `1.25%` rendered empty tags

The reader mode is therefore much closer to Darby/Sg1910/DarbyR editorial behavior.

## Acceptance Notes

- The previous complete-original prototype has been retired from the runnable scripts. Use `npm run generate:strong:hybrid` for production-local generation and `npm run evaluate:strong:hybrid` for masked gold evaluation.
- Reader mode should be the default candidate for user-facing Bibles.
- Empty tags are now editorial consensus tags, not a fallback for every unaligned original token.
