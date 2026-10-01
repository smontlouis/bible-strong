# Physical source occurrence experiment

An offline, exploratory replay of the cleaned Strong arbitration campaign.
Nothing here changes production generation or publishes resources.

Run from `apps/resource-studio` (use a fresh, nonexistent output directory):

```sh
mkdir -p outputs/strong-occurrence-prototype
yarn exec tsx scripts/strong-occurrence-prototype/run.ts \
  outputs/strong-arbitration-benchmark/v2-reader-text \
  outputs/strong-occurrence-prototype/my-replay
yarn exec tsx scripts/strong-occurrence-prototype/review.ts \
  outputs/strong-occurrence-prototype/my-replay \
  outputs/strong-arbitration-benchmark/v2-reader-text
```

The runner verifies the archived requests, responses, source texts, and input
fingerprints. It freezes predictions before reading gold labels, then reparses
the gold CSVs after removing publisher notes and verifies their offsets. The
100 reserved references are excluded. Each projection is replayed twice, with
input immutability checks. No credentials, network calls, new model decisions,
training, or threshold sweep are involved. This reuses previously inspected
test chapters; it is not a new blind experiment.

## Model and its limits

- `model.ts` groups by `sourceIdentity`, retaining Strong occurrence IDs, exact
  STEP codes, main-reference provenance, row type, raw variant fields and line
  numbers. Two repetitions with the same Strong remain separate. Hebrew technical
  affix tags remain separate from lexical codes.
- Tagging alternatives are sets of identifiers, so a component set cannot silently
  become several independent words. Raw comma-separated alternatives stay
  unresolved. Relations support multiple source units and discontinuous target
  words, independently of display identifier/carrier.
- A STEP row is a **provenance unit**, not a fully adjudicated manuscript reading.
  Its own fields may contain competing readings. Variant-conditioned rows are
  preserved, not expanded into an invented manuscript graph.
- `single-row-alternatives` describes only the _shape_ of the source columns
  (one primary code, one alternative, no declared meaning variant). It does
  **not** certify equivalence. The experiments intentionally test whether that
  insufficient shortcut works; their negative results are retained.
- `identity-evidence.ts` adds TBESG identity metadata: documented forms/spellings,
  explicit component expressions, and unresolved cases. An explicit combination
  can span multiple source rows. Adjacent matching rows produce a hypothesis,
  never a reviewed semantic annotation. A `Combination` label without an explicit
  component expression is insufficient. Lexicon evidence is diagnostic and does
  not retroactively tune either replay policy.

## Fixed projections

All three arbitration variants below use the archived **context** responses at
the inherited threshold **0.95**. Reported probabilities belong to their original
questions; they are not pooled or reinterpreted as confidence in a new identifier.

1. `archive`: the previous per-Strong policy, unchanged.
2. `guard`: on the narrow raw-column shape, merge agreeing high-threshold carrier
   proposals for one source row; retain the existing display identity, if unique;
   defer when no identity is established. Multiple existing carriers or conflicting
   qualifying votes preserve the baseline. Reusing an existing identity can still
   relocate its carrier: this hypothesis has **two observed test regressions**.
3. `primary`: additionally choose the STEP primary identity when no carrier exists,
   and deduplicate _identical_ existing carriers by preferring the primary code.
   Different existing boundaries are left unresolved. This causes **eight test
   carrier losses**, including six deleted identifiers matching the reference.

Other source rows retain the previous arbitration policy. `NONE` or lack of a
CSV tag never becomes a reviewed absence. Existing overlap protection still
applies, including cascading rejection of conflicting moves.

## Outputs

- `manifest.json`: hashes, inherited threshold and protocol.
- `source-units.json`, `identity-evidence.json`: source provenance and identity
  hypotheses for the 240 evaluation references, shared by the three editions.
- `predictions.json`: both experimental projections plus the archived control,
  written before scoring.
- `summary.json`, `changes.json`: unchanged exact Strong-and-carrier metrics,
  accepted additions/moves, explicit deletions and losses of previously correct
  carriers. A lost correct carrier is an exact-reference regression, not by itself
  a philological verdict. Deletions are separate from addition/move precision.
- `ownership-audit.json`: several placements or unplaced identities on the same
  source row. These are structural flags, not automatically errors or absences.
- `review-15.json`: targeted assistant inspection, **not independent gold**. The
  reusable notes are in `review-notes.json`. Proposed relations never change scores.

The recorded experiment uses `outputs/strong-occurrence-prototype/v1-verified`.
The earlier `v1` directory is an exploratory run before type-check cleanup and
the supplementary lexicon audit; its predictions are identical to the verified
run. Neither policy meets the earlier calibration gate. The generator remains
unchanged. See the [experiment report](../../docs/strong-occurrence-experiment-2026-10-01.md).

```sh
yarn exec tsx --test scripts/strong-occurrence-prototype/*.test.ts \
  scripts/strong-arbitration-benchmark/*.test.ts
yarn exec tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext \
  --target ES2022 --skipLibCheck --esModuleInterop scripts/strong-occurrence-prototype/*.ts
yarn exec eslint scripts/strong-occurrence-prototype/*.ts
yarn workspace @bible-strong/resource-studio typecheck
```
