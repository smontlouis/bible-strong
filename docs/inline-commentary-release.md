# Inline commentary release candidate

Status: prepared locally, not published. Production authorization, a clean pinned
code revision and live release preflight are still required. This document is not
an activation record.

## Scope and evidence

`measurements/inline-commentary-release-manifest.json` selects exactly 35 changed
commentary identities. Each entry records its bundle directory, new revision,
archive SHA-256, immutable R2 key and previous revision/key for recovery. The
archives total 217,015,946 bytes. Their on-disk archive hashes and revisions were
checked against both their manifests and the current catalog. No other catalog
identity differs from the recorded base commit.

EGW Writings remains on its previously published catalog/inventory revision. Its
prepared indexed bundle is excluded from release, consistent with its removal
from inline eligibility. Existing reading and resource access remain available.
All candidate sources came from the already-published, verified R2 copies. Do not
run any Internet source acquisition workflow to prepare or recover this release.

The 36 prepared bundles passed canonical/offline parity validation before this
35-resource selection. Full source schemas and data are preserved; SQLite adds
only the reading-index table. Publication revision changes invalidate old query
caches. Existing downloaded copies continue through the per-chapter sidecar path.

## Required sequence

Follow `.agents/skills/resource-publication/SKILL.md`, ADR-0027 and the Resource
service operator documentation. The manifest's base commit is provenance, not
an approved final deploy revision: implementation changes are still uncommitted.

1. Finish native offline QA and final checks. Review/commit the complete feature
   with its catalog, migrations, shared contracts and dependent app changes.
   Release from a clean checkout matching the required remote revision.
2. Re-read active production metadata and verify the selected previous revisions
   and immutable rollback artifacts against the candidate manifest. Abort on
   drift; never replace a newer publication on the strength of an old snapshot.
3. Establish database recovery using the operator's documented backup/baseline
   procedure before production writes. The local `production-baseline.json`
   metadata snapshot is **not** a database backup or a complete rollback bundle.
4. Apply additive migration `0034_commentary_reading_index.sql`. Existing clients
   do not require this table; do not delete old schema or resource data manually.
5. Publish only the 35 selected immutable archives through the differential R2
   command, validate/import their bundles through the Resource service, then
   deploy the Worker with the same catalog and new reading endpoints. Observe the
   operator's activation lock, confirmation and compensation procedures.
6. Verify protected and public endpoint behavior, CORS POST preflight, catalog/
   artifact revision agreement, and a real chapter-index/full-section pair. Include
   BA FR and Barnes FR Psalm 119 through verse 176. Index responses must contain
   no bodies, and section requests must preserve the requested revision and ID.
7. Release the app only after service/artifacts are ready. Verify inline settings,
   lazy full text, explicit offline installation and offline reads with the actual
   installed app. Record precise Worker, database/catalog and app release IDs.

For an online-only rollout of existing revisions, the backfill CLI is available,
but it is an alternative to the new-revision import, not an additional required
pass over all resources. Do not combine both routes without an explicit plan.

## Recovery

Before activation, stop on failed verification; immutable uploaded objects can
remain without exposing a new active revision. After activation, use the operator
compensation path to restore prior Neon publications and Worker catalog together.
Restoring only the Worker leaves index/content revisions inconsistent. Do not
manually delete the newly uploaded R2 objects or drop the additive table.

The existing importer removes replaced publication rows, so an old full-section
request can return not-found after a successful update. The client must keep its
preview and offer a chapter-index refresh, never substitute a different edition
silently. Restoring historical rows requires the verified old publication inputs
or a tested database recovery point, not merely their archive SHA values.

No production migration, upload, activation, Worker deployment or app update has
been executed for this candidate as of this document.
