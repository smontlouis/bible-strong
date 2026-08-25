# Phrase-Aware Strong Alignment V2

## Objective

Improve the French Bible Strong-generation pipeline now that the project supports phrase-level Strong assignments.

The goal is to make the hybrid generator, LLM review workflow, metrics, and regenerated local outputs fully phrase-aware, so French locutions such as `dans la mesure ou`, `prend soin`, or `a leurs peres et a leurs meres` can be represented as a single `<w strong="...">...</w>` wrapper when that is more faithful than attaching the Strong to one word.

Target Bibles:

- `bds`
- `bfc`
- `fmar`
- `frc97`
- `nbs`
- `nfc`
- `nvs78p`
- `ost`

## Read First

- `.agents/skills/bible-to-strong/SKILL.md`
- `goals/finalize-hybrid-production-maturity.md`
- `goals/multi-bible-strong-generation-review.md`
- `src/readerAlignment.ts`
- `src/curatedStrongOverrides.ts`
- `src/llmReview.ts`
- `src/generateStrongHybrid.ts`
- `viewer/reviewer.js`
- `data/curated-strong-overrides.json`
- current review outputs under `outputs/llm-books/`

## Current State

The project now supports persisted phrase overrides with:

- `target: "phrase"`
- `startWordIndex`
- `endWordIndex`
- `normalizedPhrase`

The renderer can emit one `<w>` wrapper over a multi-word French phrase, and the reviewer UI can save phrase targets.

There are already manually reviewed phrase overrides in `data/curated-strong-overrides.json`. Preserve them and do not overwrite unrelated user edits.

## Main Work

### 1. Regenerate With Existing Phrase Overrides

Regenerate the target Bibles with the current hybrid pipeline:

```sh
for bible in bds bfc fmar frc97 nbs nfc nvs78p ost; do
  npm run generate:strong:hybrid -- --bible "$bible"
done
```

Collect before/after metrics where available:

- token coverage
- visible Strong rate
- empty Strong rate
- multi-Strong word rate
- phrase Strong count
- original representation rate
- original unrepresented Strong occurrences
- hard verse count

If phrase counts are not yet reported in metrics, add a metric such as `phraseStrongAssignmentCount` and include it in reports.

### 2. Make Learned Phrase Transfer Produce Real Phrase Assignments

Today learned phrase context may identify a phrase but often still assigns the Strong to a single head word.

Update the deterministic backend so when `phraseTranslationLexicon` identifies a strong phrase candidate with a contiguous target phrase, it can produce a `ReaderPhraseAssignment` instead of only a word assignment, when this is more faithful.

Rules:

- Use phrase assignment only for contiguous target phrases.
- Keep the assignment original-confirmed.
- Do not create nested `<w>` tags.
- If the same Strong already exists on a covered word, move/deduplicate it into the phrase wrapper.
- Do not use phrase assignment for broad weak function-word drift unless the phrase is semantically meaningful.
- Preserve style 4 calibration by Bible profile.

Add or update tests for:

- learned phrase candidate renders as one phrase wrapper;
- phrase assignment does not duplicate a Strong already assigned to a word in the same phrase;
- word assignments still work for normal one-word cases;
- empty assignments still render correctly around phrase wrappers.

### 3. Make LLM Review Phrase-Aware

Update LLM review generation so suggestions can explicitly propose:

- `target: "word"`
- `target: "phrase"`
- `target: "empty"`

For phrase suggestions, the review item should include:

- `startWordIndex`
- `endWordIndex`
- `normalizedPhrase`
- reason explaining why the phrase, not one head word, is the right target.

Prompt guidance:

- Prefer `word` for a simple lexical equivalent.
- Prefer `phrase` when the French equivalent is a locution or syntactic expression.
- Prefer `empty` only when the original word is not naturally rendered by visible French text.
- Reject or avoid weak particles attached only because they exist in the original.
- Use reference Strong Bibles and original-language inventories as evidence.

Do not blindly auto-apply LLM phrase suggestions. They must flow through the same review/acceptance mechanism.

### 4. Re-run Targeted Review, Not a Full Expensive Re-run

After deterministic regeneration, inspect hard verses again.

Run LLM review only for verses still hard after the phrase-aware deterministic pass:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run review:llm:books -- \
  --bible <id> \
  --books all \
  --concurrency 3 \
  --llm-limit 25 \
  --model deepseek/deepseek-v4-flash \
  --skip-existing
```

If existing review files would hide new phrase-aware opportunities, write new outputs under a separate directory such as:

```text
outputs/llm-books-phrase-v2/<id>/
```

Use a cheaper model first. Escalate only representative difficult cases if the cheap model is clearly insufficient.

### 5. Merge and Review Remaining Cases

Create a merged review file or manifest that lets the reviewer inspect all remaining `pending` / `pending-human` items across the target Bibles.

The final human workload should be small and explicit:

- list remaining items by Bible;
- distinguish word/phrase/empty targets;
- show the reason each item still needs human review;
- avoid asking the user to review thousands of items.

### 6. Apply Accepted Decisions and Regenerate

After decisions are saved:

```sh
for bible in bds bfc fmar frc97 nbs nfc nvs78p ost; do
  npm run review:llm:apply -- \
    --bible "$bible" \
    --decisions "outputs/llm-books/$bible/llm-review-$bible-merged-decisions.json"

  npm run generate:strong:hybrid -- --bible "$bible"
done
```

If using a new phrase-v2 output directory, adapt the decisions path accordingly.

## Reports

Create or update:

- `reports/phrase-aware-strong-v2-report.md`

The report must include:

- what changed in the backend;
- phrase assignment policy;
- examples before/after, including at least one BDS example such as `Heb.1.4`;
- per-Bible metrics before/after;
- number of phrase assignments generated deterministically;
- number of phrase assignments accepted from review;
- remaining pending-human count by Bible;
- known limitations;
- exact commands to reproduce.

## Acceptance Criteria

- All target Bibles regenerate successfully.
- Phrase overrides in `data/curated-strong-overrides.json` are applied and rendered as a single `<w>` wrapper around the phrase.
- Deterministic learned phrase transfer can create real phrase assignments where appropriate.
- LLM review supports `word`, `phrase`, and `empty` targets.
- Metrics include phrase-aware counts or explicitly document phrase assignments.
- Remaining human review count is small and reported by Bible.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- Generated Bible TSVs and large/copyrighted artifacts remain under ignored `outputs/` paths and are not committed.

## Stop Conditions

Stop and document clearly if:

- source data is missing for a target Bible;
- phrase-aware deterministic generation causes worse masked gold evaluation on known Strong Bibles;
- LLM budget/API access is unavailable;
- the remaining unresolved cases require substantial human theological/editorial judgment.

If stopped, still write:

- what was completed;
- what remains;
- exact commands to resume;
- current metrics and pending counts.
