---
name: bible-to-strong
description: Use this skill when the user wants to generate, improve, evaluate, compare, minify, or publish a Strong-tagged Bible from a local Bible JSON file in this repository. It covers canonical Strong ledger generation, compact JSONL delivery with STEP identities, reader/advanced exports, bounded LLM review, gold evaluation against known Strong editions, quality reports, and safe handling of copyrighted or large generated artifacts.
---

# Bible To Strong

## Scope

Use this skill in this repository when asked to create or improve a Strong-tagged Bible for a local version such as `nbs`, `s21`, `bds`, `fmar`, etc.

Expected input:

- Bible JSON: `data/bibles/bible-<id>.json`
- Strong references: `data/strongs/Sg1910.csv`, `data/strongs/Darby.csv`, `data/strongs/DarbyR.csv`
- STEP original sources: `data/external/stepbible/amalgamated/TAHOT *.txt` and `TAGNT *.txt`
- Optional audit/provenance sources: `data/external/Alignments/data/sources/WLC.tsv` and `SBLGNT.tsv`
- Local lexicons for review and future deterministic evidence: `data/dictionaries/strong_fr.sqlite` and `data/dictionaries/strong_lexicon.full.production.sqlite`

Generated full Bible outputs under `outputs/` are ignored by Git and must not be committed. The canonical production ledger is now SQLite-first: `outputs/strong/<id>/bible-<id>-strong.sqlite`.

The canonical ledger and the downloadable Bible are deliberately different
artifacts. The ledger keeps annotations, evidence, metrics, views, and audit
provenance. A downloadable Bible must be projected from that ledger into a
small verse-per-line JSONL artifact; never ship the large authoring ledger or
its debug JSON as the product payload.

## Default Workflow

1. Confirm the requested Bible id and input file.
2. Generate the canonical Strong ledger. This is the no-LLM production path with reader and advanced views. It also applies the validated deterministic lexical auto-safe layer, then writes the residual lexical candidate report for review:

```sh
npm run strong:generate -- --bible <id>
```

Use the SQLite output as the authoritative production artifact when the user asks for the best workflow. It preserves a complete Strong ledger while keeping reader-visible tags profile-aware. Auto-safe lexical placements are already inserted with `source="semantic-lexicon"`; they should not remain as residual auto-safe candidates. Do not rely on legacy split `verses/*.json` files; new generation removes them.

Production full-Bible generation is validated with the SQLite/indexed path. On
2026-07-10, the final full NBS regeneration completed in 156.32 seconds with
about 4.33 GB max RSS after streaming the lexical report and releasing consumed
source caches before SQLite serialization. It wrote the canonical SQLite ledger and left
`Auto-safe candidates: 0`, `Auto-safe items: 0`, and `Group auto-safe items: 0`
in `outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-all.md`.
The lexical auto-safe loop is intentionally incremental after the first full
pass, but it must finish with a full-scope confirmation pass that applies zero
placements before the residual lexical report is trusted. If a run leaves any
residual auto-safe item, treat generation as incomplete and investigate before
using the Bible as a production artifact.

The duplicate lexical group auto-safe rule must continue processing all
eligible groups in a report. A regression where that loop returned after the
first resolved duplicate group caused slow global cascades; do not reintroduce
early returns there.

If an existing output folder still has the old split JSON ledger, migrate it once:

```sh
npm run strong:migrate:sqlite -- --bible <id>
```

This writes `bible-<id>-strong.sqlite`, keeps metrics/TSV outputs, and removes legacy ledger JSON directories after a successful migration.

For localized deterministic fixes, refresh only the affected books, chapters, or
ranges instead of regenerating the whole Bible:

```sh
npm run strong:refresh -- --bible <id> --only <Book>
npm run strong:refresh -- --bible <id> --only <Book.Chapter>
npm run strong:refresh -- --bible <id> --only <BookA-BookB>
npm run strong:refresh -- --bible <id> --only <Book1>,<Book2>,<Book3>
```

`strong:refresh` generates each requested scope in a temporary output directory,
then replaces only those verses in the SQLite ledger. It recalculates affected
book metrics, global metrics, and reader/advanced TSV exports without parsing or
rewriting a split full-Bible JSON ledger. Use a full `strong:generate` only when
the entire corpus must be rebuilt or when no canonical SQLite ledger exists yet.
Every full ledger records a content fingerprint over its Bible, references,
STEP sources, dictionary/index files, translation profile, and pipeline code.
Scoped refresh must refuse a missing/mismatched fingerprint. If curated
decisions changed, every changed override ref must be inside the refresh scope.

Build the local Kaikki SQLite index once when lexical reports need maximum
speed:

```sh
npm run strong:kaikki:index
```

When `data/external/french-lexical/kaikki/kaikki.org-dictionary-French.sqlite`
exists, lexical candidate generation uses targeted SQLite lookups instead of
streaming the 534 MB JSONL file.

Build the local Strong phrase-lexicon SQLite index once before production
generation or repeated scoped refreshes:

```sh
npm run strong:phrase:index
```

When `data/derived/strong-phrase-lexicon.sqlite` exists and its source
fingerprint matches `Sg1910`, `Darby`, and `DarbyR`, generation loads learned
multi-word phrase candidates from SQLite instead of rebuilding that large
in-memory lexicon for every run.

3. Export reader or advanced views from the canonical ledger when a TSV is needed:

```sh
npm run strong:export -- --bible <id> --view reader
npm run strong:export -- --bible <id> --view advanced
```

### 3a. Publish a compact STEP-aware JSONL Bible

After the canonical ledger passes its quality and integrity gates, create the
downloadable Bible as a separate projection. This applies both to the three
reference witnesses and to generated Bibles such as NBS.

For the existing reference witnesses, the compact STEP-aware generation is:

```sh
npm run strong:references:jsonl
npm run strong:references:jsonl:dstrong
```

For generated Bibles, publish directly and incrementally from
`outputs/strong/<id>/bible-<id>-strong.sqlite`. Do not first materialize or
parse a gigabyte-scale JSON ledger. Stream the SQLite verse rows in canonical
reference order and write one JSON object per line. The default downloadable
projection is the reader view; an advanced/debug projection must be a separate
explicit artifact and must not silently replace the reader product.

```sh
npm run strong:jsonl -- --bible <id> --version <VERSION>
```

This writes `outputs/strong-jsonl/<id>/bible-<id>-strong.jsonl` and an
immutable sibling `manifest.json`. Use `--only <Book>` or
`--only <Book.Chapter>` only for a bounded validation preview, normally with a
separate `--output-dir`; a scoped artifact is not a publishable full Bible.
The command refuses to overwrite either artifact.

When the user explicitly prefers recall over conservative placement, generated
Bibles also support a deterministic permissive projection:

```sh
npm run strong:jsonl -- \
  --bible <id> \
  --version <VERSION> \
  --view permissive
```

This mode is for the five generated/non-witness Bibles `ost`, `fmar`, `nvs78p`,
`neg79`, and `nbs`. It must not be applied to the reference witnesses `darby`,
`darbyr`, or `sg1910`: those sources already carry their own authored Strong
placement and remain unchanged.

The permissive publisher reads
`outputs/strong/<id>/bible-<id>-strong-permissive-plan.json`, verifies that the
plan fingerprint matches the SQLite ledger, and projects both reader and
advanced annotations. For empty or weakly placed occurrences it applies the
plan's stable best carrier when the lexical score reaches `0.48`; a relocation
must improve the current carrier by at least `0.12`. Ties are resolved by the
recorded deterministic carrier order. Exact normalized Strong dictionary terms
are eligible even when the generic lexical candidate report omitted a proper
name. Cases below the threshold remain empty.

The permissive projection is derived only: it never mutates the canonical
SQLite annotation, an approved LLM payload, or the conservative reader JSONL.
If the same Strong is already present on the selected carrier, the projected
occurrence remains empty instead of creating another identical placement. The
final compact `strong` attribute is an ordered set: duplicate values such as
`strong="H1961 H1961"` are serialized once, while different Strong identities
on the same French carrier are all retained. The manifest records planned and
applied promotions, skipped duplicate carriers, removed redundant values, and
remaining empty tags.

This writes
`outputs/strong-jsonl-permissive/<id>/bible-<id>-strong.jsonl`. Publication must
still preserve every verse and meaningful inline tag, including notes and
`divineName`, and must still require exact STEP occurrence evidence before
emitting `estrong`, `dstrong`, or `ustrong`.

Use the same JSONL verse contract as the reference witnesses:

```json
{
  "ref": "Gen.1.1",
  "version": "NBS",
  "book": 1,
  "bookId": "Gen",
  "chapter": 1,
  "verse": 1,
  "text": "..."
}
```

The `text` field keeps meaningful inline Bible markup such as `<p>`, `<note>`,
`<i>`, and `<divineName>`, but strips authoring/debug attributes. Strong and
STEP identities belong to the `<w>` occurrence in the verse:

```html
<w strong="H1254" estrong="H1254a" dstrong="H1254A">créa</w>
<w strong="G1138" ustrong="H1732">David</w>
```

Compact identity rules:

- always keep `strong` as the backward-compatible identifier carried by the
  Bible word;
- add `estrong` only when the exact STEP extended identity is not already
  represented by `strong`;
- add `dstrong` only when the exact STEP disambiguated identity adds precision
  beyond `estrong`/`strong`;
- add `ustrong` only when it adds a distinct unified/group identity useful for
  alternate forms, spellings, names, Hebrew/Aramaic equivalents, or navigation;
- preserve STEP suffix case exactly: `H2148V` and `H2148v` are distinct;
- omit redundant attributes instead of repeating the same value;
- never add inline confidence, method, source, status, or diagnostic
  `data-*` attributes to the downloadable artifact. Put provenance, counts,
  unresolved cases, source hashes, and methods in a sibling manifest/report.

For generated Bibles, prefer the ledger's exact
`originalOccurrenceId`/STEP-evidence link for each annotation. This is stronger
than re-running verse-order heuristics on already generated markup. Resolve
`eStrong` and `uStrong` through the exact `dStrong` entry in `TBESH.txt` or
`TBESG.txt`. When exact occurrence evidence is missing or ambiguous, retain the
classical `strong` unchanged and report the case outside the Bible; never guess
an `estrong`, `dstrong`, or `ustrong` during publication.

These attributes normally describe one lexical occurrence at different levels,
not four competing analyses. Product lookup should generally use
`dstrong ?? estrong ?? strong` as the primary lexical target. `ustrong` is a
grouping/navigation identity. A French carrier may occasionally represent
multiple original occurrences; then the values on `<w>` form an
occurrence-level set. Do not infer positional pairing between whitespace lists
unless a future serialization contract explicitly records that pairing; retain
the canonical ledger when exact per-occurrence relationships are needed.

Publication validation must fail closed unless all of the following hold:

- verse references, order, version, and chosen reader text survive the
  projection;
- stripping only the compact identity attributes reconstructs the intended
  minified Strong markup;
- every emitted STEP identity is backed by the exact ledger occurrence and
  STEP lexicon entry;
- existing structural markup, including divine names and notes, is preserved;
- the JSONL parses line by line and has the expected verse count;
- the manifest records source/artifact SHA-256 hashes, byte size, identity
  counts, ambiguous/unresolved counts, view, and schema version;
- the final response reports the size reduction from the canonical authoring
  artifact to the downloadable JSONL.

The generated-Bible publisher implements this contract in
`src/generatedStrongJsonl.ts` and validates the output again line by line
against SQLite before publishing it atomically. It must finish all source
hashing before linking the JSONL and remove that link if immutable manifest
publication fails; never leave a partial JSONL/manifest pair. Run it only after
the current pipeline fingerprint matches the ledger and every approved review
transaction has been finalized. A successful scoped preview against an older ledger proves
the projection mechanism, not that the Bible itself is ready for release. Do
not claim that a generated Bible such as NBS or OST is product-ready merely
because its canonical SQLite ledger or a scoped JSONL preview exists.

### 3b. Package all validated JSONL Bibles for delivery

Once every individual generated Bible and the three STEP-aware reference
witnesses are finalized, build one immutable delivery folder:

```sh
npm run strong:release:jsonl
```

This writes `outputs/releases/strong-jsonl/` with all downloadable JSONL files
at the folder root, one normalized manifest per Bible under `manifests/`, and a
single `catalog.json`. The packager verifies every source manifest, byte size,
verse count, and SHA-256 before copying, then verifies the copied SHA-256 and
publishes the complete folder atomically. It refuses an existing destination or
any stale, altered, missing, scoped, or non-final source artifact.

The individual SQLite ledgers and JSONL publication directories remain the
canonical generation and audit artifacts. The release folder is a derived
delivery package for Bible Strong and must not become a second authoring source.
Like other generated full-Bible outputs, it stays under ignored `outputs/` and
must not be committed.

For the permissive high-recall delivery, package only the five generated
Bibles:

```sh
npm run strong:release:jsonl -- --view permissive
```

This writes `outputs/releases/strong-jsonl-permissive/`. Its catalog must have
exactly five `sourceType="generated"` entries and no reference witness. Verify
both the individual artifact hashes and the packaged copies before deleting
any deterministic intermediates.

4. Run masked gold evaluation when changing alignment logic. Use the diagnostic
   backend for a broad fast sample and the canonical backend as the release canary:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold Darby --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold DarbyR --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold Sg1910 --limit 200 --backend canonical
npm run strong:evaluate -- --gold Darby --limit 200 --backend canonical
npm run strong:evaluate -- --gold DarbyR --limit 200 --backend canonical
```

Both backends strip and mask gold tags and exclude the evaluated Bible's whole
editorial family from the reference set. Darby and DarbyR are therefore held
out together. The canonical backend runs the real ledger generator with curated
overrides disabled. Treat exact carrier precision/recall/F1 as primary;
inventory-only F1 is not placement accuracy.

5. Report reference coverage against the known Strong Bibles when the user wants to know how many reference Strong occurrences were reproduced:

```sh
npm run strong:report:references -- --bible <id>
```

This reads the canonical ledger and writes JSON/Markdown coverage for `Sg1910`, `Darby`, `DarbyR`, plus consensus buckets `1/3`, `2/3`, and `3/3`.

6. For current hard-verse diagnostics or legacy TSV compatibility, run the diagnostic path explicitly:

```sh
npm run strong:diagnose -- --bible <id>
```

For a production-maturity audit, run the same commands without `--limit` and update `reports/strong-gold-evaluation-report.md`.

7. Inspect metrics:

```sh
cat outputs/strong/<id>/bible-<id>-strong-metrics.json
sqlite3 outputs/strong/<id>/bible-<id>-strong.sqlite "select count(*) from verses"
cat outputs/bible-<id>-strong-diagnostic.metrics.json
```

After a full production generation, also verify:

```sh
sqlite3 outputs/strong/<id>/bible-<id>-strong.sqlite "select count(*) from verses; pragma integrity_check;"
grep -E "Auto-safe candidates: 0|Auto-safe items: 0|Group auto-safe items: 0" outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-all.md
```

For a complete Bible, `pragma integrity_check` must return `ok`. The expected
verse count depends on the input Bible, but NBS should have `31169` verses.

8. If quality is unclear, inspect hard verses:

```sh
cat outputs/bible-<id>-strong-diagnostic.hard-verses.json
```

9. Use LLM only as a bounded suggestion generator, not as blind production:

```sh
npm run strong:diagnose -- --bible <id> --only Gen --llm --llm-limit 250 --output-dir outputs/llm-books/<id>/Gen
```

10. Prepare a human review queue for LLM suggestions:

```sh
npm run strong:review:llm -- --bible <id> --diagnostics outputs/llm-books/<id>/Gen/bible-<id>-strong-diagnostic.hard-verses.json --review outputs/llm-books/<id>/Gen/llm-review-<id>-Gen.json --only Gen
npm run viewer
```

Open `http://localhost:4173/viewer/review.html`, load the generated review JSON,
decide pending suggestions, correct token targets when needed, and click
`Enregistrer décisions`. Single-model suggestions are pending by default.

For production-scale LLM review, prefer the concurrent book runner:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run strong:review:llm:books -- --bible <id> --books all --concurrency 3 --llm-limit 25 --model deepseek/deepseek-v4-flash --skip-existing
```

This writes per-book review files under `outputs/llm-books/<id>/<Book>/` and a manifest at `outputs/llm-books/<id>/llm-review-<id>-manifest.json`. Open it with:

```text
http://localhost:4173/viewer/review.html?manifest=/outputs/llm-books/<id>/llm-review-<id>-manifest.json
```

Use `--skip-existing` to resume without re-calling the LLM for books that already have review JSON files.

Do not launch a whole multi-Bible batch with `--llm-limit 250` for every book. First run the complete 66-book pass with a small per-book limit, inspect the manifest, then rerun only selected hard books with a higher limit.

Manual review supports three cases:

- correct suggestion: keep or set `Accepter`;
- wrong suggestion: set `Rejeter`;
- right Strong but wrong French token: set the item to `À revoir`, click the intended word in the verse context or edit `Index cible` / `Mot normalisé` / `Strong`, then set `Accepter`.

11. Regenerate after saving accepted decisions:

```sh
npm run strong:generate -- --bible <id>
```

The viewer stores accepted decisions in `data/curated-strong-overrides.json`. The TypeScript fallback overrides in `src/curatedStrongOverrides.ts` remain for older reviewed decisions.

`strong:review:llm` does not auto-accept by default. `--auto-accept true` is an
explicit exploratory opt-in and is recorded as `llm-review:single-model-auto`,
never as human approval. The 5,379 NBS legacy single-model auto-accepts remain
quarantined. Plain `semantic-refill:llm` and
`semantic-refill:llm-reference-style` records are also always quarantined,
regardless of reason text; only `semantic-refill:llm-consensus-filtered` is
production-eligible.

Historical semantic-refill artifacts can be reconciled only through the strict
migration, always dry-run first:

```sh
npm run strong:review:gaps:migrate-artifacts -- --bible <id>
npm run strong:review:gaps:migrate-artifacts -- --bible <id> --apply
```

Promotion requires two distinct model identities agreeing on the same bounded
choice, a `missing` candidate that is still open, a current target supported by
current direct lexical evidence, and no replacement, relocation, or carrier
conflict. For NBS, 313 of 2,411 raw semantic-refill records passed those gates;
2,098 remain quarantined. The migration reconstructed 2,480 durable decision
records: 2,043 `accepted-safe` and 437 `needs-witness-review`.

12. Before trusting the LLM prompt on a new book/style, evaluate it against known Strong Bibles:

```sh
npm run strong:llm:transfer -- --source Darby --gold Sg1910 --only Gen.1 --limit 5
npm run strong:llm:transfer -- --source Darby --gold DarbyR --only Gen.1 --limit 5
```

13. When deterministic generation leaves meaningful semantic holes or suspicious visible placements, use the internal-agent gap-review workflow instead of ad hoc token patches:

```sh
npm run strong:generate -- --bible <id>
npm run strong:lexical-candidates -- --bible <id> --only <BookOrScope>
npm run strong:review:gaps -- --bible <id> --only <BookOrScope> --audit --output-dir outputs/gap-review/<id>/<scope>
npm run strong:review:gaps:packet -- \
  --bible <id> \
  --only <BookOrScope> \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>.json
```

When the goal is a high-yield semantic benchmark rather than a restraint test,
require semantic candidates and stop before paying for a weak packet:

```sh
npm run strong:review:gaps:packet -- \
  --bible <id> \
  --only <BookOrScope> \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>-semantic.json \
  --limit 30 \
  --min-priority semantic-medium
```

If this exits with `no-candidates-at-or-above-priority:semantic-medium`, do not
call the LLM for a semantic benchmark from that queue. Either treat the packet as
a `function-low` restraint test or improve candidate sourcing first.

For a high-yield semantic packet, prefer converting the lexical candidate report
instead:

```sh
npm run strong:review:gaps:lexical-packet -- \
  --bible <id> \
  --only <BookOrScope> \
  --lexical-report outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-<BookOrScope>.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>-lexical.json \
  --limit 30 \
  --min-confidence medium
```

For the prioritized internal-only queue, select one disjoint candidate class at
a time instead of mixing easy direct cases with ambiguous ones:

```sh
npm run strong:review:gaps:lexical-packet -- \
  --bible <id> \
  --only all \
  --candidate-class ambiguous-high \
  --audit-kind empty \
  --lexical-report outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-all.json \
  --output outputs/gap-review/<id>/<run>/packet-<id>-ambiguous-high-001.json \
  --offset 0 \
  --limit 20 \
  --min-confidence high
```

Supported classes are `all`, `open-high`, `ambiguous-high`, `direct-high`, and
`relocation-better-open`. `ambiguous-high` requires more than one high-confidence lexical
candidate and at least one open high candidate. `direct-high` requires exactly
one high candidate and that candidate must be open.
`relocation-better-open` requires a visible relocation whose best open carrier
scores at least `0.12` above its current carrier, matching the lexical report's
priority metric. Combine these with
`--audit-kind empty` or `--audit-kind relocation` to keep priority waves
disjoint. The packet builder must read only the exact candidate refs from the
canonical SQLite ledger; `--only all` is a report filter here, not permission to
materialize all 31,169 verse rows.

As of 2026-06-29, the lexical-packet + two-model + exact-consensus workflow has
three positive NBS pilots after canonical refresh:

- `Ezek`: 16 consensus placements applied; `emptyStrongCount -16`,
  `readerTaggedTokenCount +18`, `placementRiskCount -2`;
- `1Cor`: 7 consensus placements applied; `emptyStrongCount -14`,
  `readerTaggedTokenCount +15`, `placementRiskCount -1`;
- `Acts`: 8 consensus placements applied; `emptyStrongCount -6`,
  `readerTaggedTokenCount +10`, `placementRiskCount -4`.

The next broadening step is a controlled multi-packet batch, still capped per
book and consensus-only. Do not apply a raw single-model review directly just
because these pilots were positive.

The first controlled batch on 2026-06-29, replayed through the automatic
post-consensus filter on 2026-06-30, initially left 27 safe consensus decisions
applied across `Hos`, `2Sam`, `Rev`, and `Amos` after refresh. Global batch
delta before Leviticus follow-up: `emptyStrongCount -40`,
`readerTaggedTokenCount +47`, `placementRiskCount -6`.
The batch proved that exact consensus still needs a safety filter: hold generic
carriers such as `vais`, `ferai`, `fera`, `fasse`, `faisait`, `fit`, `celle`,
and `quoi` unless at least two independent witness families carry the Strong on
that exact normalized carrier. A non-generic carrier needs either an exact
carrier witness or high-scoring direct deterministic evidence on the same
target. In `Rev.5.1`, witnesses place `G1855` on
`dehors`/`revers`/`extérieur`; they establish the Strong concept but do not by
themselves validate NBS `dos`. `dos` is safe only when the packet also contains
direct deterministic evidence for that exact target; otherwise it stays in
review. `G3693` remains an advanced empty original annotation. `Lev` produced a valid 21-decision consensus
and the filter marks all 21 safe. A later isolation pass on 2026-06-30 showed
the apparent `Lev` refresh hang was not a bad Leviticus decision: scoped refresh
was repeatedly rereading heavy lexical sources and rebuilding large reference
phrase structures during auto-safe passes. The SQLite ledger, lexical source
cache, Kaikki index, and phrase-lexicon index fixed the storage and repeated
source-loading path; the 21 filtered `Lev` decisions are now applied and
verified. The pre-SQLite `Lev` refresh baseline was 132.06s with 7.46 GB max
RSS after application; the SQLite/indexed path reduces memory materially while
the remaining time is dominated by bounded lexical auto-safe stabilization.
Incremental `Lev` delta:
`emptyStrongCount -15`, `readerTaggedTokenCount +21`, `placementRiskCount -5`.
Report: `reports/llm-gap-review-nbs-Lev-filtered-applied-20260630.md`.

The second bounded batch on 2026-06-30 applied 17 filtered consensus decisions
across `2Kgs.1-5`, `1Pet.1-5`, and `Rom.1-5` after refresh. Global batch delta:
`emptyStrongCount -42`, `readerTaggedTokenCount +48`, `placementRiskCount -6`.
The filter held three model-consensus decisions: `2Kgs.4.38 H8239 -> fais`,
`1Pet.2.20 G0015 -> faisant`, and original-only `Rom.4.17 G5607 -> existe`.
The last case added a new automatic rule: a visible decision with no token
witness and no Strong support in `Sg1910`, `Darby`, or `DarbyR` must be held for
review, even when both models agree.

The full NBS high-confidence lexical gap-review batch was validated on
2026-07-01 with the SQLite-first runner:

```sh
set -a; . ./.env; set +a
npm run strong:review:gaps:batch -- \
  --bible <id> \
  --lexical-report outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-all.json \
  --output-root outputs/gap-review/<id>/full-bible-llm-high-open-<date> \
  --max-items-per-task 30 \
  --min-confidence high \
  --plan-only

npm run strong:review:gaps:batch -- \
  --bible <id> \
  --lexical-report outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-all.json \
  --output-root outputs/gap-review/<id>/full-bible-llm-high-open-<date> \
  --max-items-per-task 30 \
  --task-batch-size 3 \
  --min-confidence high \
  --skip-existing \
  --timeout-ms 600000 \
  --llm-attempts 2
```

Inspect `plan.json` before starting paid calls. Reuse the same output root for
the real run so the stable task membership and pagination are auditable.

For the validated production-style run, use one batch runner process. The runner
may keep multiple LLM tasks in flight, but SQLite writes, `strong:review:gaps:apply`,
`strong:refresh`, and reports must remain serialized. Do not launch independent
writer agents against the same Bible ledger. `--task-batch-size 3`,
`--max-items-per-task 30`, `--timeout-ms 600000`, `--llm-attempts 2`, and
`--skip-existing` are the validated defaults for NBS-scale production review.
Packet/review/consensus/filter reuse is content-addressed rather than mtime-based,
and the sidecar verifies fresh output hashes before reuse. Each LLM attempt uses
a private temporary output and may promote it only after exact packet, model,
candidate-id, and choice-id validation.
The packet runner requires provider-side strict JSON and exactly one bounded
choice per stable candidate id. The second proposer is adaptive at candidate
level: it receives only candidates for which proposer A produced a visible
consensus-eligible choice. Task membership and pagination remain stable across
resume. Application requires exact candidate-and-choice consensus from two
distinct model identities, the current lexical safety filter, and a version-2
review contract. It takes an inter-process write lock plus batch transaction
marker, backs up curated overrides and the durable raw decision ledger,
refreshes the exact scope, runs quality/integrity gates, and rolls both files
plus the scope back on failure.

`semanticRefillAgentReview --apply` is intentionally unusable as a standalone
production shortcut: it refuses application unless the batch already owns the
matching lock/transaction and the packet, Bible, scope, policy, provenance, and
contract all match. `--finalize-reference-style` is preview/validation only,
never authorization for arbitrary application. The decision ledger records
terminal contexts, but there is no safe general pre-LLM skip yet because reuse
eligibility depends on the current candidate cohort and filter policy.

The batch runner is resumable, but it may reuse only tasks whose status is
`completed`. Do not treat historical `skipped` tasks as done. A packet with zero
post-filter safe decisions is a completed no-op, not a skipped task, when both
model reviews parsed and the consensus/filter/apply validation succeeded. The
2026-07-01 NBS run had four completed no-op scopes (`Hos.14`, `Acts.27`,
`Phlm.1`, `3John.1`), which correctly produced no applied report.

The full NBS result:

- `tasks=248`, `completed=248`, `skipped=0`, `failed=0`;
- `candidates=5475`, `consensus=2665`, `acceptedSafe=2205`,
  `applied=2205`;
- `needsWitnessReview=440`, `rejectedRisky=20`;
- 248 packet files, 248 OpenAI reviews, 248 DeepSeek reviews, 248 consensus
  files, 248 filtered files;
- zero LLM `parseError` files.

The required post-batch gates are:

```sh
node - <<'NODE'
const m=require('./outputs/gap-review/<id>/<run>/manifest.json');
console.log(JSON.stringify(m.totals,null,2));
console.log(m.tasks.reduce((a,t)=>((a[t.status]=(a[t.status]||0)+1),a),{}));
NODE
node - <<'NODE'
const fs=require('fs'), path=require('path');
const root='outputs/gap-review/<id>/<run>/agent-review';
const bad=[];
for (const f of fs.readdirSync(root)) {
  if (!f.endsWith('.json')) continue;
  if (!f.includes('-openai-') && !f.includes('-deepseek-')) continue;
  const j=JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
  if (j.parseError) bad.push({file:f, parseError:j.parseError});
}
console.log(JSON.stringify(bad,null,2));
NODE
npm run strong:generate -- --bible <id>
npm run strong:export -- --bible <id> --view reader
npm run strong:export -- --bible <id> --view advanced
npm run strong:diagnose -- --bible <id>
sqlite3 outputs/strong/<id>/bible-<id>-strong.sqlite "select count(*) from verses; pragma integrity_check;"
grep -E "Auto-safe candidates: 0|Auto-safe items: 0|Group auto-safe items: 0" outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-all.md
npm run typecheck
npm run lint
npm test
```

For NBS after the 2026-07-10 deterministic hardening and final regeneration, the
canonical ledger has `31169` verses, `pragma integrity_check` returns `ok`,
lexical auto-safe is zero, `readerVisibleStrongCount=363503`,
`advancedStrongCount=486297`, `emptyStrongCount=95456`,
`phraseStrongCount=5369`, `readerTokenCoverage=0.4912`,
`advancedTokenCoverage=0.5204`, `referenceStrongCarrierCoverage=0.8593`,
`originalStrongCarrierRate=0.8029`, `originalRepresentationRate=0.9999`,
`semanticMissingCount=395`, `placementRiskCount=6831`, and the structural
`placementQuality=0.9808`. The lower reader density is intentional:
uncalibrated original-complete guesses now remain advanced instead of inflating
reader coverage.

### Internal-only multi-agent review for a generated Bible

Use this workflow when the user explicitly wants Codex sub-agents only and no
AI Gateway/provider calls. Internal sub-agents are independent review turns,
but the runtime does not attest that they are distinct model identities. Their
agreement is therefore a strong suggestion, not by itself the two-provider
production proof required by `strong:review:gaps:batch`.

Before sending any candidate to an agent, normalize the STEP identity model at
the original-token level:

- group annotations by exact `originalTokenId` and STEP token identity;
- distinguish multiple lexical occurrences from alternate `strong`,
  `eStrong`, `dStrong`, and `uStrong` identities of one occurrence;
- keep one carrier question for one original lexical occurrence;
- expose compact identities as metadata on that question, never as separate
  missing Strong candidates;
- do not ask an agent to decide whether an alias is another occurrence;
- preserve textual variants and edition support in the packet;
- when a classical Strong and STEP extended identity share one token, plan one
  product carrier such as `<w strong="G0528" estrong="G5221">…</w>`;
- detect merged or shifted verse clauses before review and quarantine any
  occurrence whose target verse cannot be established safely.

The OST Acts 16 pilot documented in
`reports/internal-agent-gap-review-ost-acts16.md` exposed why this is mandatory:
`G0528` and `G5221` were variants of the same TAGNT token, but the unnormalized
lexical packet presented them as two missing occurrences. Two proposers and an
arbiter all made the same bounded mistake because the correct product-level
choice was absent from the packet.

Prioritize a generated Bible's review queue in this order:

1. visible relocations with a better open content carrier;
2. suspicious stacking and profile over-budget carriers;
3. missing reader occurrences with an open high-confidence direct candidate;
4. ambiguous high-confidence carriers;
5. multi-word French expressions where the Strong belongs on a phrase;
6. original-only or grammatical items, normally retained in advanced/empty
   unless strong evidence supports reader visibility.

Keep packets chapter-sized and normally cap them at 20-30 candidates. Every
packet must contain target context, current reader/advanced state, exact STEP
occurrence metadata, witness carriers rather than inventories alone, bounded
word/phrase/empty/duplicate/technical choices, open/occupied/blocked targets,
and placement warnings.

Run two proposers in parallel with deliberately different review roles:

- proposer A is occurrence/evidence-first: STEP identity, morphology, source
  order, textual editions, and independent Strong witnesses;
- proposer B is French/safety-first: syntax, semantic carrier, phrase scope,
  open targets, generic words, and stacking risk.

Keep roles independent per packet, even when a long run rotates a limited pool
of internal threads. An agent that proposed a packet must not arbitrate or audit
that same packet. The root agent may serve as the fourth safety auditor only if
it did not propose or arbitrate the packet; record that provenance explicitly.

Validate both outputs locally before arbitration. Require one bounded choice
per stable candidate id, exact word/phrase indexes, matching normalized text,
allowed Strong inventory, and zero malformed or missing decisions. Send only
disagreements and sensitive agreements to the arbiter. Sensitive agreements
include aliases, original-only items, verse shifts, generic carriers,
occupied-target stacking, weak function words, and visible choices with no
exact witness or direct lexical evidence.

Internal proposer artifacts must use the current full raw-decision contract,
not the historical compact OST shape. Alongside `id`, `choiceId`, confidence,
reason, and evidence, materialize `ref`, `decision`, `strong` (containing only
the candidate's own Strong), `wordIndex`, `normalized`, `startWordIndex`,
`endWordIndex`, and `normalizedPhrase` from the exact selected packet choice;
use explicit `null` values where the choice has no such coordinate. Run the
non-mutating `strong:review:gaps:apply` validation before freezing the file.

Freeze each locally validated proposer artifact before arbitration and record
its SHA-256 in the arbitration input/manifest. A proposer must never silently
edit a file that has already been declared validated or handed to the arbiter.
If later context exposes an error, write an explicit revision, validate the
whole revised packet again, update the recorded hash, and restart or explicitly
invalidate the affected arbitration/audit. Downstream decisions are valid only
for the exact frozen proposer hashes they reviewed.

Create the immutable manifest only after both proposer turns have reached a
completed status and both final files pass `parseSemanticRefillLlmResponse`.
A proposer file already visible on the shared filesystem is not final while
its proposer is still running. Rerunning the command against an existing
manifest fails closed. If a hash changes, mark that freeze series superseded,
revalidate the final file, create a new immutable freeze series, and never
restore or silently rewrite the old manifest. Use `--verify` before
arbitration, audit, and consolidation:

```sh
npm run strong:review:gaps:freeze -- \
  --packet <packet-number> \
  --output <freeze-manifest.json> \
  --source packet=<packet.json> \
  --source evidence=<proposer-evidence.json> \
  --source french=<proposer-french.json>
npm run strong:review:gaps:freeze -- \
  --output <freeze-manifest.json> --verify
```

In a durable review decision, the `strong` array must contain only the
candidate's own `strong` value. `stepIdentity.associatedStrong`, `eStrong`,
`dStrong`, and `uStrong` remain occurrence metadata; do not copy them into the
decision's allowed Strong inventory. The exact occurrence link and publisher
preserve those identities. This distinction prevents a valid same-token alias
from being misread as an additional target Strong during pre-application
validation.

Pre-application validation must evaluate the accepted decision set as a batch,
not only one decision at a time against the unchanged ledger. When two or more
decisions in the same batch create a word-level stack on a carrier that was
previously open, move every involved decision to `pending-human` with
`suspicious-batch-stacking-on-same-word`. A linguistically plausible
compression or textual-variant pair is still a durable human decision; agent
agreement and an initially open target do not make the new stack auto-safe.

The arbiter receives the packet, both proposals, validation results, and local
STEP/reference evidence. It may choose only a bounded packet choice and must
not invent an unvalidated third carrier. A fourth internal auditor examines
only proposed production-safe decisions and can return `safe`, `hold`, or
`block`; it does not propose a new carrier.

After the independent audit, build the contract-v2 safe subset mechanically.
The command rejects unbounded arbiter choices, missing audits for green
decisions, and arbiter/auditor choice mismatches; yellow and red decisions are
never emitted:

```sh
npm run strong:review:gaps:internal-safe -- \
  --packet <packet.json> \
  --arbiter <arbiter.json> \
  --auditor <auditor.json> \
  --output <safe-reviewed.json>
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input <safe-reviewed.json> \
  --output-dir <validated-preview-dir> \
  --ledger-dir outputs/strong/<id>
```

Omit `--apply` here. The preview is required to exercise whole-batch stacking
guards while leaving the canonical ledger untouched.

After every bounded packet has a validated non-mutating preview, consolidate
only the generated `accepted.json` files with the previously approved-review
candidate artifact. Use the approval-bundle command rather than concatenating
JSON manually. Pass the earlier artifact first so an exact decision reviewed
again by a later queue keeps the earlier provenance; exact duplicates are
recorded and collapsed by Bible, reference, Strong inventory, target, indexes,
and normalized carrier. The output is still only an approval candidate:

```sh
npm run strong:review:gaps:approval-bundle -- \
  --bible <id> \
  --output <human-approval-candidate.json> \
  --source previous=<previous-approval-candidate.json> \
  --source packet-001=<validated-preview-001/accepted.json> \
  --source packet-002=<validated-preview-002/accepted.json>
```

Record the bundle's source hashes, raw source decision count, unique decision
count, duplicate ledger, and decision-payload SHA-256. The bundle status
`awaiting-explicit-human-durable-approval` is not approval. Never pass it to an
applying transaction until the human explicitly approves that exact durable
payload hash.

Before requesting that approval, freeze the read-only chapter transaction
plan. This command replays every source hash and count, reconstructs the exact
deduplication result, verifies the payload hash, checks the canonical SQLite,
and records one immutable payload hash per chapter scope. It refuses to
overwrite an existing plan and does not mutate overrides or the ledger:

```sh
npm run strong:review:gaps:approval-plan -- \
  --bible <id> \
  --bundle <human-approval-candidate.json> \
  --output <human-approval-application-plan.json> \
  --ledger-dir outputs/strong/<id>
```

The plan remains `awaiting-explicit-human-durable-approval`. Its scope count is
the exact number of locked chapter transactions and scoped refreshes required
after approval; generating the plan is never equivalent to approving or
applying it.

Verify the complete execution path in read-only mode before asking for or
recording approval. This replays the sources, bundle, plan, canonical SQLite,
metrics, input fingerprint, and current curated-override fingerprint and always
reports `appliedOverrideCount: 0`:

```sh
npm run strong:review:gaps:apply-approved -- \
  --bible <id> \
  --bundle <human-approval-candidate.json> \
  --plan <human-approval-application-plan.json> \
  --ledger-dir outputs/strong/<id>
```

Only after the human explicitly approves the exact payload SHA-256 may the
same command receive `--apply --approved-sha256 <exact-hash>`. The approved
runner replays all frozen inputs, serializes writes under the review lock,
backs up both curated overrides and the human-approval ledger, applies one
chapter scope, refreshes only that scope, runs every metric/integrity/visibility
and residual-auto-safe gate, and rolls back both state files plus the scope on
failure. A verified approval receipt is written inside the same transaction,
so a restart can reconcile the narrow commit-before-manifest crash window.
Use `--max-scopes <n>` for a bounded resumable slice. Add `--finalize` only when
the run should perform the final complete regeneration and reader/advanced
exports after all planned scopes are verified. Never pass `--apply` merely to
test the command.

Both plan creation and read-only execution verification recompute the current
Strong-ledger input fingerprint; comparing only the SQLite byte hash is not
enough. If either command reports `approval-plan-input-fingerprint-drift`, the
old plan is invalid even when SQLite itself is byte-identical. Do not weaken
that guard and do not attempt scoped refresh. Before human approval, record the
invalidation and leave the canonical ledger untouched. After explicit approval
of the unchanged decision payload, a full canonical regeneration with the
then-current stable pipeline may establish the new baseline; freeze a new plan,
rerun read-only verification, and only then begin chapter application.

Classify results as follows:

- **green**: exact proposer agreement, mechanically valid, direct same-target
  evidence or exact witness support, no alias/verse/stacking/generic risk, and
  auditor `safe`;
- **yellow**: disagreement, arbiter-only choice, sensitive agreement, or weak
  support; retain for human/viewer review;
- **red**: malformed identity, unresolved verse mapping, invalid occurrence,
  or unsafe carrier; keep advanced/empty or reject the candidate itself.

Never bypass the existing production transaction because internal agents
agree. Preview internal decisions first. Production mutation requires either
the existing distinct-model batch proof or an explicit human-approved durable
decision. Apply accepted decisions chapter by chapter with a backup, exact
scope refresh, and rollback on any gate failure.

For every applied scope require: unchanged verse count; SQLite integrity `ok`;
no increase in `placementRiskCount`; no decrease in original representation or
reference coverage; no new same-token identity duplication; no residual
lexical auto-safe item; and an auditable before/after report. The sole bounded
exception to the aggregate placement-risk delta is a newly created same-word
stack in which every Strong is distinct, every resulting annotation carries
`llm-review:human-approved`, and the exact approved payload assigns every one
of those Strong identities to that exact verse and word. This covers genuine
compound lexical carriers such as OST `Saint-Esprit` without weakening the
duplicate or over-budget guards. Prove this from the scoped before/after verses
inside the approval executor; do not change a fingerprinted generation metric
mid-application. After all scopes, regenerate the complete ledger once, rerun
global gates, and only then publish the STEP-aware compact JSONL. Agents choose
French carriers; STEP and the publisher remain authoritative for `estrong`,
`dstrong`, and `ustrong`.

For experiments and inspection, two validated model reviews on the same lexical
packet can be combined into a strict visible high-confidence consensus and run
through the post-consensus filter:

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
```

These standalone commands are preview/validation only. Production application
must be performed by `strong:review:gaps:batch`, which recreates and verifies
the two-model consensus/filter artifacts inside its locked v2 transaction.

Then write a benchmark report with the explicit output flags:

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

Give that packet to two independent proposer agents. Prefer chapter-sized packets for normal books; use book-sized packets only when the book is short or the candidate count is low. For the benchmarked reference-style workflow, use `gpt-5.4-mini` with reasoning `medium` as proposer A, `gpt-5.5` with reasoning `low` as proposer B, and `gpt-5.5` with reasoning `medium` as arbiter. This Gen.1 benchmarked combo is called combo A in `reports/gap-review-model-benchmark-gen1.md`. Do not silently upgrade proposer A to `xhigh`: the point is to test whether the ordinary proposer pair can solve the chapter without a hand-written rule. Each proposer must write a JSON review file, then validate it:

For a single-model AI Gateway pilot, use the packet runner first, then validate
the review before applying anything:

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

```sh
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<proposer>.json \
  --output-dir outputs/gap-review/<id>/agent-review/<proposer>-validated \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json
```

Use an arbiter only after both proposer outputs are validated. For the reference-style workflow, default to `gpt-5.5` with reasoning `medium` as the arbiter. Use `gpt-5.5 high` as a quality-reference baseline, escalation path, or explicit experiment, not as the default production choice. The arbiter should choose between defensible proposals and inspect local validation results; it should not invent a third unvalidated path when both proposers are weak. Validate and preview the arbiter output after converting every valid unresolved reference-style Strong to a placed decision (`word`, `phrase`, or `empty`) with a confidence score:

```sh
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<arbiter>.json \
  --output-dir outputs/gap-review/<id>/agent-review/<arbiter>-validated \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --finalize-reference-style
```

Never add `--apply` to this standalone reference-style command. If the preview
contains useful decisions, feed the current lexical report to the batch runner;
only its exact two-model filtered transaction may mutate production overrides.

The agent packet is procedural. It includes `auditKind`, `currentTarget`, `sourcePlacement`, `nearbyOpenTargets`, `blockedTargets`, `openContentTargets`, `occupiedTargets`, `availableTargets`, and `placementWarnings`. `auditKind="missing"` means the Strong is not visible yet. `auditKind="relocation"` means the Strong is already visible but may be attached to the wrong French carrier. Agents must treat `blockedTargets` as forbidden for `decision="word"` when a semantically plausible open target exists. This prevents errors such as stacking a missing Strong onto a word that already carries a different Strong when a nearby unoccupied carrier exists.

For relocation candidates, agents must compare `currentTarget` with `deterministicCandidates`. Use `duplicate` only when the current placement is correct. If a better visible carrier exists, output `word` or `phrase`; if no reliable carrier exists, output `empty`. Do not rely on hand-written semantic equivalence lists for cases such as NBS `Gen.1.27` (`homme` vs `humains`); solve those only with auditable external lexical evidence or bounded LLM review.

For reference-style candidates, do not use `pending-human` as a final preview state and do not use `reject` for a legitimate Strong simply because no French carrier is found. The objective is to copy the reader style of `Darby`, `DarbyR`, and `Sg1910`: first try `word`, then `phrase`; if no reliable visible carrier exists, output `empty` at the candidate's `sourcePlacement.insertAfterWordIndex` so the Strong remains visible as a small empty tag in original/reference order. Every final decision gets a confidence score. The product vocabulary is high confidence vs low confidence, not accepted vs pending. Use low confidence for uncertain word/phrase placements, suspicious stacking, or empty fallbacks. Reserve `reject` only for invalid candidates, duplicate drift, bad ids, or mechanically impossible decisions. The final arbiter preview may pass `--finalize-reference-style`; this converts valid unresolved, unsafe, or missing agent decisions into low-confidence `empty` preview entries instead of leaving them pending. It does not make them production-eligible. The review/preview must show low-confidence decisions in yellow and empty decisions inline, with a reason such as "no reliable French carrier found".

### Native/canonical versification alignment

Before any LLM gap-review on a Bible whose verse boundaries may differ from
STEP or the Strong witnesses, generate and freeze a versioned correspondence
manifest:

```sh
npm run strong:versification -- --bible <id>
```

The v2 manifest is full-scope and monotone. Its blocks support `identity`,
`merge`, `split`, `resegment` (N:M), `shift`, `chapter-boundary`, `omitted`, and
`added`. The detector compares three local Strong witnesses and records both
the best path and its ambiguity margin. A book-level low margin does not erase
a locally strong structural block: production may retain the best path only
when every non-identity block clears the local evidence threshold. Otherwise,
retain only the exact top-two intersection and fall back to identity outside
it. Empty canonical witness rows are valid source coordinates, not malformed
text.

Generation must validate exact target and canonical coverage before writing the
manifest. The accepted report records the manifest SHA-256, block counts,
detector version, thresholds, witnesses, and per-book resolution policy. Add
the frozen manifest path to the Strong-ledger input fingerprint; a changed
manifest always requires a full regeneration before scoped refresh.

For each non-identity block, align the concatenated target text once against
the deduplicated STEP tokens and combined witnesses, then project back to the
Bible's native verse refs. Require all of these invariants:

- every French word index belongs to exactly one native verse;
- a phrase may not cross a native verse boundary;
- every empty anchor has one deterministic native owner;
- every physical STEP occurrence is represented exactly once;
- all Strong identities of one physical STEP token are co-located on one
  carrier;
- witness inventories are partitioned, never copied into every verse;
- curated overrides remain native-ref/local-index decisions and are applied
  only after block projection;
- a targeted refresh expands to every native verse in the touched block.

Run non-mutating canaries before activating a manifest. Include at least one
2:2 clause transfer, one merge/split, one chapter/count exception, and one
same-token multi-identity case. Verify unchanged total occurrence inventory,
100% original representation for the canary scope, and zero same-token
duplication. Only then place the frozen manifest at
`data/bibles/bible-<id>-verse-correspondence.json` or pass its exact path with
`--verse-correspondence` for a full regeneration. Do not start LLM carrier
review until that regeneration and its SQLite/integrity/quality gates pass.

14. Run full checks before finalizing:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

15. When changing deterministic lexical placement rules, run or resume the
    10-book first-5-chapters regression audit:

```sh
npm run strong:audit:plan
npm run strong:audit:run
npm run strong:audit:verify
npm run strong:audit:residuals
```

The default audit is intentionally capped at 10 books to keep regeneration
fast during iterative work. Use `--books <n>` only for explicit broader
stress tests.

If the audit changed intentionally, inspect `outputs/strong-audit/nbs/manifest.json`,
then refresh the committed metrics/hash baseline:

```sh
npm run strong:audit:snapshot -- --snapshot tests/fixtures/strong-audit/nbs-10x5-snapshot.json
```

Use `strong:audit:residuals` after a successful audit run to write
`outputs/strong-audit/nbs/residuals.json` and `.md`. The residual report is for
human inspection only and stays in ignored `outputs/`; it groups remaining
lexical candidates into actionable categories such as group auto-safe leftovers,
compound STEP proper-name candidates, clean single open high candidates, blocked
single open high candidates split by medium-only vs high-candidate blockers,
high candidates that use inferred seed evidence, high-scoring medium candidates,
ambiguous high candidates, and relocation better-open candidates. Treat clean
single-open items as the first deterministic audit queue. Treat compound proper
names, inferred-seed high items, blocked items, and high-scoring medium items as
evidence for review, not as automatic insertion candidates.

Lexical auto-safe insertion is iterative. Keep rerunning candidate generation
until no more placements are applied, within the bounded pass limit. Some
group-auto-safe placements become visible only after earlier lexical passes
remove competing residual candidates.

## Decision Rules

- Prefer `strong:generate` for the production artifact because it keeps a canonical SQLite reader/advanced ledger, applies validated lexical auto-safe placements, writes the residual lexical candidate report, and explains every Strong placement.
- Keep original-complete word guesses and empty occurrences in advanced/debug
  view. Only the calibrated reader pipeline, validated lexical auto-safe, or a
  bounded reviewed decision may add a reader carrier.
- Treat `placementQuality` as a structural risk proxy, not semantic accuracy.
  Use masked-gold carrier-exact F1 as the primary quality measurement.
- Count independent witness families, not filenames: `Darby` and `DarbyR` are
  one family for consensus bonuses, learned word/phrase frequency thresholds,
  and editorial empty placement. Within one family and verse, take the maximum
  correlated-edition count before summing evidence across verses/families.
- Prefer SQLite store reads for any scoped workflow. Commands with `--only <Book|Chapter|Range>` must read only matching rows from `bible-<id>-strong.sqlite`, not parse the whole Bible.
- Keep `strong:kaikki:index` and `strong:phrase:index` prepared on production machines. They turn the two largest lexical/reference lookups into targeted SQLite reads.
- Prefer `strong:export -- --view reader` or `strong:export -- --view advanced` for TSV views.
- The diagnostic backend includes learned multi-word phrase transfer from the local Strong references. Keep this deterministic and original-confirmed.
- Use STEP TAHOT/TAGNT as the production original inventory. Treat WLC/SBLGNT suffixed Strong values (`H6960a`, etc.) as audit provenance only, not lexicon lookup keys. Render and compare the canonical Strong (`H6960`), prefer STEP `dStrong`/`eStrong` for lexical disambiguation, and keep any non-STEP source suffix only as metadata.
- Treat local French Strong dictionaries as deterministic evidence for review and future scoring, not as a license to place tags without original/reference inventory support.
- When reading `strong_lexicon.full.production.sqlite`, keep proper-name `gloss` evidence but do not use proper-name `meaning` text as French carrier evidence. Do not let a row's `uStrong` feed another classical Strong unless the normalized `uStrong` equals the row's `eStrong`, except for pronominal morphology where cross-`uStrong` forms are grammatical variants. This prevents related-name/group definitions from placing false carriers while preserving pronoun variants.
- Do not add hand-written synonym or semantic-equivalence entries to generation because a hard verse was discussed. Production placement may use exact learned reference evidence, dictionary evidence, algorithmic stemming, STEP inventory, validated lexical auto-safe evidence from external French sources, or bounded LLM review; see `docs/french-lexical-sources-for-strong-placement.md`.
- Treat synonym-only candidates as review material. A candidate can be `high` only when it has direct evidence such as `seed-term`, `seed-stem`, `kaikki-gloss`, STEP proper-name evidence, or STEP numeric component evidence. Synonym-only candidates may keep their numeric score for sorting, but their confidence is capped at `medium` and they still count as ambiguity blockers for generic auto-safe decisions. Auto-safe production insertion requires direct evidence or a French auxiliary-plus-participle phrase whose participle has direct lexical evidence. A synonym-only high-score competitor outside a strong auxiliary-plus-participle phrase does not block that phrase, but a direct-evidence outside competitor does. When both a French auxiliary-plus-participle phrase and its contained participle are independently auto-safe, prefer the phrase because it preserves the visible French verbal construction without adding semantic assumptions. Numeric component evidence may stack on occupied compound-number carriers, including relocation from a simple occupied number to a later richer compound number and duplicate empty numeric occurrences that have one richer occupied compound carrier; French compounds such as `douze`, `quatre-vingt-*`, and `soixante-dix-*` are decomposed into STEP-compatible numeric components. Repeated empty occurrences of the same Strong may be group-auto-safe when the same open French lexeme appears the same number of times with high-confidence direct evidence and source order maps cleanly to text order. The duplicate lexical group rule uses relative order and exact cardinality; it does not require the French carriers to appear after the empty source anchors, because translated clauses can move the visible carrier before the original-complete insertion point. Ambiguous STEP proper-name sequences may also be group-auto-safe when same-verse source order and French token order provide a one-to-one monotonic assignment across open high-confidence proper-name carriers; do not use this to replace simple proper-name auto-safe placements that are already unambiguous.
- Lexical auto-safe placement is a stabilization loop, not a single pass. Do
  not lower the pass limit unless the 10x5 audit proves that no validated
  auto-safe placements remain stranded in the residual report.
- Use calibrated translation profiles: one common backend, but profile-aware generation and diagnostics by translation family.
- Interpret metrics through the Bible's translation profile. Dynamic translations such as BDS are expected to have lower token coverage than formal translations such as Martin.
- Profiles are active generation inputs, not just labels: they control learned enrichment strictness, maximum Strong codes per word, empty-word consensus, and hard-verse thresholds.
- Report visible Strong rate, empty Strong rate, multi-Strong word rate, original representation rate, original unrepresented Strong occurrences, and profile token-coverage status.
- Use `strong:evaluate` after changing reader, phrase, or empty-tag behavior.
- Prefer `strong:llm:transfer` over free LLM arbitration. It is measurable: source Strong Bible -> masked gold Bible.
- Do not use `--llm-apply` until suggestions have been reviewed on a small sample.
- Promote good LLM suggestions through `strong:review:llm` + `strong:review:llm:apply` into `data/curated-strong-overrides.json` rather than repeatedly paying for the same decision.
- Prefer LLM batches by book (`--only Gen`, `--only Exod`, etc.) instead of whole-Bible LLM runs.
- For semantic improvement batches, prefer compact lexical packets and exact
  two-model consensus. NBS now has a validated full-Bible high-confidence
  lexical batch path via `strong:review:gaps:batch`, but it is still bounded
  suggestion generation: exact consensus plus the post-consensus filter is
  required before any application.
- Require two distinct model identities, the same stable candidate id and
  bounded choice id, the current filter policy, contract v2, and the active
  batch lock/transaction before production application. Direct
  `strong:review:gaps:apply --apply` is forbidden, as is combining standalone
  `--finalize-reference-style` with `--apply`.
- Treat plain `semantic-refill:llm` and
  `semantic-refill:llm-reference-style` as quarantined provenance only. Only
  `semantic-refill:llm-consensus-filtered` may enter production, either from a
  current batch transaction or from the strict current-proof artifact
  migration.
- After the first controlled batch, require a post-consensus safety filter
  before application. Generic auxiliary/function carriers, suspicious same-word
  stacking, and any positive per-book `placementRiskCount` delta should be held
  for review instead of silently promoted. Same-word stacking review must inspect
  the Strong witnesses before deciding which side to keep.
- Prefer internal-agent gap-review batches by chapter when the target is to place Strong codes already present as advanced empty/technical annotations. Chapter packets preserve local context while keeping the decision surface small. Use the benchmarked combo A by default: `gpt-5.4-mini medium` + `gpt-5.5 low` as proposers and `gpt-5.5 medium` as arbiter. Keep `gpt-5.5 high` for quality-reference runs, escalation, or explicit experiments.
- Do not send agents a free-form "find the best word" task. Use `strong:review:gaps:packet` so they see blocked/occupied/open/nearby targets and can avoid false multi-Strong stacking.
- Treat suspicious stacking as low-confidence unless it is mechanically invalid. If a proposed word target already carries a different reader Strong and another open content target exists, the arbiter should either choose the open target or output a low-confidence `empty`/`word` decision with the warning preserved.
- For reference-style candidates, prefer `empty` over `reject` when the Strong is valid but unrendered in the target French. Place the empty tag according to `sourcePlacement.insertAfterWordIndex` and keep the reason auditable. Do not leave valid reference-style candidates as final pending. Reject only token-index drift, invalid Strong ids, duplicate over-tagging, or candidates that are not actually supported by the verse/reference inventories.
- Keep generated copyrighted/full Bible outputs in `outputs/`; do not commit them.

## When More Detail Is Needed

Read [references/workflow.md](references/workflow.md) for:

- command matrix;
- metrics interpretation;
- LLM transfer evaluation;
- full gold evaluation reporting;
- quality gates;
- expected reports and final response checklist.

Read `docs/best-strong-generation-workflow.md` for the current research-based recommendation: deterministic canonical ledger first, LLM only for bounded review.
