# BibleProject visual commentary anchors

Research snapshot: 2026-08-04.

## Conclusion

The current `visual-commentary` slice contains 44 YouTube source records. Forty-three are usable passage editions and one is a French trailer that should be excluded from the editorial manifest. The publishable records resolve to 24 conceptual works; the trailer remains an excluded source record rather than a work.

- 19 works have both French and English YouTube editions in the corpus;
- three publishable works currently have only a French YouTube edition in the corpus;
- two works currently have only an English YouTube edition in the corpus;
- one additional French-only source record is the excluded trailer;
- the app must select an edition strictly from the route/application language, with no cross-language fallback.

The 24 publishable works cover:

- six whole chapters or poems: Genesis 1, Psalm 1, Psalm 8, Proverbs 8, Isaiah 61, and Psalm 148;
- the prologue of John (`John 1:1-18`);
- the divine-character declaration in `Exodus 34:6-7`;
- two complete Sermon on the Mount overviews (`Matthew 5:1-7:29`), produced in different series;
- fourteen focused Sermon on the Mount works.

There are no unresolved provider identities in this subset. There is one source inconsistency worth preserving explicitly: the newer “Warnings About Religious Practices” page summarizes `Matthew 6:1-8`, while the official script actually treats generosity (`6:1-4`), private prayer (`6:5-6`), and fasting (`6:16-18`). The proposed work therefore has two discontiguous anchors rather than an invented continuous range.

## Method and source policy

Only first-party evidence was used:

1. BibleProject video pages and collections establish canonical subjects, series membership, and exact passage labels. The older visual-commentary collection publishes ranges such as `Matthew 5:3-16`, `Matthew 5:17-20`, `Matthew 6:1-4`, `Matthew 6:9-13`, and `Matthew 6:19-23`. [BibleProject: Sermon on the Mount Visual Commentaries](https://bibleproject.com/videos/collections/sermon-on-the-mount-visual-commentaries/)
2. BibleProject guides establish the ten-part newer Sermon on the Mount structure: `Matthew 5:21-32`, `5:33-48`, `7:1-12`, and the other sections documented below. [BibleProject: Sermon on the Mount guides](https://bibleproject.com/guides/categories/sermon-on-the-mount/)
3. BibleProject's official script-reference PDFs resolve cases where a summary is too broad or inconsistent. In particular, the religious-practices script cites `Matthew 6:1`, `6:2-4`, `6:5-6`, and `6:16-18`. [BibleProject script references: Warnings About Religious Practices](https://d1bsmz3sdihplr.cloudfront.net/media/SOTM-Episode-6/Premiere%20Video/SOTM06_Script%20References.pdf)
4. The official English and French YouTube metadata already stored in `catalog.json` confirms localized episode numbers, parallel descriptions and section timestamps. It was used to pair editions, never to infer a passage from engagement data or reading-plan context.

The non-Sermon works are also explicitly passage-based in BibleProject's library. The Creation collection names Genesis 1, Psalm 8, Proverbs 8, Psalm 148, and John 1 as its five passage commentaries. [BibleProject: Creation collection](https://bibleproject.com/videos/collections/creation/) The John resource is specifically about the prologue in `John 1:1-18`, not every event in the chapter. [BibleProject: John 1 article](https://bibleproject.com/articles/john-1/) The Character of God introduction is explicitly `Exodus 34:6-7`. [BibleProject: Exodus 34:6-7](https://bibleproject.com/videos/character-of-god-exodus/)

No plan-day context, transcript cross-reference, playlist recommendation, or thematic allusion was promoted to a primary anchor. Cross-references mentioned inside a commentary belong in related-resource data later; they are not additional inline placements for the work.

## Machine-actionable conventions

- `anchor` uses OSIS-like book abbreviations and inclusive ranges.
- A semicolon separates multiple primary ranges for one work.
- `reviewed/high` means a first-party title, guide, collection, or script explicitly supports the range.
- `excluded/high` means first-party metadata identifies a non-editorial asset such as a trailer.
- Rows sharing a `proposedWorkId` are conceptual French/English editions of the same work.
- A missing edition in one language remains missing. It must not trigger fallback to the other language.

## Reviewed edition table

| Provider ID | Lang | Proposed work ID | Anchor | Confidence / review | Decision | First-party source |
|---|---|---|---|---|---|---|
| `nxwzq1PJImM` | en | `bp-vc-exodus-34-6-7` | `EXO.34.6-EXO.34.7` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/character-of-god-exodus/) · [YouTube](https://www.youtube.com/watch?v=nxwzq1PJImM) |
| `afVN-7vY0KA` | en | `bp-vc-genesis-1` | `GEN.1.1-GEN.1.31` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/genesis-1/) · [YouTube](https://www.youtube.com/watch?v=afVN-7vY0KA) |
| `-V8X5SJKIKY` | fr | `bp-vc-genesis-1` | `GEN.1.1-GEN.1.31` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/genesis-1/) · [YouTube](https://www.youtube.com/watch?v=-V8X5SJKIKY) |
| `E7k01kfBx6Y` | en | `bp-vc-psalm-1` | `PSA.1.1-PSA.1.6` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/psalm-1/) · [YouTube](https://www.youtube.com/watch?v=E7k01kfBx6Y) |
| `dFLNnAF0Kno` | fr | `bp-vc-psalm-1` | `PSA.1.1-PSA.1.6` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/psalm-1/) · [YouTube](https://www.youtube.com/watch?v=dFLNnAF0Kno) |
| `d_-xvaK4wIw` | en | `bp-vc-psalm-8` | `PSA.8.1-PSA.8.9` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/psalm-8/) · [YouTube](https://www.youtube.com/watch?v=d_-xvaK4wIw) |
| `k8P-x34iYRE` | en | `bp-vc-proverbs-8` | `PRO.8.1-PRO.8.36` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/proverbs-8/) · [YouTube](https://www.youtube.com/watch?v=k8P-x34iYRE) |
| `z37vJGdYEZw` | fr | `bp-vc-proverbs-8` | `PRO.8.1-PRO.8.36` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/proverbs-8/) · [YouTube](https://www.youtube.com/watch?v=z37vJGdYEZw) |
| `d_Q6WkD_Pas` | en | `bp-vc-isaiah-61` | `ISA.61.1-ISA.61.11` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/isaiah-61/) · [YouTube](https://www.youtube.com/watch?v=d_Q6WkD_Pas) |
| `wvqT2nT7YQs` | fr | `bp-vc-isaiah-61` | `ISA.61.1-ISA.61.11` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/isaiah-61/) · [YouTube](https://www.youtube.com/watch?v=wvqT2nT7YQs) |
| `XgCrFl4Mc5Q` | en | `bp-vc-psalm-148` | `PSA.148.1-PSA.148.14` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/psalm-148/) · [YouTube](https://www.youtube.com/watch?v=XgCrFl4Mc5Q) |
| `sEVljAVAjQE` | fr | `bp-vc-psalm-148` | `PSA.148.1-PSA.148.14` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/psalm-148/) · [YouTube](https://www.youtube.com/watch?v=sEVljAVAjQE) |
| `XgslCbXOOIE` | en | `bp-vc-john-1-prologue` | `JHN.1.1-JHN.1.18` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/john-1/) · [YouTube](https://www.youtube.com/watch?v=XgslCbXOOIE) |
| `Ag43Hsy7I9g` | fr | `bp-vc-john-1-prologue` | `JHN.1.1-JHN.1.18` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/john-1/) · [YouTube](https://www.youtube.com/watch?v=Ag43Hsy7I9g) |
| `ajwehw_AT0s` | en | `bp-vc-sotm-overview` | `MAT.5.1-MAT.7.29` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/matthew-5-7-sermon-overview/) · [YouTube](https://www.youtube.com/watch?v=ajwehw_AT0s) |
| `lD91ISyYLns` | fr | `bp-vc-sotm-overview` | `MAT.5.1-MAT.7.29` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/matthew-5-7-sermon-overview/) · [YouTube](https://www.youtube.com/watch?v=lD91ISyYLns) |
| `W9fR7sHw9Y8` | en | `bp-vc-sotm-beatitudes` | `MAT.5.3-MAT.5.16` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/matthew-5-3-16-beatitudes/) · [YouTube](https://www.youtube.com/watch?v=W9fR7sHw9Y8) |
| `fAtTege_8Uw` | fr | `bp-vc-sotm-beatitudes` | `MAT.5.3-MAT.5.16` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/matthew-5-3-16-beatitudes/) · [YouTube](https://www.youtube.com/watch?v=fAtTege_8Uw) |
| `Bpk-sI4MY58` | en | `bp-vc-sotm-righteousness` | `MAT.5.17-MAT.5.20` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/matthew-5-17-20-righteousness-and-jesus-bible/) · [YouTube](https://www.youtube.com/watch?v=Bpk-sI4MY58) |
| `hzheDBua6Ds` | fr | `bp-vc-sotm-righteousness` | `MAT.5.17-MAT.5.20` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/matthew-5-17-20-righteousness-and-jesus-bible/) · [YouTube](https://www.youtube.com/watch?v=hzheDBua6Ds) |
| `5xpP3ehZQ_Q` | fr | `bp-vc-sotm-generosity` | `MAT.6.1-MAT.6.4` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/matthew-6-1-4-generosity-and-true-reward/) · [YouTube](https://www.youtube.com/watch?v=5xpP3ehZQ_Q) |
| `0hmvIRKOmWI` | fr | `bp-vc-sotm-prayer` | `MAT.6.9-MAT.6.13` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/matthew-6-9-13-prayer-jesus/) · [YouTube](https://www.youtube.com/watch?v=0hmvIRKOmWI) |
| `JVCL1zZrEgU` | fr | `bp-vc-sotm-wealth` | `MAT.6.19-MAT.6.23` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/matthew-619-23-true-wealth-and-generosity/) · [YouTube](https://www.youtube.com/watch?v=JVCL1zZrEgU) |
| `NtKb7CJDUZc` | en | `bp-sotm-2024-01-intro` | `MAT.5.1-MAT.7.29` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/intro-to-sermon-on-the-mount/) · [YouTube](https://www.youtube.com/watch?v=NtKb7CJDUZc) |
| `ZIrt850LLIo` | fr | `bp-sotm-2024-01-intro` | `MAT.5.1-MAT.7.29` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/intro-to-sermon-on-the-mount/) · [YouTube](https://www.youtube.com/watch?v=ZIrt850LLIo) |
| `s9246LGlngs` | en | `bp-sotm-2024-02-beatitudes` | `MAT.5.3-MAT.5.16` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/the-beatitudes/) · [YouTube](https://www.youtube.com/watch?v=s9246LGlngs) |
| `R4mDSe8tGuI` | fr | `bp-sotm-2024-02-beatitudes` | `MAT.5.3-MAT.5.16` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/the-beatitudes/) · [YouTube](https://www.youtube.com/watch?v=R4mDSe8tGuI) |
| `KUil1m3P2iI` | en | `bp-sotm-2024-03-fulfills-law` | `MAT.5.17-MAT.5.20` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/jesus-fulfills-the-law/) · [YouTube](https://www.youtube.com/watch?v=KUil1m3P2iI) |
| `ncszdDRy0-s` | fr | `bp-sotm-2024-03-fulfills-law` | `MAT.5.17-MAT.5.20` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/jesus-fulfills-the-law/) · [YouTube](https://www.youtube.com/watch?v=ncszdDRy0-s) |
| `okFibMvn3t0` | en | `bp-sotm-2024-04-murder-adultery-divorce` | `MAT.5.21-MAT.5.32` | reviewed/high | publish | [BibleProject guide](https://bibleproject.com/guides/murder-adultery-and-divorce/) · [YouTube](https://www.youtube.com/watch?v=okFibMvn3t0) |
| `XgL1itLMbZI` | fr | `bp-sotm-2024-04-murder-adultery-divorce` | `MAT.5.21-MAT.5.32` | reviewed/high | publish | [BibleProject guide](https://bibleproject.com/guides/murder-adultery-and-divorce/) · [YouTube](https://www.youtube.com/watch?v=XgL1itLMbZI) |
| `3EkD-alQhT8` | en | `bp-sotm-2024-05-oaths-retaliation-enemies` | `MAT.5.33-MAT.5.48` | reviewed/high | publish | [BibleProject guide](https://bibleproject.com/guides/oaths-retaliation-and-enemy-love/) · [YouTube](https://www.youtube.com/watch?v=3EkD-alQhT8) |
| `AgnvQ-HGKwc` | fr | `bp-sotm-2024-05-oaths-retaliation-enemies` | `MAT.5.33-MAT.5.48` | reviewed/high | publish | [BibleProject guide](https://bibleproject.com/guides/oaths-retaliation-and-enemy-love/) · [YouTube](https://www.youtube.com/watch?v=AgnvQ-HGKwc) |
| `wCo2LN7E6bo` | en | `bp-sotm-2024-06-religious-practices` | `MAT.6.1-MAT.6.6; MAT.6.16-MAT.6.18` | reviewed/high | publish as two anchors | [BibleProject script](https://d1bsmz3sdihplr.cloudfront.net/media/SOTM-Episode-6/Premiere%20Video/SOTM06_Script%20References.pdf) · [YouTube](https://www.youtube.com/watch?v=wCo2LN7E6bo) |
| `At-rlvIFjHg` | fr | `bp-sotm-2024-06-religious-practices` | `MAT.6.1-MAT.6.6; MAT.6.16-MAT.6.18` | reviewed/high | publish as two anchors | [BibleProject script](https://d1bsmz3sdihplr.cloudfront.net/media/SOTM-Episode-6/Premiere%20Video/SOTM06_Script%20References.pdf) · [YouTube](https://www.youtube.com/watch?v=At-rlvIFjHg) |
| `3-YlqQfKkKk` | en | `bp-sotm-2024-07-lords-prayer` | `MAT.6.9-MAT.6.13` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/lords-prayer/) · [YouTube](https://www.youtube.com/watch?v=3-YlqQfKkKk) |
| `Ws74bmmpf8w` | fr | `bp-sotm-2024-07-lords-prayer` | `MAT.6.9-MAT.6.13` | reviewed/high | publish | [BibleProject](https://bibleproject.com/videos/lords-prayer/) · [YouTube](https://www.youtube.com/watch?v=Ws74bmmpf8w) |
| `GpqOdHV3dmU` | en | `bp-sotm-2024-08-wealth-worry` | `MAT.6.19-MAT.6.34` | reviewed/high | publish | [BibleProject guide](https://bibleproject.com/guides/wealth-and-worry/) · [YouTube](https://www.youtube.com/watch?v=GpqOdHV3dmU) |
| `mBJrqtG_Cdk` | fr | `bp-sotm-2024-08-wealth-worry` | `MAT.6.19-MAT.6.34` | reviewed/high | publish | [BibleProject guide](https://bibleproject.com/guides/wealth-and-worry/) · [YouTube](https://www.youtube.com/watch?v=mBJrqtG_Cdk) |
| `PqEiqCuIsvw` | en | `bp-sotm-2024-09-wisdom-relationships` | `MAT.7.1-MAT.7.12` | reviewed/high | publish | [BibleProject guide](https://bibleproject.com/guides/wisdom-in-relationships/) · [YouTube](https://www.youtube.com/watch?v=PqEiqCuIsvw) |
| `txV5-inh6GM` | fr | `bp-sotm-2024-09-wisdom-relationships` | `MAT.7.1-MAT.7.12` | reviewed/high | publish | [BibleProject guide](https://bibleproject.com/guides/wisdom-in-relationships/) · [YouTube](https://www.youtube.com/watch?v=txV5-inh6GM) |
| `0iJ1-_nH47c` | en | `bp-sotm-2024-10-choice` | `MAT.7.13-MAT.7.27` | reviewed/high | publish | [BibleProject guide](https://bibleproject.com/guides/the-choice/) · [YouTube](https://www.youtube.com/watch?v=0iJ1-_nH47c) |
| `Ofmvixu-FIY` | fr | `bp-sotm-2024-10-choice` | `MAT.7.13-MAT.7.27` | reviewed/high | publish | [BibleProject guide](https://bibleproject.com/guides/the-choice/) · [YouTube](https://www.youtube.com/watch?v=Ofmvixu-FIY) |
| `yIVUi1xSaMw` | fr | `bp-sotm-2024-trailer` | — | excluded/high | exclude: trailer | [YouTube: “Prochainement”](https://www.youtube.com/watch?v=yIVUi1xSaMw) |

## Pairing result

The reviewed conceptual pairs are:

| Work family | English provider ID | French provider ID |
|---|---|---|
| Genesis 1 | `afVN-7vY0KA` | `-V8X5SJKIKY` |
| Psalm 1 | `E7k01kfBx6Y` | `dFLNnAF0Kno` |
| Proverbs 8 | `k8P-x34iYRE` | `z37vJGdYEZw` |
| Isaiah 61 | `d_Q6WkD_Pas` | `wvqT2nT7YQs` |
| Psalm 148 | `XgCrFl4Mc5Q` | `sEVljAVAjQE` |
| John 1 prologue | `XgslCbXOOIE` | `Ag43Hsy7I9g` |
| Older Sermon overview | `ajwehw_AT0s` | `lD91ISyYLns` |
| Older Beatitudes | `W9fR7sHw9Y8` | `fAtTege_8Uw` |
| Older Righteousness | `Bpk-sI4MY58` | `hzheDBua6Ds` |
| New Sermon episode 1 | `NtKb7CJDUZc` | `ZIrt850LLIo` |
| New Sermon episode 2 | `s9246LGlngs` | `R4mDSe8tGuI` |
| New Sermon episode 3 | `KUil1m3P2iI` | `ncszdDRy0-s` |
| New Sermon episode 4 | `okFibMvn3t0` | `XgL1itLMbZI` |
| New Sermon episode 5 | `3EkD-alQhT8` | `AgnvQ-HGKwc` |
| New Sermon episode 6 | `wCo2LN7E6bo` | `At-rlvIFjHg` |
| New Sermon episode 7 | `3-YlqQfKkKk` | `Ws74bmmpf8w` |
| New Sermon episode 8 | `GpqOdHV3dmU` | `mBJrqtG_Cdk` |
| New Sermon episode 9 | `PqEiqCuIsvw` | `txV5-inh6GM` |
| New Sermon episode 10 | `0iJ1-_nH47c` | `Ofmvixu-FIY` |

The following works intentionally have no counterpart in the current corpus and must remain single-language:

- English only: `bp-vc-exodus-34-6-7`, `bp-vc-psalm-8`.
- French only: `bp-vc-sotm-generosity`, `bp-vc-sotm-prayer`, `bp-vc-sotm-wealth`.
- French only and excluded: `bp-sotm-2024-trailer`.

## Editorial implications

### Preserve distinct works that share an anchor

BibleProject has two different Sermon on the Mount video families: the older “Visual Commentaries” and the newer ten-episode “Sermon on the Mount” series. They frequently share a passage, but they are not duplicate provider editions and must not be collapsed into one work. For example:

- `bp-vc-sotm-overview` and `bp-sotm-2024-01-intro` both cover Matthew 5-7;
- `bp-vc-sotm-beatitudes` and `bp-sotm-2024-02-beatitudes` both cover Matthew 5:3-16;
- `bp-vc-sotm-righteousness` and `bp-sotm-2024-03-fulfills-law` both cover Matthew 5:17-20;
- the older French prayer and wealth commentaries coexist with broader newer episodes.

This creates a product-ranking question, not a data-quality problem. Both can remain in chapter resources, but only one should normally be promoted inline at a given anchor. A sensible default is to promote the newer ten-part episode and keep the older, more text-specific work under “More resources,” except where the older work has a narrower exact range such as `Matthew 6:1-4` or `6:19-23`.

### Do not turn script cross-references into anchors

The Lord's Prayer script cites Exodus, Ezekiel, Psalms, Matthew 5, Matthew 18, and Matthew 26 to explain the prayer. Its primary text remains `Matthew 6:9-13`. [BibleProject script references: The Lord's Prayer](https://d1bsmz3sdihplr.cloudfront.net/media/SOTM-Episode-7/SOTM07_Script%20References.pdf) The same rule applies to every visual commentary: explanatory cross-references can become related links later, but not additional inline placements.

### Recommended manifest assertions

A generator for this subset should fail unless all of the following remain true:

- exactly 44 source editions are classified;
- exactly 43 editions are publishable and one is excluded;
- exactly 24 publishable works exist and the trailer remains an excluded source record;
- exactly 19 works have both `fr` and `en` editions;
- exactly three publishable works are French-only;
- exactly two publishable works are English-only;
- no work has more than one edition for the same language;
- all publishable editions have at least one reviewed primary anchor;
- `bp-sotm-2024-06-religious-practices` has exactly two anchors;
- language indexes contain only editions in that exact language.
