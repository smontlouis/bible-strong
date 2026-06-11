---
name: bible-to-strong
description: Use this skill when the user wants to generate, improve, evaluate, or compare a Strong-tagged Bible from a local Bible JSON file in this repository. It covers deterministic reader/hybrid generation, LLM reference-transfer from existing Strong Bibles, gold evaluation against known Strong editions, quality reports, and safe handling of copyrighted or large generated artifacts.
---

# Bible To Strong

## Scope

Use this skill in this repository when asked to create or improve a Strong-tagged Bible for a local version such as `nbs`, `s21`, `bds`, `fmar`, etc.

Expected input:

- Bible JSON: `data/bibles/bible-<id>.json`
- Strong references: `data/strongs/Sg1910.csv`, `data/strongs/Darby.csv`, `data/strongs/DarbyR.csv`
- Original sources: `data/external/Alignments/data/sources/WLC.tsv` and `SBLGNT.tsv`

Generated full Bible outputs under `outputs/` are ignored by Git and must not be committed.

## Default Workflow

1. Confirm the requested Bible id and input file.
2. Run deterministic generation first:

```sh
npm run generate:strong:reader -- --bible <id>
npm run generate:strong:hybrid -- --bible <id>
```

3. Inspect metrics:

```sh
cat outputs/bible-<id>-strong-reader.metrics.json
cat outputs/bible-<id>-strong-hybrid.metrics.json
```

4. If quality is unclear, inspect hard verses:

```sh
cat outputs/bible-<id>-strong-hybrid.hard-verses.json
```

5. Use LLM only as a bounded suggestion generator, not as blind production:

```sh
npm run llm:transfer -- --source Darby --target <id> --only Gen.1 --limit 5
```

6. Compare LLM suggestions against the deterministic TSV. Apply only suggestions that are defensible after arbitration. Durable accepted decisions must be encoded as deterministic curated overrides in `src/curatedStrongOverrides.ts`, with Bible id, verse ref, word index, expected normalized word, Strong code, source, confidence, and reason.

7. Before trusting the LLM prompt on a new book/style, evaluate it against known Strong Bibles:

```sh
npm run llm:transfer -- --source Darby --gold Sg1910 --only Gen.1 --limit 5
npm run llm:transfer -- --source Darby --gold DarbyR --only Gen.1 --limit 5
```

8. Run full checks before finalizing:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

## Decision Rules

- Prefer `generate:strong:hybrid` for the final local TSV.
- Prefer `llm:transfer` over free LLM arbitration. It is measurable: source Strong Bible -> masked gold Bible.
- Do not use `--llm-apply` until suggestions have been reviewed on a small sample.
- Promote good LLM suggestions into `src/curatedStrongOverrides.ts` rather than repeatedly paying for the same decision.
- Reject suggestions that are just token-index drift, broad function-word tagging, duplicate over-tagging, or questionable attachment of unrendered original particles.
- Keep generated copyrighted/full Bible outputs in `outputs/`; do not commit them.

## When More Detail Is Needed

Read [references/workflow.md](references/workflow.md) for:

- command matrix;
- metrics interpretation;
- LLM transfer evaluation;
- quality gates;
- expected reports and final response checklist.
