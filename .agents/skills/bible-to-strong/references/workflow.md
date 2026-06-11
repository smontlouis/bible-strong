# Bible To Strong Workflow Reference

## Commands

Deterministic reader output:

```sh
npm run generate:strong:reader -- --bible <id>
```

Deterministic hybrid output with hard-verse diagnostics:

```sh
npm run generate:strong:hybrid -- --bible <id>
```

Hybrid plus LLM suggestions only:

```sh
npm run generate:strong:hybrid -- --bible <id> --llm --llm-limit 25
```

Apply LLM suggestions experimentally:

```sh
npm run generate:strong:hybrid -- --bible <id> --llm-apply --llm-limit 25
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
- empty Strong rate;
- original confirmation rate;
- hard verse count;
- LLM attempted count if any;
- LLM accepted/suggested count if any.

For gold evaluation, report:

- precision;
- recall;
- F1;
- evaluated verse count;
- obvious failure modes.

## LLM Policy

LLM should not be the primary generator.

Recommended LLM strategy:

1. Run deterministic generation.
2. Run `llm:transfer` on a small representative sample.
3. Evaluate the same prompt with `--gold` against `Sg1910` and `DarbyR`.
4. If F1 is acceptable, run larger suggestion batches.
5. Review suggestions before applying.
6. Compare every useful suggestion with the current TSV and the source/gold references.
7. Convert accepted decisions to deterministic curated overrides in `src/curatedStrongOverrides.ts`.

Do not let the LLM invent Strong codes. Valid suggestions must use Strong codes present in either:

- the source Strong verse;
- the original WLC/SBLGNT verse inventory, when the command allows it.

## LLM Arbitration And Curated Overrides

The production path is not "LLM says yes, TSV changes." The production path is:

1. Generate the current hybrid TSV.
2. Run `llm:transfer` from a close Strong reference such as Darby.
3. Compare suggestions to the current hybrid assignment for the same verse.
4. Reject token-index drift, weak function-word tags, duplicate over-tagging, and unrendered original particles that should stay empty or absent.
5. Accept only defensible suggestions, then encode them in `src/curatedStrongOverrides.ts`.
6. Regenerate with `npm run generate:strong:hybrid -- --bible <id>`.

Each override must be guarded by:

- Bible id;
- verse ref;
- target word index;
- expected normalized target word;
- Strong code(s);
- confidence;
- source;
- reason.

This makes LLM work reproducible and auditable: later agents do not need to re-ask the model for decisions already reviewed.

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

Then open `http://localhost:4173/` and load the generated TSV from `outputs/`.

## Reports

Useful existing reports:

- `reports/reader-strong-report.md`
- `reports/s21-concordance-comparison.md`
- `reports/hybrid-strong-report.md`

When adding a new Bible or strategy, update or create a report under `reports/` with:

- input Bible id/path;
- commands run;
- metrics;
- LLM/gold-eval results if used;
- known failure modes;
- whether generated full outputs remain ignored by Git.

## Final Response Checklist

Tell the user:

- which Bible id was processed;
- which command produced the recommended output;
- where the output and metrics are;
- whether LLM was used as suggestion-only or applied;
- key metrics;
- checks run;
- any residual risks or next recommended calibration.
