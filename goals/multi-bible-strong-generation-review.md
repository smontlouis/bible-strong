# Multi-Bible Strong Generation And Review

## Objective

Generate complete local Strong-tagged editions for:

- `bds`
- `bfc`
- `fmar`
- `frc97`
- `nfc`
- `ost`
- `nvs78p`

For each Bible, run the full hybrid generation pipeline, perform LLM review across all 66 books, apply durable reviewed decisions, regenerate the final local output, and document quality metrics.

## Read First

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `data/discovery.md`
- `reports/hybrid-gold-evaluation-report.md`
- `reports/hybrid-strong-report.md`
- `src/generateStrongHybrid.ts`
- `src/llmReview.ts`
- `src/runLlmReviewBooks.ts`
- `src/translationProfiles.ts`
- `src/curatedStrongOverrides.ts`

## Critical Pipeline Requirement

Before scaling the generation, make sure the review/apply pipeline distinguishes these outcomes:

- `accept-word`: Strong attached to a reliable target word.
- `accept-empty`: Strong exists in the original but no reliable French word can carry it.
- `reject-wrong`: proposed attachment is wrong or misleading.
- `reject-duplicate`: Strong is already represented elsewhere in the verse.
- `pending-human`: genuinely ambiguous and should be left for manual review.

Do not confuse rejecting a bad word attachment with deleting the Strong. If an original Strong is required for complete original inventory but cannot be attached safely to a visible word, preserve it as an empty Strong with source, reason, and confidence.

## Work Plan

1. Verify that each target Bible exists under `data/bibles/bible-<id>.json`.
2. Verify or add translation profiles in `src/translationProfiles.ts`.
3. Improve the pipeline if needed so curated empty Strong decisions can be persisted and applied.
4. For each Bible:
   - run deterministic hybrid generation;
   - run LLM review over all 66 books with bounded per-book quotas;
   - use `deepseek/deepseek-v4-flash` by default through AI Gateway;
   - avoid expensive models unless a small targeted rerun is clearly justified;
   - use `--skip-existing` to resume and avoid repeated LLM calls;
   - write a per-Bible review manifest.
5. Perform an autonomous review pass over pending LLM suggestions:
   - accept clear word attachments;
   - correct wrong target indexes when the Strong is correct;
   - convert required-but-unattachable Strong codes to empty Strong decisions;
   - reject only duplicates or wrong proposals;
   - leave only truly uncertain cases as `pending-human`.
6. Apply accepted decisions into durable overrides.
7. Regenerate each final Bible after applying decisions.
8. Produce individual and global reports.
9. Run verification commands.

## Suggested Commands

Baseline generation:

```sh
npm run generate:strong:hybrid -- --bible <id>
```

Book-level LLM review:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run review:llm:books -- --bible <id> --books all --concurrency 3 --llm-limit 25 --model deepseek/deepseek-v4-flash --skip-existing
```

For deeper second-pass review, rerun only selected books with a higher limit:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run review:llm:books -- --bible <id> --books Gen,Exod,Matt,John,Rom --concurrency 2 --llm-limit 100 --model deepseek/deepseek-v4-flash --skip-existing
```

Open review manifest:

```text
http://localhost:4173/viewer/review.html?manifest=/outputs/llm-books/<id>/llm-review-<id>-manifest.json
```

Apply decisions:

```sh
npm run review:llm:apply -- --bible <id> --decisions outputs/llm-books/<id>/llm-review-<id>-merged-decisions.json
```

Regenerate final output:

```sh
npm run generate:strong:hybrid -- --bible <id>
```

Final checks:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Deliverables

For each Bible:

- `outputs/bible-<id>-strong-hybrid.tsv`
- `outputs/bible-<id>-strong-hybrid.metrics.json`
- `outputs/llm-books/<id>/llm-review-<id>-manifest.json`
- `reports/strong-generation-<id>.md`

Global deliverables:

- updated durable overrides for reviewed decisions;
- `reports/strong-generation-multi-bible-report.md`;
- documented pending-human cases;
- documented rejected-wrong and rejected-duplicate cases;
- documented empty Strong behavior and counts.

## Metrics To Report

For each Bible:

- verse coverage;
- generated verse count;
- tagged token coverage;
- visible Strong rate;
- empty Strong rate;
- multi-Strong word rate;
- original representation rate;
- original unrepresented Strong count;
- pending-human count;
- rejected-wrong count;
- rejected-duplicate count;
- accepted empty Strong count;
- accepted word Strong count;
- estimated LLM token usage and cost.

## Constraints

- Do not commit full generated Bible outputs.
- Keep copyrighted or large generated artifacts under ignored paths such as `outputs/`.
- Do not rerun LLM calls when a usable review file already exists.
- Do not start a 7-Bible x 66-book x 250-verse LLM run in one batch. Use bounded passes that checkpoint per book.
- Continue other Bibles if one Bible or book fails.
- If AI Gateway credits or keys are unavailable, complete deterministic work, document the exact missing LLM commands, and continue where possible.
- Keep the pipeline reproducible: every output must be tied to a command, source path, and report.

## Acceptance Criteria

- All seven target Bibles are processed, or each blocker is precisely documented.
- Each processed Bible has all 66 books covered by review manifests.
- Reviewed accepted decisions are applied durably and final outputs are regenerated afterward.
- Original Strong codes are not silently lost: every hard case is represented as a word attachment, empty Strong, duplicate rejection, wrong rejection, or pending-human.
- Reports include all required metrics.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
- The final commit includes code, profiles, reports, docs, and non-copyright overrides only; it does not include complete generated Bible texts.
