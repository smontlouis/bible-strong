# Best Strong generation workflow

Date: 2026-07-10

## Recommendation

The production workflow is deterministic first and LLM last. Build one
canonical occurrence ledger from references, STEP, dictionaries, and
translation-profile rules; expose a conservative reader view and a complete
advanced view; evaluate carriers against masked gold; then send only unresolved
bounded choices to independent models.

The important distinction is:

- `reader` optimizes carrier precision;
- `advanced` preserves original-language completeness.

Never increase reader density merely to make inventory coverage look better.
An original-complete word guess or empty Strong remains advanced unless the
calibrated reader pipeline independently justifies it.

## One-time index preparation

Rebuild both indexes after their schema/scoring logic changes:

```sh
npm run strong:kaikki:index
npm run strong:phrase:index
```

The Kaikki index is atomic, many-to-many for ambiguous inflected forms, and
records a content fingerprint of the 534 MB source. The phrase index is also
content-addressed and includes its scoring-algorithm version.

## Canonical generation

```sh
npm run strong:generate -- --bible <id>
```

Authoritative output:

```text
outputs/strong/<id>/bible-<id>-strong.sqlite
```

Derived outputs include reader/advanced TSVs, metrics, and the residual lexical
report under `outputs/lexical-candidates/<id>/`.

Production generation is strict:

- the Bible must have a calibrated translation profile unless
  `--allow-unknown-profile` is explicitly used for exploration;
- STEP sources and the production Strong dictionary must exist and parse;
- input files, derived indexes, profile, exclusions, and pipeline algorithms
  are content-fingerprinted;
- curated decisions are indexed once by Bible/verse;
- the lexical loop must finish with a zero-application full-scope pass.

Export an existing ledger without regenerating it:

```sh
npm run strong:export -- --bible <id> --view reader
npm run strong:export -- --bible <id> --view advanced
```

## Safe scoped refresh

```sh
npm run strong:refresh -- --bible <id> --only <Book>
npm run strong:refresh -- --bible <id> --only <Book.Chapter>
npm run strong:refresh -- --bible <id> --only <BookA-BookB>
npm run strong:refresh -- --bible <id> --only <Book1>,<Book2>
```

Refresh refuses to combine verses generated from different source/index/code
fingerprints. If curated decisions changed, every changed verse must be inside
the requested scope. Otherwise run a full generation.

## Deterministic evaluation

Run the fast alignment canary on a broad sample:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold Darby --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold DarbyR --limit 1000 --backend diagnostic
```

Run the real canonical pipeline as the release canary:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 200 --backend canonical
npm run strong:evaluate -- --gold Darby --limit 200 --backend canonical
npm run strong:evaluate -- --gold DarbyR --limit 200 --backend canonical
```

The evaluated gold's complete editorial family is excluded from the input
references: Darby and DarbyR are always held out together. The canonical
backend also disables curated overrides, preventing correlated editions or
memorized verse decisions from inflating the result.

Use `carrierExact` as the primary metric, `carrierOverlap` to understand natural
multi-word spans, and `inventoryOccurrence` only as an inventory diagnostic.
See [strong-quality-methodology.md](strong-quality-methodology.md) for current
canaries, metric definitions, and gates.

## Regression audit

```sh
npm run strong:audit:plan -- --bible <id>
npm run strong:audit:run -- --bible <id>
npm run strong:audit:verify -- --bible <id>
npm run strong:audit:residuals -- --bible <id>
```

If an intentional algorithm change alters the audit, inspect the complete diff
before updating the baseline:

```sh
npm run strong:audit:snapshot -- \
  --bible <id> \
  --snapshot tests/fixtures/strong-audit/nbs-10x5-snapshot.json
npm run strong:audit:verify -- --bible <id>
```

## Curated-decision audit

```sh
npm run strong:audit:overrides -- --bible <id>
```

Production excludes legacy single-model auto-accepts and semantic-refill
decisions without a currently verifiable consensus trace. More precisely,
plain `semantic-refill:llm` and `semantic-refill:llm-reference-style` sources
are always quarantined; only `semantic-refill:llm-consensus-filtered` is
production-eligible. Invalid word/phrase indexes or normalized targets are
skipped atomically. Relocations are all-or-nothing: both source and destination
must still match.

Do not manually delete historical records merely to improve counts. Preserve
them for provenance, quarantine them from production, and promote them only
through a newly validated path.

For historical semantic-refill artifacts, run the dedicated migration in dry
run mode first and inspect its report before writing anything:

```sh
npm run strong:review:gaps:migrate-artifacts -- --bible <id>
npm run strong:review:gaps:migrate-artifacts -- --bible <id> --apply
```

Promotion requires an original two-model artifact with distinct model
identities and the exact same bounded choice, a `missing` candidate that is
still open, a current matching target backed by current direct lexical
evidence, and no replacement, relocation, or carrier conflict. On NBS, 313 of
2,411 historical raw semantic-refill records passed these gates; 2,098 remain
quarantined. The migration also reconstructed 2,480 decision-ledger records
(2,043 `accepted-safe`, 437 `needs-witness-review`). The 5,379 legacy
single-model auto-accepts remain quarantined.

## LLM residual workflow

Generate first. The batch refuses to start while deterministic auto-safe items
remain:

```sh
set -a; . ./.env; set +a
npm run strong:review:gaps:batch -- \
  --bible <id> \
  --lexical-report outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-all.json \
  --output-root outputs/gap-review/<id>/<run> \
  --max-items-per-task 30 \
  --min-confidence high \
  --plan-only

npm run strong:review:gaps:batch -- \
  --bible <id> \
  --lexical-report outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-all.json \
  --output-root outputs/gap-review/<id>/<run> \
  --max-items-per-task 30 \
  --task-batch-size 3 \
  --min-confidence high \
  --skip-existing \
  --timeout-ms 600000 \
  --llm-attempts 2
```

The default proposer pair is `openai/gpt-5.4-mini` and
`deepseek/deepseek-v4-flash`. Packets contain stable candidate IDs and a bounded
choice list. The provider must return strict JSON with exactly one decision per
candidate; incomplete or invented decisions fail validation.

The second model is adaptive by default at candidate level. After proposer A,
only candidates with a visible high-confidence choice capable of reaching
consensus are sent to proposer B. Production application still requires the
same bounded candidate/choice from two distinct model identities at `>= 0.84`,
followed by the current post-consensus safety filter and a version-2 review
contract. Task membership and pagination are fixed in `plan.json`/the manifest,
so resuming cannot silently shift candidates between tasks.

Artifacts are reused only when their content fingerprint matches the packet,
ledger, code, schema, model/reasoning settings, and filter policy, and when a
fresh SHA-256 confirms every recorded output. Completed tasks are resumed
against the manifest's expected post-task durable state (SQLite ledger, curated
overrides, and decision journal), so later scoped writes do not invalidate
earlier task artifacts while external drift still does. A corrupt partial
manifest is ignored. File mtimes alone never authorize reuse.

Each provider attempt writes to a unique temporary file. It replaces the
official review only after exact validation of the source packet, requested
model, candidate IDs, and enumerated choice IDs; a failed call can therefore
never bless a stale review file.

Application is transactional. Before writing, the batch backs up both:

```text
data/curated-strong-overrides.json
data/strong-review-decisions.json
```

It acquires an inter-process write lock, applies the filtered decisions,
refreshes the exact scope, checks verse count, risk, reference/original
coverage, and SQLite integrity, and restores both files plus the ledger scope
if any gate fails.

The write lock uses atomic stale-lock quarantine and a heartbeat. All legacy
curated-override writers share it. The batch also creates a transaction marker
that binds the exact Bible, scope, packet, filtered review, and filter policy.
`semanticRefillAgentReview --apply` refuses to run without that active batch
lock/marker and a matching v2 contract. Therefore standalone
`strong:review:gaps:apply --apply` is not a production command, and
`--finalize-reference-style` is limited to preview/validation. A newly
validated consensus promotes an identical quarantined legacy placement, while
existing production/human placements remain authoritative; `applied` counts
only real file mutations.

The durable journal records terminal contexts, but a general pre-LLM skip is
not yet safe because eligibility depends on the current candidate cohort and
filter policy. Let the batch runner decide adaptive proposer-B membership; do
not bypass the current model/consensus path based only on an old terminal
decision.

## Manual-review budget

Review these first:

- two-model disagreements;
- generic French carriers or function words;
- same-target Strong stacking;
- inferred-only dictionary/Kaikki candidates;
- relocations that remove an existing visible carrier;
- candidates that would change a high-frequency Strong across many verses.

Do not repeatedly review:

- exact occurrence-aware reference matches;
- validated deterministic auto-safe placements;
- mechanically invalid/drifted decisions;
- exact two-model consensus that passed the witness/stacking filter and
  transactional gates.

Rejected and pending model decisions remain in the durable decision ledger,
along with consensus and final `accepted-safe`, `needs-witness-review`, or
`rejected-risky` verdicts. They can later be clustered by Strong, carrier, and
evidence source to improve the deterministic rules instead of paying for the
same review again.

## Final release checks

```sh
sqlite3 outputs/strong/<id>/bible-<id>-strong.sqlite \
  "select count(*) from verses; pragma integrity_check;"
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

Generated full Bible artifacts remain under ignored `outputs/` and must not be
committed.

The final 2026-07-10 NBS generation contains 31,169 verses, 363,503
reader-visible and 486,297 advanced Strong occurrences, 95,456 empty and 5,369
phrase occurrences. Reference carrier coverage is `0.8593`, original carrier
rate `0.8029`, original representation `0.9999`, semantic missing count `395`,
placement risk `6,831`, and structural placement quality `0.9808`. Reader and
advanced token coverage are `0.4912` and `0.5204`. The full run took 156.32s
with about 4.33 GB max RSS.
