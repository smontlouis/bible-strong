# ADR-0018: Model the complete ThéoTeX Septuagint canon

## Status

Accepted

## Context

The ThéoTeX Septuagint contains the Catholic Old Testament, Psalm 151, and four works that do not
have identities in Bible Strong's Catholic canon: 1 Esdras, 3 Maccabees, 4 Maccabees, and the
Psalms of Solomon. Verse identities are durable user-data keys, so these books cannot borrow an
existing identity or be assigned differently by each importer.

## Decision

Keep IDs 1–73 unchanged. Assign stable IDs 74–77 as follows:

| ID | Book |
|---:|---|
| 74 | 1 Esdras |
| 75 | 3 Maccabees |
| 76 | 4 Maccabees |
| 77 | Psalms of Solomon |

Declare `theotex-septuagint` as the canon and versification of `LXX`. Its book order follows the
ThéoTeX source rather than numeric identity. Split canonical 2 Esdras into Ezra (15) and Nehemiah
(16). Store the Letter of Jeremiah as Baruch 6, Susanna as Daniel 13, and Bel and the Dragon as
Daniel 14. Preserve Psalm 151 as a chapter of Psalms and the Sirach translator's prologue as
Sirach 52. The already-finalized `LXX_FR` resource is outside this generation pipeline.

Bible Strong's numeric verse model cannot represent ThéoTeX's alphanumeric subdivisions or verse
bridges as separate durable identities. Fold subdivisions such as `1a` and `1b` into numeric verse
1 with visible `(a)` and `(b)` labels. Store a bridge such as `1-2` under its first numeric verse
with a visible `(1-2)` label. This preserves all source text and source labels, but the folded
subdivisions are not independently addressable.

Generate two Greek artifacts from the same validated extraction: a legacy bare JSON object and a
Schema V4 `bible-strong-canonical-bible` JSON wrapped in a deterministic ZIP. Use
`bible-lxx.json` as both the legacy filename and the ZIP entry, with `bible-lxx.json.zip` as the
canonical archive filename. Record source, text, content, and archive checksums in a provenance
manifest. Generation does not publish or activate the resources.

The live HTML snapshot is mutable. Pin its complete ordered-page checksum in the generator and
reject any change until the new source has been reviewed. The Bible Strong project owner confirmed
redistribution authorization on 2026-08-04, so the manifest permits both Online and Offline
delivery and records that confirmation as its terms reference.

## Consequences

The app can navigate and search all works published in the ThéoTeX Septuagint without changing
existing verse identities. Other Bible versions do not expose IDs 74–77 unless their declared
canon and installed coverage include them. Strong's Hebrew/Greek testament routing remains
undefined for these additional works because their book identity does not imply a Strong dataset.
