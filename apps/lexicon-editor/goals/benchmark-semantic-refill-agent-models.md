# Benchmark Semantic-Refill Agent Models

## Objective

Find the fastest and most efficient 3-agent composition for the NBS semantic-refill workflow while preserving reader-style quality close to the best known result.

Benchmark only `Gen.1` first. Do not run the whole Bible and do not benchmark on Gen.2-3 until Gen.1 identifies a convincing default combo.

The 3-agent composition is:

1. proposer A
2. proposer B
3. arbiter

The target output style is the same as the current reference-style workflow:

- copy the reader style of `Sg1910`, `Darby`, and `DarbyR`;
- no final `pending`;
- every valid candidate ends as `word`, `phrase`, or `empty`;
- `empty` is allowed when no reliable French carrier exists;
- each decision has a confidence score and a high/low confidence band;
- do not add hand-written lexical rules to win the benchmark.

## Read First

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `outputs/semantic-refill/nbs/gen1-3-medium-low/summary.json`
- `outputs/semantic-refill/nbs/gen1-3-medium-low/final-decisions.json`
- `outputs/semantic-refill/nbs/gen1-3-medium-low/agent-packet-reference-style-nbs-Gen.1.json`
- relevant code in `src/semanticRefill*.ts`

## Fixed Dataset

Use only:

```text
outputs/semantic-refill/nbs/gen1-3-medium-low/agent-packet-reference-style-nbs-Gen.1.json
```

If that file is missing, rebuild the Gen.1 packet from the current NBS enriched output, but document the exact command.

Do not change the packet between model combinations. Every benchmark row must use the exact same candidates.

## Baseline

The baseline combo is the current known-good run:

```text
proposer A: gpt-5.4-mini / medium
proposer B: gpt-5.5 / low
arbiter:    gpt-5.5 / high
```

Use this baseline as the quality reference, not necessarily as the final recommendation.

## Model Degradation Plan

Test combinations progressively from safer to cheaper/faster. Keep the same prompt structure and the same JSON contract for every run.

Recommended first matrix:

| combo | proposer A | proposer B | arbiter | purpose |
| --- | --- | --- | --- | --- |
| baseline | `gpt-5.4-mini medium` | `gpt-5.5 low` | `gpt-5.5 high` | quality reference |
| A | `gpt-5.4-mini medium` | `gpt-5.5 low` | `gpt-5.5 medium` | test cheaper arbiter |
| B | `gpt-5.4-mini low` | `gpt-5.5 low` | `gpt-5.5 medium` | test cheaper proposer A |
| C | `gpt-5.4-mini medium` | `gpt-5.4 medium` | `gpt-5.5 medium` | test replacing proposer B |
| D | `gpt-5.4-mini medium` | `gpt-5.4-mini medium` | `gpt-5.5 medium` | test cheap proposer pair |
| E | `gpt-5.4-mini low` | `gpt-5.4-mini medium` | `gpt-5.4 high` | test mostly non-frontier trio |
| F | `gpt-5.3-codex-spark high` | `gpt-5.4-mini low` | `gpt-5.4 medium` | fastest candidate if quality survives |

If a combo fails hard mechanical validation, do not test cheaper variants that depend on the same failed component unless there is a clear reason.

If a cheaper combo matches the baseline quality on Gen.1, optionally test one even cheaper combo to find the breaking point.

## Per-Combo Workflow

For each combo, create a separate output folder:

```text
outputs/semantic-refill/nbs/model-benchmark-gen1/<combo-id>/
```

Each combo must produce:

- `proposer-a.json`
- `proposer-b.json`
- `arbiter.json`
- `final-decisions.json`
- `summary.json`
- `preview.html`
- `timings.json`

Measure:

- proposer A elapsed time;
- proposer B elapsed time;
- total proposer wall time;
- arbiter elapsed time;
- total wall time;
- number of `word`, `phrase`, `empty`, `reject`;
- high-confidence count;
- low-confidence count;
- mechanical validation errors;
- malformed JSON retries;
- missing candidate decisions;
- disagreements between proposer A and proposer B;
- final differences against baseline.

## Quality Checks

Use the baseline decisions as the first comparator, then inspect important Gen.1 cases manually in the generated preview.

Minimum quality gate:

- exactly one final decision per packet candidate;
- zero final `pending`;
- zero malformed JSON;
- zero unsupported Strong ids;
- zero out-of-range word indexes;
- zero invalid phrase ranges;
- no `reject` unless the candidate itself is invalid;
- all `empty` placements use `sourcePlacement.insertAfterWordIndex`;
- final visible/empty counts must be explainable.

Important Gen.1 spot checks:

- `H4723` in `Gen.1.10` should be placed on `masse`, unless a better reasoned alternative is found.
- `H1961` phrase-style cases should not be blindly stacked on unrelated single words.
- `H7549` / firmament-style cases should respect the reader style rather than forcing every original occurrence.
- Weak function words should not receive extra stacking when a content carrier exists.
- If no good French carrier exists, prefer `empty` low confidence over `reject`.

## Scoring

Produce a score per combo:

```text
qualityScore = 100
  - 25 * mechanicalErrorCount
  - 10 * malformedJsonRetryCount
  - 8  * unsupportedRejectCount
  - 5  * importantSpotCheckFailureCount
  - 2  * unexplainedDifferenceFromBaselineCount
  - 1  * lowConfidenceVisiblePlacementCount
```

Also produce:

```text
speedScore = baselineTotalWallSeconds / comboTotalWallSeconds
efficiencyScore = qualityScore * speedScore
```

The recommended combo is the fastest combo that:

- passes all minimum quality gates;
- has `qualityScore >= 95`, or is no more than 2 points below the baseline;
- has no important spot-check failure;
- materially improves speed or reduces model cost/complexity.

If no degraded combo passes, keep the baseline and document why.

## Reporting

Write:

```text
reports/semantic-refill-model-benchmark-gen1.md
outputs/semantic-refill/nbs/model-benchmark-gen1/benchmark-summary.json
```

The report must include:

- table of all tested combos;
- exact models and reasoning efforts;
- timings per agent and total wall time;
- quality metrics;
- score formula results;
- differences from baseline;
- screenshots or links to previews;
- final recommendation;
- whether the recommended combo is safe to test on Gen.2-3 next.

## Acceptance Criteria

- At least 4 model combinations tested, including the baseline.
- All outputs are written under `outputs/semantic-refill/nbs/model-benchmark-gen1/`.
- A clear winner is selected, or the baseline is retained with evidence.
- The report explains speed/quality tradeoffs concretely.
- No code rules or lexical shortcuts are added for benchmark-specific cases.
- No full copyrighted Bible output is committed.

## Suggested Goal Command

```text
/goal Suis entièrement goals/benchmark-semantic-refill-agent-models.md. Benchmark uniquement Genèse 1 pour trouver la composition de 3 agents la plus rapide et efficace pour semantic-refill NBS. Produis les artefacts, le rapport, les timings, et recommande le combo à utiliser ensuite.
```
