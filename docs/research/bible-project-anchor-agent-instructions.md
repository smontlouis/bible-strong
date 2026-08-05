# BibleProject candidate anchor review

## Objective

Assign one honest primary Bible View target to every candidate video. The target must represent the
text or biblical locus actually taught, not every verse mentioned in passing.

## Allowed primary targets

- `passage`: an exact sustained passage. Include `book`, `chapterStart`, optional `verseStart`,
  `chapterEnd`, and optional `verseEnd`.
- `book`: a whole biblical book when the video teaches its literary design rather than one passage.
- `testament`: only for genuinely Testament-wide material.
- `strong`: only when the work explicitly studies a Hebrew or Greek lexeme and the exact Strong code
  is independently reliable.
- `library`: last resort when no honest biblical locus exists. Explain why forcing a Bible View card
  would mislead readers.

## Placement rules

- Exact commentary/exposition: `after-range`.
- Whole-book literary material: `book-intro`.
- Broad theme with a representative primary chapter: `chapter-resources`.
- Lexical study with a reliable code: `strong-resource`.
- No honest biblical target: `library`.

## Evidence hierarchy

1. Sustained transcript exposition and repeated passage structure.
2. Official title and description.
3. Explicit transcript references with timestamps.
4. Official playlist context.
5. Metadata-only reference detection.

Plan occurrences and incidental citations are never sufficient by themselves. A frequent reference
can still be secondary; read its contexts. Conversely, spoken references can be missed by the parser,
so use the intro, conclusion, title, and description together.

## Output contract

Return one JSON object per assigned provider ID:

```json
{
  "providerId": "youtube-id",
  "primaryAnchor": {
    "kind": "passage",
    "book": 40,
    "chapterStart": 5,
    "verseStart": 1,
    "chapterEnd": 7,
    "verseEnd": 29,
    "placement": "after-range"
  },
  "relatedAnchors": [],
  "confidence": "high",
  "reviewStatus": "agent-proposed",
  "rationale": "One concise editorial explanation.",
  "evidence": [
    {
      "source": "transcript",
      "timestampSeconds": 134,
      "excerpt": "A short supporting excerpt, never a long transcript quotation."
    }
  ]
}
```

Use canonical Bible book numbers 1–66. Keep evidence excerpts short. Use `medium` or `low` confidence
when the target is representative rather than exact. Do not invent Strong numbers.

Completed batch decisions belong in
`docs/research/data/bible-project/anchor-agent-reviews/{podcasts,series,other}.json`. These reviewed
inputs are versioned; the larger prepared batches and full transcript dossiers remain scratch data.
