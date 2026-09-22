# Medium — second draft batch source audit

100 new bilingual written-answer records: `medium-ot-051` through `medium-ot-100`
and `medium-nt-051` through `medium-nt-100`. Original batches are preserved.

## Sources actually consulted

- [Bible Gateway, Louis Segond](https://www.biblegateway.com/versions/Louis-Segond-LSG-Bible/):
  the exact LSG passage URL for every one of the 100 records was fetched and its
  verse text read alongside the French question, answer and explanation. Ten
  initial HTTP 500 responses succeeded when retried using the record's bilingual
  LSG/KJV URL. All 100 final references returned the French passage text.
- [Public-domain KJV transcription with explicit verse numbers](https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json):
  every one of the 100 canonical references was resolved by explicit chapter and
  verse number, and the resulting verse was read alongside the English content.
- [Leviticus 25 KJV](https://www.biblegateway.com/passage/?search=Leviticus+25&version=KJV)
  and [Luke 14 KJV](https://www.biblegateway.com/passage/?search=Luke+14&version=KJV)
  were also opened as chapter context during authoring.

The earlier thiagobodruk KJV array transcription was not used as final authority:
it omits some verse entries, so array positions can drift (observed in Matthew 22
and Mark 8). Explicit verse-number lookup and the LSG passage checks confirmed the
final references. Every record includes a reusable link to both LSG and KJV.

## Editorial corrections and duplication review

- Compared all original 300 facts, then the three new batches; replaced semantic
  duplicates across difficulty levels, including paraphrased and inverse versions.
- Coordinated overlapping new topics with the easy/hard authors. Automated checks
  found unique IDs and fact keys across the final 600-record catalogue.
- Avoided three proposed passages with LSG/KJV numbering differences by selecting
  different facts instead of attaching a misleading common reference.
- Hosea 6:6 uses `piété` in LSG and `mercy` in KJV. The French answer uses the LSG
  wording, records alternative renderings as aliases, and explains that difference.
- Explanations are authored paraphrases rather than copied Bible verses. Numeric
  and common spelling/translation aliases are provided for written answers.

## Limits of this audit

This is an editorial draft, not a published question bank. Difficulty is an author
judgment, and some answers are actions or ideas rather than names. Human review
must still calibrate difficulty, acceptable answer breadth and the bilingual
phrasing. A verse may identify the answer while the surrounding chapter supplies
the narrative context; the reading links allow that context to be examined.
Distinct details from one story remain separate facts, so avoiding exact repeats
does not guarantee that a player never revisits the same biblical episode.
