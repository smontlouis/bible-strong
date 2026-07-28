# Bible Strong BCV parser snapshot

This package is the runtime subset of `~/Projects/new-bcv-parser` used by Bible Strong.
It contains the shared ESM parser and the French and English language definitions.

The snapshot was copied from upstream commit `4eb78e1d56ba94e76a5c4524a8bef0788674dbe3`
with the local strict book matching and book-regexp prefilter changes applied. Update this
directory from the generated `esm/` output whenever those parser sources change.
