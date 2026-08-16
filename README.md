# Bible Lexicon Maker

Utilities for building Bible lexicon data from Bible JSON files and Strong CSV
files.

## Setup

```sh
npm install
```

## Recommended Workflow

### Versioned Resource publication bundles

Bible Lexicon Maker is the official producer of the handoff consumed by the
Bible Strong Resource service. A Bible publication bundle contains the
canonical import JSON and the exact matching ZIP Offline copy under one
immutable, content-derived revision. Rights and Online/Offline delivery
capabilities remain independent and are validated before a bundle is written.

Build the exhaustive ordinary-Bible handoff directly from the current mobile inventory:

```sh
npm run resources:publication:bibles -- \
  --output outputs/releases/ordinary-bible-publications-current \
  --generated-at 2026-08-16T00:00:00.000Z
```

This produces exactly 47 version directories. Each contains canonical import JSON plus the current
mobile ZIP byte-for-byte; legacy pericope and red-word entries are projected into canonical
presentation and verified for complete parity. Restricted publications declare local-development
access without enabling public Online delivery.

After generating a canonical Bible JSON, build the LSG bundle with:

```sh
npm run resources:publication:bible -- \
  --canonical outputs/releases/<release>/bibles/bible-lsg.json \
  --metadata config/resource-publications/lsg.json \
  --output-dir outputs/publications/lsg-<revision>
```

The output directory is an explicit repository-to-repository handoff. Pass it
to Bible Strong without making the Resource service inspect this working tree:

```sh
RESOURCE_PUBLICATION_BUNDLE=/absolute/path/to/lsg-<revision> yarn resources:dev
```

Validate a received or archived handoff independently with:

```sh
npm run resources:publication:bible -- validate \
  --bundle /absolute/path/to/lsg-<revision>
```

Publish the French Nave topical resource from its authoritative SQLite source
with the same handoff contract:

```sh
npm run resources:publication:nave -- \
  --sqlite /absolute/path/to/nave-fr.sqlite \
  --metadata config/resource-publications/nave-fr.json \
  --output-dir outputs/publications/nave-fr-<revision>

npm run resources:publication:nave -- validate \
  --bundle /absolute/path/to/nave-fr-<revision>
```

The Nave producer derives the immutable revision from the ordered topics and
verse anchors, embeds matching provenance in the Offline SQLite copy, and
validates canonical-to-SQLite parity before completing the handoff.

Publish all 12 cataloged Strong Bible indexes from the current authoritative
SQLite archives and pair each one with the exact ordinary-Bible revision:

```sh
npm run resources:publication:strong-bibles -- \
  --bible-bundles-dir outputs/releases/ordinary-bible-publications-current \
  --output-dir outputs/releases/strong-bible-publications-current \
  --generated-at 2026-08-17T00:00:00.000Z

npm run resources:publication:strong-bibles -- validate \
  --bundle /absolute/path/to/strong-bible-publications-current/lsg
```

The producer downloads the exact sources declared by the mobile inventory,
proves the builder/source/text revision chain, derives a canonical Strong index
from every SQLite, and validates exact JSON/SQLite parity. Each manifest
declares its required Bible text revision and SHA-256 plus the Strong lexicon
module needed for lexical details. It refuses partial catalogs, unknown dataset
identities, stale Bible dependencies, corrupt SQLite files, and malformed or
multi-entry ZIP archives.

The command refuses to replace an existing output directory. Rebuild into a
new directory for every immutable revision. Production upload or activation is
not performed by this command. This per-Resource bundle is the canonical
handoff into PostgreSQL; it does not replace the global mobile release catalog.
Before any public Offline-copy activation, feed the bundle's exact archive into
the source override for `resources:release:mobile`, rebuild the exhaustive
catalog, and publish that catalog last as described below.

### Complete mobile resource release

The mobile release inventory is owned by
`config/mobile-resource-inventory.json`. It lists every downloadable Bible,
SQLite database, timeline JSON, Strong sidecar, interlinear index, and modular
lexicon resource. Every published artifact is a ZIP containing its declared
entries. Legacy Bible artifacts group the canonical text with their optional
pericope and red-word JSON files.

Build a complete candidate and its global catalog with:

```sh
npm run resources:release:mobile -- \
  --output-dir outputs/releases/mobile-resources-<revision> \
  --app-root ../bible-strong-app
```

When a producer has just generated new local bytes, pass a JSON override map so
the global release is built from that exact candidate instead of the currently
deployed object:

```sh
npm run resources:release:mobile -- \
  --output-dir outputs/releases/mobile-resources-<revision> \
  --source-overrides outputs/releases/source-overrides.json \
  --app-root ../bible-strong-app
```

The override shape is `{ "bible:NBS": { "canonical": "path/to/new.json",
"pericope": "path/to/pericope.json", "redWords": "path/to/red-words.json" } }`.
Every resource-producing release must finish through this global command.

The command downloads the current sources, wraps historical plain JSON/SQLite
files in deterministic ZIP archives, validates existing archives, and emits
the canonical `mobile-resource-catalog.json` plus `SHA256SUMS`. Upload that
exact catalog to `/manifests/mobile-resource-catalog.json` after every ZIP has
been uploaded and verified. The build fails on duplicate identities,
duplicate artifact URLs, roles or entries, non-ZIP targets, or an unexpected archive entry. A
resource publication must update the inventory when its source or artifact
path changes and rebuild this complete catalog; publishing a resource without
the matching catalog is incomplete.

The command only creates a candidate. Upload/activation remains a protected
publication step and must place every candidate file at the catalog's stable
object path before replacing the global catalog. `--app-root` atomically
synchronizes the same catalog into the app fallback asset; omitting it is appropriate
only for an isolated maker validation build.

Generate the canonical Strong ledger first. This is the production source of
truth and includes both `reader` and `advanced` views:

```sh
npm run strong:generate -- --bible nbs
```

Export either view from the canonical ledger:

```sh
npm run strong:export -- --bible nbs --view reader
npm run strong:export -- --bible nbs --view advanced
```

Evaluate reader-style output against masked gold Strong Bibles:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000
npm run strong:evaluate -- --gold Darby --limit 1000
npm run strong:evaluate -- --gold DarbyR --limit 1000
```

Report how much of `Sg1910`, `Darby`, and `DarbyR` is represented by the
canonical ledger:

```sh
npm run strong:report:references -- --bible nbs
```

For semantic gaps that remain in the ledger, build a constrained review packet
before using any LLM. For production-scale review, inspect a stable plan before
running the transactional batch:

```sh
npm run strong:review:gaps:batch -- --bible nbs --lexical-report outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-all.json --output-root outputs/gap-review/nbs/<run> --plan-only
npm run strong:review:gaps:batch -- --bible nbs --lexical-report outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-all.json --output-root outputs/gap-review/nbs/<run> --skip-existing
```

Production application requires the exact same bounded choice from two
distinct models, the current lexical safety filter, a version-2 contract, and
the batch write lock/transaction. Direct
`strong:review:gaps:apply --apply` is intentionally refused outside that batch;
`--finalize-reference-style` is preview/validation only.

For residual hard verses, use LLM review as a bounded suggestion workflow:

```sh
npm run strong:review:llm -- --bible nbs --diagnostics outputs/llm-books/nbs/Gen/bible-nbs-strong-diagnostic.hard-verses.json --review outputs/llm-books/nbs/Gen/llm-review-nbs-Gen.json --only Gen
npm run strong:llm:transfer -- --source Darby --target nbs --only Gen.1 --limit 5
```

Useful development commands:

```sh
npm run viewer
npm run build
npm run typecheck
npm run lint
npm test
npm run format
```

## Concepts

There is one intended production artifact:

```text
outputs/strong/<bible>/bible-<bible>-strong.sqlite
```

That canonical SQLite ledger records each verse and Strong annotation with
placement, visibility, source, confidence, diagnostics, and reason.

Use both masked-gold evaluator backends after alignment changes:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold Sg1910 --limit 200 --backend canonical
```

Two views are derived from it:

- `reader`: readable Strong tagging for normal use;
- `advanced`: fuller study view with empty, technical, duplicate, and
  original-complete annotations.

Legacy command aliases were removed. Use the `strong:*` command surface.

## Review

LLM review should not generate a Bible directly. Work from deterministic
evidence: a hard-verse file, a gap-review packet, or a masked-gold transfer
experiment. Accepted decisions must be validated and saved as curated overrides.

Plain historical `semantic-refill:llm` and
`semantic-refill:llm-reference-style` records stay quarantined. Only
`semantic-refill:llm-consensus-filtered` is eligible for production. To audit
old two-model artifacts, run `strong:review:gaps:migrate-artifacts` without
`--apply` first, inspect the report, then explicitly rerun with `--apply`.

`npm run viewer` builds and starts the local UI server. `/viewer/` now reads the
canonical SQLite ledger by chapter, so it cannot silently fall back to stale
split JSON. `/viewer/review.html` is a read-only quality cockpit for current
target drift, witness-review decisions, the stable LLM plan, applied consensus
overrides, and quarantined history. It distinguishes `accepted-safe` records
from overrides actually present in production. `/viewer/lexicon.html` keeps the
FR/EN Strong lexicon. It reads the enriched
`data/dictionaries/strong_lexicon.en-fr.full.production.sqlite` by default,
including the bilingual STEP meanings and TFLSJ resources. The historical
French Strong remains a separate, collapsible comparison sourced from
`data/dictionaries/strong.legacy.sqlite`. Run `npm run lexicon:v3:enriched` to
rebuild the enriched database, or set `LEXICON_DB` to test another SQLite. The
legacy human-approved review form remains available from the
quality cockpit, clearly separated from the transactional v2 batch.

## Reports

- `reports/strong-diagnostic-report.md`: diagnostic pipeline status and metrics.
- `reports/strong-gold-evaluation-report.md`: masked-gold evaluation on
  `Sg1910`, `Darby`, and `DarbyR`.
- `reports/llm-hard-verse-review.md`: bounded LLM review on true hard verses.
- `reports/strong-bible-project-history.md`: historical record of the pipeline,
  including gap-review agent workflows.

## Data

- `data/bibles/`: Bible translations in JSON format.
- `data/strongs/`: Strong source files in CSV format.
- `data/dictionaries/`: local Strong/STEP dictionaries.

Generated Bible outputs are written to `outputs/` by default. This directory is
ignored by Git because generated Strong-tagged Bible text is a local artifact.
