# LLM Gap-Review Production Maturity

Date: 2026-07-10

## Decision

Use the LLM only as a bounded reviewer after deterministic candidate
generation. Production application is mature only through the locked batch
runner; arbitrary standalone application remains prohibited.

The mature workflow is:

```text
canonical ledger
-> gap candidates
-> stable batch plan / bounded choices
-> proposer A
-> adaptive candidate subset to proposer B
-> exact consensus from two distinct models
-> current lexical safety filter + contract v2
-> locked transaction / scoped refresh / gates / rollback
-> manifest + durable decision ledger
```

## What Is Implemented

- `strong:review:gaps:llm` calls AI Gateway on an agent packet and writes a
  review JSON with raw model content, usage, parsed decisions, and parse errors.
- `strong:review:gaps:report` produces JSON and Markdown benchmark summaries
  with `--output-json` and `--output-md`.
- `strong:review:gaps:apply --finalize-reference-style` previews/finalizes only the
  candidates from the source packet. Valid unresolved, unsafe, or missing
  reference-style decisions become low-confidence `empty` overrides instead of
  final pending items in the preview. It is validation-only, never a standalone
  production apply path.
- `strong:review:gaps:packet` now emits compact packets containing only verses
  referenced by selected candidates.
- `strong:review:gaps:packet --min-priority semantic-medium` can now stop a
  semantic benchmark before any LLM call when the queue contains no semantic
  candidates.
- `strong:review:gaps:lexical-packet` builds compact semantic packets from
  `strong:lexical-candidates` reports.
- `strong:review:gaps:consensus` builds a visible high-confidence consensus
  review from two validated model outputs.
- `strong:review:gaps:batch` fixes task membership/pagination, requires strict
  bounded choices, calls proposer B adaptively at candidate level, verifies
  exact consensus from two distinct model identities, applies the current
  lexical filter and v2 contract, and owns the write lock, transaction marker,
  refresh gates, and rollback.
- `semanticRefillAgentReview --apply` refuses to run without that matching batch
  transaction. Direct application and combining standalone
  `--finalize-reference-style` with `--apply` are intentionally unsupported.

## Current Production State

Historical NBS records are fail-closed by source. Plain `semantic-refill:llm`
and `semantic-refill:llm-reference-style` are always quarantined; only
`semantic-refill:llm-consensus-filtered` is production-eligible. The 5,379
legacy single-model auto-accepts also remain quarantined.

The strict artifact migration examined 2,411 raw semantic-refill records. It
promoted 313 whose two distinct model artifacts still agree on the same bounded
choice and whose `missing` candidate, target, open state, and direct lexical
evidence are current. It rejects replacement/relocation and carrier conflicts,
leaving 2,098 raw records quarantined. It reconstructed 2,480 durable decisions:
2,043 `accepted-safe` and 437 `needs-witness-review`.

```sh
npm run strong:review:gaps:migrate-artifacts -- --bible nbs
npm run strong:review:gaps:migrate-artifacts -- --bible nbs --apply
```

Always inspect the first dry-run report before applying. The durable terminal
context is useful for analysis, but there is no safe general pre-LLM skip yet:
the current candidate cohort and filter policy can change consensus eligibility.

The final 2026-07-10 NBS generation contains 31,169 verses, 363,503
reader-visible and 486,297 advanced Strong occurrences, including 95,456 empty
and 5,369 phrase occurrences. Reference carrier coverage is `0.8593`, original
carrier rate `0.8029`, original representation `0.9999`, semantic missing count
`395`, placement risk `6,831`, and structural placement quality `0.9808`.
Reader/advanced token coverage is `0.4912`/`0.5204`. The full generation took
156.32 seconds and about 4.33 GB max RSS.

## Historical Evidence

### Gen / DeepSeek

Packet: `outputs/gap-review/nbs/agent-packets/agent-packet-nbs-Gen-limit30.json`

Model: `deepseek/deepseek-v4-flash`

Result:

| metric                          | value |
| ------------------------------- | ----: |
| candidates                      |    30 |
| raw decisions                   |    30 |
| validated accepted              |    30 |
| accepted as empty               |    25 |
| visible high-confidence         |     4 |
| applied visible high-confidence |     4 |
| total tokens                    | 93244 |

Applied visible placements:

| ref       | Strong | target      | confidence |
| --------- | ------ | ----------- | ---------: |
| Gen.12.1  | H1980  | va-t'en     |       0.90 |
| Gen.13.3  | H1980  | rendit      |       0.85 |
| Gen.16.8  | H1980  | vas-tu      |       0.85 |
| Gen.18.22 | H1980  | repartirent |       0.85 |

After refresh on Gen:

| metric                         |   delta |
| ------------------------------ | ------: |
| readerVisibleStrongCount       |      +4 |
| emptyStrongCount               |      -6 |
| referenceStrongCarrierCoverage | +0.0001 |
| originalStrongCarrierRate      | +0.0002 |
| readerTaggedTokenCount         |      +7 |
| readerTokenCoverage            | +0.0002 |
| placementRiskCount             |      -1 |

Interpretation: positive but modest signal. The LLM found real visible
placements without increasing risk.

### Gen Compact / Same Packet / Two Models

After applying the 4 high-confidence Gen placements above, a fresh compact Gen
packet was built from the current ledger.

Packet:
`outputs/gap-review/nbs/agent-packets/agent-packet-nbs-Gen-compact-benchmark-20260629-limit30.json`

| packet metric |  value |
| ------------- | -----: |
| candidates    |     30 |
| verses        |     29 |
| bytes         | 583005 |

Result:

| model                        | raw | missing | accepted | rejected | visible high | total tokens |
| ---------------------------- | --: | ------: | -------: | -------: | -----------: | -----------: |
| `deepseek/deepseek-v4-flash` |  30 |       0 |       30 |        0 |            0 |        96345 |
| `openai/gpt-5.4-mini`        |  29 |       1 |       30 |        0 |            0 |        79419 |

Interpretation: no new high-confidence visible placements remained in the first
Gen compact batch after the earlier 4 were applied. This is a useful negative
control: the workflow did not manufacture additional visible gains after the
obvious batch was exhausted. `gpt-5.4-mini` was cheaper in tokens but missed one
candidate decision, which finalization converted to low-confidence `empty`.

### Rom / Same Packet / Two Models

Packet: `outputs/gap-review/nbs/agent-packets/agent-packet-nbs-Rom-limit30.json`

DeepSeek:

| metric                  |  value |
| ----------------------- | -----: |
| raw decisions           |     30 |
| missing decisions       |      0 |
| accepted as empty       |     28 |
| visible high-confidence |      0 |
| total tokens            | 112756 |

Gemini Flash Lite:

| metric                  |  value |
| ----------------------- | -----: |
| raw decisions           |      0 |
| missing decisions       |     30 |
| accepted as empty       |     30 |
| visible high-confidence |      0 |
| total tokens            | 107472 |

Interpretation: Rom is not an apply batch under current selection. DeepSeek
respected the contract but had no high-confidence visible yield. Gemini did not
produce parseable decisions for the current prompt/model pairing.

### Ezek / Same Packet / Two Models

Packet: `outputs/gap-review/nbs/agent-packets/agent-packet-nbs-Ezek-limit30.json`

| packet metric |  value |
| ------------- | -----: |
| candidates    |     30 |
| verses        |     20 |
| bytes         | 679858 |

Result:

| model                        | raw | missing | accepted | rejected | visible high | visible low | total tokens |
| ---------------------------- | --: | ------: | -------: | -------: | -----------: | ----------: | -----------: |
| `deepseek/deepseek-v4-flash` |  30 |       0 |       30 |        0 |            0 |          11 |       116138 |
| `openai/gpt-5.4-mini`        |  29 |       1 |       25 |        5 |            0 |           0 |        93273 |

DeepSeek initially hit one transient AI Gateway HTTP 500 on this packet; a
single retry succeeded. `gpt-5.4-mini` classified 5 candidates as `duplicate`,
which local validation kept as rejects.

Interpretation: Ezek again produced no high-confidence visible placements.
DeepSeek is more complete on this workflow but more token-heavy. `gpt-5.4-mini`
is cheaper but currently too conservative or too willing to emit terminal
`duplicate` decisions for valid reference-style candidates.

### Semantic Queue Guard

The current Gen and Ezek queues were tested with:

```sh
npm run strong:review:gaps:packet -- \
  --bible nbs \
  --only Gen \
  --candidates outputs/gap-review/nbs/Gen-compact-benchmark-20260629/gap-review-candidates.json \
  --output outputs/gap-review/nbs/agent-packets/agent-packet-nbs-Gen-semantic-min-test.json \
  --limit 30 \
  --min-priority semantic-medium
```

Both Gen and Ezek exit with:

```text
no-candidates-at-or-above-priority:semantic-medium
```

Interpretation: the next maturity step is not another model call over the same
candidate distribution. The system now has a guard that prevents spending LLM
tokens on a semantic benchmark when the queue only contains `function-low`
restraint candidates.

### Ezek Lexical Packet / Two Models / Consensus Apply

Packet:
`outputs/gap-review/nbs/agent-packets/agent-packet-nbs-Ezek-lexical-medium-open-limit30.json`

Built from:
`outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-Ezek.json`

Packet filters:

| filter                        |  value |
| ----------------------------- | -----: |
| min confidence                | medium |
| include occupied              |  false |
| allow duplicate targets       |  false |
| candidates                    |     30 |
| verses                        |     22 |
| high-confidence lexical items |     30 |
| relocation items              |      6 |

Model results:

| model                        | raw | missing | accepted | rejected | visible high | total tokens |
| ---------------------------- | --: | ------: | -------: | -------: | -----------: | -----------: |
| `deepseek/deepseek-v4-flash` |  30 |       0 |       27 |        3 |           23 |       138681 |
| `openai/gpt-5.4-mini`        |  29 |       1 |       25 |        5 |           22 |       115585 |

Consensus:

| metric                       | value |
| ---------------------------- | ----: |
| DeepSeek visible high        |    23 |
| GPT visible high             |    22 |
| exact consensus visible high |    16 |
| consensus validated          |    16 |
| consensus rejected           |     0 |
| consensus applied            |    16 |

Applied consensus examples:

| ref        | Strong | target     |
| ---------- | ------ | ---------- |
| Ezek.1.12  | H1980  | allait     |
| Ezek.1.25  | H1961  | venait     |
| Ezek.1.27  | H4758  | paraissait |
| Ezek.11.2  | H2803  | plans      |
| Ezek.11.2  | H6098  | projets    |
| Ezek.13.22 | H7725  | revienne   |

After `strong:refresh -- --bible nbs --only Ezek`, all 16 consensus placements
are present in the canonical ledger as `curated-override`.

Metrics delta on Ezek:

| metric                         | before |  after |   delta |
| ------------------------------ | -----: | -----: | ------: |
| readerVisibleStrongCount       |  18291 |  18292 |      +1 |
| emptyStrongCount               |   2336 |   2320 |     -16 |
| referenceStrongCarrierCoverage | 0.9002 | 0.9010 | +0.0008 |
| originalStrongCarrierRate      | 0.8770 | 0.8778 | +0.0008 |
| placementRiskCount             |    287 |    285 |      -2 |
| readerTaggedTokenCount         |  16242 |  16260 |     +18 |
| readerTokenCoverage            | 0.4635 | 0.4640 | +0.0005 |

Interpretation: this is the first mature high-yield workflow shape. The lexical
packet source produced a meaningful candidate distribution; two models produced
partially divergent outputs; exact consensus filtered out suspect choices; local
validation accepted the consensus; refresh confirmed the canonical ledger
changed in the expected direction.

### 1Cor Lexical High-Only Packet / Two Models / Consensus Apply

Packet:
`outputs/gap-review/nbs/agent-packets/agent-packet-nbs-1Cor-lexical-high-open-limit30.json`

Built from:
`outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-1Cor.1-1Cor.5.json`

Packet filters:

| filter                        |  value |
| ----------------------------- | -----: |
| min confidence                |   high |
| include occupied              |  false |
| allow duplicate targets       |  false |
| candidates                    |     15 |
| verses                        |     12 |
| high-confidence lexical items |     15 |
| relocation items              |      5 |
| packet bytes                  | 370419 |

Model results:

| model                        | raw | accepted | rejected | visible high | total tokens |
| ---------------------------- | --: | -------: | -------: | -----------: | -----------: |
| `deepseek/deepseek-v4-flash` |  15 |       12 |        3 |           12 |        63011 |
| `openai/gpt-5.4-mini`        |  15 |       15 |        0 |           15 |        52412 |

Consensus:

| metric                       | value |
| ---------------------------- | ----: |
| DeepSeek visible high        |    12 |
| GPT visible high             |    15 |
| exact consensus visible high |     7 |
| consensus validated          |     7 |
| consensus rejected           |     0 |
| consensus applied            |     7 |

Applied consensus:

| ref       | Strong | target    |
| --------- | ------ | --------- |
| 1Cor.2.12 | G6063  | sachions  |
| 1Cor.3.22 | G3195  | avenir    |
| 1Cor.4.11 | G0737  | presente  |
| 1Cor.4.12 | G3058  | insultes  |
| 1Cor.4.19 | G2064  | viendrai  |
| 1Cor.3.11 | G3588  | celle     |
| 1Cor.4.5  | G1012  | decisions |

After `strong:refresh -- --bible nbs --only 1Cor`, all 7 consensus placements
are present in the split canonical ledger as `reader:curated-override`.

Metrics delta on 1Cor:

| metric                         | before |  after |   delta |
| ------------------------------ | -----: | -----: | ------: |
| readerVisibleStrongCount       |   7052 |   7053 |      +1 |
| emptyStrongCount               |   1223 |   1209 |     -14 |
| referenceStrongCarrierCoverage | 0.8870 | 0.8890 |  +0.002 |
| originalStrongCarrierRate      | 0.8439 | 0.8457 | +0.0018 |
| placementRiskCount             |    344 |    343 |      -1 |
| readerTaggedTokenCount         |   5934 |   5949 |     +15 |
| readerTokenCoverage            | 0.6109 | 0.6124 | +0.0015 |

Interpretation: this reproduces the high-yield lexical workflow on a New
Testament packet. `gpt-5.4-mini` was both cheaper and more complete on this
small high-only packet, while exact consensus still filtered the apply set down
to a conservative 7 placements.

### Acts Lexical High-Only Packet / Two Models / Consensus Apply

Packet:
`outputs/gap-review/nbs/agent-packets/agent-packet-nbs-Acts-lexical-high-open-limit30.json`

Built from:
`outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-Acts.1-Acts.5.json`

Packet filters:

| filter                          |  value |
| ------------------------------- | -----: |
| min confidence                  |   high |
| include occupied                |  false |
| allow duplicate targets         |  false |
| candidates                      |     13 |
| verses                          |     11 |
| high-confidence lexical items   |     10 |
| medium-confidence lexical items |      3 |
| relocation items                |      5 |
| packet bytes                    | 277331 |

Model results:

| model                        | raw | accepted | rejected | visible high | total tokens |
| ---------------------------- | --: | -------: | -------: | -----------: | -----------: |
| `deepseek/deepseek-v4-flash` |  13 |       11 |        2 |           10 |        45829 |
| `openai/gpt-5.4-mini`        |  13 |       12 |        1 |           10 |        39181 |

Consensus:

| metric                       | value |
| ---------------------------- | ----: |
| DeepSeek visible high        |    10 |
| GPT visible high             |    10 |
| exact consensus visible high |     8 |
| consensus validated          |     8 |
| consensus rejected           |     0 |
| consensus applied            |     8 |

Applied consensus:

| ref       | Strong | target       |
| --------- | ------ | ------------ |
| Acts.1.25 | G2983  | prenne       |
| Acts.1.7  | G2540  | moments      |
| Acts.2.45 | G2933  | possessions  |
| Acts.4.31 | G2980  | disaient     |
| Acts.3.10 | G2258  | etait        |
| Acts.2.43 | G1096  | produisaient |
| Acts.4.30 | G1096  | produise     |
| Acts.5.12 | G1096  | produisaient |

After `strong:refresh -- --bible nbs --only Acts`, all 8 consensus placements
are present in the split canonical ledger as `reader:curated-override`.

Metrics delta on Acts:

| metric                         | before |  after |   delta |
| ------------------------------ | -----: | -----: | ------: |
| readerVisibleStrongCount       |  19041 |  19042 |      +1 |
| emptyStrongCount               |   3967 |   3961 |      -6 |
| referenceStrongCarrierCoverage | 0.8737 | 0.8740 | +0.0003 |
| originalStrongCarrierRate      | 0.8149 | 0.8152 | +0.0003 |
| placementRiskCount             |   1061 |   1057 |      -4 |
| readerTaggedTokenCount         |  15347 |  15357 |     +10 |
| readerTokenCoverage            | 0.6743 | 0.6748 | +0.0005 |

Interpretation: this is the third positive lexical consensus packet and the
second New Testament packet. It is smaller than Ezek and 1Cor, but it confirms
the same shape on narrative NT material with lower token cost and a clean local
validation/apply path.

### Controlled Multi-Packet Batch / Consensus-Only Apply

Report:
`reports/llm-gap-review-nbs-controlled-batch-20260629.md`

Batch scopes:

| scope | candidates | DeepSeek raw | GPT raw | DeepSeek tokens | GPT tokens | consensus | filtered applied | refresh status              |
| ----- | ---------: | -----------: | ------: | --------------: | ---------: | --------: | ---------------: | --------------------------- |
| Hos   |         23 |           23 |      23 |           82951 |      71488 |        13 |                5 | refreshed                   |
| Lev   |         24 |           24 |      24 |           90974 |      76801 |        21 |               21 | applied after cache         |
| 2Sam  |         18 |           18 |      18 |           80554 |      65140 |        13 |               10 | refreshed after auto-filter |
| Rev   |         15 |           14 |      15 |           81805 |      68162 |         6 |                5 | refreshed                   |
| Amos  |         13 |           13 |      13 |           55448 |      44487 |         7 |                7 | refreshed                   |

Safety filter:

- removed 8 `Hos` decisions with generic or weak carriers:
  `vais`, `ferai`, `fera`, `fasse`, `celle`, `quoi`;
- automatic post-consensus replay held 3 additional `2Sam` decisions for
  witness review: `H5046 -> faisait`, `H1980 -> vais`, and `H0559 -> fit`.
  Those overrides were removed and `2Sam` was refreshed;
- historical note: the 2026-06-29 filter kept `Rev.5.1 G1855 -> dos` because
  witnesses placed that Strong on `dehors` / `revers` / `extérieur`. That
  cross-carrier rationale is deprecated: the current filter requires exact
  carrier support from independent families or direct deterministic evidence
  on `dos`; otherwise the decision remains in witness review. `Darby` and
  `DarbyR` count as one family;
- `Lev` produced a clean 21-decision consensus. Follow-up isolation on
  2026-06-30 showed the apparent `strong:refresh` hang was scoped-refresh
  performance, not a bad Leviticus decision: repeated auto-safe passes reread
  the heavy lexical sources. After adding a lexical source cache, the 21
  filtered `Lev` decisions were applied and verified. The post-apply refresh
  completed in 132.06s with 7.46 GB max RSS.

Applied batch metrics:

| scope                       | empty delta | reader tagged token delta |        reader coverage delta | risk delta | verification |
| --------------------------- | ----------: | ------------------------: | ---------------------------: | ---------: | ------------ |
| Hos                         |          -6 |                        +5 |                      +0.0011 |         +1 | 5/5          |
| Lev                         |         -15 |                       +21 |                      +0.0009 |         -5 | 21/21        |
| 2Sam                        |         -15 |                       +19 |                      +0.0010 |         -3 | 10/10        |
| Rev                         |          -7 |                       +10 |                      +0.0009 |         -3 | 5/5          |
| Amos                        |         -12 |                       +13 |                      +0.0034 |         -1 | 7/7          |
| global before Lev follow-up |         -40 |                       +47 |                      +0.0001 |         -6 | 27/27        |
| Lev follow-up increment     |         -15 |                       +21 | +0.0001 global / +0.0009 Lev |         -5 | 21/21        |

Interpretation: the controlled batch confirms the workflow can scale beyond
single pilots, but it also proves that exact model consensus is not sufficient
by itself. A safety filter for generic carriers is required before application,
and same-target stacking must be checked against the Strong witnesses before one
side is discarded. `Hos` improved coverage but increased local risk by 1, so
future batches should include an automatic post-consensus risk check and require
manual review for any positive risk delta.

## Packet Size Fix

The original Gen packet included all 1533 Gen verses and weighed about 4.4 MB.
Future packets are compact:

| packet                        | verses | candidates |  bytes |
| ----------------------------- | -----: | ---------: | -----: |
| Gen compact                   |     29 |         30 | 579913 |
| Ezek                          |     20 |         30 | 679858 |
| Rom                           |     17 |         30 | 676819 |
| Luke                          |     20 |         30 | 605487 |
| Gen current compact benchmark |     29 |         30 | 583005 |
| 1Cor lexical high-only        |     12 |         15 | 370419 |
| Acts lexical high-only        |     11 |         13 | 277331 |
| Hos lexical high-only         |     13 |         23 | 503844 |
| Lev lexical high-only         |     19 |         24 | 549063 |
| 2Sam lexical high-only        |     14 |         18 | 472244 |
| Rev lexical high-only         |      9 |         15 | 479842 |
| Amos lexical high-only        |     11 |         13 | 324017 |

Future model comparisons should use only compact packets.

## Production Rule

Apply only decisions that satisfy all of the following:

- application is owned by `strong:review:gaps:batch`, not a standalone apply
  command;
- two distinct model identities returned the exact same stable candidate id and
  bounded choice id;
- `target` is `word` or `phrase`;
- `confidence >= 0.84`;
- the current post-consensus lexical filter accepts the decision;
- the filtered review carries contract version 2 and exact packet/Bible/scope
  identity;
- the batch write lock and transaction marker are active;
- no suspicious stacking conversion occurred;
- the decision is not a weak/function word unless the French carrier is clear.

Keep low-confidence `empty` decisions as review artifacts unless product
explicitly chooses empty overrides as durable reference-style display policy.
`--finalize-reference-style` can create that preview, but cannot apply it.

## Next Test Plan

1. Inspect `--plan-only` output before every paid run and keep task membership
   stable when resuming.
2. Continue improving deterministic direct evidence so fewer candidates reach
   the LLM at all.
3. Use adaptive proposer B at candidate level, but retain exact two-model
   consensus for every applied decision.
4. Cluster `needs-witness-review` decisions by Strong/carrier/provenance to turn
   repeated review patterns into deterministic evidence rules.
5. Design a safe pre-LLM reuse proof that includes the current cohort and filter
   policy before enabling any terminal-decision skip.
6. Keep the lexical filter, contract v2, transaction, scoped refresh, and
   rollback gates mandatory.

## Go / No-Go

Go for bounded production batches whose plan is inspected and whose exact
two-model/filter/transaction gates remain enabled.

No-go for standalone `strong:review:gaps:apply --apply`, for
combining `--finalize-reference-style` with `--apply`, for single-model
promotion, for unbounded free-form targets, or for treating a prior terminal
ledger record as a safe pre-LLM skip.
