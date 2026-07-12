# Bible Lexicon Maker

Utilities for building Bible lexicon data from Bible JSON files and Strong CSV
files.

## Setup

```sh
npm install
```

## Recommended Workflow

Generate the canonical Strong ledger first. This is the production source of
truth and includes both `reader` and `advanced` views:

```sh
npm run strong:generate -- --bible nbs
```

Export either view from the canonical ledger:

```sh
npm run strong:export -- --bible nbs --view reader
npm run strong:export -- --bible nbs --view advanced
```

Evaluate reader-style output against masked gold Strong Bibles:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000
npm run strong:evaluate -- --gold Darby --limit 1000
npm run strong:evaluate -- --gold DarbyR --limit 1000
```

Report how much of `Sg1910`, `Darby`, and `DarbyR` is represented by the
canonical ledger:

```sh
npm run strong:report:references -- --bible nbs
```

For semantic gaps that remain in the ledger, build a constrained review packet
before using any LLM. For production-scale review, inspect a stable plan before
running the transactional batch:

```sh
npm run strong:review:gaps:batch -- --bible nbs --lexical-report outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-all.json --output-root outputs/gap-review/nbs/<run> --plan-only
npm run strong:review:gaps:batch -- --bible nbs --lexical-report outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-all.json --output-root outputs/gap-review/nbs/<run> --skip-existing
```

Production application requires the exact same bounded choice from two
distinct models, the current lexical safety filter, a version-2 contract, and
the batch write lock/transaction. Direct
`strong:review:gaps:apply --apply` is intentionally refused outside that batch;
`--finalize-reference-style` is preview/validation only.

For residual hard verses, use LLM review as a bounded suggestion workflow:

```sh
npm run strong:review:llm -- --bible nbs --diagnostics outputs/llm-books/nbs/Gen/bible-nbs-strong-diagnostic.hard-verses.json --review outputs/llm-books/nbs/Gen/llm-review-nbs-Gen.json --only Gen
npm run strong:llm:transfer -- --source Darby --target nbs --only Gen.1 --limit 5
```

Useful development commands:

```sh
npm run viewer
npm run build
npm run typecheck
npm run lint
npm test
npm run format
```

## Concepts

There is one intended production artifact:

```text
outputs/strong/<bible>/bible-<bible>-strong.sqlite
```

That canonical SQLite ledger records each verse and Strong annotation with
placement, visibility, source, confidence, diagnostics, and reason.

Use both masked-gold evaluator backends after alignment changes:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold Sg1910 --limit 200 --backend canonical
```

Two views are derived from it:

- `reader`: readable Strong tagging for normal use;
- `advanced`: fuller study view with empty, technical, duplicate, and
  original-complete annotations.

Legacy command aliases were removed. Use the `strong:*` command surface.

## Review

LLM review should not generate a Bible directly. Work from deterministic
evidence: a hard-verse file, a gap-review packet, or a masked-gold transfer
experiment. Accepted decisions must be validated and saved as curated overrides.

Plain historical `semantic-refill:llm` and
`semantic-refill:llm-reference-style` records stay quarantined. Only
`semantic-refill:llm-consensus-filtered` is eligible for production. To audit
old two-model artifacts, run `strong:review:gaps:migrate-artifacts` without
`--apply` first, inspect the report, then explicitly rerun with `--apply`.

`npm run viewer` builds and starts the local UI server. `/viewer/` now reads the
canonical SQLite ledger by chapter, so it cannot silently fall back to stale
split JSON. `/viewer/review.html` is a read-only quality cockpit for current
target drift, witness-review decisions, the stable LLM plan, applied consensus
overrides, and quarantined history. It distinguishes `accepted-safe` records
from overrides actually present in production. `/viewer/lexicon.html` keeps the
FR/EN Strong lexicon. The legacy human-approved review form remains available
from the quality cockpit, clearly separated from the transactional v2 batch.

## Reports

- `reports/strong-diagnostic-report.md`: diagnostic pipeline status and metrics.
- `reports/strong-gold-evaluation-report.md`: masked-gold evaluation on
  `Sg1910`, `Darby`, and `DarbyR`.
- `reports/llm-hard-verse-review.md`: bounded LLM review on true hard verses.
- `reports/strong-bible-project-history.md`: historical record of the pipeline,
  including gap-review agent workflows.

## Data

- `data/bibles/`: Bible translations in JSON format.
- `data/strongs/`: Strong source files in CSV format.
- `data/dictionaries/`: local Strong/STEP dictionaries.

Generated Bible outputs are written to `outputs/` by default. This directory is
ignored by Git because generated Strong-tagged Bible text is a local artifact.
