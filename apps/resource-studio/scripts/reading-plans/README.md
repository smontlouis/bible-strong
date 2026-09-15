# Reading plans: September 2026 additions

Authoring tools for the eight BibleProject plans selected by the user and six original
chapter-per-day Bible Strong plans. Publisher reuse rights were explicitly confirmed by
the user on 2026-09-15: « Les 8 plans de Bible Projects (on a les droits) + ceux qu'on peut
construire nous-même ».

The collection has 14 concepts, 26 language editions, and 642 reading days:
- BibleProject: eight English editions, six official French editions (432 days).
- Bible Strong: Mark (16), John (21), Proverbs (31), Acts (28), James (5), Philippians (4),
  each in French and English (210 days).

The Lord's Prayer and Sermon on the Mount have no French plan edition located in the
publisher's French catalog. Do not classify English content as French merely because the
YouVersion interface is translated. These two plans remain English only.

## Reproduce

```sh
python3 -m venv /tmp/bible-plans-venv
/tmp/bible-plans-venv/bin/pip install -r apps/resource-studio/scripts/reading-plans/requirements.txt
/tmp/bible-plans-venv/bin/python apps/resource-studio/scripts/reading-plans/collect.py
/tmp/bible-plans-venv/bin/python -m unittest discover -s apps/resource-studio/scripts/reading-plans -p 'test_*.py'
/tmp/bible-plans-venv/bin/python apps/resource-studio/scripts/reading-plans/build.py
```

`output/imports/reading-plans-2026-09/` contains source URLs/hashes, daily content,
validated Firestore documents, original cover PNGs, and the validation summary. Large HTML
snapshots are cached locally and ignored by Git. The collector uses at most three concurrent
requests and fails if a day's identity or Scripture section cannot be verified.

Scripture references come only from the day's Scripture list, never from incidental links
in its devotional text. Canonical book/chapter/verse coordinates are validated against the
app's Bible structure. Bible translations are not scraped: the reader uses its selected
version. Publisher paragraphs and lists are retained as plain text; typography and emphasis
follow the existing reader. Original HTML remains in the source manifest for traceability.
Videos retain their position, with original YouTube or publisher-hosted streaming URLs;
video files are not downloaded/rehosted. The original English Paul's Letters description
says 53 days although its published schedule has 60; the schedule and all 60 days are
preserved, as is the source description.

New catalog records carry explicit `kind`, `type: reading-plan`, and `duration` metadata.
Bible Strong cover PNGs are small inline data URLs, so no external asset publication is
needed. BibleProject covers use the publisher's original image URLs.

## Existing delivery path

Reading plans currently use Firestore `plans/{id}` and `plan-sections/{sectionId}`,
not the versioned Resource Delivery catalog for Bible/lexicon/dictionary content.
Authoring here only produces documents. The root release tool owns publication:

```sh
python3 scripts/publish-reading-plans.py preflight
python3 scripts/publish-reading-plans.py publish
python3 scripts/publish-reading-plans.py verify
```

The target is explicitly `bible-strong-app` / `(default)`. The release creates 72 documents
in a single atomic commit, each with an `exists: false` precondition. It never overwrites
existing plans or user progress. `catalog-before.json` records the previous public catalog;
`receipt.json` and `verification.json` prove actual publication. Never blindly retry after
an uncertain commit: run verify and inspect the receipt first.
