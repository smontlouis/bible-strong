# ADR-0019: Model passage media as localized works with reviewed anchors

## Status

Accepted

## Context

BibleProject publishes localized French and English videos for many of the same editorial works,
while YouTube IDs and presentation metadata can change independently. Bible Strong needs durable
media identities, predictable discovery in the Bible view, and language behavior that never mixes
resources unexpectedly. A content category such as book overview or word study also does not say
where that content belongs in Scripture.

## Decision

Model each editorial concept as a provider-independent Passage media work. Model each localized
realization as a Passage media edition with the durable identity `<work-id>:<language>` and keep its
provider and provider ID as replaceable hosting details. The initial BibleProject integration
supports only French and English. Select editions strictly from the application or route language;
never fall back from French to English or from English to French.

Keep content category separate from Passage media anchors. Anchors target books, passages, verse
ranges, Strong entries, or related study contexts and declare placement, relevance, review status,
and provenance. Only reviewed anchors are publishable. For reviewed book overviews, a full-book
anchor uses `book-intro`, the first section of a split book also uses `book-intro`, and each later
section uses `before-range`. Testament-wide overviews remain `library` resources rather than being
repeated on every book or chapter.

## Consequences

A provider video can be replaced without changing the identity of the edition or work. French and
English catalogs can legitimately have different coverage; for example, Philippians remains absent
in French even though an English edition exists. Viewer queries can use language-specific indexes
without implementing fallback logic. Adding another language requires an explicit product decision
and new editions, not an automatic reuse of English. Editorial review is required before inferred
book, passage, verse, or Strong relationships become runtime anchors.
