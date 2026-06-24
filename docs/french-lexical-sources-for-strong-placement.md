# French Lexical Sources For Strong Placement

Date: 2026-06-23

This note records a first pass over external French lexical resources that could
help place Strong codes when the deterministic pipeline already knows that a
Strong belongs to a verse, but cannot find a defensible French carrier.

The important conclusion is negative: a synonym source is not enough to turn a
semantic gap into a safe automatic placement. These resources can generate
candidates and evidence, but context-sensitive selection still needs either
strict local validation or bounded LLM/human review.

## Why This Matters

Examples from NBS Genesis 1 show the boundary:

- `Gen.1.9`: `H6960` is valid from the original and STEP evidence, but the
  French carrier is `s'amassent`.
- `Gen.1.11`: `H1876` is valid, but the French carrier may be `donne`.
- `Gen.1.12`: `H6213` is valid, but the French carrier may be `portent`.

Adding those forms by hand to a project lexicon is not deterministic evidence.
It is curation. We should not do that silently in generation.

## Tested Sources

### RezoJDM / JeuxDeMots

Source:

- https://www.jeuxdemots.org/jdm-about.php
- API tested at `https://jdm-api.demo.lirmm.fr`

Test command pattern:

```sh
curl -L 'https://jdm-api.demo.lirmm.fr/v0/relations/from/amasser?types=5'
```

The API returned JSON with `nodes`, `relations`, and a `request` summary. The
useful filter is:

- source node = requested term;
- relation `type = 5`;
- positive weight;
- remove technical nodes such as `_FL:*` and language-prefixed nodes.

Sample top candidates:

```text
amasser -> reunir, accumuler, rassembler, assembler, entasser, collectionner
donner  -> offrir, produire, exposer, montrer, reveler, porter, fournir
porter  -> elever, pousser, donner, entrainer, montrer, provoquer, produire
```

Assessment:

- strongest candidate for broad French synonym evidence;
- useful weights;
- enough noise that it must feed a candidate scorer, not automatic placement;
- especially risky for polysemous verbs such as `porter` and `donner`.

Recommended role:

- generate candidate French carriers for gap-review packets;
- boost candidates already supported by STEP gloss/local Strong dictionary;
- never auto-place solely because a RezoJDM synonym relation exists.

### Kaikki / Wiktextract French

Source:

- https://kaikki.org/dictionary/rawdata.html
- processed French file tested:
  `https://kaikki.org/dictionary/French/kaikki.org-dictionary-French.jsonl.gz`

The processed French file was about 53 MB compressed at test time. It is much
more practical than the raw French extraction listed on the raw-data page.

Useful data:

- inflected form -> lemma:
  - `amassent` -> `amasser`
  - `donne` -> `donner`
  - `portent` -> `porter`
- verb forms and conjugations;
- English glosses:
  - `amasser`: "to amass; to gather up", "to accumulate"
  - `rassembler`: "to assemble", "to gather together"
  - `reunir`: "to gather, collect", "to bring together"
  - `porter`: "to carry", "to support, to bear", "to wear"
  - `produire`: "to produce, to yield"
  - `pousser`: "to grow", "to spring up, to sprout"
  - `germer`: "to germinate"

Assessment:

- very useful as a morphology and lemma source;
- useful for English gloss overlap with STEP/original glosses;
- weaker as synonym source than RezoJDM;
- can confuse homographs unless POS and form-of data are respected.

Recommended role:

- normalize French verse tokens to lemmas before matching external synonyms;
- map inflected candidate forms back to lemmas;
- compare French lemma glosses to STEP glosses/local Strong dictionary glosses;
- keep as deterministic evidence, but not final placement authority.

### WOLF, Free Wordnet For French

Source:

- https://almanach.inria.fr/software_and_resources/WOLF-en.html
- tested file:
  `https://almanach.inria.fr/software_and_resources/downloads/wolf-1.0b4.xml.bz2`

The compressed file was about 4.8 MB. It is a French WordNet in XML format.

Useful examples found:

```text
rassembler / accumuler / entasser -> "collect or gather"
pousser -> "increase in size by natural process"
porter -> many unrelated senses: wear, carry, pregnancy, etc.
```

Assessment:

- small and easy to vendor or cache;
- gives synsets and English definitions;
- useful for sense clustering;
- lower direct coverage than RezoJDM for French synonym expansion;
- still needs word-sense disambiguation.

Recommended role:

- weak semantic cluster evidence;
- cross-check with STEP glosses and Kaikki glosses;
- not enough alone for automatic placement.

### OpenOffice Synonym Dictionary

Source:

- https://github.com/olup/synonymes

The repository embeds an OpenOffice French synonym dictionary and exposes a
simple JSON/API wrapper.

Sample entries:

```text
amasser -> accumuler, entasser, amonceler, empiler, cumuler, reunir, associer
donner  -> adjuger, attribuer, conceder, accorder, fournir, administrer
porter  -> acheminer, amener, avancer, apporter, donner, soutenir
produire -> accoucher, enfanter, procreer, creer, engendrer, former
germer -> feconder, pousser
```

Assessment:

- very easy to parse;
- good as a broad synonym baseline;
- no weighting and no sense disambiguation;
- high false-positive risk.

Recommended role:

- fallback candidate expansion;
- never auto-place from this source alone.

### ReSyf

Source:

- https://aclanthology.org/C18-1218/

The paper describes a French lexical resource of ranked synonyms. It says the
resource is freely available and semantically disambiguated/refined, but a
direct machine-readable download was not found in the first pass.

Assessment:

- potentially valuable because it is sense-aware and ranked;
- not yet tested as data because no direct dump was found;
- worth revisiting before building a large in-house synonym layer.

## Practical Recommendation

Do not add hand-written synonym entries to the generation path.

Instead, if we want a stronger deterministic-assisted layer:

1. Build an external lexical index from Kaikki + RezoJDM + WOLF/OpenOffice.
2. Use Kaikki to lemmatize French target tokens.
3. Use local Strong dictionary and STEP glosses to produce expected semantic
   hints for each Strong occurrence.
4. Use external sources to produce candidate target words only.
5. Score candidates with conservative features:
   - same verse Strong inventory already permits this Strong;
   - source is not technical/function-only;
   - target token is open or low-risk;
   - lemma/synonym relation exists in at least two independent sources;
   - English/French gloss overlap agrees with STEP/local dictionary;
   - position is plausible in original/target order.
6. Auto-place only when the score is very high and no competing candidate
   exists.
7. Otherwise emit a gap-review candidate for LLM/human review.

## Boundary With LLM Review

Use a small LLM or agent review when:

- only one source suggests the carrier;
- several plausible carriers exist;
- the French expression is paraphrastic rather than lexical;
- the target word already has another Strong;
- the Strong is semantically broad or polysemous;
- the placement would move from `advanced empty` into visible reader mode.

For `H6960 -> s'amassent`, `H1876 -> donne`, and `H6213 -> portent`, external
sources can produce good candidates. They should not make the final decision by
themselves unless a future scoring layer proves high precision against masked
gold evaluation.
