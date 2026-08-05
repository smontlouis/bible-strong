# BibleProject research corpus

Generated on 2026-08-05 through YouTube Data API v3 by:

```bash
yarn bible-project:collect
```

The command reads `YOUTUBE_API_KEY` from the environment or the ignored root `.env` file. The
key is never written to the generated files. `YOUTUBE_DATA_API_KEY` remains accepted as a CI alias.

This directory is an authoring/research corpus. It is not bundled by the app and is not yet the runtime manifest.

## Files

- `source-snapshot.json`: all public channel uploads, official playlists and membership, full public provider metadata, embed dimensions and orientation, playback eligibility, related video IDs, and Scripture references detected in titles/descriptions.
- `catalog.json`: normalized research view with category, proposed viewer suitability, 9:16 detection, plan occurrences, and known localization counterparts.
- `localization-candidates.json`: up to eight ranked English counterparts for every French video, with scores, reasons, and explicit confirmation status.
- `anchor-candidates.json`: exact title references, description references, inferred book scopes, and plan reading contexts kept as distinct provenance levels.
- `book-overview-manifest.json`: the reviewed 73-work editorial manifest for book and Testament overviews, with strict-language editions and publishable book/section anchors.
- `book-overview-audit.json`: exhaustive source assignment, edition counts, and per-language canonical book coverage for the overview manifest.
- `visual-commentary-manifest.json`: 24 reviewed passage works and 42 localized editions, including one reconciled cross-category French edition, with exact verse ranges, strict-language book/chapter indexes, and first-party source pages.
- `visual-commentary-audit.json`: exhaustive assignment of the 44 source records, including one trailer, two vertical editions, and every intentionally missing localized edition.
- `word-study-manifest.json`: 20 lexical works plus one shared visual/lexical work reference, covering 42 bilingual editions with reviewed Strong, family, composite, and primary-passage anchors.
- `word-study-audit.json`: complete reconciliation of the 41 primary-category records and the one cross-category English edition, with Strong and binding-type coverage.
- `theme-manifest.json`: 57 reviewed thematic works and 111 localized editions for Bible View chapter resources, with primary placement indexes kept separate from related passages.
- `theme-audit.json`: exhaustive assignment of all 126 primary-category records, 22 explicit exclusions, seven reconciled cross-category editions, and strict-language coverage.
- `transcript-index.json`: acquisition audit for the 173 unplaced, non-rejected candidates. YouTube captions cover 170 records; the other three currently report a missing track, an offline provider video, or a provider access error.
- `anchor-dossier-index.json`: deterministic transcript/reference extraction summary with timestamps, metadata signals, local dossier paths, and coverage totals. Full transcripts stay in the ignored `.scratch/generated/` cache.
- `anchor-agent-reviews/`: versioned editorial inputs produced by the three agent review batches and cross-audited before aggregation. Keeping these decisions in the corpus makes `anchor-proposals.json` reproducible on a clean clone without the transcript cache.
- `anchor-proposals.json`: one agent-proposed primary target for every candidate, with confidence, rationale, short evidence, and explicit `agent-proposed` review status. It currently contains 85 passage targets, 26 book targets, and 62 honest library fallbacks; confidence is high for 145 records, medium for 22, and low for six.
- `presentation-data.js`: generated, browser-readable projection of the baseline 174 reviewed works, 338 editions, and all 795 inventory records used by the interactive research atlas. Before local review overrides, its Rejets view contains the 284 unique videos covered by an explicit editorial exclusion or by the reviewed vertical-9:16/Studio policies; overlapping reasons remain visible. Inventaire brut then contains the other 511 videos. Local decisions move records between these views and can also reduce the visible work/edition counts, while the combined inventory/rejection total remains 795. Every inventory record also carries its current disposition: placed, rejected, classified out of scope, inline candidate, related candidate, or awaiting review.
- `audit.json`: coverage and unresolved-review queues.

Open `docs/research/bible-project-presentation.html` to inspect every title, category, localized edition, placement, Scripture or Strong anchor, raw candidate, and rejection. Its chapter simulator previews the resources that Bible View would select for a route language and chapter.

The explorer can move a video between Inventaire brut and Rejets. These review overrides are stored locally in the browser under `bible-project-presentation-decisions-v1`; they do not rewrite generated manifests or audits. Proposed anchors can also be marked valid or needing correction; that separate local review state uses `bible-project-presentation-anchor-reviews-v2` and binds each decision to the exact anchor proposal so regenerated targets cannot inherit stale approval.

The candidate files and reviewed manifests can be regenerated without network access:

```bash
node scripts/derive-bible-project-candidates.mjs
node scripts/derive-bible-project-book-overviews.mjs
node scripts/derive-bible-project-visual-commentaries.mjs
node scripts/derive-bible-project-word-studies.mjs
node scripts/derive-bible-project-themes.mjs
node scripts/derive-bible-project-anchor-dossiers.mjs
node scripts/prepare-bible-project-anchor-agent-batches.mjs
node scripts/aggregate-bible-project-anchor-proposals.mjs
node scripts/generate-bible-project-presentation-data.mjs
```

Caption acquisition is the only network-dependent step after catalog collection:

```bash
yarn bible-project:transcripts
```

It downloads caption JSON into ignored `.scratch/generated/bible-project-transcripts/` files so agent analysis does not need to fetch the same transcript twice. A diagnostic `--limit=N` run writes its partial index under `.scratch/generated/` and never overwrites the canonical audit. Full transcripts, videos, audio, posters, and thumbnails are never versioned or bundled. The versioned indexes retain hashes, counts, extracted references, short evidence, and provenance; thumbnail values remain remote provider URLs.

## Confidence boundaries

- Channel and playlist membership are source observations at `generatedAt`.
- `planOccurrences.references` describe the reading scheduled beside a video; they are not automatically the video's semantic Scripture anchor.
- `referenceMentions` are candidates detected from publisher metadata. They require editorial review before becoming inline anchors.
- `localizedCounterpartIds` currently come from matching days in the existing FR/EN plans. Pairing accepts only videos that belong to the expected language channel, and `audit.json.pairingCorrections` records the known French Apocalypse 1-11 plan correction. Shared English IDs used by French plan days remain visible as plan occurrences but are not promoted to localized counterparts.
- `category` and baseline `suitability` are deterministic classifications from official playlist membership, title signals, and embed geometry. Vertical 9:16 and Studio records are explicit rejections. Other non-placed records, including podcasts, Classroom, uncategorized videos, and records needing further review, remain associated-resource candidates until a human accepts an anchor or rejects the video.
- `anchor-proposals.json` is research output, not a publishable manifest. Transcript frequency is evidence, not authority: every proposal must be accepted or corrected before it can populate a Bible View index.
- `metadataStatus: complete` means the item was returned by the official videos endpoint during the same refresh. Generation fails instead of publishing a partial snapshot when an upload lacks metadata, embeddability, or Made-for-Kids state.
- `embedWidth`, `embedHeight`, `aspectRatio`, and `orientation` come from the provider player endpoint. `embeddable`, `madeForKids`, `captionsAvailable`, and `regionRestriction` are provider states, not editorial recommendations. They must be checked again after `refreshDueAt`.

## Refresh constraints

The collector uses the official YouTube Data API with a private local/CI secret. It inventories each channel through its uploads playlist, lists every public playlist, then fetches video metadata in batches of 50. The generated `refreshDueAt` is 30 days after collection because YouTube-derived presentation metadata must follow YouTube's current storage/refresh policy. Durable passage anchors, work IDs, localization pairs, and editorial categories must come from BibleProject pages/guides, an approved BibleProject feed, or human review rather than engagement metadata.

The app must embed or link the hosted video, keep it outside any paywall, display the required BibleProject attribution nearby, and never re-host or modify the media.
