import assert from "node:assert/strict";
import test from "node:test";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import { resolveCanonicalVerse } from "../src/strongCanonicalResolution.js";
import {
  contentMorphology,
  isCompoundSharedCarrier,
  properNameKey,
  proposeCompoundTargetWords,
  readWitnessCompounds,
  witnessCompoundWords,
  type CompoundCarrier,
  type CompoundUnit
} from "../src/strongCompoundWords.js";
import {
  renderStrongTaggedText,
  type StrongLedgerAnnotation
} from "../src/strongLedger.js";
import { parseSourceRow } from "../src/strongSourceUnits.js";
import { tokenizeText } from "../src/tokenize.js";

const unit = (
  ref: string,
  position: number,
  strong: string,
  morphology = "HNpl",
  readingUnresolved = false
): CompoundUnit => ({
  id: `TAHOT.${ref}.${position}.L`,
  readingUnresolved,
  morphology,
  occurrences: [{ occurrenceId: `TAHOT.${ref}.${position}.L.main:0`, strong }]
});
const carrier = (
  ref: string,
  position: number,
  strong: string,
  wordIndex: number
): CompoundCarrier => ({
  strong,
  kind: "word",
  originalOccurrenceId: `TAHOT.${ref}.${position}.L.main:0`,
  startWordIndex: wordIndex,
  endWordIndex: wordIndex
});
const sg1910 = (ref: string, taggedText: string) => ({
  name: "Sg1910",
  ref,
  taggedText
});

test("witness compound words: hyphen runs, multi-position tags and digit groups", () => {
  assert.deepEqual(
    witnessCompoundWords(
      'de <w strong="H0884" pos="3">Beer</w>-<w strong="H0884" pos="4">Schéba</w>, à <w strong="H2771" pos="6">Charan</w>'
    ),
    [
      {
        wordIndex: 1,
        text: "Beer-Schéba",
        members: [
          { strong: "H0884", position: 3 },
          { strong: "H0884", position: 4 }
        ],
        pooled: false
      }
    ]
  );
  assert.deepEqual(
    witnessCompoundWords('de <w strong="H1008" pos="6+7">Béthel</w> ;')[0]
      ?.members,
    [
      { strong: "H1008", position: 6 },
      { strong: "H1008", position: 7 }
    ]
  );
  const number = readWitnessCompounds(
    'environ <w strong="H7969 H0505" pos="11+12">3 000</w> <w strong="H0376" pos="13">hommes</w>'
  );
  assert.deepEqual(number.words, ["environ", "3000", "", "hommes"]);
  assert.equal(number.compounds[0]?.text, "3000");
  assert.equal(number.compounds[0]?.pooled, true);
  // An elided clitic glued to a name is not part of a compound…
  assert.deepEqual(
    witnessCompoundWords(
      '<w strong="H0834" pos="11">qu’</w><w strong="H2396" pos="13">Ézéchias</w>'
    ),
    []
  );
  // …but the hyphenated name after it still is, and an empty tag inside a
  // compound is an untranslated word, not one of its parts.
  assert.equal(
    witnessCompoundWords(
      'près <w strong="H5921" pos="12">d’</w><w strong="H0072" pos="13">Ében</w>-<w strong="H0072" pos="14">Ézer</w>'
    )[0]?.members.length,
    2
  );
  const year = readWitnessCompounds(
    'La <w strong="H6242" pos="2">vingt</w><w strong="H8141" pos="1"></w>-<w strong="H7969" pos="3">troisième</w> <w strong="H8141" pos="4">année</w>'
  );
  assert.deepEqual(
    year.compounds[0]?.members.map((member) => member.position),
    [2, 3]
  );
  assert.ok(year.untranslated.has("H8141#1"));
});

test("STEP morphology classes and the spelling key of names", () => {
  assert.equal(contentMorphology("HR/Npl"), true);
  assert.equal(contentMorphology("HC/Ncbsa"), true);
  assert.equal(contentMorphology("HTo"), false);
  assert.equal(contentMorphology("N-DSN"), true);
  assert.equal(contentMorphology("A-NUI"), true);
  assert.equal(contentMorphology("T-GSM"), false);
  assert.equal(contentMorphology("P-GSM"), false);
  assert.equal(contentMorphology("CONJ"), false);
  assert.equal(properNameKey("Beer-Schéba"), properNameKey("Beer-Shéba"));
  assert.notEqual(properNameKey("Rab-Saris"), properNameKey("Rabshaké"));
});

test("the second half of a split name shares the carrier of the first", () => {
  const ref = "Gen.28.19";
  const proposals = proposeCompoundTargetWords({
    words: ["Il", "appela", "cet", "endroit", "Béthel"],
    units: [unit(ref, 6, "H1008"), unit(ref, 7, "H1008")],
    carriers: [carrier(ref, 6, "H1008", 4)],
    witnesses: [sg1910(ref, 'nom de <w strong="H1008" pos="6+7">Béthel</w> ;')],
    maxStrongPerWord: 3
  });
  assert.deepEqual(
    proposals.map((p) => [p.sourceUnitId, p.wordIndex, p.carrier]),
    [["TAHOT.Gen.28.19.7.L", 4, "shared"]]
  );
});

test("a compound name is found under another spelling, both halves placed once", () => {
  const ref = "Gen.28.10";
  const proposals = proposeCompoundTargetWords({
    words: ["Jacob", "partit", "de", "Beer-Shéba"],
    units: [unit(ref, 3, "H0884", "HR/Npl"), unit(ref, 4, "H0884")],
    carriers: [],
    witnesses: [
      sg1910(
        ref,
        'de <w strong="H0884" pos="3">Beer</w>-<w strong="H0884" pos="4">Schéba</w>, et'
      )
    ],
    maxStrongPerWord: 3
  });
  assert.deepEqual(
    proposals.map((p) => [p.wordIndex, p.carrier, p.match]),
    [
      [3, "new", "name-spelling"],
      [3, "shared", "name-spelling"]
    ]
  );
});

test("a repeated witness word goes to the target word its other half already carries", () => {
  const ref = "1Kgs.12.32";
  const witness = sg1910(
    ref,
    'fit à <w strong="H1008" pos="18+19">Béthel</w> afin. Il plaça à <w strong="H1008" pos="25+26">Béthel</w> les'
  );
  const units = [18, 19, 25, 26].map((p) => unit(ref, p, "H1008"));
  const proposals = proposeCompoundTargetWords({
    words: ["agit", "à", "Béthel", "et", "il", "y", "plaça"],
    units,
    carriers: [carrier(ref, 18, "H1008", 2)],
    witnesses: [witness],
    maxStrongPerWord: 3
  });
  assert.deepEqual(
    proposals.map((p) => p.sourceUnitId),
    ["TAHOT.1Kgs.12.32.19.L"]
  );
  // Without that anchor, two witness words for one target word say nothing.
  assert.deepEqual(
    proposeCompoundTargetWords({
      words: ["agit", "à", "Béthel", "et", "il", "y", "plaça"],
      units,
      carriers: [],
      witnesses: [witness],
      maxStrongPerWord: 3
    }),
    []
  );
});

test("witness positions numbered otherwise pair with STEP in order", () => {
  // The witness numbers « Bethléhem » 8+9, STEP numbers its halves 7 and 8.
  const ref = "Jer.41.17";
  const proposals = proposeCompoundTargetWords({
    words: ["près", "de", "Bethléhem"],
    units: [unit(ref, 7, "H1035"), unit(ref, 8, "H1035")],
    carriers: [carrier(ref, 8, "H1035", 2)],
    witnesses: [
      sg1910(
        ref,
        '<w strong="H0681" pos="7">près</w> de <w strong="H1035" pos="8+9">Bethléhem</w>,'
      )
    ],
    maxStrongPerWord: 3
  });
  assert.deepEqual(
    proposals.map((p) => [p.sourceUnitId, p.carrier]),
    [["TAHOT.Jer.41.17.7.L", "shared"]]
  );
});

test("function words, open readings, carried words and contradictions stay as they are", () => {
  const ref = "Matt.10.33";
  const greek = (position: number, strong: string, morphology: string) => ({
    id: `TAGNT.${ref}.${position}.NKO`,
    readingUnresolved: false,
    morphology,
    occurrences: [
      { occurrenceId: `TAGNT.${ref}.${position}.NKO.main:0`, strong }
    ]
  });
  assert.deepEqual(
    proposeCompoundTargetWords({
      words: ["devant", "mon", "Père"],
      units: [greek(13, "G3588", "T-GSM"), greek(15, "G3450", "P-1GS")],
      carriers: [],
      witnesses: [
        sg1910(
          ref,
          'devant <w strong="G3588 G3450" pos="13+15">mon</w> <w strong="G3962" pos="14">Père</w>'
        )
      ],
      maxStrongPerWord: 3
    }),
    []
  );
  // « leur » pools the article with ἴδιος: the adjective is not « leur ».
  const acts = "Acts.25.19";
  const own = (position: number, strong: string, morphology: string) => ({
    id: `TAGNT.${acts}.${position}.NKO`,
    readingUnresolved: false,
    morphology,
    occurrences: [
      { occurrenceId: `TAGNT.${acts}.${position}.NKO.main:0`, strong }
    ]
  });
  assert.deepEqual(
    proposeCompoundTargetWords({
      words: ["à", "leur", "religion", "particulière"],
      units: [own(5, "G3588", "T-GSF"), own(6, "G2398", "A-GSF")],
      carriers: [],
      witnesses: [
        sg1910(
          acts,
          'touchant <w strong="G3588 G2398" pos="5+6">leur</w> <w strong="G1175" pos="7">culte</w>'
        )
      ],
      maxStrongPerWord: 3
    }),
    []
  );
  // « là » of a repeated « temps-là », placed on the wrong repeat, anchors
  // nothing.
  const dan = "Dan.12.1";
  const time = (p: number) => unit(dan, p, "H6256", "HNcbsa");
  const there = (p: number) => unit(dan, p, "H1931", "HPdxms");
  assert.deepEqual(
    proposeCompoundTargetWords({
      words: ["ce", "temps-là", "une", "époque", "ce", "temps-là"],
      units: [time(1), there(2), time(20), there(21), time(22), there(23)],
      carriers: [
        carrier(dan, 1, "H6256", 1),
        carrier(dan, 21, "H1931", 5),
        carrier(dan, 22, "H6256", 5)
      ],
      witnesses: [
        sg1910(
          dan,
          'ce <w strong="H6256" pos="1">temps</w>-<w strong="H1931" pos="2">là</w> ; ce <w strong="H6256" pos="20">temps</w>-<w strong="H1931" pos="21">là</w>. Et en ce <w strong="H6256" pos="22">temps</w>-<w strong="H1931" pos="23">là</w>'
        )
      ],
      maxStrongPerWord: 3
    }),
    []
  );
  const gen = "Gen.28.19";
  const words = ["appela", "Béthel"];
  const witnesses = [sg1910(gen, 'de <w strong="H1008" pos="6+7">Béthel</w>')];
  const open = proposeCompoundTargetWords({
    words,
    units: [unit(gen, 6, "H1008"), unit(gen, 7, "H1008", "HNpl", true)],
    carriers: [carrier(gen, 6, "H1008", 1)],
    witnesses,
    maxStrongPerWord: 3
  });
  assert.deepEqual(open, []);
  const elsewhere = proposeCompoundTargetWords({
    words,
    units: [unit(gen, 6, "H1008"), unit(gen, 7, "H1008")],
    carriers: [carrier(gen, 6, "H1008", 1), carrier(gen, 7, "H1008", 0)],
    witnesses,
    maxStrongPerWord: 3
  });
  assert.deepEqual(elsewhere, []);
  const contradicted = proposeCompoundTargetWords({
    words,
    units: [unit(gen, 6, "H1008"), unit(gen, 7, "H1008")],
    carriers: [carrier(gen, 6, "H1008", 1)],
    witnesses: [
      ...witnesses,
      {
        name: "Darby",
        ref: gen,
        taggedText:
          'de <w strong="H1008" pos="6">Béthel</w><w strong="H1008" pos="7"></w>'
      }
    ],
    maxStrongPerWord: 3
  });
  assert.deepEqual(contradicted, []);
});

test("a number written in digits carries all its numbers", () => {
  const ref = "1Chr.12.25";
  const proposals = proposeCompoundTargetWords({
    words: ["6800", "hommes"],
    units: [
      unit(ref, 6, "H8337", "HNcbsc"),
      unit(ref, 7, "H0505", "HNcbpa"),
      unit(ref, 8, "H8083", "HC/Ncbsa"),
      unit(ref, 9, "H3967", "HNcfpa")
    ],
    carriers: [],
    witnesses: [
      sg1910(
        ref,
        '<w strong="H8337 H0505 H8083 H3967" pos="6+7+8+9">6 800</w> hommes'
      )
    ],
    maxStrongPerWord: 3
  });
  assert.equal(proposals.length, 4);
  assert.ok(proposals.every((p) => p.wordIndex === 0 && p.carrier === "new"));
  // A spelled word keeps the profile's limit.
  assert.equal(
    proposeCompoundTargetWords({
      words: ["six-mille-huit-cents"],
      units: [
        unit(ref, 6, "H8337", "HNcbsc"),
        unit(ref, 7, "H0505", "HNcbpa"),
        unit(ref, 8, "H8083", "HC/Ncbsa"),
        unit(ref, 9, "H3967", "HNcfpa")
      ],
      carriers: [],
      witnesses: [
        sg1910(
          ref,
          '<w strong="H8337" pos="6">six</w>-<w strong="H0505" pos="7">mille</w>-<w strong="H8083" pos="8">huit</w>-<w strong="H3967" pos="9">cents</w>'
        )
      ],
      maxStrongPerWord: 3
    }).length,
    3
  );
});

function bethelFixture() {
  const rows = [
    "Gen.28.19#01=L\tוַ/יִּקְרָ֛א\tvai.yik.Ra\tand/ called\tH9001/{H7121G}\tHC/Vqw3ms\t\t\tH7121G\t\t\t",
    "Gen.28.19#06=L\tבֵּֽית\\־\tbeit-\tBeth-\t{H1008G}+\\H9014\tHNpl\t\t\tH1008G_A\t\t\t",
    "Gen.28.19#07=L\tאֵ֑ל\t'El\t-el\t{H1008G}\tHNpl\t\t\tH1008G_b\t\t\t"
  ].map((line, index) => parseSourceRow(line, "TAHOT fixture.txt", index + 1)!);
  const strongs = ["H7121", "H1008", "H1008"];
  const occurrences: OriginalStrongOccurrence[] = rows.map((row, i) => ({
    occurrenceId: `${row.id}.main:0`,
    tokenId: `${row.id}.main`,
    tokenIndex: row.tokenIndex,
    sourceIdentity: row.id,
    strong: strongs[i]!,
    sourceStrong: strongs[i]!,
    text: row.surface,
    gloss: row.gloss,
    lemma: row.surface,
    morph: i === 0 ? "HC/Vqw3ms" : "HNpl",
    pos: ""
  }));
  const annotations: StrongLedgerAnnotation[] = [
    {
      id: "Gen.28.19:0:H7121",
      strong: "H7121",
      visibility: "reader",
      placement: "word",
      source: "reference-transfer",
      confidence: 0.99,
      reason: "fixture",
      diagnostics: ["exact"],
      wordIndex: 1,
      originalOccurrenceId: occurrences[0]!.occurrenceId
    },
    {
      id: "Gen.28.19:1:H1008",
      strong: "H1008",
      visibility: "reader",
      placement: "word",
      source: "reference-transfer",
      confidence: 0.995,
      reason: "fixture",
      diagnostics: ["exact"],
      wordIndex: 2,
      originalOccurrenceId: occurrences[1]!.occurrenceId
    },
    {
      id: "Gen.28.19:2:H1008",
      strong: "H1008",
      visibility: "advanced",
      placement: "empty",
      source: "original-complete",
      confidence: 0.35,
      reason: "fixture",
      diagnostics: ["empty-original"],
      insertAfterWordIndex: 2,
      originalOccurrenceId: occurrences[2]!.occurrenceId
    }
  ];
  const text = "Il appela Béthel";
  return {
    bible: "s21",
    verse: {
      ref: "Gen.28.19",
      text,
      tokens: ["Il", "appela", "Béthel"].map((word, wordIndex) => ({
        wordIndex,
        text: word,
        normalized: word.toLowerCase()
      })),
      annotations
    },
    input: {
      occurrences,
      references: [
        {
          name: "Sg1910",
          family: "Sg1910",
          verse: {
            row: {
              bookId: "Gen",
              chapter: 28,
              verse: 19,
              text: 'Il <w strong="H7121" pos="1">donna</w> le nom de <w strong="H1008" pos="6+7">Béthel</w>.'
            },
            tokens: []
          }
        }
      ],
      issues: []
    },
    sourceRows: new Map(rows.map((row) => [row.id, row])),
    lexicalItems: []
  };
}

test("resolution: the split name becomes visible on the shared carrier, shown once", () => {
  const off = bethelFixture();
  const before = resolveCanonicalVerse(off);
  assert.equal(before.decisions[2]!.state, "unresolved");
  assert.equal(off.verse.annotations[2]!.placement, "empty");

  const on = bethelFixture();
  const after = resolveCanonicalVerse({
    ...on,
    policy: { compoundTargetWords: true, maxStrongPerWord: 3 }
  });
  assert.equal(after.decisions[1]!.state, "visible");
  assert.equal(after.decisions[2]!.state, "visible");
  assert.deepEqual(after.decisions[2]!.targetWordIndices, [2]);
  assert.equal(after.decisions[2]!.assurance, "witness-compound-word");
  const shared = on.verse.annotations[2]!;
  assert.ok(isCompoundSharedCarrier(shared));
  assert.equal(shared.visibility, "hidden");
  assert.equal(shared.wordIndex, 2);
  assert.equal(shared.diagnostics[0], "compound-target-word");
  const html = renderStrongTaggedText(
    tokenizeText(on.verse.text),
    on.verse.annotations,
    "reader"
  );
  const shown = [...html.matchAll(/<w strong="([^"]*)"/gu)].flatMap((match) =>
    match[1]!.split(" ")
  );
  assert.deepEqual(shown, ["H7121", "H1008"]);
});
