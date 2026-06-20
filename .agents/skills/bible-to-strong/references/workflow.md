# Bible To Strong Workflow Reference

## Commands

Optional reader baseline:

```sh
npm run generate:strong:reader -- --bible <id>
```

Deterministic hybrid output with hard-verse diagnostics:

```sh
npm run generate:strong:hybrid -- --bible <id>
```

Masked gold evaluation of the deterministic hybrid backend:

```sh
npm run evaluate:strong:hybrid -- --gold Sg1910 --limit 1000
npm run evaluate:strong:hybrid -- --gold Darby --limit 1000
npm run evaluate:strong:hybrid -- --gold DarbyR --limit 1000
```

Full gold evaluation for production-maturity reports:

```sh
npm run evaluate:strong:hybrid -- --gold Sg1910
npm run evaluate:strong:hybrid -- --gold Darby
npm run evaluate:strong:hybrid -- --gold DarbyR
```

Hybrid plus LLM suggestions only:

```sh
npm run generate:strong:hybrid -- --bible <id> --llm --llm-limit 25
```

Book-by-book LLM batch:

```sh
npm run generate:strong:hybrid -- --bible <id> --only Gen --llm --llm-limit 250 --output-dir outputs/llm-books/<id>/Gen
npm run review:llm -- --bible <id> --diagnostics outputs/llm-books/<id>/Gen/bible-<id>-strong-hybrid.hard-verses.json --review outputs/llm-books/<id>/Gen/llm-review-<id>-Gen.json --only Gen
```

Concurrent all-books LLM batch:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run review:llm:books -- --bible <id> --books all --concurrency 3 --llm-limit 25 --model deepseek/deepseek-v4-flash --skip-existing
AI_GATEWAY_TIMEOUT_MS=120000 npm run review:llm:books -- --bible <id> --books Gen,Exod,Lev --concurrency 2 --llm-limit 100 --model deepseek/deepseek-v4-flash --skip-existing
npm run review:llm:books -- --bible <id> --books all --skip-existing
```

Use the small complete pass first. A higher `--llm-limit` should be a targeted second pass on selected books, not the default for every book of every Bible.

The batch runner creates one folder per book and writes a manifest:

```text
outputs/llm-books/<id>/<Book>/llm-review-<id>-<Book>.json
outputs/llm-books/<id>/llm-review-<id>-manifest.json
```

Open the manifest in the reviewer:

```text
http://localhost:4173/viewer/review.html?manifest=/outputs/llm-books/<id>/llm-review-<id>-manifest.json
```

The reviewer can also load a local folder of `llm-review-*.json` files. It defaults to pending suggestions, supports filtering by decision/book/search, and has a "Livre suivant" control for moving through the loaded corpus.

Prepare a human review queue from LLM suggestions:

```sh
npm run review:llm -- --bible <id>
npm run viewer
```

Save accepted decisions in the viewer, then regenerate:

```sh
npm run viewer
npm run generate:strong:hybrid -- --bible <id>
```

Reference-transfer LLM to target:

```sh
npm run llm:transfer -- --source Darby --target <id> --only Gen.1 --limit 5
```

Reference-transfer gold evaluation:

```sh
npm run llm:transfer -- --source Darby --gold Sg1910 --only Gen.1 --limit 5
npm run llm:transfer -- --source Darby --gold DarbyR --only Gen.1 --limit 5
```

S21 concordance comparison:

```sh
npm run compare:s21:concordance
```

## Choosing The Backend

Use `reader` when:

- you need the simplest fluent Strong Bible;
- you want low empty-tag rate;
- the target is close to `Sg1910`, `Darby`, or `DarbyR`.

Use `hybrid` when:

- you want hard-verse diagnostics;
- you want original-aware metrics;
- you want deterministic multi-word phrase transfer;
- you want translation-profile-aware interpretation;
- you may later run LLM review on difficult verses.

Use `llm:transfer` when:

- the target translation differs from the references enough that deterministic transfer misses obvious semantic matches;
- you need a measurable LLM path;
- you can first test the same prompt against masked gold editions.

## Metrics To Report

Always report at least:

- generated verse count;
- total Strong occurrence count;
- tagged-token coverage;
- visible Strong rate;
- empty Strong rate;
- multi-Strong word rate;
- original representation rate;
- original unrepresented Strong occurrence count;
- original confirmation rate;
- hard verse count;
- translation profile;
- profile token-coverage status;
- LLM attempted count if any;
- LLM accepted/suggested count if any.

## Style 4: Calibrated Hybrid Profiles

Do not compare every French Bible as if it were Darby.

Current profiles:

- `fmar`: formal historical translation, high Strong density accepted, up to 4 Strong codes per French word when justified.
- `nbs`: formal-readable Segond-family translation, medium density and readable tags.
- `s21`: formal-readable modern Segond-family translation, medium density and readable tags.
- `bds`: dynamic-equivalence translation, semantic density, fewer learned function-word tags, stricter empty-word consensus.

The hybrid metrics include `translationProfile`. Its settings affect generation and diagnostics:

- learned enrichment threshold;
- maximum Strong codes per visible word;
- minimum reference consensus before adding an empty word;
- whether learned function-word tags are allowed;
- `low-token-coverage`;
- `below-reference-strong-density`;
- `many-original-strong-unplaced`.

For BDS, a lower token coverage is not automatically bad. The important question is whether meaningful content words are tagged, original confirmation stays high, and hard verses are explainable.

Do not try to maximize Strong count globally. The objective is the best reader-facing density for the translation family:

- formal: denser is acceptable;
- formal-readable: balanced density;
- dynamic: fewer tags can be better when they are more semantic and readable.

For gold evaluation, report:

- precision;
- recall;
- F1;
- evaluated verse count;
- obvious failure modes.

`evaluate:strong:hybrid` masks a known Strong Bible by stripping its tags, runs the hybrid backend without using that Bible as a reference, and compares predicted Strong occurrences to the original gold Strong occurrences.

## LLM Policy

LLM should not be the primary generator.

Recommended LLM strategy:

1. Run deterministic generation.
2. Run bounded hybrid LLM suggestions by book with `--only <Book> --llm --llm-limit <n> --output-dir outputs/llm-books/<id>/<Book>`.
3. Run `npm run review:llm` against that book diagnostics file.
4. High-confidence mechanically safe suggestions are pre-marked `accept`; weak function-word/particle cases remain `pending`.
5. Open the viewer, load the review JSON, reject any bad auto-accepted suggestions, decide pending suggestions, and click `Enregistrer décisions`.
6. Regenerate the full Bible with `npm run generate:strong:hybrid -- --bible <id>`.
7. Optionally run `llm:transfer --gold` before large batches to evaluate prompt quality.

Manual correction is supported in the review UI only while an item is `À revoir`. If the LLM has the right Strong code but attached it to the wrong French token, set the item to `À revoir`, click the intended word in the verse context or edit `Index cible`, `Mot normalisé`, and `Strong`, then set the item to `Accepter`. Example: if `H8033` should be attached to `Là`, switch the item to `À revoir`, click `Là` in the context, verify that `Strong` is `H8033`, accept the item, and save decisions. The saved override is guarded by the final word index and normalized word, so it will only reapply if the target Bible verse still matches.

Default review pre-acceptance is conservative:

- confidence must be at least `0.84`;
- target word must not be a weak French function word;
- Strong code must not be in the weak auto-accept denylist, including `H0853`, `H0834`, `H0996`, `H8033`, `H5921`, `H0413`, `G1722`, `G1519`, `G3588`.

Override the threshold if needed:

```sh
npm run review:llm -- --bible <id> --auto-accept-threshold 0.88
npm run review:llm -- --bible <id> --auto-accept false
```

Do not let the LLM invent Strong codes. Valid suggestions must use Strong codes present in either:

- the source Strong verse;
- the original WLC/SBLGNT verse inventory, when the command allows it.

## LLM Arbitration And Curated Overrides

The production path is not "LLM says yes, TSV changes." The production path is:

1. Generate the current hybrid TSV.
2. Run `npm run generate:strong:hybrid -- --bible <id> --only <Book> --llm --llm-limit <n> --output-dir outputs/llm-books/<id>/<Book>`.
3. Run `npm run review:llm -- --bible <id> --diagnostics outputs/llm-books/<id>/<Book>/bible-<id>-strong-hybrid.hard-verses.json --review outputs/llm-books/<id>/<Book>/llm-review-<id>-<Book>.json --only <Book>`.
4. Open `http://localhost:4173/viewer/review.html` with `npm run viewer`.
5. Load `outputs/llm-review-<id>.json` in the "Charger une revue LLM" drop zone.
6. Accept only defensible suggestions; reject token-index drift, weak function-word tags, duplicate over-tagging, and unrendered original particles that should stay empty or absent.
7. Click `Enregistrer décisions` in the viewer.
8. Regenerate with `npm run generate:strong:hybrid -- --bible <id>`.

Each override must be guarded by:

- Bible id;
- verse ref;
- target word index;
- expected normalized target word;
- Strong code(s);
- confidence;
- source;
- reason.

The viewer writes accepted decisions to `data/curated-strong-overrides.json`. The CLI `review:llm:apply` remains available for scripted/offline decision files. This makes LLM work reproducible and auditable: later agents do not need to re-ask the model for decisions already reviewed.

## Quality Gates

Before final response:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

For a production-worthy run, also spot-check output in the viewer:

```sh
npm run viewer
```

Then open `http://localhost:4173/viewer/` and load the generated TSV from `outputs/`.

## Reports

Useful existing reports:

- `reports/reader-strong-report.md`
- `reports/s21-concordance-comparison.md`
- `reports/hybrid-strong-report.md`
- `reports/hybrid-gold-evaluation-report.md`
- `reports/llm-hard-verse-review.md`

When adding a new Bible or strategy, update or create a report under `reports/` with:

- input Bible id/path;
- commands run;
- metrics;
- LLM/gold-eval results if used;
- known failure modes;
- whether generated full outputs remain ignored by Git.

To resume a production-maturity audit, read `reports/hybrid-gold-evaluation-report.md` and `reports/llm-hard-verse-review.md`, then continue from the highest-impact documented failure class rather than adding isolated overrides.

## Final Response Checklist

Tell the user:

- which Bible id was processed;
- which command produced the recommended output;
- where the output and metrics are;
- whether LLM was used as suggestion-only or applied;
- key metrics;
- checks run;
- any residual risks or next recommended calibration.
