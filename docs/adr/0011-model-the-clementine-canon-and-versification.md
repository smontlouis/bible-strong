# ADR-0011: Model the Clementine canon and versification explicitly

## Status

Accepted

## Context

Bible Strong historically identifies the 66 Protestant books with numeric IDs 1–66. The
Clementine Vulgate contains the 73 canonical Catholic books, integrates additions into Esther and
Daniel, and uses chapter and verse numbering that differs from the application's default
versification. Some printed Vulgates also contain non-canonical appendix material.

Changing existing IDs would invalidate durable verse references and user-owned study data.
Silently reshaping the Clementine text to the default versification would make displayed references
incorrect and would obscure the source edition.

## Decision

Keep the existing IDs 1–66 and assign stable IDs 67–73 to Tobie, Judith, Sagesse, Siracide,
Baruch, 1 Maccabées, and 2 Maccabées. Canon order is independent from numeric identity: selectors
and navigation use the declared `clementine-vulgate` order.

Treat Esther's additions as chapters 11–16 of book 17, Daniel's additions as part of chapter 3 and
chapters 13–14 of book 27, and the Letter of Jeremiah as Baruch 6 in book 71. The initial
Clementine resource contains exactly the 73 canonical books and excludes the Prayer of Manasses
and III–IV Esdras.

Declare `clementine-vulgate` as both the canon and versification of version `VUL`. Preserve its
native references, including Joel in three chapters. Bible Strong does not automatically convert
references between this versification and another version.

Use the public-domain Clementine Text Project transcription at the pinned source revision recorded
by the generator. Import normalization converts source encoding to Unicode, flattens editorial
line-break and poetic delimiters without deleting their text, preserves speaker/acrostic/prologue
labels as plain text, and removes the non-verse Baruch 6 heading. The generator produces a
validated import candidate and provenance manifest; canonical publication and activation remain
governed by ADR-0010.

## Consequences

Existing verse identities remain stable, while a version can expose the Catholic canon in its
proper order. Installed coverage supplies the actual chapter and verse ranges, so Esther, Daniel,
Baruch, and Joel can differ safely from the default catalog counts.

Cross-version comparison can show texts at the same numeric location, but callers must not assume
that those locations are semantically equivalent across versifications. Adding appendix books
later requires separate identities, provenance, and an explicit canon decision.
