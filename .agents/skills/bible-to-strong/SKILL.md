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
2. Run deterministic hybrid generation first:

```sh
npm run generate:strong:hybrid -- --bible <id>
```

Use `npm run generate:strong:reader -- --bible <id>` only as a baseline comparison, not as the recommended final output.

3. Run masked gold evaluation when changing alignment logic:

```sh
npm run evaluate:strong:hybrid -- --gold Sg1910 --limit 1000
npm run evaluate:strong:hybrid -- --gold Darby --limit 1000
npm run evaluate:strong:hybrid -- --gold DarbyR --limit 1000
```

For a production-maturity audit, run the same commands without `--limit` and update `reports/hybrid-gold-evaluation-report.md`.

4. Inspect metrics:

```sh
cat outputs/bible-<id>-strong-reader.metrics.json
cat outputs/bible-<id>-strong-hybrid.metrics.json
```

5. If quality is unclear, inspect hard verses:

```sh
cat outputs/bible-<id>-strong-hybrid.hard-verses.json
```

6. Use LLM only as a bounded suggestion generator, not as blind production:

```sh
npm run generate:strong:hybrid -- --bible <id> --only Gen --llm --llm-limit 250 --output-dir outputs/llm-books/<id>/Gen
```

7. Prepare a human review queue for LLM suggestions:

```sh
npm run review:llm -- --bible <id> --diagnostics outputs/llm-books/<id>/Gen/bible-<id>-strong-hybrid.hard-verses.json --review outputs/llm-books/<id>/Gen/llm-review-<id>-Gen.json --only Gen
npm run viewer
```

Open `http://localhost:4173/viewer/review.html`, load the generated review JSON, reject any bad auto-accepted suggestions, decide pending suggestions, correct token targets when needed, and click `Enregistrer décisions`.

For production-scale LLM review, prefer the concurrent book runner:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run review:llm:books -- --bible <id> --books all --concurrency 3 --llm-limit 25 --model deepseek/deepseek-v4-flash --skip-existing
```

This writes per-book review files under `outputs/llm-books/<id>/<Book>/` and a manifest at `outputs/llm-books/<id>/llm-review-<id>-manifest.json`. Open it with:

```text
http://localhost:4173/viewer/review.html?manifest=/outputs/llm-books/<id>/llm-review-<id>-manifest.json
```

Use `--skip-existing` to resume without re-calling the LLM for books that already have review JSON files.

Do not launch a whole multi-Bible batch with `--llm-limit 250` for every book. First run the complete 66-book pass with a small per-book limit, inspect the manifest, then rerun only selected hard books with a higher limit.

Manual review supports three cases:

- correct suggestion: keep or set `Accepter`;
- wrong suggestion: set `Rejeter`;
- right Strong but wrong French token: set the item to `À revoir`, click the intended word in the verse context or edit `Index cible` / `Mot normalisé` / `Strong`, then set `Accepter`.

8. Regenerate after saving accepted decisions:

```sh
npm run generate:strong:hybrid -- --bible <id>
```

The viewer stores accepted decisions in `data/curated-strong-overrides.json`. The TypeScript fallback overrides in `src/curatedStrongOverrides.ts` remain for older reviewed decisions.

`review:llm` pre-accepts only high-confidence mechanically safe suggestions. Weak function-word/particle cases stay pending. Use `--auto-accept false` or `--auto-accept-threshold <n>` when a stricter review is needed.

9. Before trusting the LLM prompt on a new book/style, evaluate it against known Strong Bibles:

```sh
npm run llm:transfer -- --source Darby --gold Sg1910 --only Gen.1 --limit 5
npm run llm:transfer -- --source Darby --gold DarbyR --only Gen.1 --limit 5
```

10. Run full checks before finalizing:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

## Decision Rules

- Prefer `generate:strong:hybrid` for the final local TSV.
- The hybrid backend now includes learned multi-word phrase transfer from the local Strong references. Keep this deterministic and original-confirmed.
- Use the style 4 calibrated hybrid policy: one common backend, but profile-aware generation and diagnostics by translation family.
- Interpret metrics through the Bible's translation profile. Dynamic translations such as BDS are expected to have lower token coverage than formal translations such as Martin.
- Profiles are active generation inputs, not just labels: they control learned enrichment strictness, maximum Strong codes per word, empty-word consensus, and hard-verse thresholds.
- Report visible Strong rate, empty Strong rate, multi-Strong word rate, original representation rate, original unrepresented Strong occurrences, and profile token-coverage status.
- Use `evaluate:strong:hybrid` after changing reader, phrase, or empty-tag behavior.
- Prefer `llm:transfer` over free LLM arbitration. It is measurable: source Strong Bible -> masked gold Bible.
- Do not use `--llm-apply` until suggestions have been reviewed on a small sample.
- Promote good LLM suggestions through `review:llm` + `review:llm:apply` into `data/curated-strong-overrides.json` rather than repeatedly paying for the same decision.
- Prefer LLM batches by book (`--only Gen`, `--only Exod`, etc.) instead of whole-Bible LLM runs.
- Reject suggestions that are just token-index drift, broad function-word tagging, duplicate over-tagging, or questionable attachment of unrendered original particles.
- Keep generated copyrighted/full Bible outputs in `outputs/`; do not commit them.

## When More Detail Is Needed

Read [references/workflow.md](references/workflow.md) for:

- command matrix;
- metrics interpretation;
- LLM transfer evaluation;
- full gold evaluation reporting;
- quality gates;
- expected reports and final response checklist.
