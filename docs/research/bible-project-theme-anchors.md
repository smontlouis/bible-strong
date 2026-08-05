# BibleProject theme anchors for Bible View

Research snapshot: 2026-08-04.

## Conclusion

The current YouTube catalog contains **126 records classified as `theme`**: 75 English and 51 French. A strict Bible View review produces the following result:

- **21 English records are discarded**: Q+R, trailers and calls to action, reading-plan promotion, studio/behind-the-scenes pieces, derivative teaser clips, one vertical 9:16 recap, and one 54-minute compilation that duplicates the individual episodes;
- **one French record is a superseded duplicate upload** of the same Covenants film and should not be published;
- **104 primary-category records remain publishable**: 54 English and 50 French;
- full-catalog reconciliation adds **seven genuine localized counterparts** whose collector categories differ: three English editions currently under `book-collection`, two French editions under `how-to-read`, and two French editions under `uncategorized`;
- the reconciled result is **57 conceptual works and 111 publishable editions**: 57 English and 54 French;
- **54 works are bilingual** and **three are currently English-only**: commandments 9 and 10, and Son of Man;
- every work has exactly one reviewed primary passage anchor suitable for chapter-end “Pour aller plus loin”; broad thematic cross-references remain related anchors and must not cause inline placement.

There is no Nave dependency in this model. Passage anchors alone determine Bible View placement, and edition selection remains strict to the route/application language.

## Scope and source policy

Only first-party evidence was used:

1. `docs/research/data/bible-project/catalog.json`, collected from the official English and French YouTube channels with the YouTube Data API, establishes provider identity, title, description, duration, publication date, category, and availability.
2. BibleProject's official collections establish the editorial series and distinguish canonical explainers from support material: [The 10 Commandments](https://bibleproject.com/videos/collections/the-10-commandments/), [The Royal Priest](https://bibleproject.com/videos/collections/the-royal-priest/), and [Spiritual Beings](https://bibleproject.com/videos/collections/spiritual-beings/).
3. Official BibleProject video pages and scripts establish subjects and cited passages. Representative examples include [Sabbath](https://bibleproject.com/videos/sabbath-video/), [Temple](https://bibleproject.com/videos/temple/), [The Law](https://bibleproject.com/videos/law/), [Blessing and Curse](https://bibleproject.com/videos/blessing-and-curse/), and [Sacrifice and Atonement](https://bibleproject.com/videos/sacrifice-and-atonement/).
4. Official YouTube descriptions were used for newer works not yet consistently exposed through the public website, especially the 2025–2026 themes and Ten Commandments episodes.

No plan-day placement, engagement metric, suggested-video link, or incidental verse citation was promoted to a primary anchor.

## Editorial rules

- Keep full-length animated Bible explainers, including legitimate single-language works.
- Exclude Q+R, trailers, promotions, reading-plan and group-study calls to action, studio/behind-the-scenes pieces, and derivative teaser clips.
- Exclude a compilation when all of its constituent canonical episodes are already present and the format is unsuitable for a chapter-end resource.
- Exclude vertical 9:16 editions regardless of duration or playlist category. A short duration alone remains acceptable for a landscape explainer; `O1nDieIu8Xc` is excluded because its provider player geometry is vertical, not merely because it lasts 1:43.
- Categories are projections, not identity boundaries. A defensible localized counterpart is reconciled even when the collector assigned it another category.
- A work receives one representative `primaryAnchor`. Additional passages are `relatedAnchors` for discovery only and must not multiply chapter-end placements.
- No FR/EN fallback: a French route displays only the French edition, and an English route only the English edition.

## Machine-actionable conventions

- Work IDs are durable lower-case identifiers prefixed with `bp-theme-`.
- Passage syntax is OSIS-like and inclusive.
- Multiple related ranges are separated by semicolons.
- `reviewed/high` means the exact passage is intrinsic to the official subject or series structure.
- `reviewed/editorial` means the official work is panoramic and the listed passage is the reviewed representative entry point for Bible View, not a claim that the video comments only on that passage.
- `cross:<category>` marks an edition reconciled from outside `theme`.
- `—` means that no edition exists in the current 795-record catalog.

## Publishable work table

| Proposed work ID | Series | EN provider ID | FR provider ID | Primary anchor | Related anchors | Review / first-party source |
|---|---|---|---|---|---|---|
| `bp-theme-ten-commandments-wisdom` | ten-commandments | `4M9BsOvx6cs` | `5lTa7w35MyE` | `EXO.20.1-EXO.20.17` | `DEU.5.6-DEU.5.21; PSA.1.1-PSA.1.6` | reviewed/high · [collection](https://bibleproject.com/videos/collections/the-10-commandments/) |
| `bp-theme-ten-commandments-01-no-other-gods` | ten-commandments | `JGI8nNVkZpA` | `YZWuWGDIRjw` | `EXO.20.3` | `DEU.5.7` | reviewed/high · [collection](https://bibleproject.com/videos/collections/the-10-commandments/) |
| `bp-theme-ten-commandments-02-no-idols` | ten-commandments | `vXHDUs28rPM` | `-AnYtcOxw4s` | `EXO.20.4-EXO.20.6` | `DEU.5.8-DEU.5.10` | reviewed/high · [collection](https://bibleproject.com/videos/collections/the-10-commandments/) |
| `bp-theme-ten-commandments-03-carry-the-name` | ten-commandments | `elhazm4fZeE` | `uqDDycCxItU` | `EXO.20.7` | `DEU.5.11` | reviewed/high · [collection](https://bibleproject.com/videos/collections/the-10-commandments/) |
| `bp-theme-ten-commandments-04-sabbath` | ten-commandments | `VsAmFJ6quZk` | `tebmrRnqFMg` | `EXO.20.8-EXO.20.11` | `DEU.5.12-DEU.5.15` | reviewed/high · [collection](https://bibleproject.com/videos/collections/the-10-commandments/) |
| `bp-theme-ten-commandments-05-honor-parents` | ten-commandments | `Q7PgVAN2MPo` | `kvcJ_tHPc8I` | `EXO.20.12` | `DEU.5.16` | reviewed/high · [collection](https://bibleproject.com/videos/collections/the-10-commandments/) |
| `bp-theme-ten-commandments-06-protect-life` | ten-commandments | `uAQ5KaEd98Q` | `LV0-KIsZsBc` | `EXO.20.13` | `DEU.5.17` | reviewed/high · [collection](https://bibleproject.com/videos/collections/the-10-commandments/) |
| `bp-theme-ten-commandments-07-protect-marriage` | ten-commandments | `Pyk64lwOLpw` | `UwxUrEnl9Bk` | `EXO.20.14` | `DEU.5.18` | reviewed/high · [collection](https://bibleproject.com/videos/collections/the-10-commandments/) |
| `bp-theme-ten-commandments-08-do-not-steal` | ten-commandments | `WylKQKFI_4M` | `LBICDuRlPmo` | `EXO.20.15` | `DEU.5.19` | reviewed/high · [collection](https://bibleproject.com/videos/collections/the-10-commandments/) |
| `bp-theme-ten-commandments-09-truthful-witness` | ten-commandments | `SSBRI49NYmY` | — | `EXO.20.16` | `DEU.5.20` | reviewed/high · [YouTube](https://www.youtube.com/watch?v=SSBRI49NYmY) |
| `bp-theme-ten-commandments-10-desire` | ten-commandments | `185KpeCc-CY` | — | `EXO.20.17` | `DEU.5.21` | reviewed/high · [YouTube](https://www.youtube.com/watch?v=185KpeCc-CY) |
| `bp-theme-ten-commandments-recap` | ten-commandments | `O1nDieIu8Xc` | — | `EXO.20.1-EXO.20.17` | `DEU.5.6-DEU.5.21` | reviewed/high · canonical animated series recap; [YouTube](https://www.youtube.com/watch?v=O1nDieIu8Xc) |
| `bp-theme-royal-priest-eden` | royal-priest | `K60TAYja110` | `oSP0VMl-yCg` | `GEN.1.26-GEN.1.28` | `GEN.2.15; NUM.4.16` | reviewed/high · [BibleProject](https://bibleproject.com/videos/priests-of-eden/) |
| `bp-theme-royal-priest-melchizedek` | royal-priest | `KlZjA-3hiys` | `GpyKgtgnJmc` | `GEN.14.17-GEN.14.20` | `PSA.110.4; HEB.7.1-HEB.7.28` | reviewed/high · [BibleProject](https://bibleproject.com/videos/abraham-and-melchizedek/) |
| `bp-theme-royal-priest-moses-aaron` | royal-priest | `rhc1SjvYXqE` | `BWN1IDgN0sI` | `EXO.19.3-EXO.19.6` | `EXO.32.1-EXO.32.5; EXO.32.30-EXO.32.32` | reviewed/high · [BibleProject](https://bibleproject.com/videos/moses-and-aaron/) |
| `bp-theme-royal-priest-david` | royal-priest | `JCP2zWaJlGc` | `h1tBSe_0eCA` | `2SA.6.13-2SA.6.17` | `PSA.110.1-PSA.110.7; 1CH.21.26-1CH.22.1` | reviewed/editorial · [collection](https://bibleproject.com/videos/collections/the-royal-priest/) |
| `bp-theme-royal-priest-jesus` | royal-priest | `LBr-blQxIm4` | `ZJL2ZVDiJL8` | `MRK.10.45` | `HEB.7.1-HEB.10.39` | reviewed/editorial · [collection](https://bibleproject.com/videos/collections/the-royal-priest/) |
| `bp-theme-royal-priesthood` | royal-priest | `Tw-bBfBDpE0` | `QURmKkdxTk4` | `1PE.2.4-1PE.2.9` | `REV.22.3-REV.22.5` | reviewed/editorial · [collection](https://bibleproject.com/videos/collections/the-royal-priest/) |
| `bp-theme-spiritual-beings-god` | spiritual-beings | `eAvYmE2YYIU` | `tPxYu0ZPsjs` | `GEN.1.1-GEN.1.3` | `JHN.1.1-JHN.1.3` | reviewed/editorial · [collection](https://bibleproject.com/videos/collections/spiritual-beings/) |
| `bp-theme-spiritual-beings-introduction` | spiritual-beings | `cBxOZqtGTXE` | `9spMKqeT8zU` | `GEN.1.1` | `PSA.148.1-PSA.148.14` | reviewed/editorial · [collection](https://bibleproject.com/videos/collections/spiritual-beings/) |
| `bp-theme-spiritual-beings-elohim` | spiritual-beings | `U5iyUik97Lg` | `9QezT4U-vrU` | `PSA.82.1` | `DEU.6.4` | reviewed/high · [collection](https://bibleproject.com/videos/collections/spiritual-beings/) |
| `bp-theme-spiritual-beings-divine-council` | spiritual-beings | `e1rai6WoOJU` | `uRHqnheTYzQ` | `PSA.82.1-PSA.82.8` | `DEU.32.8-DEU.32.9` | reviewed/high · [collection](https://bibleproject.com/videos/collections/spiritual-beings/) |
| `bp-theme-spiritual-beings-angels-cherubim` | spiritual-beings | `-bMRxQbLUlg` | `2BgWsZx7-5E` | `GEN.3.24` | `EXO.25.18-EXO.25.22; ISA.6.1-ISA.6.7` | reviewed/editorial · [collection](https://bibleproject.com/videos/collections/spiritual-beings/) |
| `bp-theme-spiritual-beings-angel-of-yhwh` | spiritual-beings | `qgmf8bHayXw` | `Gth9P04n3o8` | `EXO.3.1-EXO.3.6` | `GEN.16.7-GEN.16.13` | reviewed/editorial · [collection](https://bibleproject.com/videos/collections/spiritual-beings/) |
| `bp-theme-spiritual-beings-satan-demons` | spiritual-beings | `CamYtVpoTNk` | `xbskH8vOe4k` | `GEN.3.1-GEN.3.15` | `JOB.1.6-JOB.1.12` | reviewed/editorial · [collection](https://bibleproject.com/videos/collections/spiritual-beings/) |
| `bp-theme-spiritual-beings-new-humanity` | spiritual-beings | `takEeHtRrMw` | `068pfnkfPOQ` | `DAN.7.13-DAN.7.14` | `GEN.1.26-GEN.1.28` | reviewed/editorial · [collection](https://bibleproject.com/videos/collections/spiritual-beings/) |
| `bp-theme-way-of-the-exile` | biblical-themes | `XzWpa0gcPyo` | `eN7pv0trosE` | `JER.29.4-JER.29.7` | `DAN.1.8-DAN.1.16` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/way-of-the-exile/) |
| `bp-theme-covenants` | biblical-themes | `6v4jKkFj3TI` | `MfuYg7P0iBI` | `GEN.12.1-GEN.12.3` | `GEN.9.8-GEN.9.17; EXO.19.3-EXO.19.6; 2SA.7.12-2SA.7.16; JER.31.31-JER.31.34` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/covenants/) |
| `bp-theme-chaos-dragon` | biblical-themes | `JN1thcowKXw` | `h-Pf4M6VZrU` | `GEN.1.20-GEN.1.21` | `PSA.74.12-PSA.74.17; ISA.27.1; REV.12.1-REV.12.17` | reviewed/high · [guide](https://bibleproject.com/guides/dragons-in-the-bible/) |
| `bp-theme-passover` | biblical-themes | `14x_PtlnJHw` | `RRna_gY_TLE` | `EXO.12.1-EXO.12.28` | `ISA.31.5` | reviewed/high · [YouTube](https://www.youtube.com/watch?v=14x_PtlnJHw) |
| `bp-theme-gospel-of-the-kingdom` | biblical-themes | `xmFPS0f-kzs` | `txGfRrR9v_M` | `MRK.1.14-MRK.1.15` | `ISA.52.7` | reviewed/high · [BibleProject](https://bibleproject.com/videos/gospel-kingdom/) |
| `bp-theme-redemption` | biblical-themes | `uib2G8GkG60` | `lX7rZ7hp_gQ` (`cross:uncategorized`) | `EXO.12.1-EXO.12.13` | `1PE.1.18-1PE.1.19` | reviewed/editorial · matched official descriptions; [YouTube EN](https://www.youtube.com/watch?v=uib2G8GkG60) · [FR](https://www.youtube.com/watch?v=lX7rZ7hp_gQ) |
| `bp-theme-holiness` | biblical-themes | `l9vn5UvsHvM` | `jxKoDvf2nXk` | `LEV.11.44-LEV.11.45` | `ISA.6.1-ISA.6.7` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/holiness/) |
| `bp-theme-heaven-and-earth` | biblical-themes | `Zy2AQlK6C5k` | `PZ-CmV2Xg6A` | `GEN.1.1` | `REV.21.1-REV.21.5` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/heaven-and-earth/) |
| `bp-theme-public-reading-scripture` | biblical-themes | `BO1Y9XyWKTw` | `OMPI6mMPj7E` | `NEH.8.1-NEH.8.8` | `1TI.4.13` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/public-reading-scripture/) |
| `bp-theme-sabbath` | biblical-themes | `PFTLvkB3JLM` | `6lowTdQ61Y4` | `GEN.1.1-GEN.2.3` | `EXO.20.8-EXO.20.11; LEV.25.1-LEV.25.55; LUK.4.14-LUK.4.21` | reviewed/high · [BibleProject](https://bibleproject.com/videos/sabbath-video/) |
| `bp-theme-city` | biblical-themes | `5yZLFmVHfaw` | `zv1LAco6pTk` | `GEN.4.17` | `GEN.11.1-GEN.11.9; REV.21.1-REV.21.27` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/city/) |
| `bp-theme-exile` | biblical-themes | `xSua9_WhQFE` | `nFHZQT0GuBI` | `GEN.3.22-GEN.3.24` | `2KI.25.1-2KI.25.21` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/exile/) |
| `bp-theme-image-of-god` | biblical-themes | `YbipxLDtY8c` | `sDnohPQxLD8` (`cross:how-to-read`) | `GEN.1.26-GEN.1.28` | `COL.1.15-COL.1.20` | reviewed/high · matched official descriptions; [BibleProject](https://bibleproject.com/videos/image-of-god/) |
| `bp-theme-exodus-way` | biblical-themes | `dYPlBq8ELvA` | `pekXBuUDiyE` | `EXO.14.10-EXO.14.31` | `LUK.9.28-LUK.9.36; ACT.9.1-ACT.9.2` | reviewed/editorial · [YouTube](https://www.youtube.com/watch?v=dYPlBq8ELvA) |
| `bp-theme-sacrifice-atonement` | biblical-themes | `G_OlRWGLdnw` (`cross:book-collection`) | `wmICj1t6UIA` | `LEV.16.1-LEV.16.34` | `HEB.9.6-HEB.9.14; MAT.26.26-MAT.26.28` | reviewed/high · [BibleProject](https://bibleproject.com/videos/sacrifice-and-atonement/) |
| `bp-theme-justice` | biblical-themes | `A14THPoc4-4` | `H3-GGFM3WqM` | `MIC.6.8` | `PRO.31.8-PRO.31.9; LUK.4.16-LUK.4.21` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/justice/) |
| `bp-theme-wilderness` | biblical-themes | `b54d_GhBthI` | `rRN01oNzNo8` | `EXO.16.1-EXO.16.36` | `MAT.4.1-MAT.4.11` | reviewed/editorial · matched official descriptions; [YouTube](https://www.youtube.com/watch?v=b54d_GhBthI) |
| `bp-theme-blessing-and-curse` | biblical-themes | `jQaeIJOA6J0` | `Wm30OGylv4Q` | `GEN.12.1-GEN.12.3` | `GEN.3.14-GEN.3.19; GAL.3.13-GAL.3.14` | reviewed/high · [BibleProject](https://bibleproject.com/videos/blessing-and-curse/) |
| `bp-theme-day-of-the-lord` | biblical-themes | `tEBc2gSSW04` | `utHEZsmzU74` | `JOL.2.1-JOL.2.2` | `1TH.5.1-1TH.5.11` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/day-of-the-lord/) |
| `bp-theme-law` | biblical-themes | `3BGO9Mmd_cU` | `IDS6LONO8Sw` | `EXO.20.1-EXO.20.17` | `MAT.22.34-MAT.22.40` | reviewed/high · [BibleProject](https://bibleproject.com/videos/law/) |
| `bp-theme-temple` | biblical-themes | `wTnq6I3vUbU` | `ZjoRCeqpUSA` (`cross:uncategorized`) | `GEN.1.1-GEN.2.3` | `1KI.6.1-1KI.6.38; ACT.2.1-ACT.2.4; EPH.2.19-EPH.2.22` | reviewed/high · [BibleProject](https://bibleproject.com/videos/temple/) |
| `bp-theme-tree-of-life` | biblical-themes | `TJLan-pJzfQ` | `FRqpC4yLc68` | `GEN.2.8-GEN.2.9` | `REV.22.1-REV.22.5` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/tree-of-life/) |
| `bp-theme-eternal-life` | biblical-themes | `uCOycIMyJZM` | `u-2dqyddp2o` | `JHN.17.3` | `JHN.3.16` | reviewed/high · [BibleProject](https://bibleproject.com/videos/eternal-life/) |
| `bp-theme-last-will-be-first` | biblical-themes | `n-UenIDevpI` | `A-eeOo_TgYk` | `MRK.10.31-MRK.10.45` | `COL.1.15-COL.1.20` | reviewed/editorial · [YouTube](https://www.youtube.com/watch?v=n-UenIDevpI) |
| `bp-theme-mountain` | biblical-themes | `CxDIeoVz7_8` | `bfQ6I4Smh7A` | `EXO.19.1-EXO.19.6` | `GEN.2.8-GEN.2.14; MAT.17.1-MAT.17.8` | reviewed/editorial · [YouTube](https://www.youtube.com/watch?v=CxDIeoVz7_8) |
| `bp-theme-anointing` | biblical-themes | `-uPNMO-YA5E` | `OZh3BZHCM5s` | `GEN.28.18-GEN.28.22` | `1SA.16.1-1SA.16.13; LUK.4.16-LUK.4.21` | reviewed/editorial · [YouTube](https://www.youtube.com/watch?v=-uPNMO-YA5E) |
| `bp-theme-holy-spirit` | biblical-themes | `oNNZO9i1Gjc` | `n4_ZOaMvpGY` | `GEN.1.2` | `ACT.2.1-ACT.2.4` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/holy-spirit/) |
| `bp-theme-water-of-life` | biblical-themes | `PgmAkM39Zt4` | `0dJXpm668TE` | `GEN.2.10` | `EZK.47.1-EZK.47.12; JHN.4.7-JHN.4.14; REV.22.1-REV.22.2` | reviewed/editorial · [BibleProject](https://bibleproject.com/videos/water-of-life/) |
| `bp-theme-son-of-man` | biblical-themes | `z6cWEcqxhlI` | — | `DAN.7.13-DAN.7.14` | `MRK.14.61-MRK.14.64` | reviewed/high · [BibleProject](https://bibleproject.com/videos/son-of-man/) |
| `bp-theme-messiah` | biblical-themes | `3dEh25pduQ8` | `4eBBvA8zzxI` (`cross:how-to-read`) | `GEN.3.15` | `2SA.7.12-2SA.7.16; ISA.11.1-ISA.11.10` | reviewed/high · matched official descriptions; [BibleProject](https://bibleproject.com/videos/messiah/) |
| `bp-theme-generosity` | biblical-themes | `62CliEkRCso` (`cross:book-collection`) | `fnP-hBi2A2Y` | `2CO.8.9` | `GEN.1.29-GEN.1.30; LUK.12.13-LUK.12.34` | reviewed/editorial · matched official descriptions; [BibleProject](https://bibleproject.com/videos/generosity/) |
| `bp-theme-test` | biblical-themes | `sR4AT0LMJ5c` (`cross:book-collection`) | `_oH7LD9MRkc` | `GEN.2.16-GEN.2.17` | `GEN.22.1-GEN.22.19; MAT.4.1-MAT.4.11` | reviewed/high · [BibleProject](https://bibleproject.com/videos/the-test/) |

## Explicit exclusions

These decisions account for every `theme` record not published above.

| Provider ID | Lang | Proposed identity | Decision | Reason |
|---|---|---|---|---|
| `GOXEADdM0ZI` | en | `bp-theme-noise-melchizedek-qr` | exclude | Q+R, not an animated Bible explainer |
| `NluVlZCToSg` | en | `bp-theme-noise-royal-priests-qr` | exclude | question-and-response companion |
| `mWze68PQa3A` | en | `bp-theme-noise-commandments-bts-doodles` | exclude | 31-second behind-the-scenes clip |
| `x8CuY56_wk4` | en | `bp-theme-noise-commandments-bts-dirt` | exclude | 63-second behind-the-scenes clip |
| `1s7AjhVxDPs` | en | `bp-theme-noise-commandments-bts-sound` | exclude | behind-the-scenes sound-design clip |
| `zx1YJNZWmuc` | en | `bp-theme-noise-commandments-bts-full` | exclude | 12:59 studio/production documentary |
| `z4__yO5yBfU` | en | `bp-theme-noise-commandment-10-studio` | exclude | studio teaser |
| `eiJbjmqOD54` | en | `bp-theme-noise-commandment-03-studio` | exclude | studio teaser |
| `npkMrWPDpWI` | en | `bp-theme-noise-commandment-04-studio` | exclude | studio teaser |
| `EgF5fMp4RNM` | en | `bp-theme-noise-commandment-05-studio` | exclude | studio teaser |
| `AKmdcNfnvjc` | en | `bp-theme-noise-commandment-06-studio` | exclude | studio teaser |
| `MlAzDJUE1zY` | en | `bp-theme-noise-commandment-07-studio` | exclude | studio teaser |
| `mI7_EGPyluc` | en | `bp-theme-noise-commandment-08-studio` | exclude | studio teaser |
| `sDwmRiwVzQo` | en | `bp-theme-noise-commandment-09-studio` | exclude | studio teaser |
| `IiQjNBdzsrM` | en | `bp-theme-noise-commandments-trailer` | exclude | “Coming Soon” trailer |
| `EvldOJ0Z7Jc` | en | `bp-theme-noise-commandments-group-promo` | exclude | group-study call to action |
| `yy7Hesk4NZg` | en | `bp-theme-noise-commandments-plan-promo` | exclude | YouVersion reading-plan promotion |
| `w0iZ-hc7G9M` | en | `bp-theme-noise-commandment-01-short` | exclude | derivative 61-second promotional extract; canonical episode retained |
| `V_UL7evhaBg` | en | `bp-theme-noise-commandment-02-short` | exclude | derivative 51-second promotional extract; canonical episode retained |
| `Ya-EbpCXWpw` | en | `bp-theme-noise-commandments-compilation` | exclude | 54:17 long-form compilation duplicating the canonical episodes; unsuitable for chapter-end placement |
| `FVzc7zXuQzA` | fr | `bp-theme-covenants:fr:legacy` | exclude as superseded | older 2019 upload of the same localized Covenants film; exact official description matches the current 2025 upload `MfuYg7P0iBI`, which is the retained canonical FR edition |

## Cross-category reconciliation

The seven added editions are not optional guesses. Each has the same subject and substantially identical official description as its counterpart.

| Work ID | Provider ID | Lang | Current category | Canonical projection |
|---|---|---|---|---|
| `bp-theme-redemption` | `lX7rZ7hp_gQ` | fr | `uncategorized` | biblical-themes |
| `bp-theme-image-of-god` | `sDnohPQxLD8` | fr | `how-to-read` | biblical-themes |
| `bp-theme-sacrifice-atonement` | `G_OlRWGLdnw` | en | `book-collection` | biblical-themes |
| `bp-theme-temple` | `ZjoRCeqpUSA` | fr | `uncategorized` | biblical-themes |
| `bp-theme-messiah` | `4eBBvA8zzxI` | fr | `how-to-read` | biblical-themes |
| `bp-theme-generosity` | `62CliEkRCso` | en | `book-collection` | biblical-themes |
| `bp-theme-test` | `sR4AT0LMJ5c` | en | `book-collection` | biblical-themes |

## Uncertain and time-sensitive cases

There are no unresolved identity pairings, but four decisions should remain visible in audit data:

1. `O1nDieIu8Xc` is retained because it is a canonical animated recap in the official series, despite its short duration. If product testing shows that the intro plus recap is repetitive in Exodus 20, this should become a ranking decision, not a data-quality exclusion.
2. `MfuYg7P0iBI` is selected over `FVzc7zXuQzA` because it is the current 2025 official-channel upload of the same French Covenants film. The legacy provider ID should remain in the audit so saved links can be migrated.
3. The French Ten Commandments channel currently stops at commandment 8 in this snapshot. Commands 9 and 10 must remain English-only until official French editions enter the catalog; they must never appear on a French route through fallback.
4. Panoramic theme videos cite many passages. Their `reviewed/editorial` primary anchors are intentionally representative. Future script-level refinement may change a primary anchor, but should not expand every citation into an inline placement.

## Bible View implications

The manifest generated from this research should expose two indexes per language:

- a `primaryByChapter` index used for chapter-end “Pour aller plus loin” cards;
- an optional `relatedByChapter` index used only inside resource detail or search, never for automatic inline placement.

At a busy chapter such as Exodus 20, ranking should prefer the exact commandment episode over the general Ten Commandments introduction, recap, Law theme, and older Sabbath theme. This is a presentation priority problem; the works remain distinct and valid.

Recommended generator assertions:

- exactly 126 primary-category records are classified;
- exactly 21 English records are excluded and exactly one French record is excluded as a superseded duplicate;
- exactly 104 primary-category editions are publishable;
- exactly seven editions are reconciled from outside `theme`;
- exactly 57 conceptual works and 111 editions are emitted;
- edition totals are exactly 57 English and 54 French;
- exactly 54 works are bilingual and three are English-only;
- no work has more than one edition per language;
- every publishable work has exactly one primary anchor;
- related anchors never populate the automatic Bible View chapter index;
- every edition resolves to one current catalog record with matching provider ID and language;
- excluded provider IDs cannot appear in a language index;
- no language index can return an edition in the other language.

## Sources

- [BibleProject: The 10 Commandments collection](https://bibleproject.com/videos/collections/the-10-commandments/)
- [BibleProject: The Royal Priest collection](https://bibleproject.com/videos/collections/the-royal-priest/)
- [BibleProject: Spiritual Beings collection](https://bibleproject.com/videos/collections/spiritual-beings/)
- [BibleProject downloads library: Biblical Themes](https://bibleproject.com/downloads/)
- [BibleProject downloads library](https://bibleproject.com/downloads/)
- [BibleProject: Sabbath](https://bibleproject.com/videos/sabbath-video/)
- [BibleProject: Temple](https://bibleproject.com/videos/temple/)
- [BibleProject: Law](https://bibleproject.com/videos/law/)
- [BibleProject: Blessing and Curse](https://bibleproject.com/videos/blessing-and-curse/)
- [BibleProject: Sacrifice and Atonement](https://bibleproject.com/videos/sacrifice-and-atonement/)
- [BibleProject: Royal Priests of Eden](https://bibleproject.com/videos/priests-of-eden/)
- [BibleProject: Abraham and Melchizedek](https://bibleproject.com/videos/abraham-and-melchizedek/)
- [BibleProject: Moses and Aaron](https://bibleproject.com/videos/moses-and-aaron/)
- [BibleProject: Dragons in the Bible guide](https://bibleproject.com/guides/dragons-in-the-bible/)
- [Official English BibleProject YouTube channel](https://www.youtube.com/@bibleproject/videos)
- [Official French BibleProject YouTube channel](https://www.youtube.com/@BibleProject-Fran%C3%A7ais/videos)
