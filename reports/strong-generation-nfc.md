# Strong Generation NFC

Generated: 2026-06-20T10:40:23.995Z

## Inputs

- Bible JSON: `data/bibles/bible-nfc.json` (present)
- Metrics: `outputs/bible-nfc-strong-hybrid.metrics.json` (present)
- LLM manifest: `outputs/llm-books/nfc/llm-review-nfc-manifest.json` (present)
- Merged decisions: `outputs/llm-books/nfc/llm-review-nfc-merged-decisions.json`

## Metrics

- verse coverage: 30767/30767
- total Strong occurrences: 303213
- tagged token coverage: 37.47%
- visible Strong rate: 99.60%
- empty Strong rate: 0.40%
- multi-Strong word rate: 4.79%
- original representation rate: 61.64%
- original unrepresented Strong count: 159884
- hard verse count: 14980
- profile token coverage status: below-expected
- translation profile: Nouvelle francais courant (dynamic, semantic)
- curated override Strong occurrences: 158

## LLM Review

- reviewed books: 66/66
- missing books: none
- failed books: none
- LLM attempted verses: 65
- LLM prompt tokens: 180373
- LLM completion tokens: 253602
- LLM total token count: 433975
- estimated uncached LLM cost: $0.0963 using DeepSeek V4 Flash at $0.14/1M input and $0.28/1M output tokens
- review items: 196
- auto accepted items: 157
- pending items in manifest: 39

## Decision Counts

- accept-word: 157
- accept-empty: 0
- reject-wrong: 0
- reject-duplicate: 0
- pending-human: 39
- accept: 0
- reject: 0
- pending: 0
