# S21 Reader Comparison With concordance.bible SG21

## Scope

Local generation:

```sh
npm run generate:strong:reader -- --bible s21
```

Generated files:

- `outputs/bible-s21-strong-reader.tsv`
- `outputs/bible-s21-strong-reader.metrics.json`
- `outputs/bible-s21-strong-reader.diagnostics.json`
- `outputs/s21-concordance-comparison.metrics.json`

External comparison source:

- `https://concordance.bible/SG21/Gen/1/`
- sampled chapters: `Gen 1`, `Gen 2`, `Ps 23`, `Isa 53`, `Matt 1`, `John 1`, `Rom 8`

`https://concordance.bible/SG21/download/` returns 404, so the comparison uses public chapter HTML and does not store a full SG21 Strong dataset locally.

Reproducible comparison:

```sh
npm run compare:s21:concordance
```

## Local S21 Reader Metrics

Full local S21 reader output after original-aware reader enrichment:

- verses generated: `31,160 / 31,168`
- total Strong occurrences represented: `396,490`
- empty Strong rate: `1.00%`
- tagged-token coverage: `50.68%`
- original confirmation rate on tagged words: `95.65%`

Previous local reader baseline:

- total Strong occurrences represented: `378,206`
- empty Strong rate: `1.18%`
- tagged-token coverage: `49.39%`

## Sample Comparison

| Chapter | Local tags | concordance.bible tags | Local empty | concordance.bible empty | Exact Strong multiset verses |
| ------- | ---------: | ---------------------: | ----------: | ----------------------: | ---------------------------: |
| Gen 1   |        386 |                    406 |           5 |                      27 |                       7 / 31 |
| Gen 2   |        300 |                    313 |           4 |                      10 |                       8 / 25 |
| Ps 23   |         51 |                     57 |           0 |                       0 |                        1 / 6 |
| Isa 53  |        158 |                    162 |           0 |                       1 |                       0 / 12 |
| Matt 1  |        317 |                    394 |          45 |                      63 |                       0 / 25 |
| John 1  |        766 |                    812 |          25 |                      52 |                       3 / 51 |
| Rom 8   |        589 |                    667 |           2 |                      24 |                       1 / 39 |

Total on the sampled chapters:

- local: `2,567` Strong occurrences, `81` empty tags
- concordance.bible SG21: `2,811` Strong occurrences, `177` empty tags
- local empty rate: `3.16%`
- concordance.bible empty rate: `6.30%`
- exact verse-level Strong multiset match: `20 / 189` verses

## What Changes

The local S21 reader is still more conservative than concordance.bible SG21, but the gap is smaller after enrichment.

The biggest difference is not the UI representation. It is the editorial alignment policy and the availability of SG21-specific lexical annotation:

1. concordance.bible SG21 uses translation-specific decisions for SG21.
2. concordance.bible exposes per-word `data-lm` lemmas and `data-pa` Strong-position assignments in the public HTML.
3. Local reader mode learns from `Sg1910`, `Darby`, and `DarbyR`, then enriches from WLC/SBLGNT original Strong occurrences.
4. Therefore it now catches several SG21-specific mappings, but it still lacks concordance.bible's full SG21 editorial alignment table.
5. It also adds fewer empty tags because it requires local reference consensus.

## Concrete Differences

### Genesis 1:1

Local S21 reader before enrichment:

- `H7225`
- `H0430`
- `H1254`
- `H0776`

Local S21 reader after enrichment:

- `H7225`
- `H0430`
- `H1254`
- `H8064`
- `H0776`

concordance.bible SG21:

- `H7225`
- `H0430`
- `H1254`
- `H8064`
- `H0776`

The enrichment fixes the previous `ciel`/`cieux` gap by allowing `ciel` to inherit `H8064` from learned French Strong evidence confirmed by WLC.

### Genesis 1:3

The previous local reader missed two `H1961` occurrences. The enriched reader now tags SG21 expressions equivalent to “qu’il y ait” and “il y eut”.

Reason: the new reader rules allow high-confidence `H1961` forms (`ait`, `eut`, `passa`, `serviront`, etc.) when the original verse contains the corresponding Strong occurrence.

### Genesis 1:4

Both systems add the empty `H0996`, but concordance.bible also tags:

- `H0430` on the pronoun replacing “Dieu”
- another `H0996` on `des`

Reason: concordance.bible SG21 accepts more translation-specific pronoun/preposition mappings than the local reader mode. The local mode intentionally does not broadly tag pronouns/articles from original occurrences, because that quickly becomes pseudo-interlinear and hurts reading fluency.

### Genesis 1:5

concordance.bible adds an empty `H7121` for the second “appela” idea, while the local output does not.

Reason: local reader only adds empty tags when `Sg1910`, `Darby`, and `DarbyR` show consensus. SG21 has its own editorial empty decisions.

### Genesis 1:11-12

concordance.bible keeps slightly more agriculture-related Strong occurrences:

- `H6212`
- `H2232`
- `H6213`

The local output sometimes maps nearby/general words differently (`H1877`, `H0834`).

Reason: SG21 has translation wording such as “herbe à graine” and “qui donnent”, while the local model transfers from older references and only uses SG21-agnostic enrichment.

## Interpretation

The enriched reader mode is good for producing a fluent Strong Bible from existing French reference editions plus original-language evidence, but it does **not** reproduce concordance.bible SG21 exactly.

concordance.bible SG21 appears to be:

- more complete than the `Sg1910`/`Darby`/`DarbyR`-calibrated reader mode;
- more willing to tag SG21-specific wording;
- more willing to add empty tags for translation-specific omissions;
- still far from full interlinear coverage.

So the target profile for SG21-like output is between our two modes:

- not `strong-align` complete mode, which creates too many empty tags;
- not baseline `reader` mode, which was too conservative for SG21;
- the implemented enriched reader policy, with room for target-specific empty heuristics if we decide to mimic concordance.bible more closely.

## Implemented Backend Work

1. Added a real-word enrichment pass to reader mode.
   - Use WLC/SBLGNT occurrence inventories as candidate pools.
   - Use learned translation lexicon evidence to attach missing original Strong codes to existing S21 words.
   - Do not emit empty tags for every remaining original occurrence.

2. Added lexical equivalence and curated reader rules.
   - `ciel` ↔ `cieux` for `H8064`
   - `chaos` ↔ reference wording such as `informe/désolation` for `H8414`
   - phrase-level mappings such as `ait/eut/passa/serviront` for `H1961`

3. Preserved conservative empty-tag policy.
   - Keep consensus empties from `Sg1910/Darby/DarbyR`.
   - Do not add empty tags merely because WLC/SBLGNT has extra original occurrences.
   - This avoids returning to the 40% empty-tag problem.

4. Added a reproducible comparison command.
   - Fetch selected public concordance.bible pages.
   - Compare Strong multisets and empty-tag counts.
   - Store only metrics/diffs, not full copyrighted SG21 text.

## Current Conclusion

Our S21 reader output is now closer to concordance.bible SG21 while staying reader-first and fluent, but it is not SG21-equivalent.

The remaining gap is mostly editorial recall:

- it still under-produces SG21-style empty tags;
- it still avoids broad pronoun/article mappings that concordance.bible sometimes accepts;
- it still lacks concordance.bible's SG21-specific lemma/alignment table.

To match concordance.bible SG21 more closely, the next step would be target-specific empty and pronoun/preposition policies calibrated per chapter. That is a different product choice than the current fluent-reader objective.
