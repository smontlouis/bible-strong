# Hybrid Gold Evaluation

## Scope

This report summarizes the full masked-gold evaluation of the deterministic `hybrid` backend.

The evaluator strips tags from a known Strong Bible, runs the `hybrid` backend without using that same Bible as a reference, then compares predicted Strong occurrences with the original gold Strong occurrences.

Commands run:

```sh
npm run evaluate:strong:hybrid -- --gold Sg1910
npm run evaluate:strong:hybrid -- --gold Darby
npm run evaluate:strong:hybrid -- --gold DarbyR
```

Outputs:

- `outputs/hybrid-gold-eval-Sg1910.json`
- `outputs/hybrid-gold-eval-Darby.json`
- `outputs/hybrid-gold-eval-DarbyR.json`

## Global Results

| Gold   |   Verses | Predicted Strong | Expected Strong | Precision |   Recall |       F1 |
| ------ | -------: | ---------------: | --------------: | --------: | -------: | -------: |
| Sg1910 | `31,171` |        `376,665` |       `422,384` |  `0.9172` | `0.8179` | `0.8647` |
| Darby  | `31,171` |        `469,617` |       `424,086` |  `0.8736` | `0.9674` | `0.9182` |
| DarbyR | `31,171` |        `463,264` |       `423,496` |  `0.8725` | `0.9544` | `0.9116` |

## OT/NT Results

| Gold   | Testament |   Verses | Precision |   Recall |       F1 |
| ------ | --------- | -------: | --------: | -------: | -------: |
| Sg1910 | OT        | `23,213` |  `0.9275` | `0.8103` | `0.8649` |
| Sg1910 | NT        |  `7,958` |  `0.8960` | `0.8346` | `0.8642` |
| Darby  | OT        | `23,213` |  `0.8731` | `0.9792` | `0.9231` |
| Darby  | NT        |  `7,958` |  `0.8748` | `0.9420` | `0.9072` |
| DarbyR | OT        | `23,213` |  `0.8748` | `0.9710` | `0.9204` |
| DarbyR | NT        |  `7,958` |  `0.8672` | `0.9182` | `0.8920` |

## Error Categories

| Gold   | Under-tagging | Over-tagging | Mixed mismatch | Near exact | Low signal |
| ------ | ------------: | -----------: | -------------: | ---------: | ---------: |
| Sg1910 |      `17,768` |      `2,684` |        `7,823` |    `2,744` |      `152` |
| Darby  |       `1,758` |     `12,433` |        `8,184` |    `8,796` |        `0` |
| DarbyR |       `2,877` |     `11,794` |        `8,476` |    `8,023` |        `1` |

Interpretation:

- `Sg1910` is mainly recall-limited. The hybrid reader policy avoids many weak/function-word and morphology-heavy tags that Sg1910 includes.
- `Darby` and `DarbyR` are mainly precision-limited. The hybrid backend is often denser than their editorial choices, especially around expansions, notes, and repeated formulas.
- The OT scores are stronger for Darby/DarbyR because the reference density agrees well with the Hebrew-driven reader policy.
- The NT has more mismatch in epistles and Acts, especially where reference wording and textual variants diverge.

## Worst Books

### Sg1910

| Book | Precision |   Recall |       F1 |    FP |      FN |
| ---- | --------: | -------: | -------: | ----: | ------: |
| Job  |  `0.9358` | `0.6788` | `0.7868` | `379` | `2,613` |
| Hab  |  `0.8941` | `0.7232` | `0.7997` |  `56` |   `181` |
| Dan  |  `0.9323` | `0.7293` | `0.8184` | `305` | `1,558` |
| Jude |  `0.8760` | `0.7902` | `0.8309` |  `48` |    `90` |
| Nah  |  `0.9303` | `0.7541` | `0.8330` |  `31` |   `135` |

### Darby

| Book   | Precision |   Recall |       F1 |    FP |    FN |
| ------ | --------: | -------: | -------: | ----: | ----: |
| 2Cor   |  `0.8164` | `0.9383` | `0.8731` | `906` | `265` |
| 3John  |  `0.8159` | `0.9512` | `0.8784` |  `44` |  `10` |
| 1Thess |  `0.8293` | `0.9557` | `0.8880` | `284` |  `64` |
| 1John  |  `0.8356` | `0.9588` | `0.8930` | `380` |  `83` |
| Jude   |  `0.8422` | `0.9536` | `0.8945` |  `77` |  `20` |

### DarbyR

| Book  | Precision |   Recall |       F1 |      FP |      FN |
| ----- | --------: | -------: | -------: | ------: | ------: |
| 2Cor  |  `0.8024` | `0.9213` | `0.8577` |   `969` |   `336` |
| 3John |  `0.8333` | `0.9314` | `0.8796` |    `38` |    `14` |
| Acts  |  `0.8691` | `0.8908` | `0.8798` | `2,348` | `1,910` |
| Jude  |  `0.8222` | `0.9465` | `0.8800` |    `88` |    `23` |
| 1John |  `0.8181` | `0.9529` | `0.8803` |   `427` |    `95` |

## Worst Verse Patterns

### Sg1910 Under-Tagging

Examples:

- `Job.5.11`, `Job.22.29`, `Job.23.5`: zero or near-zero predicted tags against several expected Strong occurrences.
- `Josh.15.33`, `1Chr.14.5`, `Neh.10.25`: short proper-name/list verses where the reader policy has weak lexical anchors.

Interpretation: Sg1910 carries a denser editorial Strong style than the current reader policy. Increasing recall here would likely require dedicated handling for names, lists, and morphology-heavy poetic clauses.

### Darby/DarbyR Over-Tagging

Examples:

- `Job.12.5`, `Prov.26.10`: predicted density is much higher than gold.
- `2Cor.1.7`, `1John.2.23`, `Deut.21.16`: hybrid predicts all or nearly all expected tags plus surplus tags.

Interpretation: the hybrid backend is more willing to attach original-confirmed content tags than Darby/DarbyR in some editorially compact verses.

### Textual Variant / Empty-Gold Verses

Examples:

- `Luke.17.36`, `Acts.24.7`: gold has no Strong occurrences, while the backend can still produce a tag from available original/reference data.
- Some zero-expected, zero-predicted verses are now treated as near-exact rather than false worst cases.

Interpretation: these are mostly edition/verse-presence issues, not ordinary alignment failures.

### NT Epistle Mismatch

Worst books for Darby and DarbyR include `2Cor`, `1John`, `1Thess`, `Jude`, and `Heb`.

Interpretation: epistles have many compact function words, pronouns, abstract nouns, and repeated formulae. The backend needs stricter NT calibration before trying to maximize recall there.

## Corrections And Decisions

Corrected during this maturity pass:

- The gold evaluator now reports by-book, by-testament, worst-book, worst-verse, and error-category metrics.
- Zero-expected/zero-predicted variant verses are no longer treated as worst failures.
- Translation-profile diagnostics are retained: dynamic translations such as BDS are not judged against Darby-style density.

Not corrected yet, deliberately:

- Sg1910 under-tagging in poetic/list/name-heavy passages. This needs a specific name/list strategy rather than broad coverage inflation.
- Darby/DarbyR over-tagging in compact verses. Reducing this globally could harm BDS/NBS/S21 generation, so it should be handled through profile-aware precision controls.
- NT epistle mismatches. These need targeted calibration by testament/book before promotion into production rules.
