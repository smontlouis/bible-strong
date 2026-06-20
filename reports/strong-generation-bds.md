# Strong Generation BDS

Generated: 2026-06-20T10:40:23.962Z

## Inputs

- Bible JSON: `data/bibles/bible-bds.json` (present)
- Metrics: `outputs/bible-bds-strong-hybrid.metrics.json` (present)
- LLM manifest: `outputs/llm-books/bds/llm-review-bds-manifest.json` (present)
- Merged decisions: `outputs/llm-books/bds/llm-review-bds-merged-decisions.json`

## Metrics

- verse coverage: 31112/31112
- total Strong occurrences: 341691
- tagged token coverage: 41.62%
- visible Strong rate: 99.64%
- empty Strong rate: 0.36%
- multi-Strong word rate: 4.20%
- original representation rate: 68.98%
- original unrepresented Strong count: 130381
- hard verse count: 9531
- profile token coverage status: within-expected
- translation profile: Bible du Semeur (dynamic, semantic)
- curated override Strong occurrences: 180

## LLM Review

- reviewed books: 66/66
- missing books: none
- failed books: none
- LLM attempted verses: 65
- LLM prompt tokens: 201338
- LLM completion tokens: 278355
- LLM total token count: 479693
- estimated uncached LLM cost: $0.1061 using DeepSeek V4 Flash at $0.14/1M input and $0.28/1M output tokens
- review items: 248
- auto accepted items: 176
- pending items in manifest: 72

## Decision Counts

- accept-word: 176
- accept-empty: 0
- reject-wrong: 0
- reject-duplicate: 0
- pending-human: 72
- accept: 0
- reject: 0
- pending: 0
