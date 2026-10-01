# Strong resolution and empty anchor experiment

Run from `apps/resource-studio`, with a fresh output directory:

```sh
yarn exec tsx scripts/strong-resolution-benchmark/run.ts \
  outputs/strong-arbitration-benchmark/v2-reader-text \
  outputs/strong-occurrence-prototype/v1-verified \
  outputs/strong-resolution-benchmark/my-run
```

This addresses the [approved goal](../../docs/strong-resolution-goal-2026-10-01.md)
with three hypotheses: separate absence from anchor evidence; project an empty
between identifiable witness neighbors; cross-check with source neighbors.
No fourth scoring model, remote call, new training, or reserve-set evaluation.

The reusable module is `src/strongResolution.ts`. Source units preserve physical
identity across alternative Strong codes and repeated words. Unresolved reading
variants cannot become reviewed decisions until their reading is resolved.
Visible carriers retain the explicit assurance `existing-generator`, which is
not independent semantic verification. A proposed empty remains unresolved until
a target-specific reviewed decision is supplied. Review records bind reference,
exact target text hash, source identity and source evidence hash; their structural
validation does not prove the reviewer's philological judgment.

The production reader and complete aligners now attach `emptyEvidence` to generated
empties. The ledger carries and stores it in its existing annotations JSON. This
is additive metadata, not a change to rendered placements or legacy confidence
values. Lexical replacement clears obsolete empty evidence, and the pipeline
fingerprint includes the module. Existing ledgers have no retroactive evidence;
regeneration is required to add it.

## Prediction protocol

- Use the 720 clean edition texts at the existing 240 references. The 100 reserved
  references remain excluded. Fingerprint all consumed input files.
- Exclude the target edition and its whole editorial family from witness inputs.
  Darby and DarbyR are one family. The three editions therefore provide only one
  independent family for each masked prediction.
- Keep frozen baseline visible carriers. Do not use target labels to decide
  carriers, identities, proposed empties, or anchoring intervals.
- Candidate empties require a uniquely identifiable single-code source unit,
  no visible baseline carrier, and an explicit empty annotation in a witness.
  This nominates an investigation, never certifies target absence.
- Neighbor transfer requires uniquely identifiable Strong carriers in the witness
  and target. Repetition without occurrence correspondence is unresolved. Boundaries
  with competing identities, reversed neighbors, and conflicting intervals remain
  explicit. Source-neighbor matching uses occurrence IDs, so it can retain repeats.
- A non-singleton interval stays an interval. A singleton is conditionally
  supported by its neighbors, not a calibrated probability or absence proof.
- Freeze predictions before target scoring and repeat every resolution decision
  with immutable inputs. Only then measure agreement with explicit target tags.

`ratio` is the legacy length-proportion formula applied to the same nominated
cases as a diagnostic control. It is **not** a full rerun of the production
consensus policy: masked cases have one family, so that policy's two-family
minimum would normally reject them. `neighbor` and `source` measure the two
anchor proposals independently; `combined` intersects their intervals. No
parameter search or winner selection is performed on these exploratory chapters.

## Reading the results

`summary.json` separates coverage from semantic review, nomination agreement from
anchoring, exact positions from interval containment, and calibration from test.
An interval containing a reference anchor is not equivalent to an exact placement;
its width is reported. A missing or repeated target tag is unscorable, never a
negative absence label. `empty-proposals-for-audit.json` retains every candidate
and its evidence. `predictions.json` covers every source unit and all 720 texts.

The recorded run is `outputs/strong-resolution-benchmark/v1-verified`. The earlier
`v1` exploratory run has identical predictions, before extra interval metrics and
a lint cleanup. No evaluated anchor policy is enabled as a new generator default.
No real review record was invented to populate the `empty:reviewed` state.

```sh
yarn exec tsx --test tests/strongResolution.test.ts tests/readerAlignment.test.ts \
  tests/completeAlignment.test.ts tests/strongLedger.test.ts tests/strongLedgerStore.test.ts
yarn workspace @bible-strong/resource-studio typecheck
yarn exec tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext \
  --target ES2022 --skipLibCheck --esModuleInterop scripts/strong-resolution-benchmark/run.ts
yarn exec eslint src/strongResolution.ts scripts/strong-resolution-benchmark/run.ts
```
