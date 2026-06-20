# Strong Generation OST

Generated: 2026-06-20T10:40:24.003Z

## Inputs

- Bible JSON: `data/bibles/bible-ost.json` (present)
- Metrics: `outputs/bible-ost-strong-hybrid.metrics.json` (present)
- LLM manifest: `outputs/llm-books/ost/llm-review-ost-manifest.json` (present)
- Merged decisions: `outputs/llm-books/ost/llm-review-ost-merged-decisions.json`

## Metrics

- verse coverage: 31169/31169
- total Strong occurrences: 421289
- tagged token coverage: 53.24%
- visible Strong rate: 99.30%
- empty Strong rate: 0.70%
- multi-Strong word rate: 3.58%
- original representation rate: 86.05%
- original unrepresented Strong count: 58465
- hard verse count: 4862
- profile token coverage status: within-expected
- translation profile: Ostervald (formal, high)
- curated override Strong occurrences: 59

## LLM Review

- reviewed books: 66/66
- missing books: none
- failed books: none
- LLM attempted verses: 62
- LLM prompt tokens: 168552
- LLM completion tokens: 205193
- LLM total token count: 373745
- estimated uncached LLM cost: $0.0811 using DeepSeek V4 Flash at $0.14/1M input and $0.28/1M output tokens
- review items: 78
- auto accepted items: 59
- pending items in manifest: 19

## Decision Counts

- accept-word: 59
- accept-empty: 0
- reject-wrong: 0
- reject-duplicate: 0
- pending-human: 19
- accept: 0
- reject: 0
- pending: 0
