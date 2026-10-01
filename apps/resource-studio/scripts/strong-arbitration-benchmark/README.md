# JEV arbitration of expanded Strong candidates

Offline experiment. No ledger, production dictionary pointer, publication or
resource activation is changed. Commands run from `apps/resource-studio`.

## Fixed protocol

The same 900 source occurrences are evaluated under three variants:

- `lexical`: existing carrier plus all available lexical candidates;
- `enriched`: the same list plus Eflomal Strong/surface union projections at seed 17;
- `context`: identical enriched choices and instructions, adding up to three
  source neighbors on either side with their glosses and morphology.

Candidate origins and scores are hidden. Candidate order is a fixed hash of the
occurrence and choice. Relative order of existing choices is unchanged when new
choices enter. Instructions and lexical hints are common to all variants.

Select 75 cases per edition × calibration/test × existing/missing visible
carrier, by fixed hash without reading labels. A source Strong must occur once,
with at most one baseline annotation; repeated source occurrences remain in
whole-verse scores but are excluded from arbitration. At least one visible
enriched choice is required. These strata intentionally oversample missing
carriers and are not the natural prevalence of errors in a Bible.

The 240-passages corpus and chapter splits come from the prior Eflomal campaign.
This is exploratory reuse of its test chapters. The 100 reserved passages are
untouched. The lexical-only condition is a comparator with the same new
instructions and cases, not a reproduction of the original JEV/Laya pilot.

`policy.json` fixes thresholds before results: at least 30 applied modifications,
98% observed exact agreement, no aggregate increase in false positives. Select
on calibration, persist the selection before test scoring, and retain baseline
when nothing qualifies. These exploratory criteria do not certify production
quality. All test thresholds remain descriptive.

Requests are label-free. `NONE`, `UNSURE`, invalid responses and low probability
preserve the baseline. Visible proposals are applied simultaneously, allowing
swaps. New overlaps are rejected, restoring their original carriers until the
result stabilizes. This is a conservative display constraint, not a rule against
semantic many-to-many groups.

## Correct reader text first

The first completed run, `outputs/strong-arbitration-benchmark/v1`, inherited a
preprocessing flaw: `stripTags` retained the contents of publisher `<note>`
elements, including inside French training text. It remains archived to explain
the correction. Its comparative scores concern that contaminated input only.

`reader-text.ts` removes entire note subtrees before tokenization and carrier
extraction, handles nested/self-closing notes, and rejects unbalanced note tags.
`clean-corpus.ts` rebuilds the French corpus from original CSVs while retaining
exactly the same references, source sequences and chapter exclusions. It produces
new offsets and expected carriers; old annotations are not moved heuristically.
This is a benchmark projection, not a replacement of the product's canonical
publication parser. Authorized baseline witness sources remain as before.

```sh
yarn exec tsx scripts/strong-arbitration-benchmark/clean-corpus.ts \
  outputs/strong-alignment-benchmark/v1-corrected \
  outputs/strong-alignment-benchmark/v2-reader-text

for gold in Sg1910 Darby DarbyR; do
  NODE_OPTIONS=--max-old-space-size=8192 yarn exec tsx \
    scripts/strong-alignment-benchmark/prepare.ts baseline \
    outputs/strong-alignment-benchmark/v2-reader-text "$gold" || break
done
for mode in train infer repeat; do
  outputs/tools/eflomal-venv/bin/python scripts/strong-alignment-benchmark/run.py \
    --root outputs/strong-alignment-benchmark/v2-reader-text --mode "$mode" || break
done
```

Use new output paths to reproduce a completed run; preparers reject overwrites.
See the [Eflomal setup](../strong-alignment-benchmark/README.md) for pinned native
dependencies and its explicit-seed patch. The corrected models are retrained,
not inferred from priors learned on text containing notes.

## Prepare and evaluate JEV

The existing Python environment provides `httpx==0.28.1`; no Laya weights are
loaded by this runner. JEV uses the same evaluation endpoint as the prior pilot.
The [official Gateway model page](https://vercel.com/ai-gateway/models/jev)
documents its typed evaluation interface and 32K context. The runner rejects
requests exceeding 24KB and rejects any provider warning instead of truncating.
Reported input-token usage is archived. This does not assert access to an
undocumented server tokenizer or internal attention behavior.

```sh
yarn exec tsx scripts/strong-arbitration-benchmark/prepare.ts \
  outputs/strong-alignment-benchmark/v2-reader-text \
  outputs/strong-arbitration-benchmark/v2-reader-text
for mode in base repeat reverse; do
  outputs/tools/strong-decisions-venv/bin/python \
    scripts/strong-arbitration-benchmark/run.py \
    --root outputs/strong-arbitration-benchmark/v2-reader-text --mode "$mode" || break
done
yarn exec tsx scripts/strong-arbitration-benchmark/report.ts \
  outputs/strong-arbitration-benchmark/v2-reader-text
```

`AI_GATEWAY_API_KEY` is read from environment or `../../.env`; `--env-file`
selects another local credentials file. No credential, authentication header or
arbitrary HTTP failure body is archived. Only state and the typed question are
sent. Requests/responses and hashes are persisted; resumed calls never replace
existing responses. Transient HTTP errors get at most three attempts; timeouts
and incoherent probability contracts are archived as errors, not repaired by
choosing a different answer. A 100-case fixed sample of the context variant is
repeated identically and with reversed option order.

The gateway model alias is mutable. Archived decisions can be replayed
deterministically; fresh remote calls are not assumed deterministic. Probability
is the reported probability of the selected choice, not the separate provider
confidence field. Rounding is checked and preserved, not renormalized.

## Interpretation and artifacts

`summary.json` includes exact reconstruction, calibration, candidate coverage,
choice correctness, accepted-edit precision, harmed existing placements, and
stability. `changes-for-audit.json` retains every simulated edit and its labels.
The report verifies fingerprints and reparses gold CSVs using the same
reader-text projection before scoring.

Decision correctness includes correct abstention when the exact CSV target is
not offered. This expected choice changes with the candidate list, so also
compare correct visible targets over the same denominator. A missing CSV tag
is unscorable, not `NONE`. Explicit empty gold can label `NONE`, without making
that legacy annotation independently validated semantics. Whole-verse scores
retain unreviewed and repeated occurrences and therefore dilute the effect of
the 450 sampled test decisions.

Both initial and cleaned campaigns use the same policy. Cleaning was triggered
by inspection of data, after the initial experiment's scores; the rerun is not
a new blind test or a tuned threshold campaign. Its case sample is regenerated
from clean baseline/candidates under the same label-free rule, not forced to
retain every old case.

## Semantic review

```sh
yarn exec tsx scripts/strong-arbitration-benchmark/prepare-review.ts \
  outputs/strong-alignment-benchmark/v1-corrected/blind-review.json \
  outputs/strong-arbitration-benchmark/v2-reader-text/semantic-review-v2.json \
  outputs/strong-alignment-benchmark/v2-reader-text
```

This preserves the 60 originally selected passages and source identities,
replaces contaminated French text/tokens with the verified clean input, and
leaves every semantic annotation empty. No CSV labels or predictions are read.
Version 2 also groups logical Strong identities by physical STEP token so aliases
are visible as alternatives rather than implicitly separate translated words.
See the [review charter](../../docs/strong-semantic-review-charter-2026-10-01.md).
`review.ts` checks structural consistency, not philological correctness. Two
independent reviews and adjudication remain to be performed.

## Validation

```sh
yarn exec tsx --test scripts/strong-arbitration-benchmark/*.test.ts
outputs/tools/strong-decisions-venv/bin/python -m unittest discover \
  -s scripts/strong-arbitration-benchmark -p test_run.py
yarn exec tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext \
  --target ES2022 --skipLibCheck --esModuleInterop scripts/strong-arbitration-benchmark/*.ts
yarn exec eslint scripts/strong-arbitration-benchmark/*.ts
yarn workspace @bible-strong/resource-studio typecheck
```
