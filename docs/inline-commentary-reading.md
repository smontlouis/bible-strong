# Inline commentary reading

Implementation status: in development; no production migration, resource publication
or application update has been issued for this feature.

## Reader behavior

Bible settings select up to five inline commentaries from the user's existing
commentary selection. EGW Writings is excluded from inline eligibility: it remains
available in the general commentary/resource surfaces. The same eligibility rule
filters the settings list and normalizes saved selections before any reading
request, including settings restored from another device. SDABC remains eligible;
this exclusion targets the separate EGW Writings collection only.
Removing a commentary from the master selection also removes it
from inline reading. Enabling a commentary never downloads an entire resource.
The selector shows whether an Offline copy is installed and exposes the existing
explicit download flow on native platforms.

During chapter reading, only section identifiers, verse ranges and plain-text
excerpts are loaded. Sections sharing a resource and last visible covered verse are grouped into one
chip, with a count when several sections are available. Opening that group lists
its excerpts; full text is fetched only after selecting a section. Only the chip
summary crosses the Bible DOM bridge. Introductions appear before the chapter and are omitted in focused passage
mode. EGW reading groups are split at gaps in their source associations.

Opening a chip requests its complete section using the same resource, language,
revision, chapter and section identifier. The existing contextual panel on Web
and native sheet show the excerpt while loading or when full content is unavailable.
The reader never silently substitutes another revision's text.

## Online and offline data

- `POST /v1/commentaries/reading-index` accepts one chapter and up to five
  resources. Each resource can succeed or fail independently. It selects only
  index columns from PostgreSQL. The HTTP response uses `no-store`; client queries
  and the revision-bound persistent cache provide reuse.
- `POST /v1/commentaries/reading-section` requires an exact revision and section
  identifier. Unpublished staged revisions are not readable. A missing/deleted
  revision returns not-found; there is no active-revision fallback.
- New Offline copies contain `COMMENTARY_READING_SECTIONS` and its chapter index.
  This table contains only positions and excerpts. Full content is reconstructed
  from the existing local chapter source only when opening a section, so the
  complete work is not duplicated inside its download. Online section delivery
  retains a materialized body for one direct, revision-bound request.
- Existing Offline copies keep their original checksummed bytes. On first reading
  of a chapter, the application builds a revision-bound JSON sidecar next to the
  installed resources. Subsequent index reads use that sidecar. Opening full text
  still works from the original local data. Revision replacement during migration
  invalidates the result.
- The persistent online index cache stores previews, not a complete Offline copy.
  Cached previews alone cannot guarantee full-text access without connectivity.

The service's existing importer removes prior publication rows when replacing a
resource. Consequently, an old cached index may receive not-found after a resource
update. The sheet keeps its excerpt and offers an explicit chapter-index refresh;
the user can then open a chip from the new index. It never automatically opens a
different edition. This preserves correctness without retaining every historical
publication. Installing/removing an Offline copy also refreshes the chapter index.

## Publication contract

Shared section construction belongs to `resource-domain`. Studio packaging,
service importing, parity validation and native legacy migration use the same
reading projection. Canonical publications declare `readingIndexVersion: 2` and
include that algorithm version in the content-derived revision hash. Future
algorithm changes require a new version and compatible readers/importers.

Bundle validation reconstructs the projection from canonical data and checks all
SQLite section IDs, ranges, excerpts and total row counts, plus the full text in
the original source tables. Legacy bundles
without the version marker remain readable under their existing contract; they
do not prove that a prebuilt reading index exists.

Migration `0034_commentary_reading_index.sql` adds the service projection table.
Existing imported publications are not backfilled automatically. An operator can
prepare their derived online projection without changing source rows, artifact
hashes or revision metadata. Run a dry-run for one explicit identity first:

```sh
yarn workspace @bible-strong/resource-service exec tsx src/publication/commentaryReadingBackfillCli.ts --resource-id MHY --language fr
```

`--apply` writes the projection atomically while locking the source publication;
`--mode hosted` requires an explicit direct `RESOURCE_DATABASE_URL` and the usual
authorized production procedure. Dry-run is the default. Tests verify dry-run,
repeat application and unchanged publication metadata. This command has only been
tested locally, not applied to production. New offline artifacts still require
new validated revisions and differential publication through the Resource service.
Deploying the app alone cannot enable online indexes on an unmigrated service.

## Measurements and release gates

The excerpt limit is 160 UTF-16 code units. There is **no chapter-wide cap on
section count**: all identifiers and ranges are retained, including sections near
the end of long chapters. A proposed cap of 30 sections was rejected because it
would remove useful coverage. Grouping chips does not discard their sections.

Measurements now use the existing, checksum-verified published R2 copies, without
reacquiring source websites. All 36 commentary archives were recovered, indexed,
packaged, parity-validated and imported into the dedicated local PostgreSQL
instance. None of these new bundles has been published to production.

| Published source | Median index bytes | p95 bytes | Maximum bytes | Largest chapter |
| --- | ---: | ---: | ---: | --- |
| Bible annotée FR | 4,388 | 9,081 | 21,688 | Psalm 119, 95 sections |
| SDABC FR | 5,367 | 11,383 | 39,956 | Psalm 119, 172 sections |
| EGW | 7,009 | 71,471 | 314,583 | John 1, 1,238 sections |

For the 35 currently inline-eligible published resources (excluding EGW Writings),
the largest measured chapter index is Barnes FR, Psalm 119: 176 sections,
44,398 bytes (13,398 gzip bytes). Its cache value is 87,060 estimated bytes.
Thus the 160-character excerpt limit retains complete coverage at modest size for
the current eligible catalog. The sum of the five largest per-resource maxima is
208,524 bytes before the batch envelope; this is a conservative upper bound, not
a measured single-chapter batch. See `inline-commentary-eligible-catalogue.json`.

These payloads include positions and excerpts, not full commentary bodies.
Measured gzip sizes of the BA and EGW maxima are 7,062 and 61,430 bytes;
these are compression measurements, not proof of deployed HTTP compression.
A commentary section can cover multiple verses, so section counts need not equal
verse counts. EGW can associate many distinct source sections with the same verses.

EGW John 1 groups into 36 chips without dropping any of its 1,238 sections; the
serialized Bible DOM summaries occupy 13,305 bytes. The persistent cache permits
1,000,000 estimated bytes per entry, 8,000,000 bytes total and 160 entries, evicting
older writes. The largest serialized index across the 36 prepared copies uses
621,656 estimated bytes (UTF-16 storage accounting), within that per-entry bound.

Native reads of normalized offline sources reuse each document instead of joining
its HTML repeatedly for every association. An exhaustive comparison across EGW's
1,120 chapters and 85,014 sections found identical IDs, ranges, excerpts and bodies
against the prior materialized projection. For John 15, source graph serialization
was 3,230,576 bytes versus 17,633,736 bytes of repeated chapter bodies. These are
desktop measurements, not device peak-memory or latency measurements; the source
bodies are still read only when opening full text or migrating an old offline copy.
Reports are in `docs/measurements/inline-commentary-*.json`.

Run the reproducible measurement on a verified local SQLite artifact:

```sh
yarn workspace @bible-strong/resource-studio exec tsx src/measureCommentaryReadingIndex.ts /absolute/source.sqlite /absolute/report.json
```

The script hashes the source, works on a disposable copy, and reports added SQLite
bytes, generation time, chapter payload sizes before/after gzip, worst chapters and
the lookup query plan. Timings describe desktop SQLite, not mobile/network latency.
It verifies that the source bytes remain unchanged. Fixture tests validate the
measurement mechanism; fixture results are not representative corpus measurements.

Before release: complete user-flow validation and deployment readiness, and follow the authorized
Resource publication procedure. Progress and test evidence are recorded in
`plans/inline-commentary-index.md`.
