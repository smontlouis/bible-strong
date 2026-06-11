# Hybrid Strong Backend

## Goal

Build a safer backend for difficult verses without continuing to add one-off lexical patches.

The hybrid backend starts from the fluent reader output, diagnoses hard verses, and can ask Vercel AI Gateway for bounded alignment suggestions. LLM output is not trusted blindly: suggestions are mechanically validated and are not applied to the TSV unless `--llm-apply` is explicitly passed.

## Commands

Deterministic full S21 generation:

```sh
npm run generate:strong:hybrid -- --bible s21
```

LLM suggestions for a bounded number of hard verses:

```sh
npm run generate:strong:hybrid -- --bible s21 --llm --llm-limit 25
```

Apply LLM suggestions to the TSV only when reviewing that behavior intentionally:

```sh
npm run generate:strong:hybrid -- --bible s21 --llm-apply --llm-limit 25
```

Single chapter/verse testing:

```sh
npm run generate:strong:hybrid -- --bible s21 --only Gen.1 --llm --llm-limit 2
npm run generate:strong:hybrid -- --bible s21 --only Gen.2.4 --llm --llm-limit 1
```

## Outputs

- `outputs/bible-s21-strong-hybrid.tsv`
- `outputs/bible-s21-strong-hybrid.metrics.json`
- `outputs/bible-s21-strong-hybrid.hard-verses.json`

The hard-verses JSON is the useful review artifact. It includes:

- reasons why the verse is considered hard;
- token coverage and original confirmation metrics;
- reference-density comparison;
- whether the verse was LLM-eligible;
- LLM suggestions, when requested.

## Current S21 Full Metrics

Deterministic hybrid generation, no LLM application:

- verses: `31,168`
- total Strong occurrences: `396,492`
- hard diagnostic verses: `8,485`
- LLM-eligible verses: `3,231`
- curated LLM-transfer overrides applied: `2`
- output tags otherwise unchanged from enriched reader mode unless `--llm-apply` is passed

## What Counts As Hard

A verse is diagnostically hard when one or more of these signals fires:

- no tags at all;
- low token coverage;
- low original confirmation;
- many actionable original Strong occurrences remain unplaced;
- local Strong density is much lower than the median of `Sg1910`, `Darby`, and `DarbyR`.

For LLM routing, the filter is stricter. The LLM is called only for:

- no-tags;
- low-original-confirmation;
- low-token-coverage;
- or the combination `many-original-strong-unplaced` + `below-reference-strong-density`.

This avoids wasting LLM calls on normal reader-mode omissions like Hebrew particles or unrendered function words.

## LLM Validation

The LLM receives:

- target French words with indexes and current Strong tags;
- original WLC/SBLGNT Strong occurrences with lemma, gloss, morph, and position;
- local Strong references from `Sg1910`, `Darby`, and `DarbyR`;
- hard-verse reasons.

The response must be JSON:

```json
{
  "assignments": [
    {
      "wordIndex": 0,
      "strong": ["H0000"],
      "confidence": 0.8,
      "reason": "short explanation"
    }
  ]
}
```

Rejected automatically:

- invalid word indexes;
- confidence below `0.64`;
- Strong codes absent from the original verse inventory;
- Strong codes with suffixes such as `H0871A`;
- too many Strong codes on one target word;
- broad tags on French function words, except a small allowlist for translated prepositions/existential auxiliaries.

## Trial Results

`Gen.1` after actionable-original filtering:

- hard diagnostic verses: `2`
- LLM suggestion calls with `--llm-limit 2`: `2`
- mechanically valid suggestions: varied by run, generally `3-5`
- TSV unchanged unless `--llm-apply` is used

Full S21 with `--llm --llm-limit 3`:

- LLM attempted verses: `3`
- mechanically valid suggestions: `11`
- examples that look useful:
  - `Gen.2.2`: `mit/terme` area for `H3615`
  - `Gen.2.4`: `histoire/H8435`
  - `Gen.4.11`: `entrouvert/H6475`
- examples requiring human/editorial review:
  - `Gen.1.29`: `aussi/H2009`
  - `Gen.1.29`: `noyau/H6086`
  - implicit nouns attached to auxiliary words

## Conclusion

The LLM is useful as an arbiter/reviewer, not as a direct production source yet.

The best current policy is:

1. generate deterministic hybrid output;
2. run LLM suggestions with a bounded limit;
3. review suggestions in `hard-verses.json`;
4. promote recurring good decisions into deterministic rules or a curated alignment table;
5. use `--llm-apply` only for controlled experiments.

This is closer to the architecture in `data/discovery.md`: deterministic alignment first, LLM only for ambiguous residual cases.

## Curated LLM Transfer Overrides

The first reviewed `Darby -> target` transfer batch on `Gen.1.1-5` has been promoted into deterministic overrides instead of being blindly applied from the LLM response.

Accepted overrides:

- NBS `Gen.1.2`: `souffle/H7307`, `tournoyait/H7363`
- BDS `Gen.1.2`: `chaotique/H8414`
- BDS `Gen.1.4`: `des/H0996`
- FMAR `Gen.1.2`: `forme/H8414`, `mouvait/H7363`
- FMAR `Gen.1.4`: `des/H0996`
- FMAR `Gen.1.5`: `nomma/H7121`, first `fut/H1961`
- S21 `Gen.1.4`: `il/H0430`, `des/H0996`

Rejected examples:

- token-index drift such as attaching `H0216` to articles before `lumière`;
- broad or ambiguous function-word tags;
- questionable extra `H6440` on `dessus` when the current reader output already has the rendered `H5921`;
- suggestions already covered by the hybrid output.

The overrides live in `src/curatedStrongOverrides.ts` and are guarded by Bible id, verse ref, word index, expected normalized word, source, confidence, and reason.

Current regenerated override counts:

| Bible | Curated Strong additions | Total Strong occurrences |
| ----- | -----------------------: | -----------------------: |
| NBS   |                      `2` |                `392,329` |
| BDS   |                      `2` |                `344,699` |
| FMAR  |                      `4` |                `407,333` |
| S21   |                      `2` |                `396,492` |

## Better LLM Strategy: Reference Transfer

A more promising LLM use is explicit reference transfer:

> Given a known Strong verse such as Darby, and an untagged target verse such as NBS, place the existing Strong codes onto the target words.

This is now available as:

```sh
npm run llm:transfer -- --source Darby --target nbs --only Gen.1 --limit 3
```

The important advantage is that this can be evaluated by masking a known Strong Bible:

```sh
npm run llm:transfer -- --source Darby --gold Sg1910 --only Gen.1 --limit 5
npm run llm:transfer -- --source Darby --gold DarbyR --only Gen.1 --limit 5
```

Initial gold-eval results on `Gen.1.1-5`:

| Transfer               | Precision |   Recall |       F1 |
| ---------------------- | --------: | -------: | -------: |
| Darby -> Sg1910 masked |  `1.0000` | `0.9796` | `0.9897` |
| Darby -> DarbyR masked |  `0.9057` | `0.9796` | `0.9412` |

The Darby -> DarbyR score is lower mostly because DarbyR verse text includes notes/literal expansions that disturb token indexes.

For real target transfer, `Darby -> NBS` on `Gen.1.1-3` produced plausible suggestions:

- `ciel/H8064`
- `chaos/H8414`
- `souffle/H7307`
- `tournoyait/H7363`
- `ait/eut/H1961`

This is more measurable and more controllable than free LLM arbitration. The recommended path is now:

1. use deterministic reader/hybrid output as baseline;
2. use `llm:transfer` from a close Strong reference as a suggestion generator;
3. evaluate the same prompt against masked known Bibles;
4. apply only suggestions that pass deterministic validation and confidence thresholds;
5. promote repeated high-quality suggestions into deterministic rules.
