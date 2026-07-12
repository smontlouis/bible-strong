# Strong Audit 10x5 Workflow

This workflow stress-tests deterministic Strong generation across a stable random
sample of 10 NBS books. Each selected book is generated for chapters 1-5.

## Commands

Preview the stable sample:

```sh
npm run strong:audit:plan
```

Generate or resume the full audit:

```sh
npm run strong:audit:run
```

The run writes isolated generated ledgers under:

```text
outputs/strong-audit/nbs/scopes/<Book>/
```

It also writes:

```text
outputs/strong-audit/nbs/manifest.json
outputs/strong-audit/nbs/snapshot.json
```

`manifest.json` includes local output paths and viewer URLs. `snapshot.json`
keeps only stable metrics and hashes, so it can be compared with the committed
baseline.

Update the committed baseline after an intentional deterministic improvement:

```sh
npm run strong:audit:snapshot -- --snapshot tests/fixtures/strong-audit/nbs-10x5-snapshot.json
```

Verify the latest generated snapshot against the committed baseline:

```sh
npm run strong:audit:verify
```

Generate a human-readable residual queue after a run:

```sh
npm run strong:audit:residuals
```

This writes:

```text
outputs/strong-audit/nbs/residuals.json
outputs/strong-audit/nbs/residuals.md
```

The residual report is ignored output. Use it to choose the next deterministic
improvement candidate without re-running ad hoc scripts. It groups remaining
items by categories such as group auto-safe leftovers, clean single open
high-confidence candidates, compound STEP proper-name candidates, blocked single
open high-confidence candidates split by medium-only vs high-candidate blockers,
high candidates that use inferred seed evidence, high-scoring medium candidates,
ambiguous high-confidence candidates, and relocation better-open candidates.
Inspect the clean category first; compound proper-name, inferred-seed, blocked,
and medium categories are review material, not automatic proof that a new
deterministic rule is safe.

## Rules

- Do not commit generated ledgers under `outputs/`.
- Commit only code, tests, docs, and the metrics/hash baseline under
  `tests/fixtures/strong-audit/`.
- A snapshot mismatch is not automatically bad. It means the deterministic
  output changed and must be reviewed before the baseline is updated.
- Do not add hand-written semantic equivalence rules to make one verse pass.
- Treat lexical auto-safe placement as an iterative stabilization step. If
  `strong:audit:residuals` shows group auto-safe leftovers, first verify that
  the generation pass limit did not stop before the validated placements were
  absorbed.
- Treat compound STEP proper-name residuals as a separate review queue. They can
  represent split original name parts or duplicate source occurrences on one
  French name, so they should not be promoted through the simple proper-name
  auto-safe rule.
- Treat medium-blocked and high-blocked single-open residuals separately.
  Medium-blocked items usually mean a direct high candidate is being held back
  by high-scoring synonym evidence; high-blocked items mean another direct high
  candidate still competes. Neither category is automatically safe.
- Treat high candidates that use inferred seed evidence as a separate review
  signal. These candidates can be good, but their direct evidence comes from
  French terms inferred through Kaikki glosses rather than the Strong dictionary
  terms, so they are weaker than dictionary-backed `seed-term` matches.
  Promote only generic deterministic improvements with tests.

## Current Sample

Seed: `nbs-strong-audit-2026-06-25`

Books:

```text
Rev, Prov, Dan, 2Sam, Amos, 1Sam, 1Tim, Heb, Ezek, John
```

## Accepted Deterministic Findings

- French auxiliary-plus-participle phrases can be auto-safe when the phrase has
  direct lexical evidence and any high-confidence outside competitor is
  synonym-only. A direct outside competitor still keeps the item in review.
- The previous regression audit accepted this for `1Sam.4.9` (`H5647` on `ont été`) and
  `Rom.4.14` (`G2758` on `est vidée`), reducing residual empty annotations by
  two without increasing placement risk.
- Strong lexicon `meaning` text is no longer used as French carrier evidence
  for proper-name rows. Proper-name `gloss` values remain available, but
  descriptive definitions such as "fils de Siméon" must not place a different
  proper-name Strong on `Siméon`.
- Cross-`uStrong` dictionary evidence is only kept when it normalizes to the
  same classical Strong, or when the row morphology is pronominal. This keeps
  grammatical pronoun variants available while preventing related-name/group
  definitions from contaminating another Strong. The previous regression audit accepted this
  after `placementRiskCount` dropped from `2098` to `1997`; `John.4.1` keeps
  the extra `G2424` empty instead of placing it on `disciples`, `1Pet.2.21`
  keeps `G0846` on `ses`, and `1Chr.4.24` keeps `H3226` empty instead of
  placing it on `Siméon`.
- Synonym-only candidates are capped at `medium` confidence even when their
  numeric score is high. The numeric score remains available for sorting and
  ambiguity blocking, but the viewer no longer presents external synonym-only
  evidence as a high-confidence placement. The previous regression audit accepted this after
  `lexicalHighConfidenceCandidates` dropped from `4106` to `2374` with zero
  non-lexical metric changes, so the generated placements stayed stable while
  the debug queue became less misleading.
- Ambiguous STEP proper-name sequences can be resolved by source order when the
  same verse has a one-to-one monotonic mapping between empty original proper
  names and open French proper-name carriers. The rule is deliberately inactive
  for already unambiguous simple proper-name placements, so it does not churn
  existing signatures. The previous regression audit accepted this after `1Chr.4.24` placed
  `H3226` on `Yamîn` and `H3402` on `Yarib`; total empty Strong count dropped
  from `9268` to `9266`, reference carrier coverage rose from `0.8932` to
  `0.8933`, and placement quality stayed at `0.9566`.
- Repeated lexical duplicates do not need each French carrier to appear after
  the empty source anchor when exact cardinality and relative order are clean.
  This keeps the rule deterministic while allowing normal translation
  reordering inside a verse. The previous regression audit accepted this after `Lev.4.35`
  became a group-auto-safe candidate for two `H5493` occurrences on
  `détachera` and `détache`; reader-visible Strong count rose from `54904` to
  `54906`, empty Strong count dropped from `9266` to `9248`, reference carrier
  coverage rose from `0.8933` to `0.8936`, and placement quality rose from
  `0.9566` to `0.9567`.
- Lexical auto-safe generation needs enough stabilization passes to absorb
  candidates that appear only after earlier lexical placements. Raising the
  bounded pass limit from four to eight allowed the validated `Lev.4.35`
  group-auto-safe pair to be inserted into the ledger as `semantic-lexicon`
  placements. The previous regression audit accepted this after group auto-safe leftovers
  dropped from `2` to `0`, empty Strong count dropped from `9248` to `9244`,
  original carrier rate rose from `0.8265` to `0.8266`, and placement quality
  stayed at `0.9567`.
- Compound STEP proper-name candidates are no longer counted as clean
  single-open high candidates in the residual report. The current 10x5 sample
  has `compoundProperNameItems` at `0` and `cleanSingleOpenHighItems` at `77`;
  broader stress tests keep names such as `Lo-Rouhama` in a dedicated review
  queue when the underlying STEP evidence has multiple gloss parts or duplicate
  source occurrences.
- Blocked single-open high candidates are split into medium-blocked and
  high-blocked residual queues. This keeps synonym-only blocker noise separate
  from real direct-evidence ambiguity, so future deterministic placement rules
  can be evaluated against the right queue instead of a mixed count. On the
  current 10x5 sample, the blocked count is `20`: `15` medium-blocked items and
  `5` high-blocked items.
- Inferred-seed high candidates are reported separately so false direct-looking
  candidates can be audited without weakening the validated dictionary-backed
  path. This is intentionally a diagnostic category; it does not lower
  confidence or change ledger output yet. On the current 10x5 sample, `54`
  high candidates use inferred seed evidence.
- When an auxiliary-plus-participle phrase and its contained participle are
  both independently auto-safe, the phrase wins. This resolves a mechanical
  ambiguity in favor of the fuller French verbal construction without adding a
  semantic exception. The previous regression audit accepted this after `John.2.22` placed
  `G1453` on `se fut réveillé`, `1Cor.3.5` placed `G1325` on `a accordé`, and
  `Acts.3.15` placed `G1453` on `l’a réveillé`; placement risk dropped from
  `1997` to `1994`, phrase Strong count rose by three, and placement quality
  improved in all three affected scopes.
