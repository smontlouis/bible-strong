# Reading plans

## September 2026 additions

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

### Reproduce

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

## October 2026 addition: the chronological plan

One concept, two language editions, 730 reading days: « The One Year Chronological Bible »,
the schedule Tyndale House Publishers offers on YouVersion (plan 10819). Requested by a
reader on 2026-10-11 and added on the owner's go the same day.

The source has no devotional text: each day is a list of Scripture references, 1,756 in
all. The English edition keeps the publisher's title and description. No French publisher
edition was located, so the French edition is the same schedule with a translated title,
description, and day labels. Both use the publisher's cover image URL.

Consecutive whole chapters of one book are stored as one chapter range (Genesis 1, 2, 3
becomes Genesis 1-3); the reading order is unchanged. Every reference was checked against
the app's Bible structure, and the schedule covers all 1,189 chapters.

The collector was a one-off and is not kept in the repository. The record of the release is
`output/imports/reading-plans-2026-10/`: source URLs and hashes, the 40 Firestore documents,
the validation summary, the publication receipt, and its verification.

## Existing delivery path

Reading plans currently use Firestore `plans/{id}` and `plan-sections/{sectionId}`,
not the versioned Resource Delivery catalog for Bible/lexicon/dictionary content.
Authoring here only produces documents. The root release tool owns publication:

```sh
python3 scripts/publish-reading-plans.py preflight [release]
python3 scripts/publish-reading-plans.py publish [release]
python3 scripts/publish-reading-plans.py verify [release]
```

`release` is a folder of `output/imports/` and defaults to `reading-plans-2026-09`. The
target is explicitly `bible-strong-app` / `(default)`. A release creates all its documents
(72 in September) in a single atomic commit, each with an `exists: false` precondition. It
never overwrites existing plans or user progress. `catalog-before.json` records the previous public catalog;
`receipt.json` and `verification.json` prove actual publication. Never blindly retry after
an uncertain commit: run verify and inspect the receipt first.

A 401 means the Firebase CLI access token has expired; any CLI command, such as
`firebase projects:list`, renews it.
