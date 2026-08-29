# Strong Bible quality methodology

Date: 2026-07-10

## Objective

The production objective is not to maximize the number of visible Strong codes.
It is to maximize correct French carrier placement while preserving complete
original-language provenance in a separate advanced view. A lower reader
density is an improvement when it removes unsupported carriers.

The canonical ledger therefore has two explicit contracts:

- `reader`: only calibrated reference transfer and validated deterministic
  lexical placements;
- `advanced`: reader annotations plus STEP-backed complete, technical, empty,
  and duplicate occurrences.

The original-complete pass never promotes a word guess or an empty occurrence
to reader by itself. An empty reader annotation must be supported as an empty
placement by independent reference families, not merely by the presence of the
same Strong number somewhere in a witness verse.

## Primary measurements

`strong:evaluate` strips the tags from a known Strong Bible, excludes its whole
editorial family from the references, regenerates predictions, and compares
Strong occurrences. In particular, evaluating Darby also excludes DarbyR, and
evaluating DarbyR also excludes Darby.
The sample is deterministic, proportional by book, and evenly spread within
each book.

Metrics have different meanings:

1. `carrierExact`: same Strong occurrence on the same word, phrase span, or
   empty anchor. This is the primary precision/recall/F1 metric.
2. `carrierOverlap`: same Strong on an overlapping visible span. This is useful
   when the generator chooses a natural multi-word French phrase while the gold
   edition tags only its head word.
3. `visibilityClassification`: same Strong classified as visible versus empty,
   ignoring its exact position.
4. `inventoryOccurrence`: Strong multiset only. This measures inventory
   recovery, not placement quality, and must never be reported as carrier
   accuracy.
5. `cardinality`: occurrence-count errors per Strong and per verse.
6. confidence calibration and risk/coverage: empirical exact-carrier precision
   by confidence threshold.

The report also groups prediction precision by provenance. This catches a
method that looks good in aggregate but introduces systematic carrier errors.

Two evaluator backends are supported:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold Sg1910 --limit 200 --backend canonical
```

The diagnostic backend is fast and isolates reader alignment. The canonical
backend executes the real ledger generator, including lexical auto-safe, with
curated overrides disabled. Production changes must pass both; canonical is the
release canary.

## Current masked-gold canaries

Measured on 2026-07-10, without using the evaluated gold as a reference:

| Gold   | Backend    | Verses | Exact precision | Exact recall | Exact F1 | Overlap F1 | Inventory F1 |
| ------ | ---------- | -----: | --------------: | -----------: | -------: | ---------: | -----------: |
| Sg1910 | canonical  |    200 |          0.9366 |       0.7748 |   0.8480 |     0.8579 |       0.8960 |
| Darby  | canonical  |    200 |          0.8904 |       0.7829 |   0.8332 |     0.8610 |       0.9232 |
| DarbyR | canonical  |    200 |          0.8803 |       0.7702 |   0.8216 |     0.8480 |       0.9199 |
| Sg1910 | diagnostic |  1,000 |          0.9318 |       0.7580 |   0.8360 |     0.8452 |       0.8849 |
| Darby  | diagnostic |  1,000 |          0.8838 |       0.7726 |   0.8245 |     0.8520 |       0.9177 |
| DarbyR | diagnostic |  1,000 |          0.8800 |       0.7611 |   0.8163 |     0.8416 |       0.9126 |

These numbers are canaries, not claims that the references are perfect ground
truth. Sg1910, Darby, and DarbyR have editorial differences. The lower honest
Darby scores replace earlier inflated measurements that accidentally retained
the correlated Darby/DarbyR sister edition as an input witness.

## Structural production gates

The canonical generation must satisfy all of the following:

- exact input, derived-index, profile, and algorithm fingerprint recorded in
  SQLite metadata;
- scoped refresh refused when that fingerprint differs from the full ledger;
- a changed curated override allowed only when every changed verse is inside
  the requested refresh scope;
- expected verse count and `pragma integrity_check = ok`;
- no residual lexical auto-safe item after the final full-scope stabilization
  pass;
- the Strong multiset rendered in each reader, advanced, and debug HTML view
  exactly equals the visible canonical annotations, including word/empty
  carriers inside phrases and crossing phrase spans;
- original representation does not regress;
- application of reviewed decisions must not increase `placementRiskCount` or
  decrease reference/original coverage;
- any failed post-apply gate restores both the override file and durable
  decision ledger, then refreshes the rollback scope.

`placementQuality` is a structural proxy derived from placement-risk rules. It
is useful as a regression gate, but it is not semantic accuracy and cannot
replace masked-gold carrier F1.

The 2026-07-10 full NBS generation produced:

- 31,169 verses; SQLite integrity `ok`;
- reader-visible Strong occurrences `363,503`;
- advanced Strong occurrences `486,297`, including `95,456` empty
  occurrences and `5,369` phrase occurrences;
- reader token coverage `0.4912`, inside the calibrated NBS range;
- advanced token coverage `0.5204`;
- reference Strong carrier coverage `0.8593`;
- original Strong carrier rate `0.8029`;
- original representation `0.9999`;
- semantic missing count `395`;
- placement risk `6,831`;
- structural placement quality `0.9808`;
- zero residual auto-safe items;
- the lossless renderer invariant passed for every verse and view;
- full generation under the standard V8 heap in 156.32 seconds at about 4.33 GB max
  RSS. The 184 MB lexical JSON is streamed item-by-item and source caches are
  released before SQLite serialization.

The stable 10-books × 5-chapters audit also passes its updated snapshot:
reader `15,850`, advanced `21,005`, empty `3,964`, reference carrier coverage
`0.8651`, original carrier rate `0.8107`, original representation `1.0`,
placement risk `325`, structural placement quality `0.9780`, reader token
coverage `0.5265`, and advanced token coverage `0.5571`.

## Deterministic evidence policy

Production placement uses the following hierarchy:

1. exact occurrence-aware reference transfer;
2. global maximum-weight one-to-one matching for repeated forms;
3. learned translation and phrase evidence scored by both
   `P(form | Strong)` and `P(Strong | form)`;
4. effective frequency counted per family and verse: correlated editions use
   their maximum occurrence count, then independent families/verses are
   summed (`Darby` and `DarbyR` count as one family);
5. STEP occurrence evidence, including the exact token and `dStrong` sense;
6. conservative dictionary and lexical auto-safe evidence.

Generic French carriers such as forms of `être`, `avoir`, `faire`, and `aller`
are review-only unless strict independent evidence rules are met. Multi-word
dictionary prose and reverse Kaikki inferences are also review-only. Kaikki
uses a many-to-many form-to-lemma index, stop words, document frequency, and
inverse-document-frequency weights. Synonyms may rank or block a candidate but
cannot become independent production evidence by being counted twice through
the same provenance root.

## Curated and LLM decision policy

Every relocation validates both its source and destination before mutating the
ledger. Token drift therefore skips the whole operation instead of deleting the
old carrier or duplicating the Strong.

Historical single-model auto-accepts are quarantined by default. For NBS this
currently excludes 5,379 legacy single-model auto-accepts. Plain
`semantic-refill:llm` and `semantic-refill:llm-reference-style` records are
also always quarantined, even when their reason text claims consensus. The only
semantic-refill source eligible for production is
`semantic-refill:llm-consensus-filtered`.

The artifact migration inspected 2,411 historical raw semantic-refill records.
It promoted 313 for which the original two-model artifact still proves a
current bounded decision; 2,098 remain quarantined. It also reconstructed
2,480 durable decision-ledger records: 2,043 `accepted-safe` and 437
`needs-witness-review`. Migration is deliberately stricter than historical
validation: the candidate must be a still-open `missing` item, the target and
text must still match, current direct lexical evidence must support the exact
carrier, and no replacement, relocation, or carrier conflict is allowed.

Run the migration as a dry run first, inspect its report, then apply it:

```sh
npm run strong:review:gaps:migrate-artifacts -- --bible nbs
npm run strong:review:gaps:migrate-artifacts -- --bible nbs --apply
```

Invalid or drifted targets are mechanically skipped. When a newly validated
batch consensus has the same placement key as a quarantined decision, it can
replace that record atomically; an existing eligible human/production decision
remains authoritative. Batch reports count actual mutations, not merely
validated proposals.
Run the audit with:

```sh
npm run strong:audit:overrides -- --bible nbs
```

The production LLM path is bounded:

- stable candidate IDs and enumerated target choices;
- shared verse/token context sent once per packet;
- provider-side strict JSON schema;
- exactly one decision per candidate, with unknown, duplicate, or missing IDs
  rejected rather than repaired;
- exact candidate-and-choice consensus from two distinct model identities at
  confidence `>= 0.84`;
- contract version 2 on the filtered review before application;
- adaptive second-model calls at candidate level: proposer B receives only
  candidates for which proposer A left a consensus-eligible visible choice;
- post-consensus generic-carrier, witness, and stacking filters;
- content-addressed caching over packet, ledger, code, schema, model, reasoning,
  and filter configuration, with fresh output hashes checked before reuse;
- each LLM attempt writes a private temporary output that is promoted only
  after exact packet/model/candidate/choice validation;
- raw decisions appended to `data/strong-review-decisions.json`, including
  rejected and pending outcomes, plus consensus and final post-filter verdicts,
  so future calibration does not lose negative evidence;
- stable task membership and pagination in a resumable manifest tied to both an
  immutable run policy and the expected post-task ledger state;
- inter-process write locking, a batch transaction marker, transactional
  application, and rollback gates.

`semanticRefillAgentReview` is a validator/preview tool when invoked directly.
Its `--apply` mode is refused unless the batch runner already owns the write
lock and active transaction marker, and unless the exact packet, Bible, scope,
filter policy, two-model provenance, and v2 contract all match. Likewise,
`--finalize-reference-style` is preview/validation only; it is never an
authorization for arbitrary production application.

The ledger stores enough terminal decision context for later reuse, but there
is not yet a safe general pre-LLM skip: consensus eligibility depends on the
current candidate cohort and current filter policy. Do not infer that a prior
terminal record lets a future batch bypass model calls.

Manual review should focus on disagreements, generic carriers, same-target
stacking, inferred-only evidence, and high-impact relocation. Deterministic
rejects and exact high-confidence consensus do not need repetitive manual
review.
