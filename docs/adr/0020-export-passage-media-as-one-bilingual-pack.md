# ADR 0020: Export passage media as one bilingual pack

## Status

Accepted

## Context

The BibleProject curation workspace contains raw YouTube inventory, rejected videos, transcripts,
editorial evidence, human decisions, localized editions, and reviewed Bible or Strong anchors. The
application only needs the publishable subset. Bible Strong exposes these resources for free and its
route language determines which localized edition is visible.

Separate French and English artifacts would duplicate work identity, anchors, indexes, and release
metadata. They would also make it easier for the two catalogs to drift.

## Decision

Publish one deterministic `passage-media` pack containing both French and English editions under a
shared work. A work stores its localized editions in an object keyed by `fr` and `en`. The runtime
resolves only the current application language; a missing edition is hidden and never replaced by the
other language.

The pack contains reviewed works, localized YouTube metadata, categories, series, placements, Bible
anchors, Strong anchors, BibleProject attribution, and derived chapter, Strong, and library indexes.
It declares `access: free`. It does not contain raw inventory, rejections, transcripts, agent
rationales, review provenance, or media files.

Generation produces three files under `dist/passage-media/`:

- `passage-media.json`: the application payload and runtime indexes;
- `catalog.json`: revision, checksum, byte size, language policy, and publication counts;
- `publication-report.json`: deterministic validation results for the release.

The revision is a SHA-256 digest of the canonical payload before the revision field is added. The
catalog separately records the SHA-256 digest of the final artifact.

## Consequences

- Work identity and anchors have one source of truth for both languages.
- The Bible View can look up resources by chapter without scanning every anchor.
- Strong screens and the library have dedicated indexes.
- A route never displays a video in the wrong language.
- Updating the curation requires regenerating and validating the production pack.
- Videos remain hosted by YouTube; the app stores only metadata and embed/source identifiers.
