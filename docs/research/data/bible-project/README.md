# BibleProject research corpus

Generated on 2026-08-04 through YouTube Data API v3 by:

```bash
yarn bible-project:collect
```

The command reads `YOUTUBE_API_KEY` from the environment or the ignored root `.env` file. The
key is never written to the generated files. `YOUTUBE_DATA_API_KEY` remains accepted as a CI alias.

This directory is an authoring/research corpus. It is not bundled by the app and is not yet the runtime manifest.

## Files

- `source-snapshot.json`: all public channel uploads, official playlists and membership, full public provider metadata, playback eligibility, related video IDs, and Scripture references detected in titles/descriptions.
- `catalog.json`: normalized research view with category, proposed viewer suitability, plan occurrences, and known localization counterparts.
- `localization-candidates.json`: up to eight ranked English counterparts for every French video, with scores, reasons, and explicit confirmation status.
- `anchor-candidates.json`: exact title references, description references, inferred book scopes, and plan reading contexts kept as distinct provenance levels.
- `book-overview-manifest.json`: the reviewed 73-work editorial manifest for book and Testament overviews, with strict-language editions and publishable book/section anchors.
- `book-overview-audit.json`: exhaustive source assignment, edition counts, and per-language canonical book coverage for the overview manifest.
- `audit.json`: coverage and unresolved-review queues.

The two candidate files can be regenerated without network access:

```bash
node scripts/derive-bible-project-candidates.mjs
node scripts/derive-bible-project-book-overviews.mjs
```

No video, audio, caption, transcript, poster, or thumbnail file is downloaded or stored. Thumbnail values are remote provider URLs.

## Confidence boundaries

- Channel and playlist membership are source observations at `generatedAt`.
- `planOccurrences.references` describe the reading scheduled beside a video; they are not automatically the video's semantic Scripture anchor.
- `referenceMentions` are candidates detected from publisher metadata. They require editorial review before becoming inline anchors.
- `localizedCounterpartIds` currently come from matching days in the existing FR/EN plans. Pairing accepts only videos that belong to the expected language channel, and `audit.json.pairingCorrections` records the known French Apocalypse 1-11 plan correction. Shared English IDs used by French plan days remain visible as plan occurrences but are not promoted to localized counterparts.
- `category` and `suitability` are deterministic classifications from official playlist membership and title signals. `review` and `uncategorized` queues are intentionally preserved.
- `metadataStatus: complete` means the item was returned by the official videos endpoint during the same refresh. Generation fails instead of publishing a partial snapshot when an upload lacks metadata, embeddability, or Made-for-Kids state.
- `embeddable`, `madeForKids`, `captionsAvailable`, and `regionRestriction` are provider states, not editorial recommendations. They must be checked again after `refreshDueAt`.

## Refresh constraints

The collector uses the official YouTube Data API with a private local/CI secret. It inventories each channel through its uploads playlist, lists every public playlist, then fetches video metadata in batches of 50. The generated `refreshDueAt` is 30 days after collection because YouTube-derived presentation metadata must follow YouTube's current storage/refresh policy. Durable passage anchors, work IDs, localization pairs, and editorial categories must come from BibleProject pages/guides, an approved BibleProject feed, or human review rather than engagement metadata.

The app must embed or link the hosted video, keep it outside any paywall, display the required BibleProject attribution nearby, and never re-host or modify the media.
