# Strong Generation BFC

Generated: 2026-06-20T10:40:23.972Z

## Inputs

- Bible JSON: `data/bibles/bible-bfc.json` (present)
- Metrics: `outputs/bible-bfc-strong-hybrid.metrics.json` (present)
- LLM manifest: `outputs/llm-books/bfc/llm-review-bfc-manifest.json` (present)
- Merged decisions: `outputs/llm-books/bfc/llm-review-bfc-merged-decisions.json`

## Metrics

- verse coverage: 28358/28358
- total Strong occurrences: 282678
- tagged token coverage: 36.95%
- visible Strong rate: 99.57%
- empty Strong rate: 0.43%
- multi-Strong word rate: 4.67%
- original representation rate: 60.12%
- original unrepresented Strong count: 158988
- hard verse count: 14969
- profile token coverage status: below-expected
- translation profile: Bible en francais courant (dynamic, semantic)
- curated override Strong occurrences: 232

## LLM Review

- reviewed books: 66/66
- missing books: none
- failed books: none
- LLM attempted verses: 66
- LLM prompt tokens: 223099
- LLM completion tokens: 294580
- LLM total token count: 517679
- estimated uncached LLM cost: $0.1137 using DeepSeek V4 Flash at $0.14/1M input and $0.28/1M output tokens
- review items: 277
- auto accepted items: 228
- pending items in manifest: 49

## Decision Counts

- accept-word: 228
- accept-empty: 0
- reject-wrong: 0
- reject-duplicate: 0
- pending-human: 49
- accept: 0
- reject: 0
- pending: 0
