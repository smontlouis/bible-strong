# Local Strong alignment experiment

Offline Eflomal benchmark, expanded to established reader carriers. It produces
diagnostics and review material; it never applies its predictions to a production
ledger. Run commands from `apps/resource-studio`.

**Historical input caveat:** this original corpus preparer retains publisher-note
contents when stripping tags. Use the [reader-text correction and rerun protocol](../strong-arbitration-benchmark/README.md)
before a new arbitration experiment. The archived `v1-corrected` run corrected
the prior-key bug, not this subsequently discovered text-projection flaw.

## Environment

The measured run used Python 3.14.7, Apple M4 Pro, macOS 26.3.1, GCC 14 and the
following upstream revision. Python dependencies and the private checkout live in
ignored `outputs/tools/`; Yarn dependencies are unchanged.

```sh
python3 -m venv outputs/tools/eflomal-venv
outputs/tools/eflomal-venv/bin/pip install -r scripts/strong-alignment-benchmark/requirements.txt
git clone https://github.com/robertostling/eflomal.git outputs/tools/eflomal-src
git -C outputs/tools/eflomal-src checkout --detach 1fe2a43e3667fb2461736ddb48783ab0cf98a171
outputs/tools/eflomal-venv/bin/python scripts/strong-alignment-benchmark/seed_eflomal.py outputs/tools/eflomal-src
MAKEFLAGS='CC=/opt/homebrew/bin/gcc-14' outputs/tools/eflomal-venv/bin/pip install --no-build-isolation ./outputs/tools/eflomal-src
```

Adapt the compiler path on another host. `seed_eflomal.py` accepts only the pinned
revision and the expected original/already-patched file. It adds an explicit seed
to the upstream C random initializer. The runner sets one OpenMP thread to keep
sampler order stable. Binary, runner, dataset and prior hashes bind the outputs;
repeatability on this host is measured, not assumed across compilers/hardware.

## Prepare and run

Use a fresh destination. Preparation requires the existing French CSVs, STEP
TAHOT/TAGNT, strict legacy dictionary, lexical sources when available, and the
first decision pilot's selected references. Missing input is not downloaded or
silently substituted.

```sh
NODE_OPTIONS=--max-old-space-size=8192 yarn exec tsx scripts/strong-alignment-benchmark/prepare.ts corpus outputs/strong-alignment-benchmark/example
for gold in Sg1910 Darby DarbyR; do
  NODE_OPTIONS=--max-old-space-size=8192 yarn exec tsx scripts/strong-alignment-benchmark/prepare.ts baseline outputs/strong-alignment-benchmark/example "$gold" || break
done
for mode in train infer repeat; do
  outputs/tools/eflomal-venv/bin/python scripts/strong-alignment-benchmark/run.py --root outputs/strong-alignment-benchmark/example --mode "$mode" || break
done
yarn exec tsx scripts/strong-alignment-benchmark/report.ts outputs/strong-alignment-benchmark/example
```

The completed, valid run is `outputs/strong-alignment-benchmark/v1-corrected`.
`v1` is retained as an **invalid preliminary integration run**: its prior subset
filter dropped uppercase Strong keys. A regression test now compares the native
prior representation from complete versus filtered inputs. The rerun retained
the same input data and evaluation policies; it did not tune to those invalid
scores. Training was rerun as well, so all artifacts carry the corrected runner
hash. The canonical baselines and corpus inputs were copied byte-for-byte.

## Protocol

- Select 240 passages outside the first pilot's chapters, shared by all three
  editions: 112 calibration and 128 test passages. Reserve another 100 passages
  and exclude their chapters from learning too.
- Train on the remaining chapters of each edition using only plain French text
  and source sequences. Exclude source identities shared with evaluation or
  reserve verses. No CSV tags are input to Eflomal.
- Keep each occurrence identity separately. Compare classical Strong tokens with
  source surface tokens. Multiple identities on one physical token are expanded
  into separate source entries; the surface experiment repeats the surface in
  that situation. Surfaces retain source diacritics/punctuation, remove TAGNT
  parenthesized transliteration and replace whitespace with underscores.
- Reuse the canonical STEP amalgamated inventory and preferred alternate
  references. This is not a reconstruction of a single manuscript edition.
- Train default Eflomal model 3, three samplers, seed 17. Export lexical, HMM and
  fertility priors. Infer each held-out verse **alone** with those priors and
  iterations `(4,4,16)`, for seeds 17/29/43. Inference adapts latent alignments
  locally within that input pair; no other test verse contributes counts.
- Repeat seed 17 on 25 verses for each edition/representation (150 pairs). A
  mismatch is a hard failure. NULL output means no proposed visible carrier,
  not a proof of omission.
- Evaluate all baseline placements, not only selected gaps. The opt-in
  `includeAllReaderAnnotations` report option expands word/phrase review while
  keeping default production selection unchanged.
- Compare lexical top 5/10/all candidates, plus source-linked Eflomal candidates.
  Include existing carriers; report already-correct, misplaced and missing
  classes separately. Unique-source/unique-gold cases support candidate recall;
  repeated occurrences remain in reconstruction metrics.
- Project source links to a carrier only when its target indices are contiguous.
  Discontinuous groups remain in raw links but are omitted from this experimental
  carrier projection. Do not wrap intervening words into a false phrase.
- Hybrid rules require the same carrier across three seeds, optionally exact
  lexical support. Simultaneous replacements permit swaps. New overlaps are
  conservatively rejected with restoration to a fixed point; full many-to-many
  semantic groups are a future experiment.
- Freeze `policy.json` before scoring. Choose a hybrid only on calibration with
  at least 30 changed placements, 98% observed agreement and no aggregate false
  positive increase. This is exploratory selection, not confidence certification.
  If nothing qualifies, retain the baseline. Record all test variants descriptively.

The canonical baseline masks the evaluated CSV and excludes its editorial family.
Existing authorized reference transfer is still available at inference. Derived
dictionary evidence is not itself a new independent gold. The explicit legacy
dictionary is used because the default V3 pointer remains unattested.

## Outputs and interpretation

`plan.json` binds splits, source hashes and training inputs. Model subdirectories
archive alignments, priors, inference results and provenance. `summary.json` and
`report.md` provide metrics; `changes-for-audit.json` exposes every proposed edit.
The persisted calibration selection must match on subsequent report generation.

`blind-review.json` contains 60 distinct passages with original occurrences and
unannotated French tokens. Neither baseline, CSV labels nor model predictions
are shown. It is **unreviewed**, not new semantic ground truth.

For editorial review, `sure` and `possible` entries should name source occurrence
IDs and target token-index lists (including discontinuous lists when justified).
`absent` means an identified source occurrence has no explicit French equivalent;
`uncertain` means the relationship is unresolved. Note source-edition differences
separately. Two independent annotations and an adjudication should precede using
this packet as a semantic benchmark. Preserve its initial form and version any
corrections without silently replacing the legacy gold.

## Validation

```sh
yarn exec tsx --test scripts/strong-alignment-benchmark/engine.test.ts tests/lexicalCandidateReport.test.ts
outputs/tools/eflomal-venv/bin/python -m unittest discover -s scripts/strong-alignment-benchmark -p test_run.py
yarn workspace @bible-strong/resource-studio typecheck
yarn exec tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 --skipLibCheck --esModuleInterop scripts/strong-alignment-benchmark/*.ts
yarn exec eslint scripts/strong-alignment-benchmark/*.ts src/lexicalCandidateReport.ts tests/lexicalCandidateReport.test.ts
```
