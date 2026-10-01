# Words of Jesus — alignment instructions

These instructions are given to the agents that review the verses queued by
`yarn resources:words-of-jesus prepare-alignment`. Each batch file lists verses of
one Bible (the *target*) whose words-of-Jesus marking is missing, disputed or
absent. The agent decides, for every verse, which words of the target text
Jesus speaks.

## Input

A batch file `outputs/words-of-jesus/alignment/<bible>/batch-NNN.json`:

- `versionId`, `language`: the target Bible.
- `resultPath`: where to write the answer.
- `verses[]`, each with:
  - `ref`: `book-chapter-verse` (40 = Matthew … 66 = Revelation);
  - `flag`: why the verse is queued (`missing`, `uncertain`, `unsupported`,
    `coverage`);
  - `words`: the target verse, word by word, as `index:word`;
  - `current`: the target verse with its current marking between `⟦` and `⟧`, or
    `null`. It may be wrong;
  - `references`: the same verse in reference Bibles, words of Jesus between
    `⟦` and `⟧`. KJV, NASB2020 and NASB1995 are marked by their publishers;
    LSG (French targets) is a historical, less reliable marking;
  - `previous`, `next`: the neighbouring target verses, for context.

## Output

Write a JSON array to `resultPath`, one entry per verse of the batch, in the
same order:

```json
[
  { "ref": "40-10-5", "words": [[15, 28]] },
  { "ref": "40-14-18", "words": [[4, 4]] },
  { "ref": "44-10-13", "words": [] }
]
```

`words` lists inclusive ranges of target word indexes. Use several ranges when
narration interrupts the speech. Use `[]` when the verse has no words of Jesus.
Parse the file back before finishing and report how many verses you answered.

## Editorial rules

1. Mark what Jesus himself says in direct speech: during his ministry, after his
   resurrection, and when he speaks from heaven (Acts 9:4-6, 9:10-16,
   18:9-10, 22:7-10, 22:18-21, 23:11, 26:14-18; his words in Revelation,
   notably chapters 1-3 and 22).
2. Scripture that Jesus quotes is part of his speech.
3. Never mark narration or speech introductions (`Jésus lui dit :`,
   `répondit-il`, `dit Jésus`, `he said`), even when inserted inside the speech:
   split the speech into two ranges around them. Never include the introducing
   colon.
4. Do not mark other speakers: the Father's voice from heaven, angels, the
   Spirit, disciples, crowds. Do not mark someone else reporting or recalling
   what Jesus said (Luke 24:6-7, John 21:23), nor indirect speech. Words of
   Jesus quoted by an apostle (Acts 20:35, 1 Corinthians 11:24-25,
   2 Corinthians 12:9) are marked only when the references mark them.
5. Include quotation marks and dashes that open or close the speech when they
   are separate words; include final punctuation of the speech.
6. Follow the target translation's own quotation structure when it clearly
   differs from the references, for example a translation that closes Jesus'
   words after John 3:15 so that 3:16-21 is narration. When the target is
   ambiguous, follow the majority of the references.
7. Versification can differ: use `previous` and `next` to recognise when the
   target verse corresponds to a neighbouring reference verse.
8. Decide from the target text. Do not translate, rewrite or normalise it.
