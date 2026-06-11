# Goal: Complete Original Strong Alignment Generator

## Objective

Build a true original-language Strong generator for French Bible JSON files.

The pipeline must align French words or segments to Hebrew/Greek original tokens tagged with Strong numbers, then generate a Strong-tagged French output where every original Strong occurrence is represented.

This goal is stricter than V1 and V2:

- V1/V2 may be used as baselines, fallbacks, or validation signals.
- V1/V2 do not satisfy this goal by themselves.
- A simple pipeline of `French word -> Segond/Darby -> Strong -> verify Strong exists in original verse` is not sufficient.

The main pipeline must produce or use explicit alignments:

```txt
French word/segment -> original Hebrew/Greek token(s) -> Strong occurrence(s)
```

## Read First

Read the current context before implementing:

- `goals/bds-strong-generation.md`
- `reports/bds-strong-report.md`
- `reports/bds-strong-v2-report.md`
- `data/discovery.md`
- current code in `src/`

## Target Compatibility

The pipeline must be generic for French Bible files in this format:

```txt
data/bibles/bible-*.json
```

Development targets:

1. NBS first, because it currently performs better than BDS and is useful for evaluation.
2. BDS second, because it is harder and more paraphrastic.
3. Other available French Bibles such as `fmar`, `neg79`, or future `ost`.

The CLI, internal formats, diagnostics, and metrics must not be hardcoded for NBS or BDS.

The command should work like:

```sh
npm run generate:strong:align -- --bible nbs
npm run generate:strong:align -- --bible bds
npm run generate:strong:align -- --bible fmar
npm run generate:strong:align -- --bible neg79
```

If a Bible is incomplete, NT-only, OT-only, or has versification differences, the pipeline must:

- process all available verses,
- skip missing references cleanly,
- emit diagnostics,
- not crash,
- report covered books/testaments.

## Complete Strong Representation Requirement

For every verse with compatible original source data, all Strong occurrences from the original text must be represented in the generated output.

This is occurrence-based, not unique-code-based.

If `H0996` appears twice in the original verse, it should be represented twice in the output unless the source text mismatch is explicitly diagnosed.

A Strong occurrence can be represented in three ways:

1. Attached to a real French word or segment.
2. Attached together with other Strong numbers on the same French word or segment.
3. Inserted as an empty tag when the original token is not explicitly translated.

Expected empty-tag format:

```html
<w
  strong="H0996"
  data-empty="true"
  data-original-token="..."
  data-confidence="..."
  data-method="empty-original"
></w>
```

Expected real-word tag format:

```html
<w
  strong="H7225"
  data-empty="false"
  data-original-token="..."
  data-confidence="..."
  data-method="..."
  >commencement</w
>
```

When multiple original tokens map to the same French word, multiple Strong numbers may be assigned to the same word:

```html
<w strong="H7970 H3967" data-original-token="token-a token-b">130</w>
```

## Source Text Rules

Old Testament:

- Prefer WLC / WLCM source data.

New Testament:

- Choose and document the source text used.
- If using SBLGNT but a comparison source follows Textus Receptus / Majority Text, classify missing Strong occurrences due to text-source differences separately.

Do not count known source-text mismatches as ordinary alignment failures.

Required diagnostic category:

```txt
sourceTextMismatch
```

## Allowed Sources And Tools

You may use internet research and download open datasets/tools.

Allowed sources include:

- Macula Greek
- Macula Hebrew
- Clear-Bible Alignments
- WLC/SBLGNT TSV
- SIL NLP / machine.py
- SimAlign
- eflomal
- fast_align
- awesome-align
- other relevant open-source aligners
- local Strong references `Sg1910`, `Darby`, `DarbyR` as baseline/fallback/validation
- Vercel AI Gateway through `AI_GATEWAY_KEY` for ambiguous cases, with max budget 40 USD

Document every external source used:

- URL,
- license,
- local path,
- what it is used for.

Do not commit large downloaded datasets or generated full Bible outputs.

Use ignored local directories such as:

- `data/external/`
- `outputs/`
- `artifacts/`
- `cache/`

## Expected Implementation

Build internal representations for:

1. Original verse:
   - book,
   - chapter,
   - verse,
   - original token id,
   - surface text,
   - lemma,
   - gloss,
   - morph,
   - Strong occurrence.

2. French verse:
   - book,
   - chapter,
   - verse,
   - token id/index,
   - surface text,
   - normalized form,
   - character offsets if useful.

3. Alignment:
   - French token or segment,
   - original token(s),
   - Strong occurrence(s),
   - method,
   - confidence,
   - whether output is on a real word or empty tag.

4. Output:
   - TSV or JSON,
   - preserving book/chapter/verse,
   - containing all represented Strong occurrences,
   - with diagnostics and metrics.

## Method Expectations

Try to implement a real alignment backend.

Possible approaches:

- SimAlign / multilingual embeddings between French and original glosses.
- eflomal / statistical alignment over verse pairs.
- Clear-Bible alignment data if usable.
- Hybrid scoring using:
  - original token gloss,
  - lemma,
  - morphology,
  - French references,
  - v1/v2 candidate tags,
  - Strong lexicon fallback.
- LLM arbitration only for ambiguous or low-confidence cases, not as the default full-corpus method unless cost and quality are documented.

References `Sg1910`, `Darby`, and `DarbyR` may be used for:

- fallback,
- baseline,
- evaluation,
- tie-breaking,
- weak secondary signal.

They must not be the primary source of Strong assignments when original alignment evidence is available.

## Metrics Required

Report at least:

- verseCount,
- processedVerseCount,
- skippedVerseCount,
- frenchTokenCount,
- taggedFrenchTokenCount,
- originalStrongOccurrenceCount,
- representedStrongOccurrenceCount,
- missingStrongOccurrenceCount,
- realWordStrongOccurrenceCount,
- emptyStrongOccurrenceCount,
- multiStrongWordCount,
- sourceTextMismatchCount,
- fallbackStrongOccurrenceCount,
- originalDirectStrongOccurrenceCount,
- strongCoverage = representedStrongOccurrenceCount / originalStrongOccurrenceCount,
- emptyStrongRate = emptyStrongOccurrenceCount / representedStrongOccurrenceCount,
- realWordStrongRate = realWordStrongOccurrenceCount / representedStrongOccurrenceCount,
- comparison to V1/V2 metrics,
- evaluation against Sg1910 or Darby when possible.

## Evaluation Required

Quality must be measured, not just inspected manually.

At minimum, run an evaluation like:

1. Take a known Strong-tagged French source such as Sg1910 or Darby.
2. Strip its tags.
3. Run the new original-alignment pipeline.
4. Compare generated Strong occurrences to the known tags.
5. Report precision, recall, F1, and missing/extra counts.

If full-Bible evaluation is not feasible, run it on at least one complete book such as Mark or John.

## Deliverables

Required command:

```sh
npm run generate:strong:align -- --bible nbs
```

Required local generated artifacts:

- `outputs/bible-nbs-strong-align.tsv` or `.json`
- `outputs/bible-nbs-strong-align.metrics.json`
- `outputs/bible-nbs-strong-align.diagnostics.json`

Required committed report:

```txt
reports/original-alignment-strong-report.md
```

Required tests:

- original source parsing,
- French tokenization,
- alignment format,
- Strong propagation from original tokens,
- empty Strong tag insertion,
- multiple Strong numbers on one French word,
- generic compatibility with more than one Bible JSON,
- comparison/evaluation against baseline tags.

Required checks:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Run `npm run format:check` too if formatting changed.

## Acceptance Criteria

The goal is complete only if:

- The pipeline produces explicit French-to-original alignments.
- All original Strong occurrences are represented for compatible verses, either on real French words or empty tags.
- Missing Strong occurrences are counted and explained.
- Source-text mismatches are separated from alignment failures.
- The pipeline runs on at least one complete book, preferably Mark or John, and ideally full NBS.
- It remains generic for `data/bibles/bible-*.json`.
- Each generated tag includes:
  - Strong,
  - original token id(s),
  - method,
  - confidence,
  - empty vs real-word status,
  - fallback status if applicable.
- Metrics include strong occurrence coverage and empty-tag rates.
- Evaluation against Sg1910 or Darby is included.
- Required checks pass.
- A final commit is created if satisfactory.

## Stop Condition

If a full-Bible run is too slow, too expensive, or blocked by model/tooling constraints, do not stop at theory.

Deliver a proven prototype with:

- at least one complete book,
- preferably two French Bibles, such as NBS and BDS,
- complete metrics,
- evaluation results,
- examples of real-word tags, multi-Strong tags, and empty tags,
- known failure modes,
- estimated cost/time for full-Bible generation,
- exact resume commands.

## Definition Of Not Done

Do not mark the goal complete if the result is only:

- the current V1 reference-transfer pipeline,
- the current V2 verse-level original Strong verification,
- a report without a runnable implementation,
- a prototype that cannot represent untranslated original Strong occurrences as empty tags.
