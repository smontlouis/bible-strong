# Bible Lexicon Maker

Utilities for building Bible lexicon data from Bible JSON files and Strong CSV files.

## Setup

```sh
npm install
```

## Recommended Scripts

```sh
npm run dev
npm run generate:strong:hybrid -- --bible nbs
npm run generate:strong:enriched -- --bible nbs
npm run strong:semantic-refill -- --bible nbs --only Gen.3 --audit --output-dir outputs/semantic-refill/nbs/Gen.3
npm run strong:semantic-refill:agent-packet -- --bible nbs --only Gen.3 --candidates outputs/semantic-refill/nbs/Gen.3/semantic-refill-candidates.json
npm run strong:semantic-refill:agent-review -- --bible nbs --input outputs/semantic-refill/nbs/agent-review/review.json --candidates outputs/semantic-refill/nbs/Gen.3/semantic-refill-candidates.json
npm run generate:strong:hybrid -- --bible nbs --only Gen --llm --llm-limit 250 --output-dir outputs/llm-books/nbs/Gen
npm run review:llm -- --bible nbs --diagnostics outputs/llm-books/nbs/Gen/bible-nbs-strong-hybrid.hard-verses.json --review outputs/llm-books/nbs/Gen/llm-review-nbs-Gen.json --only Gen
npm run evaluate:strong:hybrid -- --gold Sg1910 --limit 1000
npm run evaluate:strong:hybrid -- --gold Sg1910
npm run llm:transfer -- --source Darby --target nbs --only Gen.1 --limit 5
npm run viewer
npm run build
npm run typecheck
npm run lint
npm test
npm run format
```

`npm run generate:strong:hybrid` is the recommended production-local pipeline. It implements the style 4 calibrated hybrid policy: one common backend, but generation and diagnostics are adapted to the translation family. It combines reader alignment, original WLC/SBLGNT confirmation, learned multi-word phrase transfer, curated LLM-transfer overrides, active translation profiles, and metrics for visible, empty, multi-word, and original-representation coverage.

`npm run generate:strong:reader` remains available as a simple baseline calibrated against `Sg1910`, `Darby`, and `DarbyR`.

`npm run viewer` starts the local UI server. Use `/viewer/` for TSV/CSV Strong inspection, `/viewer/lexicon.html` for the FR/EN Strong lexicon, and `/viewer/review.html` for LLM review.

For LLM review, work book by book. Run `generate:strong:hybrid -- --only <Book> --llm`, then `npm run review:llm` against that diagnostics file. High-confidence mechanically safe suggestions are pre-accepted; weak function-word/particle cases stay pending. Load the review JSON in `/viewer/review.html`, reject bad auto-accepted suggestions, decide pending suggestions, then click `Enregistrer décisions`. The reviewer writes accepted suggestions directly to `data/curated-strong-overrides.json`.

For semantic holes that remain as advanced/empty Strong annotations, use the internal-agent semantic-refill workflow. Generate an enriched Bible, run `strong:semantic-refill --audit`, build a procedural packet with `strong:semantic-refill:agent-packet`, ask two agents to propose decisions, validate each JSON with `strong:semantic-refill:agent-review`, arbitrate, apply only the validated final review, then regenerate. Agent packets include blocked occupied targets and nearby open targets so agents do not stack a missing Strong onto a word that already carries another Strong when a better carrier exists.

## Reports

- `reports/hybrid-strong-report.md`: current pipeline status and final metrics.
- `reports/hybrid-gold-evaluation-report.md`: full masked-gold evaluation on `Sg1910`, `Darby`, and `DarbyR`.
- `reports/llm-hard-verse-review.md`: bounded LLM review on true hard verses.
- `reports/strong-bible-project-history.md`: historical record of the pipeline, including the semantic-refill agent workflow.

## Data

- `data/bibles/`: Bible translations in JSON format.
- `data/strongs/`: Strong source files in CSV format.

Generated Bible outputs are written to `outputs/` by default. This directory is ignored by Git because generated Strong-tagged Bible text is a local artifact.
