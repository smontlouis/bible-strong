# English Strong Bible rich-source contract

This import stage intentionally precedes application integration. Its purpose is
to retain every useful editorial signal exposed by the unlocked SWORD module,
then measure what each source actually contains.

## Selected sources

The pinned catalog contains KJV, NASB 2020, NASB 1995, BSB, ASV, English
Darby, Revised Literal Translation, Revised Webster, and Revised Version 1895.
There is deliberately no `KJVS` dataset: the product will expose a single KJV
whose Strong layer can be enabled separately.

ESV, WEB Strong, and ABEn are outside this batch. ESV has no authorized rich
text source in the current workspace; the local positional file is not a Bible
text and cannot preserve editorial markup.

## Lossless authoring layer

Each JSONL line is one native-versification verse. Its `text` value is the exact
OSIS fragment returned by the SWORD module with filtering disabled. This keeps,
when present:

- Strong lemmas, source lemmas, morphology, and source-token positions;
- words of Jesus (`q who="Jesus"`), suitable for red-letter rendering;
- section titles and other headings, also projected into a structured
  `headings` array with an `isPericope` classification;
- paragraphs and paragraph milestones;
- poetry lines and line groups;
- translation additions/italics;
- divine-name spans, notes, cross-references, variants, milestones, and every
  original element attribute.

The source fragment remains authoritative. The structured heading projection is
an index, not a replacement for that fragment. Unknown elements are counted in
the manifest and are never silently discarded.

Revised Version 1895 uses NRSVA versification and contains supplemental books.
They are retained in the rich-source JSONL with `canon="supplemental"`. The
66-book product subset is explicitly counted separately.

## Separation from the Strong sidecar

The rich-source JSONL is not the final mobile JSON. A later projection will:

1. convert OSIS presentation elements into the canonical Bible JSON layout;
2. keep headings/pericopes as anchored editorial objects, independent from
   Bible Strong's current pericope model;
3. keep notes and cross-references in canonical JSON;
4. move Strong occurrences and any Strong-coupled linguistic data into the
   separate SQLite sidecar;
5. prove that stripping the sidecar leaves the exact canonical text and
   editorial structure.

No application integration should consume the raw authoring layer directly.

## Reproducible extraction

```sh
python3 -m venv outputs/tools/pysword-venv
outputs/tools/pysword-venv/bin/python -m pip install \
  -r requirements/sword-import.txt
outputs/tools/pysword-venv/bin/python \
  scripts/extract_sword_rich_bibles.py --download
```

Archives are checksum-pinned in
`src/englishStrongSwordSources.json`. Generated texts remain under
`outputs/` and must not be committed.
