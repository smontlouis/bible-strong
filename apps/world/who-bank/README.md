# Who am I? — editorial catalogue

200 bilingual identity cards: 110 people, 52 places and 38 objects. Each card has
four individually sourced clues in 4–3–2–1 order, from a less familiar detail to a
recognizable event or association. Clues accumulate; a first clue can fit more
than one identity while later clues disambiguate. Points express reveal stage,
not a separate difficulty tier. Testament labels describe the chosen story context;
some places or objects appear across both Testaments.

Open `/who-lab.html` with `yarn dev:world`. Preview masks identities until an exact
normalized answer/alias matches or the reviewer reveals the answer. It has no
opponent, timer or Jev adjudication. Unrecognized answers can be retried; revealing
scores zero. Review mode displays both languages, all sources and answer variants.
Notes and decisions are saved locally under a dedicated key and can be exported.
Category filtering is an editorial aid, not a restored live-game setup option.

The server imports these cards into the shared SQLite GameCatalogue for live
Who am I rounds. The production client never receives the full catalogue.
Use the review UI to improve clue progression and accepted variants. See each
category's source notes for checks performed and limitations. The existing
1,200 written-answer questions remain a separate catalogue.

## Review batches

The original 30-card pilot remains batch 1. Additional identities retain stable
category IDs and form batches 2–5 of 30 cards each. Person additions are divided
17/17/17/19, places 8/8/8/6, and objects 5/5/5/5. Use the review batch selector or
`/who-lab.html?batch=2`. Export includes batch numbers and all current decisions.
The extra files and their source notes describe the added identities. Distribution
between Testaments follows source richness rather than an artificial equal quota.

## Further curated additions

The `*-more.json` files add 48 identities (28 people, 12 places, 8 objects).
Selection prioritizes recognizable narratives with four useful clues, rather than
meeting a numerical quota. These additions form batch 6 (30 cards) and batch 7
(18 cards before the final additions). The previous five batches and their IDs stay stable. Per-category
source notes describe the reviewed passages and editorial exclusions.

`people-final.json` adds Abel and Melchizedek with eight sourced bilingual clues.
Batch 7 now contains 20 cards, bringing the catalogue to 200 identities and 800 clues.
See `people-final-sources.md` for the checked passages.
