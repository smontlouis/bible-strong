# BibleProject word-study anchors

Research snapshot: 2026-08-04.

## Conclusion

The complete 795-record catalog contains **21 publishable lexical works**, all with both an English and a French YouTube edition: **42 editions total**. The current `word-study` category contains only 41 of them because the English edition of “Character of God” (`nxwzq1PJImM`) is categorized as `visual-commentary`, while its French counterpart (`r4A91QVsUlI`) is categorized as `word-study`.

The reviewed domain is therefore conceptual works, not the current category boundary:

- 6 Character of God works;
- 6 Shema works;
- 3 Bad Words works;
- 4 Advent works;
- Gospel and Witness.

There are no missing language editions and no unresolved provider identities in this corpus. Edition selection can remain strict: an English route receives the English edition and a French route receives the French edition, with no cross-language fallback.

## Method and source policy

Only first-party material was used to define the corpus and its biblical scope:

1. The English and French channel metadata stored in [`catalog.json`](data/bible-project/catalog.json) establishes the 42 provider IDs, titles, playlists, languages, availability, and current local categories.
2. BibleProject's official collection pages establish the editorial series and their episode order: [Character of God](https://bibleproject.com/videos/collections/character-of-god/), [The Shema](https://bibleproject.com/videos/collections/shema/), [Bad Words](https://bibleproject.com/videos/collections/bad-words/), [Advent](https://bibleproject.com/videos/collections/advent/), and [Word Studies](https://bibleproject.com/videos/collections/word-studies/).
3. Official video pages, reflection guides, and publisher script-reference PDFs establish the original-language forms and primary passages. For example, the Sin script explicitly teaches Hebrew *khataʼ* and Greek *hamartia* and identifies Genesis 4:7 as the first biblical occurrence central to its explanation. [BibleProject Sin script references](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/word_studies/sin_script-reference_UPDATED.pdf)
4. Strong identifiers below are implementation bindings to the exact Hebrew or Greek lexemes explicitly named by BibleProject. A Strong is not inferred from an English/French gloss alone. Where the resource teaches a phrase, a lexeme family, or multiple languages, that structure is preserved instead of pretending that one Strong represents the entire concept.
5. Every emitted code, language, and lemma was manually checked against Bible Strong's published `strong-lexicon-core` schema version 2. The generator validates binding shape and code format; the manifest records this editorial lexicon review rather than downloading the application database during ordinary offline derivation. [Bible Strong core lexicon publication](../../src/helpers/strongLexiconPublications.ts)

The primary Scripture anchor is the best inline placement for the work, not a list of every cross-reference in its transcript. Transcript examples can become related references later, but they must not create dozens of duplicate inline cards.

## Strong binding conventions

- **direct**: the work's named lexeme maps cleanly to one Strong entry.
- **family**: the work explicitly teaches more than one grammatical form or language; one primary Strong may be indexed, with related Strong entries retained.
- **composite**: the work teaches a phrase made from multiple lexemes. It must be found through all components and through the concept label, never represented by one invented Strong.
- **none**: the work is an overview of a passage containing several attributes and has no single lexical identity.

Strong codes are suitable lookup keys, but the original script and lemma remain the semantic authority. In particular, translations such as “love,” “soul,” “grace,” and “sin” are too broad to serve as identity keys on their own.

## Reviewed work table

| Proposed work ID | English provider ID | French provider ID | Original-language identity | Strong binding | Primary Scripture anchor | First-party evidence |
|---|---|---|---|---|---|---|
| `exodus-34-6-7-visual-commentary` | `nxwzq1PJImM` | `r4A91QVsUlI` | `יְהוָה רַחוּם וְחַנּוּן אֶרֶךְ אַפַּיִם וְרַב־חֶסֶד וֶאֱמֶת` — the complete divine-character declaration | **none**; do not assign one Strong to the whole formula | `EXO.34.6-EXO.34.7` | [Exodus 34:6-7](https://bibleproject.com/videos/character-of-god-exodus/) |
| `bp-word-character-compassion` | `qJEtyAiAQik` | `69_vtfw-0mA` | `רַחוּם` (*rakhum*, compassionate) | **direct** `H7349` | `EXO.34.6` | [Character of God collection](https://bibleproject.com/videos/collections/character-of-god/) |
| `bp-word-character-grace` | `ABPVVw_aw44` | `wktA2VE4yhY` | `חַנּוּן` (*khanun*, gracious) | **direct** `H2587` | `EXO.34.6` | [Character of God collection](https://bibleproject.com/videos/collections/character-of-god/) |
| `bp-word-character-slow-to-anger` | `TeQ1nq_YJD0` | `M1cvdmKMfGI` | `אֶרֶךְ אַפַּיִם` (*ʼerekh ʼappayim*, “long of nose”) | **composite** `H750` + `H639`; no single Strong | `EXO.34.6` | [Slow to Anger guide](https://bibleproject.com/guides/slow-to-anger/) |
| `bp-word-character-loyal-love` | `UfbyFLgs_NM` | `4U-KtmcHrGI` | `חֶסֶד` (*khesed*, loyal love) | **direct** `H2617` | `EXO.34.6` | [Character of God collection](https://bibleproject.com/videos/collections/character-of-god/) |
| `bp-word-character-faithful` | `HCLuq_5o7_o` | `xqUPT7BoX-w` | `אֱמֶת` (*ʼemet*, faithfulness/truth) | **direct** `H571` | `EXO.34.6` | [BibleProject: Can We Trust God?](https://bibleproject.com/articles/can-we-trust-god-in-difficult-times/) |
| `bp-word-shema-listen` | `6KQLOuIKaRA` | `1g4u57TSY0g` | `שָׁמַע` (*shama/shema*, hear, listen, respond) | **direct** `H8085` | `DEU.6.4` | [Shema video](https://bibleproject.com/videos/shema-listen/) · [script](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/word_studies/Shema-Listen_script-references_UPDATED.pdf) |
| `bp-word-shema-yhwh` | `eLrGM26pmM0` | `vxPgZ_-tzLU` | `יְהוָה` (*YHWH*) | **direct** `H3068` | `DEU.6.4` | [The Shema collection](https://bibleproject.com/videos/collections/shema/) |
| `bp-word-shema-love-ahavah` | `HV_LUs2lnIQ` | `nJ-9YpX7IRs` | verb `אָהַב` (*ʼahav*) and noun `אַהֲבָה` (*ahavah*, love) | **family** primary `H157`; related noun `H160`; the anchored form in Deuteronomy 6:5 is `H157` | `DEU.6.5` | [The Shema collection](https://bibleproject.com/videos/collections/shema/) · [official script](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/Shema_Love_Script-References.pdf) |
| `bp-word-shema-heart-lev` | `aS4iM6KpPYo` | `FuQp4baBpPU` | `לֵב` / `לֵבָב` (*lev/levav*, heart) | **family** `H3820` + `H3824`; the anchored form in Deuteronomy 6:5 is `H3824` | `DEU.6.5` | [The Shema collection](https://bibleproject.com/videos/collections/shema/) |
| `bp-word-shema-soul-nephesh` | `g_igCcWAMAM` | `FLrm_KlwLv8` | `נֶפֶשׁ` (*nephesh*, living being/life) | **direct** `H5315` | `DEU.6.5` | [The Shema collection](https://bibleproject.com/videos/collections/shema/) |
| `bp-word-shema-strength-meod` | `9aaVy1AmFX4` | `cXwM1xW8LEI` | `מְאֹד` (*meʼod*, very/much; “strength” in the Shema) | **direct** `H3966` | `DEU.6.5` | [The Shema collection](https://bibleproject.com/videos/collections/shema/) |
| `bp-word-bad-sin-khata` | `aNOZ7ocLD74` | `8QfBEhOvux4` | Hebrew `חָטָא` (*khataʼ*) and Greek `ἁμαρτία` (*hamartia*) | **family** primary `H2398`; related nominal `H2403` and Greek `G266` | `GEN.4.7` | [Sin video](https://bibleproject.com/videos/khata-sin/) · [script](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/word_studies/sin_script-reference_UPDATED.pdf) |
| `bp-word-bad-transgression-pesha` | `cq-r9FFN5ew` | `d1YadwvBp9o` | Hebrew noun `פֶּשַׁע` (*pesha*), verb `פָּשַׁע` (*pasha*), Greek `παράπτωμα` (*paraptoma*) | **family** primary `H6588`; related `H6586`, `G3900` | `EXO.34.7` | [Transgression video](https://bibleproject.com/videos/pesha-transgression/) · [script](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/Transgression_Script-References.pdf) |
| `bp-word-bad-iniquity-avon` | `w1zkwkI9oAw` | `OfruTm0lwqE` | Hebrew `עָוֹן` (*avon*), related verb `עָוָה` (*avah*), Greek `ἀνομία` (*anomia*) | **family** primary `H5771`; related `H5753`, `G458` | `EXO.34.7` | [Iniquity video](https://bibleproject.com/videos/avon-iniquity/) · [script](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/Iniquity_Script-References.pdf) |
| `bp-word-advent-hope-yakhal` | `4WYNBjJSYvE` | `ILFWnQ3izNw` | `יָחַל` (*yakhal*, wait/hope) | **direct** `H3176` | `PSA.130.5` | [Yakhal / Hope](https://bibleproject.com/videos/yakhal-hope/) |
| `bp-word-advent-peace-shalom` | `oLYORLZOaZE` | `66mFOG3ukGY` | `שָׁלוֹם` (*shalom*, completeness/peace) | **direct** `H7965` | `ISA.9.6-ISA.9.7` | [Shalom / Peace](https://bibleproject.com/videos/shalom-peace/) · [Advent collection](https://bibleproject.com/videos/collections/advent/) |
| `bp-word-advent-joy-chara` | `qvOhQTuD2e0` | `KcenGEY1w-U` | `χαρά` (*chara*, joy) | **direct** `G5479` | `LUK.2.9-LUK.2.11` | [Chara / Joy](https://bibleproject.com/videos/chara-joy/) |
| `bp-word-advent-love-agape` | `slyevQ1LW7A` | `6CByTcTzbKI` | `ἀγάπη` (*agape*, self-giving love) | **direct** `G26` | `1CO.13.1-1CO.13.7` | [Agape / Love](https://bibleproject.com/videos/agape-love/) |
| `bp-word-gospel-euangelion` | `HT41M013X3A` | `uNPKcNKRwb8` | Hebrew verb `בָּשַׂר` (*bisser*), noun `בְּשׂוֹרָה` (*besorah*), Greek `εὐαγγέλιον` (*euangelion*) | **family** primary `G2098`; related `H1319`, `H1309` | `MRK.1.14-MRK.1.15` | [Gospel video](https://bibleproject.com/videos/euangelion-gospel/) · [script](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/Gospel-Word-Study_Script-References.pdf) |
| `bp-word-witness-martus` | `jhcmzjwbvyk` | `W2-G9yjdgtg` | Hebrew noun `עֵד` (*ʼed*), verb `עוּד` (*uwd*), Greek noun `μάρτυς` (*martus*) and verb `μαρτυρέω` (*martureo*) | **family** primary `G3144`; related `H5707`, `H5749`, `G3140` | `ACT.1.8` | [Witness video](https://bibleproject.com/videos/martus-witness/) · [script](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/Witness_Script-References.pdf) |

All 42 IDs above were matched directly against the local official YouTube metadata. No title-only guessed pairing remains.

## Important modeling decisions

### Character of God must be one cross-category work family

`nxwzq1PJImM` is already used by the visual-commentary manifest at `EXO.34.6-EXO.34.7`. That placement remains valid, but the same provider edition is also the English localization of French word-study edition `r4A91QVsUlI`. The durable conceptual work retains the existing ID `exodus-34-6-7-visual-commentary` and is referenced from the lexical projection rather than duplicated as two unrelated works.

The overview has no single Strong. Its child works provide exact lexical access to compassion, grace, slow-to-anger, loyal love, and faithfulness.

### “Slow to anger” cannot be forced to one Strong

BibleProject explicitly explains `אֶרֶךְ אַפַּיִם` as the idiom “long of nose.” [BibleProject Slow to Anger guide](https://bibleproject.com/guides/slow-to-anger/) The resource therefore needs:

- a concept identity such as `slow-to-anger`;
- component Strong links `H750` and `H639`;
- the primary passage anchor `EXO.34.6`.

Choosing only `H639` would incorrectly turn a phrase about patience into a generic resource about every occurrence of “nose/anger.” Choosing only `H750` would be equally incomplete.

### Lexeme families are not duplicate works

Sin, transgression, iniquity, gospel, and witness intentionally cross Hebrew and Greek. The official scripts name those related forms explicitly: Sin names *khataʼ* and *hamartia*; Transgression names *pesha*, *pasha*, and *paraptoma*; Iniquity names *avon*, *avah*, and *anomia*; Gospel names *bisser*, *besorah*, and *euangelion*; Witness names *ʼed*, *uwd*, *martus*, and *martureo*. These are one editorial work each with several exact lexical access points, not separate videos per Strong.

### Primary passage anchors remain deliberately narrow

- Character works anchor to the declaration they unpack, `Exodus 34:6-7`.
- Shema works anchor to the actual prayer wording, `Deuteronomy 6:4-5`.
- Bad Words use the first central Sin scene (`Genesis 4:7`) and the canonical triad in `Exodus 34:7` for transgression and iniquity.
- Advent works use a representative passage where the named lexeme is part of the resource's own reflection or narrative: `Psalm 130:5`, `Isaiah 9:6-7`, `Luke 2:9-11`, and `1 Corinthians 13:1-7`.
- Gospel and Witness use `Mark 1:14-15` and `Acts 1:8`, where the named Greek identities drive the passage.

The videos cite many additional passages, but those are explanatory evidence. Promoting every cited occurrence to a primary anchor would overwhelm the Bible viewer and misrepresent the work as verse commentary.

## Full-catalog exclusions

The complete-catalog audit also found videos outside these 21 works that discuss Hebrew or Greek vocabulary. They should not be absorbed into this primary word-study manifest:

- the Ten Commandments theme episodes use lexical analysis within broader commandment studies;
- classroom `NVRY8Uv9R28` (“Earth”) is a course resource;
- podcast `HTEyJ0ozoaM` (“Christ”) is a podcast episode;
- studio `sGm7BJCMz8U` is a production preview about Compassion;
- visual commentary `5xpP3ehZQ_Q` uses lexical detail inside a passage commentary;
- the 214 Shorts are derivative/promotional units, not the canonical full-length word-study works.

The inclusion rule is therefore: a full-length edition in an official BibleProject Word Studies family, plus the cross-category Character of God overview counterpart. Merely mentioning an original-language word is not enough.

## Recommended manifest assertions

A generator for this corpus should fail unless all of the following remain true:

- exactly 21 conceptual works exist;
- exactly 42 provider editions exist: 21 English and 21 French;
- every work has exactly one edition for each language;
- every provider ID resolves to one current catalog record;
- exactly one included edition is outside the current `word-study` category: `nxwzq1PJImM`;
- all works have at least one reviewed primary Scripture anchor;
- the Character overview has `strongBinding: none`;
- Slow to Anger has a composite binding containing both `H750` and `H639` and no synthetic single Strong;
- every family binding distinguishes its primary Strong from related forms;
- language indexes never return an edition in the other language;
- transcript cross-references are not silently promoted to primary anchors.

## Sources

- [BibleProject: Character of God](https://bibleproject.com/videos/collections/character-of-god/)
- [BibleProject: The Shema](https://bibleproject.com/videos/collections/shema/)
- [BibleProject: Bad Words](https://bibleproject.com/videos/collections/bad-words/)
- [BibleProject: Advent](https://bibleproject.com/videos/collections/advent/)
- [BibleProject: Word Studies](https://bibleproject.com/videos/collections/word-studies/)
- [BibleProject downloads library](https://bibleproject.com/downloads/)
- [BibleProject Sin script references](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/word_studies/sin_script-reference_UPDATED.pdf)
- [BibleProject Transgression script references](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/Transgression_Script-References.pdf)
- [BibleProject Iniquity script references](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/Iniquity_Script-References.pdf)
- [BibleProject Gospel script references](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/Gospel-Word-Study_Script-References.pdf)
- [BibleProject Witness script references](https://d1bsmz3sdihplr.cloudfront.net/media/Script%20References/Witness_Script-References.pdf)
