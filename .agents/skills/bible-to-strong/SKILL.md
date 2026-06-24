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

Generated full Bible outputs under `outputs/` are ignored by Git and must not be committed.

## Default Workflow

1. Confirm the requested Bible id and input file.
2. Generate the canonical Strong ledger. This is the no-LLM production path with reader and advanced views. It also applies the validated deterministic lexical auto-safe layer, then writes the residual lexical candidate report for review:

```sh
npm run strong:generate -- --bible <id>
```

Use this output as the authoritative production artifact when the user asks for the best workflow. It preserves a complete Strong ledger while keeping reader-visible tags profile-aware. Auto-safe lexical placements are already inserted with `source="semantic-lexicon"`; they should not remain as residual auto-safe candidates.

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

Give that packet to two independent proposer agents. Prefer chapter-sized packets for normal books; use book-sized packets only when the book is short or the candidate count is low. For the benchmarked reference-style workflow, use `gpt-5.4-mini` with reasoning `medium` as proposer A, `gpt-5.5` with reasoning `low` as proposer B, and `gpt-5.5` with reasoning `medium` as arbiter. This Gen.1 benchmarked combo is called combo A in `reports/gap-review-model-benchmark-gen1.md`. Do not silently upgrade proposer A to `xhigh`: the point is to test whether the ordinary proposer pair can solve the chapter without a hand-written rule. Each proposer must write a JSON review file, then validate it:

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
  --apply
npm run strong:generate -- --bible <id>
```

The agent packet is procedural. It includes `auditKind`, `currentTarget`, `sourcePlacement`, `nearbyOpenTargets`, `blockedTargets`, `openContentTargets`, `occupiedTargets`, `availableTargets`, and `placementWarnings`. `auditKind="missing"` means the Strong is not visible yet. `auditKind="relocation"` means the Strong is already visible but may be attached to the wrong French carrier. Agents must treat `blockedTargets` as forbidden for `decision="word"` when a semantically plausible open target exists. This prevents errors such as stacking a missing Strong onto a word that already carries a different Strong when a nearby unoccupied carrier exists.

For relocation candidates, agents must compare `currentTarget` with `deterministicCandidates`. Use `duplicate` only when the current placement is correct. If a better visible carrier exists, output `word` or `phrase`; if no reliable carrier exists, output `empty`. Do not rely on hand-written semantic equivalence lists for cases such as NBS `Gen.1.27` (`homme` vs `humains`); solve those only with auditable external lexical evidence or bounded LLM review.

For reference-style candidates, do not use `pending-human` as a final state and do not use `reject` for a legitimate Strong simply because no French carrier is found. The objective is to copy the reader style of `Darby`, `DarbyR`, and `Sg1910`: first try `word`, then `phrase`; if no reliable visible carrier exists, output `empty` at the candidate's `sourcePlacement.insertAfterWordIndex` so the Strong remains visible as a small empty tag in original/reference order. Every final decision gets a confidence score. The product vocabulary is high confidence vs low confidence, not accepted vs pending. Use low confidence for uncertain word/phrase placements, suspicious stacking, or empty fallbacks. Reserve `reject` only for invalid candidates, duplicate drift, bad ids, or mechanically impossible decisions. The review/preview must show low-confidence decisions in yellow and empty decisions inline, with a reason such as "no reliable French carrier found".

14. Run full checks before finalizing:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

## Decision Rules

- Prefer `strong:generate` for the production artifact because it keeps a canonical reader/advanced ledger, applies validated lexical auto-safe placements, writes the residual lexical candidate report, and explains every Strong placement.
- Prefer `strong:export -- --view reader` or `strong:export -- --view advanced` for TSV views.
- The diagnostic backend includes learned multi-word phrase transfer from the local Strong references. Keep this deterministic and original-confirmed.
- Use STEP TAHOT/TAGNT as the production original inventory. Treat WLC/SBLGNT suffixed Strong values (`H6960a`, etc.) as audit provenance only, not lexicon lookup keys. Render and compare the canonical Strong (`H6960`), prefer STEP `dStrong`/`eStrong` for lexical disambiguation, and keep any non-STEP source suffix only as metadata.
- Treat local French Strong dictionaries as deterministic evidence for review and future scoring, not as a license to place tags without original/reference inventory support.
- Do not add hand-written synonym or semantic-equivalence entries to generation because a hard verse was discussed. Production placement may use exact learned reference evidence, dictionary evidence, algorithmic stemming, STEP inventory, validated lexical auto-safe evidence from external French sources, or bounded LLM review; see `docs/french-lexical-sources-for-strong-placement.md`.
- Treat synonym-only candidates as review material. Auto-safe production insertion requires direct evidence such as `seed-term`, `seed-stem`, `kaikki-gloss`, STEP proper-name evidence, STEP numeric component evidence, or a French auxiliary-plus-participle phrase whose participle has direct lexical evidence. Numeric component evidence may stack on occupied compound-number carriers, including relocation from a simple occupied number to a later richer compound number. Repeated empty occurrences of the same Strong may be group-auto-safe when the same open French lexeme appears the same number of times with high-confidence direct evidence and source order maps cleanly to text order.
- Use calibrated translation profiles: one common backend, but profile-aware generation and diagnostics by translation family.
- Interpret metrics through the Bible's translation profile. Dynamic translations such as BDS are expected to have lower token coverage than formal translations such as Martin.
- Profiles are active generation inputs, not just labels: they control learned enrichment strictness, maximum Strong codes per word, empty-word consensus, and hard-verse thresholds.
- Report visible Strong rate, empty Strong rate, multi-Strong word rate, original representation rate, original unrepresented Strong occurrences, and profile token-coverage status.
- Use `strong:evaluate` after changing reader, phrase, or empty-tag behavior.
- Prefer `strong:llm:transfer` over free LLM arbitration. It is measurable: source Strong Bible -> masked gold Bible.
- Do not use `--llm-apply` until suggestions have been reviewed on a small sample.
- Promote good LLM suggestions through `strong:review:llm` + `strong:review:llm:apply` into `data/curated-strong-overrides.json` rather than repeatedly paying for the same decision.
- Prefer LLM batches by book (`--only Gen`, `--only Exod`, etc.) instead of whole-Bible LLM runs.
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
