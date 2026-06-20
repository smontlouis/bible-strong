# Multi-Bible Strong Generation Report

Generated: 2026-06-20T10:39:22.690Z

## Summary

| Bible | Verses | Tags | Empty | Token coverage | Original repr. | Hard verses | LLM books | Pending human | Failed books |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
bds | 31112/31112 | 341691 | 1235 | 41.62% | 68.98% | 9531 | 66/66 | 72 | 0
bfc | 28358/28358 | 282678 | 1207 | 36.95% | 60.12% | 14969 | 66/66 | 49 | 0
fmar | 31057/31057 | 410398 | 2515 | 49.34% | 83.35% | 7008 | 66/66 | 20 | 0
frc97 | 30742/30742 | 293403 | 1215 | 36.30% | 59.86% | 16465 | 66/66 | 61 | 0
nfc | 30767/30767 | 303213 | 1216 | 37.47% | 61.64% | 14980 | 66/66 | 39 | 0
ost | 31169/31169 | 421289 | 2961 | 53.24% | 86.05% | 4862 | 66/66 | 19 | 0
nvs78p | 31170/31170 | 422562 | 3926 | 54.90% | 86.60% | 3228 | 66/66 | 14 | 0

## Notes

- Full generated Bible TSV files remain under `outputs/` and are ignored by Git.
- LLM review is checkpointed per book under `outputs/llm-books/<id>/`.
- Legacy `accept` decisions are normalized to `accept-word`; undecided `pending` items are normalized to `pending-human` and are not silently applied.
