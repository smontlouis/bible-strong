# Best Strong Generation Workflow

Date: 2026-06-23

This note records the recommended workflow after checking the current repository,
the local data, the Cambridge article, and the related public projects already
surveyed in `docs/related-work-llm-strong-bibles.md`.

## Short Conclusion

The best workflow is not LLM-first.

Use a deterministic, evidence-led pipeline first:

1. build the verse inventory from original-language sources;
2. transfer obvious Strong tags from local French Strong references;
3. use learned word and phrase lexicons from those references;
4. use translation profiles to control density;
5. write a canonical ledger explaining every Strong occurrence;
6. run evaluation against masked gold Strong Bibles;
7. use LLM only on the residual review queue, with allowed Strong inventories
   and mechanical validation.

The LLM should not invent Strong numbers, should not freely retag a whole Bible,
and should not directly change production data without review or validation.

## Evidence

### Cambridge Article

The Cambridge/Natural Language Engineering article "Automated annotation of
parallel bible corpora with cross-lingual semantic concordance" describes a
pipeline for automated Strong-based annotation of Bible corpora. The relevant
lesson is that the strong baseline uses dictionaries, existing annotated texts,
parallel corpora, SWORD-style resources, and detailed evaluation. It is not a
free LLM generation workflow.

Important consequence for this project: treat Strong generation as a constrained
alignment and evidence problem, then evaluate precision/recall/F1 against known
Strong editions.

### Public Prior Art

- `scruffian/farsi-strongs` is the closest direct precedent: a non-LLM automatic
  Strong transfer pipeline for a Farsi Bible.
- `unfoldingWord/bp-assistant-skills` validates a hybrid architecture: scripts
  for parsable/verifiable work, LLM for semantic judgement, validation, and
  review.
- `Clear-Bible/Alignments` and `biblealignlib` provide the right model for
  alignment data and evaluation discipline.
- `Clear-Bible/macula-hebrew` and `macula-greek` provide rich original-language
  morphology, glosses, syntax, word senses, semantic roles, and participant
  data.
- `STEPBible-Data` provides CC BY 4.0 lexical and morphology data, including
  STEP lexical identifiers that are more precise than classical Strong alone.
- `schierlm/aligned-bible-corpus-data` and `BibleMultiConverter` are useful for
  edition mapping, formats, and export/import workflows.

## Current Repository State

The repository already has the core pieces:

- local French Strong references: `data/strongs/Sg1910.csv`,
  `data/strongs/Darby.csv`, `data/strongs/DarbyR.csv`;
- original inventories from Clear-Bible alignment sources:
  `data/external/Alignments/data/sources/WLC.tsv` and `SBLGNT.tsv`;
- local dictionaries: `data/dictionaries/strong_fr.sqlite` and
  `data/dictionaries/strong_lexicon.full.production.sqlite`;
- diagnostic TSV/hard-verse generation: `strong:diagnose`;
- canonical ledger generation: `strong:generate`;
- reader/advanced exports from the canonical ledger;
- phrase transfer, translation profiles, gap review, curated overrides;
- masked gold evaluation through `strong:evaluate`;
- bounded LLM review and internal-agent gap review.

The main gap: the generation path learns its lexical placement evidence mostly
from the local Strong-tagged references. The French Strong dictionaries and STEP
lexicon are available locally, but they are not yet a first-class deterministic
placement signal in the reader alignment scorer.

## Recommended Production Workflow

### 1. Generate The Canonical Strong Ledger

For highest quality, start here:

```sh
npm run strong:generate -- --bible <id>
```

This produces the canonical output under:

```text
outputs/strong/<id>/
```

It gives two product views from the same ledger:

- `reader`: visible tags only where the French carrier is defensible;
- `advanced`: complete original-aware study view, including empty, technical,
  duplicate, and original-complete annotations.

### 2. Export Views Or Generate Diagnostics

Use the canonical export when a plain Strong TSV is needed:

```sh
npm run strong:export -- --bible <id> --view reader
npm run strong:export -- --bible <id> --view advanced
```

Use the diagnostic TSV only when current hard-verse diagnostics are needed:

```sh
npm run strong:diagnose -- --bible <id>
```

The diagnostic path is still valuable because it produces hard-verse reports and
is the current target of masked gold evaluation.

### 3. Evaluate Deterministically

When changing alignment logic, run:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000
npm run strong:evaluate -- --gold Darby --limit 1000
npm run strong:evaluate -- --gold DarbyR --limit 1000
```

For production maturity, remove `--limit` and report precision, recall, F1,
worst books, worst verses, and recurring error classes.

### 4. Use Gap Review Before LLM Review

If the ledger has important Strong codes present in `advanced` but not visible
in `reader`, build a deterministic review queue:

```sh
npm run strong:review:gaps -- --bible <id> --only <BookOrScope> --audit --output-dir outputs/gap-review/<id>/<scope>
npm run strong:review:gaps:packet -- \
  --bible <id> \
  --only <BookOrScope> \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>.json
```

This is preferable to asking an LLM to "find the best Strong". The packet
constrains choices to known inventories and explicit candidate targets.

### 5. Use LLM Only As Review

LLM use is allowed only after deterministic evidence has created a bounded
problem:

- a hard-verse list;
- a gap-review packet;
- a masked-gold transfer experiment;
- a candidate list whose Strong codes are already allowed by references or
  original inventories.

Accepted LLM decisions must go through validation and should be saved as curated
overrides, not re-asked repeatedly.

## Best Next Implementation Work

### A. Add French Lexicon Evidence To The Deterministic Scorer

Build a normalized French lexical index from:

- `data/dictionaries/strong_fr.sqlite` columns `LSG` and `Definition`;
- `data/dictionaries/strong_lexicon.full.production.sqlite`
  `LexiconTranslations.fr.gloss` and text from `meaning`;
- optionally STEP `uStrong`/`dStrong` once original tagged tokens are imported.

Use it as a weak-to-medium scorer, not as an automatic final authority.

Suggested behavior:

- exact gloss match on a non-function French word: useful evidence;
- definition-only match: weaker evidence;
- multi-word expression match: good phrase candidate;
- function-word match: ignore unless Strong is allowlisted;
- proper names: allow stronger confidence when original/reference inventory
  agrees.

This should feed `translationLexicon`/`readerAlignment` as an additional
candidate source such as `dictionary-fr-exact`, `dictionary-fr-stem`, or
`dictionary-fr-phrase`.

### B. Import STEP Tagged Originals

The current plan in `goals/step-tagged-originals-plan.md` is still the right
direction. Importing `TAHOT`/`TAGNT` would let the ledger carry:

- classical Strong;
- `eStrong`;
- `dStrong`;
- `uStrong`;
- original token;
- morphology;
- STEP entry id.

That improves sense disambiguation and gives the product a better study layer
than plain Strong.

### C. Add A Ledger Quality Report

For each book/Bible, report:

- original Strong occurrence count;
- reader visible count;
- advanced count;
- empty/technical count;
- reference support count;
- dictionary support count;
- unresolved semantic holes;
- low-confidence placements;
- profile-specific density warnings.

This is the best way to know whether a generated Bible is actually production
worthy before any LLM is called.

### D. Keep External Aligners As An Optional Experiment

SimAlign/eflomal remain promising, especially for translations far from the
French references. But given the current codebase, the fastest quality gain is
not to replace the pipeline. It is to add dictionary/STEP evidence and improve
the canonical ledger. External aligners can become a second deterministic
candidate source later.

## Practical Default

When asked to generate the best Strong Bible today:

```sh
npm run strong:generate -- --bible <id>
npm run strong:export -- --bible <id> --view reader
npm run strong:evaluate -- --gold Sg1910 --limit 1000
npm run strong:evaluate -- --gold Darby --limit 1000
npm run strong:evaluate -- --gold DarbyR --limit 1000
```

Then inspect:

```text
outputs/strong/<id>/bible-<id>-strong-metrics.json
outputs/bible-<id>-strong-diagnostic.metrics.json
outputs/bible-<id>-strong-diagnostic.hard-verses.json
```

Only after this, run semantic refill or LLM review on the specific residual
cases.
