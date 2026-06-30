# Bible To Strong Workflow Reference

## Commands

Canonical no-LLM Strong ledger with reader and advanced views. The canonical
artifact is `outputs/strong/<id>/bible-<id>-strong.sqlite`; reader/advanced TSV
files are exports from that SQLite store:

```sh
npm run strong:generate -- --bible <id>
```

Migrate an existing pre-SQLite split JSON output once:

```sh
npm run strong:migrate:sqlite -- --bible <id>
```

Build the Kaikki lexical SQLite index once:

```sh
npm run strong:kaikki:index
```

When `data/external/french-lexical/kaikki/kaikki.org-dictionary-French.sqlite`
exists, lexical candidate generation uses targeted SQLite lookups instead of
streaming the large JSONL dictionary.

Build the Strong phrase-lexicon SQLite index once:

```sh
npm run strong:phrase:index
```

When `data/derived/strong-phrase-lexicon.sqlite` exists and its source
fingerprint matches `Sg1910`, `Darby`, and `DarbyR`, generation loads learned
multi-word phrase candidates from SQLite instead of rebuilding the large
in-memory phrase lexicon on every run.

Export an existing canonical output again if needed:

```sh
npm run strong:export -- --bible <id> --view reader
npm run strong:export -- --bible <id> --view advanced
```

Diagnostic output with hard-verse reports:

```sh
npm run strong:diagnose -- --bible <id>
```

Masked gold evaluation of the diagnostic backend:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000
npm run strong:evaluate -- --gold Darby --limit 1000
npm run strong:evaluate -- --gold DarbyR --limit 1000
```

Full gold evaluation for production-maturity reports:

```sh
npm run strong:evaluate -- --gold Sg1910
npm run strong:evaluate -- --gold Darby
npm run strong:evaluate -- --gold DarbyR
```

Diagnostic plus LLM suggestions only:

```sh
npm run strong:diagnose -- --bible <id> --llm --llm-limit 25
```

Book-by-book LLM batch:

```sh
npm run strong:diagnose -- --bible <id> --only Gen --llm --llm-limit 250 --output-dir outputs/llm-books/<id>/Gen
npm run strong:review:llm -- --bible <id> --diagnostics outputs/llm-books/<id>/Gen/bible-<id>-strong-diagnostic.hard-verses.json --review outputs/llm-books/<id>/Gen/llm-review-<id>-Gen.json --only Gen
```

Concurrent all-books LLM batch:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run strong:review:llm:books -- --bible <id> --books all --concurrency 3 --llm-limit 25 --model deepseek/deepseek-v4-flash --skip-existing
AI_GATEWAY_TIMEOUT_MS=120000 npm run strong:review:llm:books -- --bible <id> --books Gen,Exod,Lev --concurrency 2 --llm-limit 100 --model deepseek/deepseek-v4-flash --skip-existing
npm run strong:review:llm:books -- --bible <id> --books all --skip-existing
```

Use the small complete pass first. A higher `--llm-limit` should be a targeted second pass on selected books, not the default for every book of every Bible.

The batch runner creates one folder per book and writes a manifest:

```text
outputs/llm-books/<id>/<Book>/llm-review-<id>-<Book>.json
outputs/llm-books/<id>/llm-review-<id>-manifest.json
```

Open the manifest in the reviewer:

```text
http://localhost:4173/viewer/review.html?manifest=/outputs/llm-books/<id>/llm-review-<id>-manifest.json
```

The reviewer can also load a local folder of `llm-review-*.json` files. It defaults to pending suggestions, supports filtering by decision/book/search, and has a "Livre suivant" control for moving through the loaded corpus.

Prepare a human review queue from LLM suggestions:

```sh
npm run strong:review:llm -- --bible <id>
npm run viewer
```

Save accepted decisions in the viewer, then regenerate:

```sh
npm run viewer
npm run strong:generate -- --bible <id>
```

Reference-transfer LLM to target:

```sh
npm run strong:llm:transfer -- --source Darby --target <id> --only Gen.1 --limit 5
```

Reference-transfer gold evaluation:

```sh
npm run strong:llm:transfer -- --source Darby --gold Sg1910 --only Gen.1 --limit 5
npm run strong:llm:transfer -- --source Darby --gold DarbyR --only Gen.1 --limit 5
```

Internal-agent gap-review packet:

```sh
npm run strong:generate -- --bible <id>
npm run strong:review:gaps -- \
  --bible <id> \
  --only <BookOrScope> \
  --audit \
  --output-dir outputs/gap-review/<id>/<scope>
npm run strong:review:gaps:packet -- \
  --bible <id> \
  --only <BookOrScope> \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>.json
```

For semantic benchmarks, require a semantic-priority queue before calling a
model:

```sh
npm run strong:review:gaps:packet -- \
  --bible <id> \
  --only <BookOrScope> \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>-semantic.json \
  --limit 30 \
  --min-priority semantic-medium
```

If the packet command exits with
`no-candidates-at-or-above-priority:semantic-medium`, the current queue is a
restraint/function-low queue, not a high-yield semantic benchmark queue.

High-yield semantic packet from lexical candidates:

```sh
npm run strong:review:gaps:lexical-packet -- \
  --bible <id> \
  --only <BookOrScope> \
  --lexical-report outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-<BookOrScope>.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>-lexical.json \
  --limit 30 \
  --min-confidence medium
```

Current production-maturity evidence, dated 2026-06-29:

| scope  | consensus applied | empty delta | reader tagged token delta | risk delta |
| ------ | ----------------: | ----------: | ------------------------: | ---------: |
| `Ezek` |                16 |         -16 |                       +18 |         -2 |
| `1Cor` |                 7 |         -14 |                       +15 |         -1 |
| `Acts` |                 8 |          -6 |                       +10 |         -4 |

This is enough evidence to run the next controlled batch across several compact
lexical packets, but the application rule remains consensus-only. Keep per-book
caps, validate each model review, build exact visible high-confidence consensus,
apply only that consensus, refresh the affected scope, and write a before/after
benchmark report.

The first controlled batch, replayed through the automatic post-consensus filter
on 2026-06-30, initially left 27 safe consensus decisions applied across `Hos`,
`2Sam`, `Rev`, and `Amos` with global deltas `emptyStrongCount -40`,
`readerTaggedTokenCount +47`, and `placementRiskCount -6` before the Leviticus
follow-up. It also exposed two mandatory safety gates before application:

- remove generic carriers such as `vais`, `ferai`, `fera`, `fasse`, `celle`,
  and `quoi` unless at least two Strong witnesses use the same normalized
  carrier. The automatic replay also held 2 Samuel `faisait`, `vais`, and
  `fit`;
- hold same-target stacking for review instead of applying both Strong codes to
  the same French word automatically. That review must inspect the witnesses
  before discarding either side. In `Rev.5.1`, the witness check showed
  `G1855 -> dehors/revers/extérieur`, so NBS `dos` keeps `G1855`; `G3693`
  remains advanced empty.

`Lev` produced a clean 21-decision consensus in that batch and the filter marks
all 21 safe. Follow-up isolation on 2026-06-30 showed the apparent refresh hang
was a performance issue in scoped refresh, not a bad Leviticus decision:
`generateStrongLedger` reread heavy lexical sources and rebuilt large reference
phrase structures during auto-safe stabilization. The SQLite ledger, lexical
source cache, Kaikki index, and phrase-lexicon index now remove the full-ledger
JSON parse and the largest repeated source-loading costs. The pre-SQLite
`strong:refresh -- --bible nbs --only Lev` baseline completed in 132.06s with
7.46 GB max RSS; the SQLite/indexed path reduces memory materially while the
remaining time is dominated by bounded lexical auto-safe stabilization. The 21
filtered `Lev` decisions are now applied and verified. Incremental `Lev` delta:
`emptyStrongCount -15`,
`readerTaggedTokenCount +21`, `placementRiskCount -5`. Report:
`reports/llm-gap-review-nbs-Lev-filtered-applied-20260630.md`.

The second bounded batch on 2026-06-30 applied 17 filtered consensus decisions
across `2Kgs.1-5`, `1Pet.1-5`, and `Rom.1-5`, with global deltas
`emptyStrongCount -42`, `readerTaggedTokenCount +48`, and
`placementRiskCount -6`. The automatic filter held `2Kgs.4.38 H8239 -> fais`,
`1Pet.2.20 G0015 -> faisant`, and original-only `Rom.4.17 G5607 -> existe`.
Visible decisions with no token witness and no Strong support in `Sg1910`,
`Darby`, or `DarbyR` must remain review items.

Visible high-confidence consensus from two validated model reviews, then filter
before application:

```sh
npm run strong:review:gaps:consensus -- \
  --left-review outputs/gap-review/<id>/agent-review/<left>.json \
  --right-review outputs/gap-review/<id>/agent-review/<right>.json \
  --left-validation-dir outputs/gap-review/<id>/agent-review/<left>-validated \
  --right-validation-dir outputs/gap-review/<id>/agent-review/<right>-validated \
  --output outputs/gap-review/<id>/agent-review/<consensus-visible-high>.json \
  --min-confidence 0.84
npm run strong:review:gaps:filter -- \
  --review outputs/gap-review/<id>/agent-review/<consensus-visible-high>.json \
  --output outputs/gap-review/<id>/agent-review/<consensus-visible-high>-auto-filtered.json \
  --report-json reports/llm-gap-review-<id>-<scope>-post-consensus-filter.json \
  --report-md reports/llm-gap-review-<id>-<scope>-post-consensus-filter.md
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<consensus-visible-high>-auto-filtered.json \
  --output-dir outputs/gap-review/<id>/agent-review/<consensus-visible-high>-auto-filtered-applied \
  --apply
```

Benchmark report with before/after metrics:

```sh
npm run strong:review:gaps:report -- \
  --packet outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>-lexical.json \
  --review outputs/gap-review/<id>/agent-review/<consensus-visible-high>.json \
  --validation-dir outputs/gap-review/<id>/agent-review/<consensus-visible-high>-validated \
  --applied-dir outputs/gap-review/<id>/agent-review/<consensus-visible-high>-applied \
  --before-metrics outputs/gap-review/<id>/baseline/bible-<id>-strong-metrics-before-<scope>.json \
  --after-metrics outputs/strong/<id>/bible-<id>-strong-metrics.json \
  --metrics-scope <scope> \
  --output-json reports/llm-gap-review-<id>-<scope>.json \
  --output-md reports/llm-gap-review-<id>-<scope>.md
```

Single-model AI Gateway pilot from a packet:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run strong:review:gaps:llm -- \
  --input outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>.json \
  --output outputs/gap-review/<id>/agent-review/llm-review-<id>-<scope>.json \
  --model deepseek/deepseek-v4-flash
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/llm-review-<id>-<scope>.json \
  --output-dir outputs/gap-review/<id>/agent-review/llm-review-<id>-<scope>-validated \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --finalize-reference-style
```

Validate an agent or arbiter review:

```sh
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<review>.json \
  --output-dir outputs/gap-review/<id>/agent-review/<review>-validated \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json
```

Apply only the final validated arbiter decisions:

```sh
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<arbiter>.json \
  --output-dir outputs/gap-review/<id>/agent-review/<arbiter>-applied \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --finalize-reference-style \
  --apply
npm run strong:generate -- --bible <id>
```

S21 concordance comparison:

```sh
npm run compare:s21:concordance
```

## Reference-Style Agent Model Matrix

When the task is to copy the visible Strong style of `Darby`, `DarbyR`, and
`Sg1910` for a target Bible, use this benchmarked default matrix:

- proposer A: `gpt-5.4-mini`, reasoning `medium`;
- proposer B: `gpt-5.5`, reasoning `low`;
- arbiter: `gpt-5.5`, reasoning `medium`.

Do not upgrade proposer A to `xhigh` unless the user explicitly asks for that
experiment. The normal workflow is meant to test whether the ordinary proposer
pair can solve the chapter. If a stronger proposer is used during an experiment,
record that fact in the output folder/report and do not treat the result as the
default production evidence.

This default was selected by the Gen.1 benchmark documented in
`reports/gap-review-model-benchmark-gen1.md`. It is combo A:

- same proposers as the high-quality baseline;
- arbiter downgraded from `gpt-5.5 high` to `gpt-5.5 medium`;
- 0 final differences from the baseline on Gen.1;
- all applicable spot checks passed;
- wall time improved from 719s to 623s.

Keep `gpt-5.5 high` as the quality-reference baseline, an escalation path for
hard chapters, or an explicit experiment. Do not use `gpt-5.4-mini low` as
proposer A for this workflow: the Gen.1 benchmark showed that it collapsed to
all-empty proposals and caused downstream quality loss.

For this workflow, build packets chapter by chapter. Filter candidates to Strong
codes present in at least one reference Strong Bible when the goal is
reader-style parity. Original-only candidates may be reported separately, but
they must not force the visible reader style.

The gap-review candidate set is not limited to missing Strong codes. It
also emits `auditKind="relocation"` items for visible reader tags that look
misplaced. A relocation candidate carries `currentTarget` plus alternative
`deterministicCandidates`; the proposer should return `duplicate` only when the
existing target is correct. Otherwise it should return `word`, `phrase`, or
`empty`. For cases like NBS `Gen.1.27` (`H0120` on `homme` vs `humains`),
do not introduce a hand-written semantic rule. Move the Strong only when
auditable external lexical evidence or a bounded LLM review supports the
target carrier.

## Choosing The Command

Use `strong:generate` when:

- the user asks for the best production-quality workflow;
- you need the canonical Strong SQLite ledger;
- you need one artifact that can produce both `reader` and `advanced` views;
- you need auditable placement, visibility, source, confidence, and diagnostics.

Use `strong:export` when:

- a TSV is needed for the viewer, distribution, or downstream tools;
- the canonical SQLite ledger already exists;
- the caller needs either `--view reader` or `--view advanced`.

Use `strong:diagnose` when:

- you need hard-verse diagnostics;
- you need current diagnostic metrics;
- you are preparing bounded LLM review inputs.

Use `strong:evaluate` when:

- alignment logic changed;
- you need masked-gold precision, recall, and F1 against `Sg1910`, `Darby`, or
  `DarbyR`.

Use `strong:review:gaps` and `strong:review:gaps:*` when:

- the ledger already contains an advanced/technical/empty Strong that needs a
  reader placement decision;
- you want a constrained packet for agents instead of a free-form LLM task.

Use `strong:llm:transfer` when:

- the target translation differs from the references enough that deterministic transfer misses obvious semantic matches;
- you need a measurable LLM path;
- you can first test the same prompt against masked gold editions.

## Metrics To Report

Always report at least:

- generated verse count;
- total Strong occurrence count;
- tagged-token coverage;
- visible Strong rate;
- empty Strong rate;
- multi-Strong word rate;
- original representation rate;
- original unrepresented Strong occurrence count;
- original confirmation rate;
- hard verse count;
- translation profile;
- profile token-coverage status;
- LLM attempted count if any;
- LLM accepted/suggested count if any.

## Translation Profiles

Do not compare every French Bible as if it were Darby.

Current profiles:

- `fmar`: formal historical translation, high Strong density accepted, up to 4 Strong codes per French word when justified.
- `nbs`: formal-readable Segond-family translation, medium density and readable tags.
- `s21`: formal-readable modern Segond-family translation, medium density and readable tags.
- `bds`: dynamic-equivalence translation, semantic density, fewer learned function-word tags, stricter empty-word consensus.

The diagnostic metrics include `translationProfile`. Its settings affect generation and diagnostics:

- learned enrichment threshold;
- maximum Strong codes per visible word;
- minimum reference consensus before adding an empty word;
- whether learned function-word tags are allowed;
- `low-token-coverage`;
- `below-reference-strong-density`;
- `many-original-strong-unplaced`.

For BDS, a lower token coverage is not automatically bad. The important question is whether meaningful content words are tagged, original confirmation stays high, and hard verses are explainable.

Do not try to maximize Strong count globally. The objective is the best reader-facing density for the translation family:

- formal: denser is acceptable;
- formal-readable: balanced density;
- dynamic: fewer tags can be better when they are more semantic and readable.

For gold evaluation, report:

- precision;
- recall;
- F1;
- evaluated verse count;
- obvious failure modes.

`strong:evaluate` masks a known Strong Bible by stripping its tags, runs the current diagnostic backend without using that Bible as a reference, and compares predicted Strong occurrences to the original gold Strong occurrences.

## LLM Policy

LLM should not be the primary generator.

Recommended LLM strategy:

1. Run deterministic ledger generation.
2. Inspect metrics, hard verses, and the canonical ledger.
3. Prefer gap review when the Strong already exists in advanced/debug but
   lacks a good reader placement.
4. Run bounded diagnostic LLM suggestions by book with `--only <Book> --llm --llm-limit <n> --output-dir outputs/llm-books/<id>/<Book>` only for residual hard cases.
5. Run `npm run strong:review:llm` against that book diagnostics file.
6. High-confidence mechanically safe suggestions are pre-marked `accept`; weak function-word/particle cases remain `pending`.
7. Open the viewer, load the review JSON, reject any bad auto-accepted suggestions, decide pending suggestions, and click `Enregistrer décisions`.
8. Regenerate the full Bible with `npm run strong:generate -- --bible <id>`.
9. Optionally run `strong:llm:transfer --gold` before large batches to evaluate prompt quality.

Manual correction is supported in the review UI only while an item is `À revoir`. If the LLM has the right Strong code but attached it to the wrong French token, set the item to `À revoir`, click the intended word in the verse context or edit `Index cible`, `Mot normalisé`, and `Strong`, then set the item to `Accepter`. Example: if `H8033` should be attached to `Là`, switch the item to `À revoir`, click `Là` in the context, verify that `Strong` is `H8033`, accept the item, and save decisions. The saved override is guarded by the final word index and normalized word, so it will only reapply if the target Bible verse still matches.

Default review pre-acceptance is conservative:

- confidence must be at least `0.84`;
- target word must not be a weak French function word;
- Strong code must not be in the weak auto-accept denylist, including `H0853`, `H0834`, `H0996`, `H8033`, `H5921`, `H0413`, `G1722`, `G1519`, `G3588`.

Override the threshold if needed:

```sh
npm run strong:review:llm -- --bible <id> --auto-accept-threshold 0.88
npm run strong:review:llm -- --bible <id> --auto-accept false
```

Do not let the LLM invent Strong codes. Valid suggestions must use Strong codes present in either:

- the source Strong verse;
- the original WLC/SBLGNT verse inventory, when the command allows it.

## LLM Arbitration And Curated Overrides

The production path is not "LLM says yes, TSV changes." The production path is:

1. Generate the current diagnostic hard-verse report.
2. Run `npm run strong:diagnose -- --bible <id> --only <Book> --llm --llm-limit <n> --output-dir outputs/llm-books/<id>/<Book>`.
3. Run `npm run strong:review:llm -- --bible <id> --diagnostics outputs/llm-books/<id>/<Book>/bible-<id>-strong-diagnostic.hard-verses.json --review outputs/llm-books/<id>/<Book>/llm-review-<id>-<Book>.json --only <Book>`.
4. Open `http://localhost:4173/viewer/review.html` with `npm run viewer`.
5. Load `outputs/llm-review-<id>.json` in the "Charger une revue LLM" drop zone.
6. Accept only defensible suggestions; reject token-index drift, weak function-word tags, duplicate over-tagging, and unrendered original particles that should stay empty or absent.
7. Click `Enregistrer décisions` in the viewer.
8. Regenerate with `npm run strong:generate -- --bible <id>`.

Each override must be guarded by:

- Bible id;
- verse ref;
- target word index;
- expected normalized target word;
- Strong code(s);
- confidence;
- source;
- reason.

The viewer writes accepted decisions to `data/curated-strong-overrides.json`. The CLI `strong:review:llm:apply` remains available for scripted/offline decision files. This makes LLM work reproducible and auditable: later agents do not need to re-ask the model for decisions already reviewed.

## Internal-Agent Semantic Refill

Use this workflow when the canonical ledger already contains the Strong in
`advanced` or `debug`, but the reader mode still has semantic holes. This is the
right path for cases like a missing visible content Strong, not for rebuilding
the whole Bible from scratch.

The production shape is:

1. Generate or refresh the canonical Strong ledger.
2. Run `strong:review:gaps --audit` to create candidate and pending files.
3. Build a procedural packet with `strong:review:gaps:packet`.
4. Send one chapter packet to two independent proposer agents.
5. Validate each proposer with `strong:review:gaps:apply`.
6. Send packet + proposals + validations to an arbiter.
7. Validate the arbiter output.
8. Apply only validated arbiter decisions.
9. Regenerate the canonical Strong ledger.
10. Inspect the result in the viewer.

Prefer chapter-sized packets. They preserve enough narrative context while
keeping the decision surface small. Use book-sized packets only for short books
or low candidate counts.

The packet deliberately reduces LLM freedom. Each candidate includes:

- `sourcePlacement`: where the advanced/empty Strong currently sits;
- `nearbyOpenTargets`: unoccupied content words near that source placement;
- `blockedTargets`: words already carrying reader Strong tags;
- `openContentTargets`: non-weak unoccupied target words;
- `occupiedTargets`: all occupied word/phrase carriers;
- `availableTargets`: every token with occupancy metadata;
- `placementWarnings`: mechanical risks the agent must account for.

The key rule is: do not stack a missing Strong onto a `blockedTarget` just
because the surface word looks lexically attractive. If a plausible
`nearbyOpenTarget` exists, prefer it.

For reference-style candidates, no valid Strong should disappear just because no
French carrier is found. There is no final `pending` bucket in this workflow.
Every valid candidate must become a placed decision with a confidence score. The
decision order is:

1. `word` when a visible French token clearly carries the Strong;
2. `phrase` when a contiguous French expression carries the Strong;
3. `empty` when the Strong is legitimate for the verse/reference style but no
   reliable French carrier exists.

Use `sourcePlacement.insertAfterWordIndex` to position the empty tag in the
original/reference order. Example: if an unplaced Strong belongs before the
concept currently carried by `abime`, place the empty tag before that segment
rather than reporting it as merely "not placed". The output reason should say
that no reliable French carrier was found.

Reserve `reject` for invalid candidate ids, Strong codes absent from the
allowed inventories, duplicated drift, impossible token indexes, or bad
proposals. Do not reject a valid reference-style Strong only because it is not
rendered by a visible French word.

Confidence replaces pending/review state:

- `confidence >= 0.84`: high-confidence placement, rendered normally;
- `confidence < 0.84`: low-confidence placement, rendered in yellow;
- low-confidence can apply to `word`, `phrase`, or `empty`;
- keep warnings such as suspicious stacking, weak carrier, or no reliable
  French carrier in the reason/evidence, but still place the Strong.

If local validation produces `pending-human` for a structurally valid
reference-style candidate, the final adapter must convert it before preview or
application. Pass `--finalize-reference-style` on the final arbiter validation
or application command. That mode keeps mechanically safe `word`/`phrase`
decisions, converts unsafe or unresolved targets to low-confidence `empty` at
`sourcePlacement.insertAfterWordIndex`, and fills any missing candidate decision
with the same low-confidence `empty` fallback.

This rule came from the NBS Gen.3.6 regression test. The weak prompt caused both
proposers to choose `H8378 -> desirable`, even though `desirable` already had
`H2530`. Adding only `blockedTargets` made the agents safer but sometimes too
conservative. Adding `sourcePlacement` and `nearbyOpenTargets` fixed the
upstream behavior: both proposers selected `H8378 -> plaisant`, while keeping
`H7919 -> discernement`.

Local validation remains a safety net, but it is not the product state. If an
agent proposes a word target that already carries a different reader Strong
while an open content target exists, validation may flag it as
`pending-human/suspicious-stacking-on-occupied-word`; the arbiter/final adapter
must then choose a safer open target or emit a low-confidence `empty` fallback.

Preview/report requirements for this workflow:

- show visible existing tags;
- show agent/arbitrated visible additions;
- show `empty` additions inline as small empty Strong tags;
- color low-confidence placements yellow;
- report true technical rejects separately from valid low-confidence or empty
  placements.

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

Then open `http://localhost:4173/viewer/` and load the generated TSV from `outputs/`.

## Reports

Useful existing reports:

- `reports/reader-strong-report.md`
- `reports/s21-concordance-comparison.md`
- `reports/strong-diagnostic-report.md`
- `reports/strong-gold-evaluation-report.md`
- `reports/llm-hard-verse-review.md`

When adding a new Bible or strategy, update or create a report under `reports/` with:

- input Bible id/path;
- commands run;
- metrics;
- LLM/gold-eval results if used;
- known failure modes;
- whether generated full outputs remain ignored by Git.

To resume a production-maturity audit, read `reports/strong-gold-evaluation-report.md` and `reports/llm-hard-verse-review.md`, then continue from the highest-impact documented failure class rather than adding isolated overrides.

## Final Response Checklist

Tell the user:

- which Bible id was processed;
- which command produced the recommended output;
- where the output and metrics are;
- whether LLM was used as suggestion-only or applied;
- key metrics;
- checks run;
- any residual risks or next recommended calibration.
