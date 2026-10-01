# Occurrence resolution and local review workflow

This is an opt-in authoring workflow. It consumes source occurrences, target text
and existing carriers; it produces a decision for every Strong-bearing source
unit, a local Strong rendering, and an offline review page. It never publishes,
replaces production ledgers, calls a remote model, or treats missing matches as
proof of absence.

Run commands from `apps/resource-studio`. Output directories must be new.

## Apply reviews to an existing Bible ledger

```sh
yarn exec tsx scripts/strong-resolution-workflow/run.ts prepare-ledger \
  /absolute/path/to/materialized-ledger.json outputs/resolution-my-bible
yarn exec tsx scripts/strong-resolution-workflow/run.ts apply \
  outputs/resolution-my-bible outputs/resolution-my-bible-preview
```

The ledger must contain `verses`, not only pointers to split files. Source
occurrence ownership must agree with the pinned STEP inventory; incompatible
versification or source ownership fails explicitly instead of silently remapping.
Witnesses missing a verse are omitted. An authoring dossier can also be supplied
directly according to `ResolutionDossier`, with a manifest binding its JSON hash
and the hashes of its inputs.

Open `review.html`, select a verse and an occurrence, record the relation and its
evidence, and export the decisions. The page has no network calls. Edits live in
memory until exported. The editor shows predictions and witnesses, so its reviews
are marked **exposed**, never blind. A full runtime validator checks imports on
replay; the page's checks alone do not validate a review.

```sh
yarn exec tsx scripts/strong-resolution-workflow/run.ts apply \
  outputs/resolution-my-bible outputs/resolution-my-bible-reviewed \
  --reviews /absolute/path/to/strong-resolution-reviews.json
```

Assistant-authored decisions require the explicit `--assisted` flag. Their
assurance remains `assistant-reviewed`. A human record remains `human-reviewed`,
not independently adjudicated. Default generation does not adopt assistant
reviews or automatic witness transfers. Reviews are target-edition-specific and
bound to text, source evidence and occurrence identity. Empty anchors have their
own rationale and are also bound to the complete placement context. Changing that
context invalidates the anchor even if the translation text remains unchanged.

For automatic French grammatical empties, add `--grammar-fr` to `apply`. This
explicitly supplies the target language and enables the versioned
`fr-bare-object-marker-v1` rule. It only adds a lexical empty for a bare H0853/HTo
particle between an identifiable source verb and noun whose existing French
carriers form a local verb–object construction. The grammatical relation is kept
separately. Conjunctions, pronominal suffixes, source variants, ambiguous carriers,
prepositional constructions, punctuation boundaries and existing marker decisions
are excluded. An explicit review takes precedence. The anchor convention is before
the object group, including an unassigned determiner; it remains conditional on
the existing carriers and is not labeled human-reviewed or probabilistically certain.

```sh
yarn exec tsx scripts/strong-resolution-workflow/run.ts apply \
  outputs/resolution-my-bible outputs/resolution-my-bible-automatic \
  --grammar-fr
```

The earlier reserve protocol rejects this new rule. Its separate prospective
check selects 200 OT references outside all earlier evaluated chapters and the
initial pilot, freezes code and data before generating predictions, and records
editorial empty-anchor diagnostics after predictions are sealed:

```sh
yarn exec tsx scripts/strong-resolution-workflow/grammar-check.ts \
  outputs/strong-grammar-empty/my-validation
```

The review page is an optional inspection surface, not a request for the user to
review passages or select editorial conventions. The agent owns analysis,
editorial choices and validation; unresolved cases remain explicit without
creating a mandatory human approval queue.

The outputs are:

- `predictions.json`: baseline, final disposition, evidence, suggestions, review
  provenance and projected carriers for every unit;
- `generated-preview.json`: unchanged target text and a Strong rendering using
  the existing renderer; the decision evidence remains in `predictions.json`;
- `review.html`: self-contained inspection and review editor;
- manifests and summary: immutable inputs, code hashes, decision counts.

An absence with no reviewed anchor is retained as an absence decision but is not
rendered at an invented position. A reviewed relation may be discontinuous; its
display carrier must be an explicitly selected contiguous subset. Alias or reading
ambiguity can prevent display even when a relation has been reviewed. An explicit
unresolved review withdraws the old owned carrier from the preview. Other
occurrences remain unchanged. These local preview decisions do not alter the
canonical production generator defaults.

## Experiment and final reserve

```sh
yarn exec tsx scripts/strong-resolution-workflow/run.ts prepare-development \
  outputs/strong-resolution-workflow/development-v1
yarn exec tsx scripts/strong-resolution-workflow/run.ts evaluate \
  outputs/strong-resolution-workflow/development-v1 \
  outputs/strong-resolution-workflow/development-evaluation --exact
yarn exec tsx scripts/strong-resolution-workflow/run.ts freeze \
  outputs/strong-resolution-workflow/development-evaluation \
  outputs/strong-resolution-workflow/freeze.json
yarn exec tsx scripts/strong-resolution-workflow/run.ts prepare-reserve \
  outputs/strong-resolution-workflow/freeze.json \
  outputs/strong-resolution-workflow/reserve
yarn exec tsx scripts/strong-resolution-workflow/run.ts evaluate \
  outputs/strong-resolution-workflow/reserve \
  outputs/strong-resolution-workflow/reserve-evaluation
```

The optional transfer matches the whole witness carrier with accents and elisions
preserved, case/apostrophe normalization only. It requires one source identity,
one source occurrence, a unique target match, no occupied target token, agreement
among all tagged witnesses, and no competing proposal. Darby sisters count as one
family. Empty witness tags never produce automatic absence decisions.

The gate is fixed before reserve evaluation: at least 30 proposals, at least 98%
exact CSV agreement, no increase in false positives, and no formerly correct
carrier lost. If it fails, freeze disables automatic transfer. Reserve evaluation
requires the exact frozen policy and hashes, and rejects reviews. Predictions
are sealed before opening target tags for scoring. The held-out editorial family
is excluded from all witness inputs, including the baseline generator.

`evaluate` needs the three historical CSV reference editions. `apply` supports
arbitrary authoring editions and does not read target labels or calculate CSV
accuracy. Exact CSV agreement is an editorial compatibility measure, not semantic
certainty. The reserve is a final evaluation for this cycle; after inspecting its
results it must not be described as untouched in future work.

## Assisted reference

`reference/assisted-review-2026-10-01.json` contains 120 exposed, assistant-authored
decisions: 88 visible relations, 10 proposed explicit absences with separately
chosen anchors, and 22 unresolved cases. They cover all 42 empty nominations from
the previous experiment and all units of five short passages in three editions.
The five passages are Exod.13.1, Ps.91.16, Ps.137.2, Prov.7.17 and Matt.3.8.

Each record cites the local STEP row and the exact edition text actually examined.
The morphology and English STEP glosses support inspection; this is not a second
expert annotation or independent philological adjudication. It is a versioned
working reference and demonstrates the review/replay contract. Reapplying its
decisions to the same passages is not an independent accuracy test.

```sh
yarn exec tsx scripts/strong-resolution-workflow/run.ts evaluate \
  outputs/strong-resolution-workflow/development-v1 \
  outputs/strong-resolution-workflow/assisted-example \
  --reviews scripts/strong-resolution-workflow/reference/assisted-review-2026-10-01.json \
  --assisted
yarn exec tsx --test tests/strongResolutionWorkflow.test.ts tests/strongResolution.test.ts
```

The [experiment report](../../docs/strong-resolution-extended-experiment-2026-10-01.md)
records retained outputs, results, limitations and validation.
