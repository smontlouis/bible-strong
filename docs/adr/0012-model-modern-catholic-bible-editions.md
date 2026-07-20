# ADR-0012: Model modern Catholic Bible editions explicitly

## Status

Accepted

## Context

Bible Strong already assigns stable numeric identities 67–73 to Tobit, Judith, Wisdom, Sirach,
Baruch, 1 Maccabees, and 2 Maccabees. Several installed French editions were historically generated
with only the 66 Protestant books even though their Bible.com sources expose these seven books.
Leaving those editions on the implicit Protestant canon prevents their installed coverage from
surfacing deuterocanonical content.

The Catholic editions do not all expose additions to Esther, Daniel, and Baruch in the same way.
Silently treating all five sources as one versification would hide those source differences.

## Decision

Add `catholic-73` as the canon of BCC1923, BFC, FRC97, NFC, and PDV2017. Its order follows the modern
Catholic order published by these sources and retains stable Bible Strong book identities 1–73.
Installed resource coverage remains authoritative for the chapters and verses that can actually be
opened.

BFC, FRC97, NFC, and PDV2017 explicitly retain `bible-strong-default` versification. Their separate
Bible.com Greek Esther or Daniel alternatives are not merged automatically; import manifests must
record any unused alternatives.

BCC1923 uses `bible-strong-catholic-extended-esther-daniel`: its Greek Esther and Daniel sources are
mapped to the existing Esther and Daniel identities while preserving their 16 and 14 chapters.
Bible Strong does not infer equivalence between these locations and another versification.

When a source publishes the Letter of Jeremiah as a separate book, the import representation maps it
to Baruch 6. A source that does not publish that text, such as BFC 63, retains five Baruch chapters;
coverage exposes that difference instead of fabricating content.

Bible.com generator outputs and manifests are audited import candidates. Canonical publication,
revision metadata, rights controls, and CDN activation remain governed by ADR-0010 and are outside
the generator.

## Consequences

Book selectors can expose all installed deuterocanonical books in these editions without changing
global verse identities. Version comparison remains location-based and does not claim semantic
cross-versification equivalence. Future mappings of separate Esther or Daniel additions require an
explicit versification decision and tests.
