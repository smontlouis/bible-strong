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
before using any LLM:

```sh
npm run strong:review:gaps -- --bible nbs --only Gen.3 --audit --output-dir outputs/gap-review/nbs/Gen.3
npm run strong:review:gaps:packet -- --bible nbs --only Gen.3 --candidates outputs/gap-review/nbs/Gen.3/gap-review-candidates.json
npm run strong:review:gaps:apply -- --bible nbs --input outputs/gap-review/nbs/agent-review/review.json --candidates outputs/gap-review/nbs/Gen.3/gap-review-candidates.json
```

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
outputs/strong/<bible>/bible-<bible>-strong-ledger.json
```

That canonical ledger records each Strong annotation with placement, visibility,
source, confidence, diagnostics, and reason.

Two views are derived from it:

- `reader`: readable Strong tagging for normal use;
- `advanced`: fuller study view with empty, technical, duplicate, and
  original-complete annotations.

Legacy command aliases were removed. Use the `strong:*` command surface.

## Review

LLM review should not generate a Bible directly. Work from deterministic
evidence: a hard-verse file, a gap-review packet, or a masked-gold transfer
experiment. Accepted decisions must be validated and saved as curated overrides.

`npm run viewer` starts the local UI server. Use `/viewer/` for TSV/CSV Strong
inspection, `/viewer/lexicon.html` for the FR/EN Strong lexicon, and
`/viewer/review.html` for LLM review.

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
