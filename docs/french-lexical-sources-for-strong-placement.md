# French Lexical Sources For Strong Placement

Date: 2026-06-24

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

## Production Recommendation

Do not add hand-written synonym entries to the generation path.

The validated lexical auto-safe layer is now part of the canonical generation
path:

```sh
npm run strong:generate -- --bible <id>
```

During generation, the ledger is built first, then the lexical scorer applies
only auto-safe placements. A residual lexical report is written for the viewer
under:

```text
outputs/lexical-candidates/<bible>/
```

Manual candidate inspection is still available:

```sh
npm run strong:lexical-candidates -- --bible nbs --only Gen.1-Gen.6
```

Optional external source flags remain:

```sh
--kaikki /path/to/kaikki.org-dictionary-French.jsonl.gz
--jdm-cache /path/to/rezojdm-cache
--fetch-jdm
--openoffice /path/to/openoffice-synonyms.txt-or-dictionary.go
--wolf /path/to/wolf.xml-or-wolf.xml.bz2
```

`strong:lexical-candidates` only produces a report. `strong:generate` is the
production command that applies validated auto-safe placements.

Current local command used for the STEP-first NBS Genesis 1-6 run:

```sh
npm run strong:lexical-candidates -- \
  --bible nbs \
  --only Gen.1-Gen.6 \
  --ledger outputs/strong-step-first/nbs/bible-nbs-strong-ledger.json \
  --kaikki data/external/french-lexical/kaikki/kaikki.org-dictionary-French.jsonl \
  --jdm-cache data/external/french-lexical/rezojdm-cache \
  --openoffice data/external/french-lexical/openoffice/synonymes/handler/dictionary.go \
  --wolf data/external/french-lexical/wolf/wolf-1.0b4.xml.bz2 \
  --output-dir outputs/lexical-candidates/nbs
```

The viewer auto-loads the matching report when the ledger scope and Bible id
match:

```text
/outputs/lexical-candidates/<bible>/bible-<bible>-lexical-candidates-<scope>.json
```

For `outputs/strong-step-first/nbs/bible-nbs-strong-ledger.json`, it loads:

```text
/outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-Gen.1-Gen.6.json
```

As of the STEP-first production run with lexical auto-safe enabled, NBS Genesis
1-6 applied 61 lexical auto-safe placements into the canonical ledger. The
residual lexical audit metrics were:

```text
audit items: 242
empty annotations: 170
reader empty annotations: 159
advanced empty annotations: 11
relocation annotations: 72
items with candidates: 209
candidate count: 722
high / medium / low candidates: 201 / 181 / 340
open / occupied candidates: 195 / 527
reviewable candidates: 412
auto-safe items: 0
group auto-safe items: 0
ambiguous high-confidence items: 53
relocation items with better open candidate: 7
```

Interpretation:

- `auto-safe` is deliberately strict and is applied by `strong:generate`.
- residual reports should show `auto-safe items: 0`; remaining candidates are
  review material, not automatic production changes.
- `group auto-safe` means an individually ambiguous proper-name candidate was
  resolved by source order across repeated French carriers. The same mechanism
  also resolves repeated ordinary lexical carriers when the same Strong has the
  same high-confidence direct lexical evidence on each open repeated French
  token.
- `ambiguous high-confidence` means several high candidates compete; these
  should go to review.
- `occupied` means the candidate is on a word already carrying a reader Strong;
  this is a relocation/stacking risk.
- `relocation-guard` evidence means a weak open synonym candidate was capped
  because the current visible carrier already has direct lexical evidence.
- `seed-stem` evidence means the target word shares a conservative morphological
  stem with a local Strong dictionary term. This is limited to long stems and
  expected suffix drift, so concatenated dictionary phrases do not become direct
  lexical evidence.
- `number-component` evidence means a STEP numeric/cardinal occurrence matches
  one component of a French compound number. These candidates may be auto-safe
  even when the French token is already occupied by another numeric Strong.
  For relocation audits, a numeric Strong may also move from a simple occupied
  number to a later occupied compound number when the compound exposes a richer
  numeric decomposition.
- `french-auxiliary-phrase` evidence means a STEP verb gloss includes an
  auxiliary such as `had`/`have` or `was`/`be`, and the French text renders it
  as an adjacent auxiliary plus participle. In those cases the phrase can be
  auto-safe when the participle has direct lexical evidence.
- synonym-only candidates are never auto-safe. Synonyms can boost a candidate,
  but production insertion requires direct evidence such as `seed-term`,
  `seed-stem`, `kaikki-gloss`, `proper-name-*`, or `number-component`.

Observed benchmark cases:

- `Gen.1.9 H6960`: `s’amassent` is a high-confidence candidate, but remains
  residual review material unless direct evidence also supports it.
- `Gen.1.11 H1876`: `donne` is medium confidence, review needed.
- `Gen.1.11 H6213`: `portent` and `donne` are both high confidence, ambiguous.
- `Gen.1.12 H6213`: `portent` is high confidence, but `produisit` is also a
  strong occupied candidate; review needed before moving.
- `Gen.1.10 H2896/H2895`: `bon` remains the correct direct carrier. The open
  candidate `ferme` is capped low by the relocation guard because it only has
  indirect synonym evidence (`fort -> ferme`) while the current target has a
  direct lexical match.
- `Gen.1.27 H0120/H2145`: `humains` is high confidence for both candidates, so
  the system correctly refuses auto-safe relocation.
- `Gen.4.25 H3205`: `mit au monde` is detected as a phrase candidate from WOLF
  (`mettre au monde -> accoucher`) and scores high, while `mit` alone remains
  medium. This is deterministic phrase evidence, not a hand-written exception.
- `Gen.4.22 H8423`: `Toubal-Caïn` is placed by the lexical auto-safe layer as a
  high-confidence proper-name candidate from STEP (`Tubal` + `Cain`) confirmed
  by the local Strong
  dictionary (`tubal-cain`). This is transliteration evidence, not synonym
  evidence. The same pass flags the visible placement on `Tsilla` as a
  relocation candidate, then resolves the four `H8423` audit items as a group:
  two source tokens map to the first French `Toubal-Caïn`, and two map to the
  second. Related dictionary terms are not treated as valid semantic matches.
- `Gen.4.18 H4232/H4967`: `Mehouyaël` and `Metoushaël` are placed as
  high-confidence proper-name candidates from STEP plus the Strong dictionary.
  This comes from generic biblical name transliteration rules (`j/y`, `th/t`,
  `ch/h`, `ou/u`, and consonant skeletons), not from verse-specific aliases.
  The repeated source tokens are then resolved as groups onto the repeated
  French carriers.
- `Gen.4.18`, `Gen.4.19`, `Gen.4.23`, and `Gen.4.24 H3929`: `Lémek` is
  detected from STEP/dictionary name evidence despite transliteration drift
  (`Lamech`, `Le.mekh`, `lemec`). Composite morphology such as `HC/Npm` is
  treated as a proper-name signal, and the two misplaced visible `H3929`
  placements in `Gen.4.23` are resolved as a group onto the two French `Lémek`
  carriers.
- `Gen.5.1 H8435`: `généalogie` is placed from a conservative
  dictionary-stem match (`genealogie` vs `genealogies`) plus external synonym
  evidence (`généalogie -> descendance`). This lifts a real lexical match
  without adding a hand-written `H8435 = généalogie` alias.
- `Gen.5.15 H2568`: `soixante-cinq` is placed for `five` even though
  the same French token already carries `H8346` (`sixty`). This is a
  STEP-bounded numeric component match, not a general license to stack Strong
  codes on occupied words.

Current deterministic-assisted layer:

1. Build an external lexical index from Kaikki + RezoJDM + WOLF/OpenOffice.
2. Use Kaikki to lemmatize French target tokens.
3. Use local Strong dictionary and STEP glosses to produce expected semantic
   hints for each Strong occurrence.
4. Use external sources to produce candidate target words and short phrase
   carriers. Phrase candidates are matched with lemma/original token variants
   so a bad lemma on one internal token does not break known locutions such as
   `mit au monde`.
5. Treat proper names separately from ordinary lexical synonyms. For STEP proper
   nouns, compare target words against STEP gloss/transliteration keys and only
   let the Strong dictionary confirm names that agree with STEP. Do not use
   synonym evidence for those candidates. Name keys normalize common
   transliteration drift such as hyphenation, `j/y`, `th/t`, `ou/u`,
   `ch/h/kh/c/k`, and consonant skeletons only when STEP and the Strong
   dictionary agree.
6. Score candidates with conservative features:
   - same verse Strong inventory already permits this Strong;
   - source is not technical/function-only;
   - local Strong dictionary terms match directly or through a conservative
     long-stem variant;
   - STEP numeric/cardinal occurrences can match one component of a compound
     French number;
   - target token is open or low-risk;
   - lemma/synonym relation exists in at least two independent sources;
   - English/French gloss overlap agrees with STEP/local dictionary;
   - position is plausible in original/target order.
7. For relocation audits, cap synonym-only open candidates when the current
   visible target already has direct lexical evidence. This prevents false
   positives such as `Gen.1.10 H2896 -> ferme` when `bon` is already directly
   supported.
8. Auto-place only when the score is very high, no competing safe candidate
   exists, and direct lexical evidence is present.
9. Otherwise emit a residual lexical candidate for LLM/human review.

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
