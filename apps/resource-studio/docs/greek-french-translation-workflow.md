# Greek lexicon French translation workflow

This workflow translates only the French fields that are blank in the Greek
lexicon reorganization candidate. It never edits the production lexicon or the
TIPNR entity database.

## Immutable parent contract

Every translation is attached to one deduplicated English parent by SHA-256.
The batch input retains:

- the exact English HTML and plain text;
- the parent hash;
- every target entry/resource ID;
- every target lexicon key.

A translation output must copy `parentHash` and `englishHtml` exactly. Changes
to the English parent require a new batch and invalidate the old translation.

## Translation rules

- Translate faithfully into clear, natural French without adding an
  interpretation or editorial synthesis.
- Preserve Greek, Hebrew, Strong codes, numbers, Bible references and
  abbreviations.
- Preserve the exact ordered sequence of HTML tags and their attributes.
- Translate text nodes only.
- Do not silently reconstruct a truncated or malformed source. A natural
  rendering of an obvious concatenation is allowed, but it must not add facts.
- Keep lexical lists as concise lists; keep full Abbott-Smith notices as
  dictionary prose.

## Output and review

Initial agent output uses `reviewStatus="translated"`. It is immutable after
the structural validator accepts it. Cross-review is recorded separately so
that the original translation, reviewer decision and any correction remain
auditable.

No SQLite merge is allowed until:

1. every expected parent has exactly one translation;
2. structural validation has no issue;
3. every translation has an independent review decision;
4. corrected translations pass the same structural validation;
5. the candidate English parent hashes still match the batch manifest.

The final merge writes a new candidate database. It does not overwrite the
English reorganization candidate or the production database.

## Modular SQLite release

After validating and merging the bilingual candidate, download or verify the
two compiled STEP lexicons and rebuild the exhaustive relation graph:

```sh
npm run lexicon:step:compiled
npm run lexicon:relations:enrich:candidate
```

Both files are pinned by commit and SHA-256. Relation enrichment refuses a
missing or mismatched source. It imports `@StepRelatedNos2`, preserves typed
identity relations, resolves classical legacy targets to canonical STEP
entries when possible, and writes a provenance row for every relation.

Then publish the mobile modules:

```sh
npm run lexicon:greek:translate:release
```

The command atomically publishes
`outputs/releases/strong-lexicon-modular-v2-greek-french-step-related/` with:

- `strong_lexicon.core.sqlite` and its deterministic ZIP;
- `strong_lexicon.resources.sqlite` and its deterministic ZIP;
- `bible_entities.production.sqlite` and its deterministic ZIP;
- `catalog.json`, sealing the source candidate, hashes, counts and revision;
- `SHA256SUMS`.

The core and resources modules are projected from the reviewed bilingual
candidate. The entities module is copied byte-for-byte from the existing TIPNR
production database. The command validates every SQLite file, the projection
fingerprints, the TIPNR copy hash, resource links and archive contents. It also
refuses an existing destination directory.

Schema version 2 marks the relation-aware core/resources publication. The
mobile application keeps the complete relation graph but moves
`same_estrong` targets into the meaning section and removes repeated targets
from the related-words presentation.
