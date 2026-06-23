# Finalize French STEP Strong Lexicon

## Objective

Produce a final, reviewed French version of the STEP Strong lexicon, ready for a later DB import, with a reproducible workflow and defensible quality gates.

Do not write translations into the database until the final JSONL and reports are reviewed and approved.

## Current State

Primary source:

- `data/dictionaries/strong_lexicon.sqlite`

Legacy French helper source:

- `data/dictionaries/strong_fr.sqlite`

Current generated FR files:

- `outputs/lexicon-fr/strong_lexicon_fr.candidates.jsonl`
- `outputs/lexicon-fr/strong_lexicon_fr.accepted-v3.jsonl`
- `outputs/lexicon-fr/strong_lexicon_fr.remaining-after-retries.json`
- `outputs/lexicon-fr/strong_lexicon_fr.reclassification.json`
- `outputs/lexicon-fr/retry-short-meaning.candidates.jsonl`
- `outputs/lexicon-fr/retry-hard.candidates.jsonl`

Current reports:

- `reports/lexicon-fr-production.md`
- `reports/lexicon-fr-reclassification.md`
- `reports/lexicon-fr-retry-short-meaning.md`
- `reports/lexicon-fr-retry-hard.md`
- `reports/lexicon-fr-retry-summary.md`

Current quality state:

- `22,019 / 22,717` entries accepted in `accepted-v3`
- `534` invalid entries remain after retries
- `164` `confidenceOnly` entries remain for targeted audit
- No DB write has been done

## Existing Workflow Scripts

Read and reuse these scripts before adding new ones:

- `scripts/translateLexiconFr.ts`
- `scripts/reclassifyLexiconFrCandidates.ts`
- `scripts/benchmarkLexiconTranslation.ts`

Useful commands:

```sh
npm run reclassify:lexicon:fr
npm run translate:lexicon:fr
npm run lint
npm run typecheck
```

## Important Validator Context

The FR pipeline already includes important fixes:

- STEP suffixes in `dStrong` such as `G0032G`, `H7965G`, `H7965H`, etc. can be valid and must not automatically be treated as Strong changes.
- `lockedTerms` should apply only to lexical identity fields where possible: `eStrong`, `original`, `transliteration`, `gloss`.
- Do not trigger theological locked terms merely because a word appears somewhere in a long English definition.
- `Ham -> Cham` should apply only to the biblical name `H2526`, not to every occurrence of the English string `ham`.

## Role Of `strong_fr.sqlite`

Use `strong_fr.sqlite` as a secondary helper only. It is useful, but it is not the final authority.

It contains:

- `Grec`: about `5,775` entries
- `Hebreu`: about `8,854` entries
- useful columns: `Mot`, `Phonetique`, `Grec` / `Hebreu`, `Origine`, `Type`, `LSG`, `Definition`

Use it for:

- common French glosses;
- biblical proper-name forms;
- theological terminology hints;
- LSG translation frequency hints from the `LSG` field;
- fallback help for very short STEP entries;
- QA comparison against the new FR output.

Do not use it for:

- replacing STEP as the primary source;
- blindly copying `Definition`;
- importing old HTML;
- overwriting good STEP-based translations;
- merging or deleting STEP subentries;
- deciding `dStrong` / `uStrong` semantics when the legacy DB only has a classical Strong number.

Recommended policy:

```text
Use strong_fr.sqlite only as an auxiliary French hint:
- to propose common French equivalents;
- to stabilize biblical proper names;
- to identify usual French theological terms;
- to compare LSG renderings and frequency counts.

Never copy legacy Definition blindly.
Never keep legacy HTML.
Never prefer strong_fr.sqlite over STEP when they diverge.
Never use it to merge or remove STEP subentries.
```

## Work Plan

### 1. Inspect Remaining Problems

Read:

- `outputs/lexicon-fr/strong_lexicon_fr.remaining-after-retries.json`
- `reports/lexicon-fr-retry-summary.md`

Classify the remaining `534` invalid entries into:

- real translation problems;
- validator false positives;
- good translations polluted only by invented Strong references;
- candidates whose `meaningFr` is still too short;
- proper-name issues;
- theological terminology issues;
- genuinely uncertain cases requiring `review_needed`.

Do not rerun the same generic translation prompt over all remaining entries without first classifying them.

### 2. Fix Strong-Code Pollution

For `invented-strong` and `strong-changed`:

- If the French translation itself is good, prefer post-correction over full retranslation.
- Remove invented Strong references from `meaningFr` / `notesFr` unless the source explicitly contains them.
- Normalize `translation.strong` only when the candidate used a valid STEP `dStrong` suffix from the source.
- Keep `source.eStrong`, `source.dStrong`, `source.uStrong` unchanged.
- Do not invent root-code etymologies.

Expected result:

- many `invented-strong` entries should become accepted without another expensive LLM call.

### 3. Fix Short Meanings

For `meaning-too-short`:

- Enrich only if the definition is genuinely too poor for app display.
- Use STEP as the source.
- Use `strong_fr.sqlite` as a hint for common French wording when helpful.
- Keep it concise but informative.
- Do not pad text with empty wording.

Good example shape:

```text
Farine de blé obtenue par la mouture du grain.
```

Bad example shape:

```text
Farine.
```

### 4. Audit `confidenceOnly`

The `164` `confidenceOnly` entries are not invalid by default.

For each one:

- accept it if the French is faithful, natural, and lexicographic;
- correct it if the issue is obvious;
- mark `review_needed` only when there is a real uncertainty;
- do not reject merely because `confidence` is below the automatic threshold.

### 5. Use Legacy FR As QA, Not Authority

For important entries, compare against `strong_fr.sqlite`:

- proper names: verify the French biblical form;
- theology: verify conventional terms such as `alliance`, `expiation`, `justice`, `droiture`, `grâce`, `faveur`, `esprit`, `souffle`, `Éternel`, `YHWH`, `Seigneur`;
- LSG frequency lists: use them to understand common translation choices, not to force a single gloss.

If STEP and legacy FR diverge:

- prefer STEP for semantic structure;
- use legacy FR only to improve French wording or terminology.

### 6. Produce Final Files

Produce:

- `outputs/lexicon-fr/strong_lexicon_fr.final.jsonl`
- `outputs/lexicon-fr/strong_lexicon_fr.final-review-needed.json`
- `outputs/lexicon-fr/strong_lexicon_fr.final-rejected.json`
- `reports/lexicon-fr-final-quality.md`
- `reports/lexicon-fr-final-samples.md`
- `reports/lexicon-fr-final-import-plan.md`

Final JSONL requirements:

- exactly `22,717` records;
- exactly one record per `stepEntryId`;
- parseable JSONL;
- no duplicate `stepEntryId`;
- no empty `glossFr`;
- no HTML;
- no invented Strong code;
- no accidental English leak where a French equivalent exists;
- all records must have a final status: `accepted`, `review_needed`, or `rejected`;
- `source.eStrong`, `source.dStrong`, `source.uStrong`, `original`, `transliteration`, and `morph` must be preserved.

### 7. Quality Reports

`reports/lexicon-fr-final-quality.md` must include:

- total accepted / review_needed / rejected;
- final issue counts;
- number of entries fixed without LLM;
- number of entries fixed with LLM;
- additional API cost;
- remaining risk areas;
- before/after examples for the hard cases;
- import recommendation.

`reports/lexicon-fr-final-samples.md` must include at least:

- 10 Greek common terms;
- 10 Hebrew common terms;
- 10 proper names;
- 10 theological terms;
- 10 short-entry fixes;
- 10 long-entry or multi-sense examples.

`reports/lexicon-fr-final-import-plan.md` must include:

- proposed DB schema or table names;
- import order;
- indexes;
- rollback plan;
- how to preserve source metadata;
- how app code should query by classical Strong vs STEP entry id;
- what remains manual.

## Quality Gates

Before declaring done, run:

```sh
npm run lint
npm run typecheck
```

Also run or add checks for:

- final JSONL parses completely;
- final count is exactly `22,717`;
- no duplicate `stepEntryId`;
- no HTML in translated fields;
- no invented Strong references;
- no empty `glossFr`;
- all records have a final status;
- final accepted/review/rejected counts are reported.

## Definition Of Done

The goal is complete only when:

- `outputs/lexicon-fr/strong_lexicon_fr.final.jsonl` exists and covers all `22,717` STEP entries;
- all remaining problematic cases are explicitly accepted, corrected, `review_needed`, or `rejected`;
- `strong_fr.sqlite` has been used only as a controlled helper source;
- final reports exist and explain the quality state clearly;
- lint and typecheck pass;
- no DB write has been done;
- the next step is a conscious import decision, not more blind generation.

## Suggested Agent Prompt

```md
Finalize the French STEP Strong lexicon.

Do not write to the DB.

Use `data/dictionaries/strong_lexicon.sqlite` as the primary source. Use `data/dictionaries/strong_fr.sqlite` only as a legacy French hint for common French glosses, biblical proper names, theological terminology, and LSG frequency comparison. Never copy legacy HTML or prefer the old DB over STEP when they diverge.

Start from:

- `outputs/lexicon-fr/strong_lexicon_fr.accepted-v3.jsonl`
- `outputs/lexicon-fr/strong_lexicon_fr.remaining-after-retries.json`

Resolve the remaining `534` invalid entries and audit the `164` confidence-only candidates. Prefer deterministic post-correction when the French text is good but the record contains invented Strong references or validator artifacts. Use targeted LLM calls only when the text is genuinely wrong, too short, or uncertain.

Produce:

- `outputs/lexicon-fr/strong_lexicon_fr.final.jsonl`
- `outputs/lexicon-fr/strong_lexicon_fr.final-review-needed.json`
- `outputs/lexicon-fr/strong_lexicon_fr.final-rejected.json`
- `reports/lexicon-fr-final-quality.md`
- `reports/lexicon-fr-final-samples.md`
- `reports/lexicon-fr-final-import-plan.md`

Final JSONL must contain exactly `22,717` records, one per `stepEntryId`, with no HTML, no invented Strong code, no duplicate id, no empty `glossFr`, and explicit final status.

Run `npm run lint` and `npm run typecheck`.

Stop before DB import and report whether the final JSONL is ready for import.
```
