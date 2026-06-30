---
name: bible-to-strong
description: Use this skill when the user wants to generate, improve, evaluate, or compare a Strong-tagged Bible from a local Bible JSON file in this repository. It covers canonical Strong ledger generation, reader/advanced exports, bounded LLM review, gold evaluation against known Strong editions, quality reports, and safe handling of copyrighted or large generated artifacts.
---

# Bible To Strong

## Scope

Use this skill in this repository when asked to create or improve a Strong-tagged Bible for a local version such as `nbs`, `s21`, `bds`, `fmar`, etc.

Expected input:

- Bible JSON: `data/bibles/bible-<id>.json`
- Strong references: `data/strongs/Sg1910.csv`, `data/strongs/Darby.csv`, `data/strongs/DarbyR.csv`
- STEP original sources: `data/external/stepbible/amalgamated/TAHOT *.txt` and `TAGNT *.txt`
- Optional audit/provenance sources: `data/external/Alignments/data/sources/WLC.tsv` and `SBLGNT.tsv`
- Local lexicons for review and future deterministic evidence: `data/dictionaries/strong_fr.sqlite` and `data/dictionaries/strong_lexicon.full.production.sqlite`

Generated full Bible outputs under `outputs/` are ignored by Git and must not be committed. The canonical production ledger is now SQLite-first: `outputs/strong/<id>/bible-<id>-strong.sqlite`.

## Default Workflow

1. Confirm the requested Bible id and input file.
2. Generate the canonical Strong ledger. This is the no-LLM production path with reader and advanced views. It also applies the validated deterministic lexical auto-safe layer, then writes the residual lexical candidate report for review:

```sh
npm run strong:generate -- --bible <id>
```

Use the SQLite output as the authoritative production artifact when the user asks for the best workflow. It preserves a complete Strong ledger while keeping reader-visible tags profile-aware. Auto-safe lexical placements are already inserted with `source="semantic-lexicon"`; they should not remain as residual auto-safe candidates. Do not rely on legacy split `verses/*.json` files; new generation removes them.

If an existing output folder still has the old split JSON ledger, migrate it once:

```sh
npm run strong:migrate:sqlite -- --bible <id>
```

This writes `bible-<id>-strong.sqlite`, keeps metrics/TSV outputs, and removes legacy ledger JSON directories after a successful migration.

For localized deterministic fixes, refresh only the affected books, chapters, or
ranges instead of regenerating the whole Bible:

```sh
npm run strong:refresh -- --bible <id> --only <Book>
npm run strong:refresh -- --bible <id> --only <Book.Chapter>
npm run strong:refresh -- --bible <id> --only <BookA-BookB>
npm run strong:refresh -- --bible <id> --only <Book1>,<Book2>,<Book3>
```

`strong:refresh` generates each requested scope in a temporary output directory,
then replaces only those verses in the SQLite ledger. It recalculates affected
book metrics, global metrics, and reader/advanced TSV exports without parsing or
rewriting a split full-Bible JSON ledger. Use a full `strong:generate` only when
the entire corpus must be rebuilt or when no canonical SQLite ledger exists yet.

Build the local Kaikki SQLite index once when lexical reports need maximum
speed:

```sh
npm run strong:kaikki:index
```

When `data/external/french-lexical/kaikki/kaikki.org-dictionary-French.sqlite`
exists, lexical candidate generation uses targeted SQLite lookups instead of
streaming the 534 MB JSONL file.

Build the local Strong phrase-lexicon SQLite index once before production
generation or repeated scoped refreshes:

```sh
npm run strong:phrase:index
```

When `data/derived/strong-phrase-lexicon.sqlite` exists and its source
fingerprint matches `Sg1910`, `Darby`, and `DarbyR`, generation loads learned
multi-word phrase candidates from SQLite instead of rebuilding that large
in-memory lexicon for every run.

3. Export reader or advanced views from the canonical ledger when a TSV is needed:

```sh
npm run strong:export -- --bible <id> --view reader
npm run strong:export -- --bible <id> --view advanced
```

4. Run masked gold evaluation when changing alignment logic:

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000
npm run strong:evaluate -- --gold Darby --limit 1000
npm run strong:evaluate -- --gold DarbyR --limit 1000
```

The evaluator still uses the diagnostic backend internally. Until it evaluates the canonical ledger directly, use `strong:evaluate` as the public command.

5. Report reference coverage against the known Strong Bibles when the user wants to know how many reference Strong occurrences were reproduced:

```sh
npm run strong:report:references -- --bible <id>
```

This reads the canonical ledger and writes JSON/Markdown coverage for `Sg1910`, `Darby`, `DarbyR`, plus consensus buckets `1/3`, `2/3`, and `3/3`.

6. For current hard-verse diagnostics or legacy TSV compatibility, run the diagnostic path explicitly:

```sh
npm run strong:diagnose -- --bible <id>
```

For a production-maturity audit, run the same commands without `--limit` and update `reports/strong-gold-evaluation-report.md`.

7. Inspect metrics:

```sh
cat outputs/strong/<id>/bible-<id>-strong-metrics.json
sqlite3 outputs/strong/<id>/bible-<id>-strong.sqlite "select count(*) from verses"
cat outputs/bible-<id>-strong-diagnostic.metrics.json
```

8. If quality is unclear, inspect hard verses:

```sh
cat outputs/bible-<id>-strong-diagnostic.hard-verses.json
```

9. Use LLM only as a bounded suggestion generator, not as blind production:

```sh
npm run strong:diagnose -- --bible <id> --only Gen --llm --llm-limit 250 --output-dir outputs/llm-books/<id>/Gen
```

10. Prepare a human review queue for LLM suggestions:

```sh
npm run strong:review:llm -- --bible <id> --diagnostics outputs/llm-books/<id>/Gen/bible-<id>-strong-diagnostic.hard-verses.json --review outputs/llm-books/<id>/Gen/llm-review-<id>-Gen.json --only Gen
npm run viewer
```

Open `http://localhost:4173/viewer/review.html`, load the generated review JSON, reject any bad auto-accepted suggestions, decide pending suggestions, correct token targets when needed, and click `Enregistrer décisions`.

For production-scale LLM review, prefer the concurrent book runner:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run strong:review:llm:books -- --bible <id> --books all --concurrency 3 --llm-limit 25 --model deepseek/deepseek-v4-flash --skip-existing
```

This writes per-book review files under `outputs/llm-books/<id>/<Book>/` and a manifest at `outputs/llm-books/<id>/llm-review-<id>-manifest.json`. Open it with:

```text
http://localhost:4173/viewer/review.html?manifest=/outputs/llm-books/<id>/llm-review-<id>-manifest.json
```

Use `--skip-existing` to resume without re-calling the LLM for books that already have review JSON files.

Do not launch a whole multi-Bible batch with `--llm-limit 250` for every book. First run the complete 66-book pass with a small per-book limit, inspect the manifest, then rerun only selected hard books with a higher limit.

Manual review supports three cases:

- correct suggestion: keep or set `Accepter`;
- wrong suggestion: set `Rejeter`;
- right Strong but wrong French token: set the item to `À revoir`, click the intended word in the verse context or edit `Index cible` / `Mot normalisé` / `Strong`, then set `Accepter`.

11. Regenerate after saving accepted decisions:

```sh
npm run strong:generate -- --bible <id>
```

The viewer stores accepted decisions in `data/curated-strong-overrides.json`. The TypeScript fallback overrides in `src/curatedStrongOverrides.ts` remain for older reviewed decisions.

`strong:review:llm` pre-accepts only high-confidence mechanically safe suggestions. Weak function-word/particle cases stay pending. Use `--auto-accept false` or `--auto-accept-threshold <n>` when a stricter review is needed.

12. Before trusting the LLM prompt on a new book/style, evaluate it against known Strong Bibles:

```sh
npm run strong:llm:transfer -- --source Darby --gold Sg1910 --only Gen.1 --limit 5
npm run strong:llm:transfer -- --source Darby --gold DarbyR --only Gen.1 --limit 5
```

13. When deterministic generation leaves meaningful semantic holes or suspicious visible placements, use the internal-agent gap-review workflow instead of ad hoc token patches:

```sh
npm run strong:generate -- --bible <id>
npm run strong:lexical-candidates -- --bible <id> --only <BookOrScope>
npm run strong:review:gaps -- --bible <id> --only <BookOrScope> --audit --output-dir outputs/gap-review/<id>/<scope>
npm run strong:review:gaps:packet -- \
  --bible <id> \
  --only <BookOrScope> \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>.json
```

When the goal is a high-yield semantic benchmark rather than a restraint test,
require semantic candidates and stop before paying for a weak packet:

```sh
npm run strong:review:gaps:packet -- \
  --bible <id> \
  --only <BookOrScope> \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>-semantic.json \
  --limit 30 \
  --min-priority semantic-medium
```

If this exits with `no-candidates-at-or-above-priority:semantic-medium`, do not
call the LLM for a semantic benchmark from that queue. Either treat the packet as
a `function-low` restraint test or improve candidate sourcing first.

For a high-yield semantic packet, prefer converting the lexical candidate report
instead:

```sh
npm run strong:review:gaps:lexical-packet -- \
  --bible <id> \
  --only <BookOrScope> \
  --lexical-report outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-<BookOrScope>.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>-lexical.json \
  --limit 30 \
  --min-confidence medium
```

As of 2026-06-29, the lexical-packet + two-model + exact-consensus workflow has
three positive NBS pilots after canonical refresh:

- `Ezek`: 16 consensus placements applied; `emptyStrongCount -16`,
  `readerTaggedTokenCount +18`, `placementRiskCount -2`;
- `1Cor`: 7 consensus placements applied; `emptyStrongCount -14`,
  `readerTaggedTokenCount +15`, `placementRiskCount -1`;
- `Acts`: 8 consensus placements applied; `emptyStrongCount -6`,
  `readerTaggedTokenCount +10`, `placementRiskCount -4`.

The next broadening step is a controlled multi-packet batch, still capped per
book and consensus-only. Do not apply a raw single-model review directly just
because these pilots were positive.

The first controlled batch on 2026-06-29, replayed through the automatic
post-consensus filter on 2026-06-30, initially left 27 safe consensus decisions
applied across `Hos`, `2Sam`, `Rev`, and `Amos` after refresh. Global batch
delta before Leviticus follow-up: `emptyStrongCount -40`,
`readerTaggedTokenCount +47`, `placementRiskCount -6`.
The batch proved that exact consensus still needs a safety filter: hold generic
carriers such as `vais`, `ferai`, `fera`, `fasse`, `faisait`, `fit`, `celle`,
`quoi` unless at least two Strong witnesses use the same normalized carrier, and
resolve same-target stacking against witnesses. The witness check corrected
`Rev.5.1`: `Sg1910`, `Darby`, and `DarbyR` support `G1855` on
`dehors`/`revers`/`extérieur`, so NBS `dos` keeps `G1855`; `G3693` remains an
advanced empty original annotation. `Lev` produced a valid 21-decision consensus
and the filter marks all 21 safe. A later isolation pass on 2026-06-30 showed
the apparent `Lev` refresh hang was not a bad Leviticus decision: scoped refresh
was repeatedly rereading heavy lexical sources and rebuilding large reference
phrase structures during auto-safe passes. The SQLite ledger, lexical source
cache, Kaikki index, and phrase-lexicon index fixed the storage and repeated
source-loading path; the 21 filtered `Lev` decisions are now applied and
verified. The pre-SQLite `Lev` refresh baseline was 132.06s with 7.46 GB max
RSS after application; the SQLite/indexed path reduces memory materially while
the remaining time is dominated by bounded lexical auto-safe stabilization.
Incremental `Lev` delta:
`emptyStrongCount -15`, `readerTaggedTokenCount +21`, `placementRiskCount -5`.
Report: `reports/llm-gap-review-nbs-Lev-filtered-applied-20260630.md`.

The second bounded batch on 2026-06-30 applied 17 filtered consensus decisions
across `2Kgs.1-5`, `1Pet.1-5`, and `Rom.1-5` after refresh. Global batch delta:
`emptyStrongCount -42`, `readerTaggedTokenCount +48`, `placementRiskCount -6`.
The filter held three model-consensus decisions: `2Kgs.4.38 H8239 -> fais`,
`1Pet.2.20 G0015 -> faisant`, and original-only `Rom.4.17 G5607 -> existe`.
The last case added a new automatic rule: a visible decision with no token
witness and no Strong support in `Sg1910`, `Darby`, or `DarbyR` must be held for
review, even when both models agree.

After validating two model reviews on the same lexical packet, build a strict
visible high-confidence consensus review, run the post-consensus filter, and
apply only the filtered safe review:

```sh
npm run strong:review:gaps:consensus -- \
  --left-review outputs/gap-review/<id>/agent-review/<left>.json \
  --right-review outputs/gap-review/<id>/agent-review/<right>.json \
  --left-validation-dir outputs/gap-review/<id>/agent-review/<left>-validated \
  --right-validation-dir outputs/gap-review/<id>/agent-review/<right>-validated \
  --output outputs/gap-review/<id>/agent-review/<consensus-visible-high>.json \
  --min-confidence 0.84
npm run strong:review:gaps:filter -- \
  --review outputs/gap-review/<id>/agent-review/<consensus-visible-high>.json \
  --output outputs/gap-review/<id>/agent-review/<consensus-visible-high>-auto-filtered.json \
  --report-json reports/llm-gap-review-<id>-<scope>-post-consensus-filter.json \
  --report-md reports/llm-gap-review-<id>-<scope>-post-consensus-filter.md
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<consensus-visible-high>-auto-filtered.json \
  --output-dir outputs/gap-review/<id>/agent-review/<consensus-visible-high>-auto-filtered-applied \
  --apply
```

Then write a benchmark report with the explicit output flags:

```sh
npm run strong:review:gaps:report -- \
  --packet outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>-lexical.json \
  --review outputs/gap-review/<id>/agent-review/<consensus-visible-high>.json \
  --validation-dir outputs/gap-review/<id>/agent-review/<consensus-visible-high>-validated \
  --applied-dir outputs/gap-review/<id>/agent-review/<consensus-visible-high>-applied \
  --before-metrics outputs/gap-review/<id>/baseline/bible-<id>-strong-metrics-before-<scope>.json \
  --after-metrics outputs/strong/<id>/bible-<id>-strong-metrics.json \
  --metrics-scope <scope> \
  --output-json reports/llm-gap-review-<id>-<scope>.json \
  --output-md reports/llm-gap-review-<id>-<scope>.md
```

Give that packet to two independent proposer agents. Prefer chapter-sized packets for normal books; use book-sized packets only when the book is short or the candidate count is low. For the benchmarked reference-style workflow, use `gpt-5.4-mini` with reasoning `medium` as proposer A, `gpt-5.5` with reasoning `low` as proposer B, and `gpt-5.5` with reasoning `medium` as arbiter. This Gen.1 benchmarked combo is called combo A in `reports/gap-review-model-benchmark-gen1.md`. Do not silently upgrade proposer A to `xhigh`: the point is to test whether the ordinary proposer pair can solve the chapter without a hand-written rule. Each proposer must write a JSON review file, then validate it:

For a single-model AI Gateway pilot, use the packet runner first, then validate
the review before applying anything:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run strong:review:gaps:llm -- \
  --input outputs/gap-review/<id>/agent-packets/agent-packet-<id>-<scope>.json \
  --output outputs/gap-review/<id>/agent-review/llm-review-<id>-<scope>.json \
  --model deepseek/deepseek-v4-flash
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/llm-review-<id>-<scope>.json \
  --output-dir outputs/gap-review/<id>/agent-review/llm-review-<id>-<scope>-validated \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --finalize-reference-style
```

```sh
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<proposer>.json \
  --output-dir outputs/gap-review/<id>/agent-review/<proposer>-validated \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json
```

Use an arbiter only after both proposer outputs are validated. For the reference-style workflow, default to `gpt-5.5` with reasoning `medium` as the arbiter. Use `gpt-5.5 high` as a quality-reference baseline, escalation path, or explicit experiment, not as the default production choice. The arbiter should choose between defensible proposals and inspect local validation results; it should not invent a third unvalidated path when both proposers are weak. Validate the arbiter output the same way. Apply only the final decisions after converting every valid unresolved reference-style Strong to a placed decision (`word`, `phrase`, or `empty`) with a confidence score:

```sh
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<arbiter>.json \
  --output-dir outputs/gap-review/<id>/agent-review/<arbiter>-applied \
  --candidates outputs/gap-review/<id>/<scope>/gap-review-candidates.json \
  --finalize-reference-style \
  --apply
npm run strong:generate -- --bible <id>
```

The agent packet is procedural. It includes `auditKind`, `currentTarget`, `sourcePlacement`, `nearbyOpenTargets`, `blockedTargets`, `openContentTargets`, `occupiedTargets`, `availableTargets`, and `placementWarnings`. `auditKind="missing"` means the Strong is not visible yet. `auditKind="relocation"` means the Strong is already visible but may be attached to the wrong French carrier. Agents must treat `blockedTargets` as forbidden for `decision="word"` when a semantically plausible open target exists. This prevents errors such as stacking a missing Strong onto a word that already carries a different Strong when a nearby unoccupied carrier exists.

For relocation candidates, agents must compare `currentTarget` with `deterministicCandidates`. Use `duplicate` only when the current placement is correct. If a better visible carrier exists, output `word` or `phrase`; if no reliable carrier exists, output `empty`. Do not rely on hand-written semantic equivalence lists for cases such as NBS `Gen.1.27` (`homme` vs `humains`); solve those only with auditable external lexical evidence or bounded LLM review.

For reference-style candidates, do not use `pending-human` as a final state and do not use `reject` for a legitimate Strong simply because no French carrier is found. The objective is to copy the reader style of `Darby`, `DarbyR`, and `Sg1910`: first try `word`, then `phrase`; if no reliable visible carrier exists, output `empty` at the candidate's `sourcePlacement.insertAfterWordIndex` so the Strong remains visible as a small empty tag in original/reference order. Every final decision gets a confidence score. The product vocabulary is high confidence vs low confidence, not accepted vs pending. Use low confidence for uncertain word/phrase placements, suspicious stacking, or empty fallbacks. Reserve `reject` only for invalid candidates, duplicate drift, bad ids, or mechanically impossible decisions. The final arbiter validation should pass `--finalize-reference-style`; this converts valid unresolved, unsafe, or missing agent decisions into low-confidence `empty` overrides instead of leaving them as final pending. The review/preview must show low-confidence decisions in yellow and empty decisions inline, with a reason such as "no reliable French carrier found".

14. Run full checks before finalizing:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

15. When changing deterministic lexical placement rules, run or resume the
    10-book first-5-chapters regression audit:

```sh
npm run strong:audit:plan
npm run strong:audit:run
npm run strong:audit:verify
npm run strong:audit:residuals
```

The default audit is intentionally capped at 10 books to keep regeneration
fast during iterative work. Use `--books <n>` only for explicit broader
stress tests.

If the audit changed intentionally, inspect `outputs/strong-audit/nbs/manifest.json`,
then refresh the committed metrics/hash baseline:

```sh
npm run strong:audit:snapshot -- --snapshot tests/fixtures/strong-audit/nbs-10x5-snapshot.json
```

Use `strong:audit:residuals` after a successful audit run to write
`outputs/strong-audit/nbs/residuals.json` and `.md`. The residual report is for
human inspection only and stays in ignored `outputs/`; it groups remaining
lexical candidates into actionable categories such as group auto-safe leftovers,
compound STEP proper-name candidates, clean single open high candidates, blocked
single open high candidates split by medium-only vs high-candidate blockers,
high candidates that use inferred seed evidence, high-scoring medium candidates,
ambiguous high candidates, and relocation better-open candidates. Treat clean
single-open items as the first deterministic audit queue. Treat compound proper
names, inferred-seed high items, blocked items, and high-scoring medium items as
evidence for review, not as automatic insertion candidates.

Lexical auto-safe insertion is iterative. Keep rerunning candidate generation
until no more placements are applied, within the bounded pass limit. Some
group-auto-safe placements become visible only after earlier lexical passes
remove competing residual candidates.

## Decision Rules

- Prefer `strong:generate` for the production artifact because it keeps a canonical SQLite reader/advanced ledger, applies validated lexical auto-safe placements, writes the residual lexical candidate report, and explains every Strong placement.
- Prefer SQLite store reads for any scoped workflow. Commands with `--only <Book|Chapter|Range>` must read only matching rows from `bible-<id>-strong.sqlite`, not parse the whole Bible.
- Keep `strong:kaikki:index` and `strong:phrase:index` prepared on production machines. They turn the two largest lexical/reference lookups into targeted SQLite reads.
- Prefer `strong:export -- --view reader` or `strong:export -- --view advanced` for TSV views.
- The diagnostic backend includes learned multi-word phrase transfer from the local Strong references. Keep this deterministic and original-confirmed.
- Use STEP TAHOT/TAGNT as the production original inventory. Treat WLC/SBLGNT suffixed Strong values (`H6960a`, etc.) as audit provenance only, not lexicon lookup keys. Render and compare the canonical Strong (`H6960`), prefer STEP `dStrong`/`eStrong` for lexical disambiguation, and keep any non-STEP source suffix only as metadata.
- Treat local French Strong dictionaries as deterministic evidence for review and future scoring, not as a license to place tags without original/reference inventory support.
- When reading `strong_lexicon.full.production.sqlite`, keep proper-name `gloss` evidence but do not use proper-name `meaning` text as French carrier evidence. Do not let a row's `uStrong` feed another classical Strong unless the normalized `uStrong` equals the row's `eStrong`, except for pronominal morphology where cross-`uStrong` forms are grammatical variants. This prevents related-name/group definitions from placing false carriers while preserving pronoun variants.
- Do not add hand-written synonym or semantic-equivalence entries to generation because a hard verse was discussed. Production placement may use exact learned reference evidence, dictionary evidence, algorithmic stemming, STEP inventory, validated lexical auto-safe evidence from external French sources, or bounded LLM review; see `docs/french-lexical-sources-for-strong-placement.md`.
- Treat synonym-only candidates as review material. A candidate can be `high` only when it has direct evidence such as `seed-term`, `seed-stem`, `kaikki-gloss`, STEP proper-name evidence, or STEP numeric component evidence. Synonym-only candidates may keep their numeric score for sorting, but their confidence is capped at `medium` and they still count as ambiguity blockers for generic auto-safe decisions. Auto-safe production insertion requires direct evidence or a French auxiliary-plus-participle phrase whose participle has direct lexical evidence. A synonym-only high-score competitor outside a strong auxiliary-plus-participle phrase does not block that phrase, but a direct-evidence outside competitor does. When both a French auxiliary-plus-participle phrase and its contained participle are independently auto-safe, prefer the phrase because it preserves the visible French verbal construction without adding semantic assumptions. Numeric component evidence may stack on occupied compound-number carriers, including relocation from a simple occupied number to a later richer compound number and duplicate empty numeric occurrences that have one richer occupied compound carrier; French compounds such as `douze`, `quatre-vingt-*`, and `soixante-dix-*` are decomposed into STEP-compatible numeric components. Repeated empty occurrences of the same Strong may be group-auto-safe when the same open French lexeme appears the same number of times with high-confidence direct evidence and source order maps cleanly to text order. The duplicate lexical group rule uses relative order and exact cardinality; it does not require the French carriers to appear after the empty source anchors, because translated clauses can move the visible carrier before the original-complete insertion point. Ambiguous STEP proper-name sequences may also be group-auto-safe when same-verse source order and French token order provide a one-to-one monotonic assignment across open high-confidence proper-name carriers; do not use this to replace simple proper-name auto-safe placements that are already unambiguous.
- Lexical auto-safe placement is a stabilization loop, not a single pass. Do
  not lower the pass limit unless the 10x5 audit proves that no validated
  auto-safe placements remain stranded in the residual report.
- Use calibrated translation profiles: one common backend, but profile-aware generation and diagnostics by translation family.
- Interpret metrics through the Bible's translation profile. Dynamic translations such as BDS are expected to have lower token coverage than formal translations such as Martin.
- Profiles are active generation inputs, not just labels: they control learned enrichment strictness, maximum Strong codes per word, empty-word consensus, and hard-verse thresholds.
- Report visible Strong rate, empty Strong rate, multi-Strong word rate, original representation rate, original unrepresented Strong occurrences, and profile token-coverage status.
- Use `strong:evaluate` after changing reader, phrase, or empty-tag behavior.
- Prefer `strong:llm:transfer` over free LLM arbitration. It is measurable: source Strong Bible -> masked gold Bible.
- Do not use `--llm-apply` until suggestions have been reviewed on a small sample.
- Promote good LLM suggestions through `strong:review:llm` + `strong:review:llm:apply` into `data/curated-strong-overrides.json` rather than repeatedly paying for the same decision.
- Prefer LLM batches by book (`--only Gen`, `--only Exod`, etc.) instead of whole-Bible LLM runs.
- For semantic improvement batches, prefer compact lexical packets and exact
  two-model consensus. The current positive threshold is three refreshed NBS
  pilots (`Ezek`, `1Cor`, `Acts`), which permits a controlled multi-packet
  consensus-only batch, not broad automatic LLM application.
- After the first controlled batch, require a post-consensus safety filter
  before application. Generic auxiliary/function carriers, suspicious same-word
  stacking, and any positive per-book `placementRiskCount` delta should be held
  for review instead of silently promoted. Same-word stacking review must inspect
  the Strong witnesses before deciding which side to keep.
- Prefer internal-agent gap-review batches by chapter when the target is to place Strong codes already present as advanced empty/technical annotations. Chapter packets preserve local context while keeping the decision surface small. Use the benchmarked combo A by default: `gpt-5.4-mini medium` + `gpt-5.5 low` as proposers and `gpt-5.5 medium` as arbiter. Keep `gpt-5.5 high` for quality-reference runs, escalation, or explicit experiments.
- Do not send agents a free-form "find the best word" task. Use `strong:review:gaps:packet` so they see blocked/occupied/open/nearby targets and can avoid false multi-Strong stacking.
- Treat suspicious stacking as low-confidence unless it is mechanically invalid. If a proposed word target already carries a different reader Strong and another open content target exists, the arbiter should either choose the open target or output a low-confidence `empty`/`word` decision with the warning preserved.
- For reference-style candidates, prefer `empty` over `reject` when the Strong is valid but unrendered in the target French. Place the empty tag according to `sourcePlacement.insertAfterWordIndex` and keep the reason auditable. Do not leave valid reference-style candidates as final pending. Reject only token-index drift, invalid Strong ids, duplicate over-tagging, or candidates that are not actually supported by the verse/reference inventories.
- Keep generated copyrighted/full Bible outputs in `outputs/`; do not commit them.

## When More Detail Is Needed

Read [references/workflow.md](references/workflow.md) for:

- command matrix;
- metrics interpretation;
- LLM transfer evaluation;
- full gold evaluation reporting;
- quality gates;
- expected reports and final response checklist.

Read `docs/best-strong-generation-workflow.md` for the current research-based recommendation: deterministic canonical ledger first, LLM only for bounded review.
