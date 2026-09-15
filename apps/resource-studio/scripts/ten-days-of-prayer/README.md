# Ten Days of Prayer

Six official General Conference Ministerial Association campaigns, each in French and
English: 2026, 2025, 2024, 2023, 2016, 2014. User confirmed Adventist content rights and
selected these prayer plans on 2026-09-15. This authoring workflow prepares the existing
Firestore reading-plan format; it does not use or change the Resource Delivery catalog.

## Reproduce

Use a Python virtual environment with `requirements.txt`, then run:

```sh
python collect.py
python build.py
python -m unittest discover -p 'test_*.py'
```

`sources.json` records the exact official archive/PDF URLs. The collector uses three
concurrent requests, extracts only PDF members with safe generated filenames, and selects
the English subarchive inside the multilingual 2014/2016 archives. No authentication or
private publisher API is required.

The four recent English editions use the official HTML daily sections. French combined
PDF page ranges were inspected explicitly; individual daily files are used when available.
2014 day-one files include an introduction before the daily reading, which is excluded.
Day eleven, final Sabbath celebrations, outreach appendices and leader guides remain in
the cached source package, outside the ten-day reading sequence.

PDF text uses PyMuPDF to avoid artificial spaces introduced by letter-spaced headings.
Paragraph breaks, prayer lists and known Symbol/Wingdings bullet glyphs are preserved.
Running publication headers are omitted, but biblical quotations, original prayer prompts,
Ellen White excerpts and their citations remain in order. English and French translations
are imported independently, not machine-translated or forced into textual parity.

Each daily unit contains the full original reading as a Text slice. The app's existing
reference parser makes recognized Bible references navigable. The original fixed January
campaign dates are not used as participation dates: explicit `kind: reading-plan` and
`duration: 10` allow each reader to begin freely. Editorial years remain metadata.

Original simple PNG covers distinguish the themes and are embedded as data URLs. No
publisher logo or third-party photo is copied for the covers.

## Artifacts and publication

`output/imports/ten-days-of-prayer-2026-09/` contains downloads and source hashes,
120 daily readings with source file/page provenance, 24 Firestore documents, validation,
covers and publication receipts. Large source PDFs/ZIPs and HTML are locally cached and
ignored by Git.

From repository root, the separate publication tool provides:

```sh
python3 scripts/publish-ten-days-of-prayer.py preflight
python3 scripts/publish-ten-days-of-prayer.py publish
python3 scripts/publish-ten-days-of-prayer.py verify
```

It creates 12 new plan parents and 12 sections atomically in `bible-strong-app`, with
`exists: false` on every write. Existing plans and user progress cannot be overwritten.
After an uncertain write, verify before retrying. A receipt plus remote verification,
not the presence of local files, proves publication.

The initial PDF campaign/day headings are omitted from the body because the app already
renders the plan and day titles. This removes presentation duplication only; all subsequent
quotations, readings and prayer instructions are retained. `heading-cleanup-receipt.json`
records the guarded follow-up update after the first visual check. `verification.json`
corresponds to the final document digest.

Display credit uses the program name (« 10 jours de prière » / “10 Days of Prayer”).
The `attribution` field retains the full General Conference Ministerial Association publisher
credit and an official program URL, rendered in plan details on web and native. The author
identity remains `general-conference-ministerial`. `author-attribution-receipt.json` records
the user-authorized metadata update; daily content and progress identifiers are unchanged.
