# Finalize Hybrid Production Maturity

## Goal

Finalize the production maturity of the Bible-to-Strong hybrid pipeline.

The objective is to turn the current `hybrid` pipeline into a stable, calibrated, defensible workflow for generating French Strong-tagged Bibles by completing the full improvement loop:

```text
evaluate -> identify patterns -> fix one class of errors -> measure again
```

## Read First

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `reports/hybrid-strong-report.md`
- `src/generateStrongHybrid.ts`
- `src/readerAlignment.ts`
- `src/phraseTranslationLexicon.ts`
- `src/translationProfiles.ts`
- `src/evaluateStrongHybrid.ts`
- `data/discovery.md`

## Expected Work

### 1. Cleanup And Stability

- Verify that only the recommended pipelines remain exposed:
  - `generate:strong:hybrid`
  - `generate:strong:reader` as baseline only
  - `evaluate:strong:hybrid`
  - `llm:transfer`
  - `viewer`
- Verify that active docs no longer recommend old v1/v2/align pipelines.
- Keep full generated artifacts out of Git.

### 2. Complete Gold Evaluation

- Run full, unlimited hybrid gold evaluation on:
  - `Sg1910`
  - `Darby`
  - `DarbyR`
- Produce complete JSON outputs under `outputs/`.
- Add or enrich a report under `reports/` with:
  - global precision, recall, and F1;
  - metrics by book;
  - metrics by OT/NT;
  - worst books;
  - worst verses;
  - observed error categories.

### 3. Worst Verse Analysis

- Read the `worstVerses` from the gold evaluation outputs.
- Identify recurring patterns, including:
  - Sg1910 under-tagging;
  - DarbyR expansions or notes;
  - Strong surplus versus Darby;
  - proper names;
  - repeated formulas;
  - Hebrew prepositions;
  - function words;
  - uncovered multi-word expressions.
- Document concrete examples for each important pattern.

### 4. Bible-Specific Calibration

- Verify and adjust profiles in `src/translationProfiles.ts`:
  - `bds`: dynamic
  - `nbs`: formal-readable
  - `s21`: formal-readable
  - `fmar`: formal
- Do not optimize only to increase coverage.
- Ensure thresholds help prioritize real hard verses rather than hide true problems.
- Add any metric needed to explain each Bible according to its translation profile.

### 5. Targeted Fixes

- Fix only defensible and measurable error classes.
- Prioritize:
  - frequent multi-word expressions;
  - recurring false positives;
  - clear content-word under-tagging;
  - density errors caused by translation profile differences.
- Avoid isolated patches that do not generalize.
- Add automated tests for every corrected error class.

### 6. LLM On True Hard Verses

- Use the LLM only on a bounded sample of true profile-aware hard verses.
- Do not automatically apply suggestions.
- Produce a suggestion report with:
  - accepted suggestions;
  - rejected suggestions;
  - reasons;
  - approximate cost;
  - recurring patterns.
- Promote only validated suggestions into deterministic rules or curated overrides.
- If cost or budget becomes problematic, stop and document precisely.

### 7. Final Regeneration

- Regenerate:
  - `nbs`
  - `bds`
  - `fmar`
  - `s21`
- Produce:
  - `outputs/bible-<id>-strong-hybrid.tsv`
  - `outputs/bible-<id>-strong-hybrid.metrics.json`
  - `outputs/bible-<id>-strong-hybrid.hard-verses.json`
- Verify that full generated outputs remain ignored by Git.

### 8. Final Documentation

- Update:
  - `README.md`
  - `.agents/skills/bible-to-strong/SKILL.md`
  - `.agents/skills/bible-to-strong/references/workflow.md`
  - `reports/hybrid-strong-report.md`
- Clearly document:
  - recommended pipeline;
  - translation profiles;
  - complete gold metrics;
  - remaining limits;
  - when to use LLM;
  - how to resume.

### 9. Verification

Run and pass:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
python3 /Users/stephane/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/bible-to-strong
```

## Acceptance Criteria

- Old pipelines are not recommended or exposed as active paths.
- Full gold evaluation exists for `Sg1910`, `Darby`, and `DarbyR`.
- Results are analyzed globally, by book, and by OT/NT.
- Translation profiles correctly explain differences, especially BDS.
- At least one error class is corrected, or explicitly documented as not corrected with justification.
- LLM hard-verse review is tested on a bounded sample, or explicitly deferred with justification.
- `nbs`, `bds`, `fmar`, and `s21` are regenerated with up-to-date metrics.
- Docs and the skill let a future agent resume without ambiguity.
- All checks pass.
- Do not commit unless explicitly requested.

## Stop Condition

If full evaluation or LLM calls take too much time or cost too much, stop cleanly with:

- what was completed;
- what remains;
- exact commands to resume;
- estimated time/cost to finish.
