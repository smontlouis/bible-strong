# Strong Generation FMAR

Generated: 2026-06-20T10:40:23.979Z

## Inputs

- Bible JSON: `data/bibles/bible-fmar.json` (present)
- Metrics: `outputs/bible-fmar-strong-hybrid.metrics.json` (present)
- LLM manifest: `outputs/llm-books/fmar/llm-review-fmar-manifest.json` (present)
- Merged decisions: `outputs/llm-books/fmar/llm-review-fmar-merged-decisions.json`

## Metrics

- verse coverage: 31057/31057
- total Strong occurrences: 410398
- tagged token coverage: 49.34%
- visible Strong rate: 99.39%
- empty Strong rate: 0.61%
- multi-Strong word rate: 3.89%
- original representation rate: 83.35%
- original unrepresented Strong count: 69668
- hard verse count: 7008
- profile token coverage status: within-expected
- translation profile: Martin (formal, high)
- curated override Strong occurrences: 107

## LLM Review

- reviewed books: 66/66
- missing books: none
- failed books: none
- LLM attempted verses: 64
- LLM prompt tokens: 194233
- LLM completion tokens: 212814
- LLM total token count: 407047
- estimated uncached LLM cost: $0.0868 using DeepSeek V4 Flash at $0.14/1M input and $0.28/1M output tokens
- review items: 121
- auto accepted items: 101
- pending items in manifest: 20

## Decision Counts

- accept-word: 101
- accept-empty: 0
- reject-wrong: 0
- reject-duplicate: 0
- pending-human: 20
- accept: 0
- reject: 0
- pending: 0
