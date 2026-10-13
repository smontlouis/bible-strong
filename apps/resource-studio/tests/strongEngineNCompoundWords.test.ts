import assert from "node:assert/strict";
import test from "node:test";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import {
  applyCompoundTargetWordsToVerse,
  resolveCanonicalVerse
} from "../src/strongCanonicalResolution.js";
import {
  applyCompoundTargetWords,
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
  applyCompoundTargetWordsToLedger,
  renderStrongTaggedText,
  type StrongLedgerAnnotation,
  type StrongLedgerVerse,
  type StrongLedgerVerseMetrics
} from "../src/strongLedger.js";
import { parseSourceRow } from "../src/strongSourceUnits.js";
import { tokenizeText } from "../src/tokenize.js";
import type { VerseCorrespondenceBlock } from "../src/verseCorrespondence.js";

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
const darby = (ref: string, taggedText: string) => ({
  name: "Darby",
  ref,
  taggedText
});
/** What the reader shows: the numbers, their words and their visibility. */
const readerView = (annotations: StrongLedgerAnnotation[]) =>
  JSON.stringify(
    annotations
      .filter((a) => a.visibility === "reader")
      .map((a) => [
        a.id,
        a.strong,
        a.placement,
        a.wordIndex,
        a.startWordIndex,
        a.endWordIndex,
        a.insertAfterWordIndex
      ])
  );

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
    'à <w strong="H1008" pos="18+19">Béthel</w> ; à <w strong="H1008" pos="25+26">Béthel</w>'
  );
  const units = [18, 19, 25, 26].map((p) => unit(ref, p, "H1008"));
  const proposals = proposeCompoundTargetWords({
    words: ["à", "Béthel", "et", "y"],
    units,
    carriers: [carrier(ref, 18, "H1008", 1)],
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
      words: ["à", "Béthel", "et", "y"],
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
          '<w strong="H6256" pos="1">temps</w>-<w strong="H1931" pos="2">là</w> ; <w strong="H6256" pos="20">temps</w>-<w strong="H1931" pos="21">là</w> ; <w strong="H6256" pos="22">temps</w>-<w strong="H1931" pos="23">là</w>'
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

test("the profile's limit holds for every word, numbers in digits included", () => {
  const ref = "1Chr.12.25";
  const units = [
    unit(ref, 6, "H8337", "HNcbsc"),
    unit(ref, 7, "H0505", "HNcbpa"),
    unit(ref, 8, "H8083", "HC/Ncbsa"),
    unit(ref, 9, "H3967", "HNcfpa")
  ];
  const digits = (maxStrongPerWord: number, digitNumberStrongs = false) =>
    proposeCompoundTargetWords({
      words: ["6800", "hommes"],
      units,
      carriers: [],
      witnesses: [
        sg1910(
          ref,
          '<w strong="H8337 H0505 H8083 H3967" pos="6+7+8+9">6 800</w> hommes'
        )
      ],
      maxStrongPerWord,
      digitNumberStrongs
    });
  // T: a number in digits shows every number of its value.
  assert.equal(digits(3, true).length, 4);
  assert.deepEqual(
    digits(3).map((p) => [p.strong, p.wordIndex, p.carrier]),
    [
      ["H8337", 0, "new"],
      ["H0505", 0, "new"],
      ["H8083", 0, "new"]
    ]
  );
  assert.equal(digits(4).length, 4);
  // A spelled word keeps the same limit.
  assert.equal(
    proposeCompoundTargetWords({
      words: ["six-mille-huit-cents"],
      units,
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
  // A word that already shows as many numbers as allowed takes no new one,
  // but a source word whose number it shows still shares that carrier.
  const gen = "Gen.36.2";
  assert.deepEqual(
    proposeCompoundTargetWords({
      words: ["Oholibama-Ana"],
      units: [1, 2, 3, 7, 8].map((p) =>
        unit(gen, p, p === 7 ? "H0001" : p === 8 ? "H0004" : `H000${p}`)
      ),
      carriers: [1, 2, 3].map((p) => carrier(gen, p, `H000${p}`, 0)),
      witnesses: [
        sg1910(
          gen,
          '<w strong="H0001" pos="7">Oholibama</w>-<w strong="H0004" pos="8">Ana</w>'
        )
      ],
      maxStrongPerWord: 3
    }).map((p) => [p.sourceUnitId, p.carrier]),
    [["TAHOT.Gen.36.2.7.L", "shared"]]
  );
});

test("nothing is proposed inside a phrase, on split votes or from another verse", () => {
  const ref = "Gen.28.19";
  const units = [unit(ref, 6, "H1008"), unit(ref, 7, "H1008")];
  const bethel = 'de <w strong="H1008" pos="6+7">Béthel</w>';
  const placed = (input: {
    words: string[];
    carriers?: CompoundCarrier[];
    witnesses: Array<{ name: string; ref: string; taggedText: string }>;
  }) =>
    proposeCompoundTargetWords({
      units,
      carriers: [],
      maxStrongPerWord: 3,
      ...input
    }).map((p) => [p.sourceUnitId, p.wordIndex, p.carrier]);
  assert.deepEqual(
    placed({ words: ["appela", "Béthel"], witnesses: [sg1910(ref, bethel)] }),
    [
      ["TAHOT.Gen.28.19.6.L", 1, "new"],
      ["TAHOT.Gen.28.19.7.L", 1, "shared"]
    ]
  );
  // The target word lies inside a phrase carrier of another source word.
  assert.deepEqual(
    placed({
      words: ["appela", "Béthel"],
      carriers: [
        {
          strong: "H7121",
          kind: "phrase",
          originalOccurrenceId: "TAHOT.Gen.28.19.1.L.main:0",
          startWordIndex: 0,
          endWordIndex: 1
        }
      ],
      witnesses: [sg1910(ref, bethel)]
    }),
    []
  );
  // Two witnesses pair the word with different target words.
  assert.deepEqual(
    placed({
      words: ["Béthel", "et", "Béthel"],
      witnesses: [
        sg1910(ref, `${bethel} et Béthel`),
        darby(ref, 'de Béthel et <w strong="H1008" pos="6+7">Béthel</w>')
      ]
    }),
    []
  );
  // Positions of another verse never name these source words.
  assert.deepEqual(
    placed({
      words: ["appela", "Béthel"],
      witnesses: [sg1910("Gen.28.18", bethel)]
    }),
    []
  );
});

test("the occurrence's own annotation becomes its carrier, reviewed states stay", () => {
  const ref = "Gen.28.19";
  const tokens = ["appela", "Béthel"].map((text) => ({
    text,
    normalized: text.toLowerCase()
  }));
  const annotation = (
    position: number,
    fields: Partial<StrongLedgerAnnotation>
  ): StrongLedgerAnnotation => ({
    id: `${ref}:${position}:H1008`,
    strong: "H1008",
    visibility: "advanced",
    placement: "empty",
    source: "original-complete",
    confidence: 0.3,
    reason: "fixture",
    diagnostics: [],
    insertAfterWordIndex: 1,
    originalOccurrenceId: `TAHOT.${ref}.${position}.L.main:0`,
    ...fields
  });
  const run = (second?: Partial<StrongLedgerAnnotation>) => {
    const annotations = [
      annotation(6, {
        visibility: "reader",
        placement: "word",
        source: "reference-transfer",
        wordIndex: 1,
        insertAfterWordIndex: undefined
      }),
      ...(second ? [annotation(7, second)] : [])
    ];
    const proposals = applyCompoundTargetWords({
      ref,
      tokens,
      annotations,
      units: [unit(ref, 6, "H1008"), unit(ref, 7, "H1008")],
      witnesses: [sg1910(ref, 'de <w strong="H1008" pos="6+7">Béthel</w>')],
      maxStrongPerWord: 3
    });
    return { proposals, annotations };
  };
  // An advanced phrase estimate is converted, not doubled.
  const phrase = run({
    placement: "phrase",
    startWordIndex: 0,
    endWordIndex: 1,
    insertAfterWordIndex: undefined
  });
  assert.equal(phrase.proposals.length, 1);
  assert.equal(phrase.annotations.length, 2);
  assert.ok(isCompoundSharedCarrier(phrase.annotations[1]!));
  assert.equal(phrase.annotations[1]!.startWordIndex, undefined);
  assert.equal(phrase.annotations[1]!.wordIndex, 1);
  // A reviewed or not-rendered occurrence keeps its state.
  for (const fixed of [
    { visibility: "pending" as const },
    { visibility: "rejected" as const },
    { placement: "not-rendered" as const },
    { placement: "technical" as const }
  ]) {
    const result = run(fixed);
    assert.deepEqual(result.proposals, []);
    assert.equal(result.annotations[1]!.diagnostics.length, 0);
  }
  // An occurrence without any annotation gets one.
  const bare = run();
  assert.equal(bare.proposals.length, 1);
  assert.equal(bare.annotations.length, 2);
  assert.ok(isCompoundSharedCarrier(bare.annotations[1]!));
  // A second run sees the shared carrier as a carrier: nothing moves.
  const before = JSON.stringify(bare.annotations);
  assert.deepEqual(
    applyCompoundTargetWords({
      ref,
      tokens,
      annotations: bare.annotations,
      units: [unit(ref, 6, "H1008"), unit(ref, 7, "H1008")],
      witnesses: [sg1910(ref, 'de <w strong="H1008" pos="6+7">Béthel</w>')],
      maxStrongPerWord: 3
    }),
    []
  );
  assert.equal(JSON.stringify(bare.annotations), before);
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
  const applied = applyCompoundTargetWordsToVerse({
    ...on,
    maxStrongPerWord: 3
  });
  assert.deepEqual(
    applied.map((p) => p.carrier),
    ["shared"]
  );
  // Resolution itself never changes the reader.
  const reader = readerView(on.verse.annotations);
  const after = resolveCanonicalVerse({
    ...on,
    policy: { compoundTargetWords: true }
  });
  assert.equal(readerView(on.verse.annotations), reader);
  assert.equal(after.decisions[1]!.state, "visible");
  assert.equal(after.decisions[2]!.state, "visible");
  assert.deepEqual(after.decisions[2]!.targetWordIndices, [2]);
  assert.equal(after.decisions[2]!.assurance, "witness-compound-word");
  assert.deepEqual(
    after.decisions[2]!.placementEvidence.map((e) => e.diagnostics[0]),
    ["compound-target-word"]
  );
  assert.ok(
    after.decisions[2]!.exploration.methods.includes("compound-target-word")
  );
  assert.ok(
    !before.decisions[2]!.exploration.methods.includes("compound-target-word")
  );
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

test("a merged block's joined witness row maps no compound", () => {
  // The joined row numbers the words of both verses under the first one's
  // reference: N abstains, as M and R do.
  const merged = bethelFixture();
  const before = JSON.stringify(merged.verse.annotations);
  assert.deepEqual(
    applyCompoundTargetWordsToVerse({
      ...merged,
      input: {
        ...merged.input,
        mapping: {
          targetRefs: ["Gen.28.19"],
          canonicalRefs: ["Gen.28.19", "Gen.28.20"],
          kind: "merge"
        } as VerseCorrespondenceBlock
      },
      maxStrongPerWord: 3
    }),
    []
  );
  assert.equal(JSON.stringify(merged.verse.annotations), before);
  // The same verse with its own canonical reference is mapped.
  const single = bethelFixture();
  assert.equal(
    applyCompoundTargetWordsToVerse({
      ...single,
      input: {
        ...single.input,
        mapping: {
          targetRefs: ["Gen.28.19"],
          canonicalRefs: ["Gen.28.19"],
          kind: "identity"
        } as VerseCorrespondenceBlock
      },
      maxStrongPerWord: 3
    }).length,
    1
  );
});

/** The Béthel fixture as a ledger verse, both halves still uncarried. */
function bethelLedgerVerse() {
  const fixture = bethelFixture();
  // The first half too is only an advanced estimate here.
  Object.assign(fixture.verse.annotations[1]!, {
    visibility: "advanced",
    placement: "empty",
    source: "original-complete",
    wordIndex: undefined,
    insertAfterWordIndex: 2
  });
  const metrics = Object.fromEntries(
    [
      "wordCount",
      "readerVisibleStrongCount",
      "advancedStrongCount",
      "emptyStrongCount",
      "phraseStrongCount",
      "technicalStrongCount",
      "pendingHumanCount",
      "rejectedCount",
      "referenceStrongOccurrenceCount",
      "referenceStrongRepresentedCount",
      "referenceStrongCoverage",
      "referenceStrongCarrierCount",
      "referenceStrongCarrierCoverage",
      "originalStrongOccurrenceCount",
      "originalRepresentedStrongOccurrenceCount",
      "originalRepresentationRate",
      "originalStrongCarrierCount",
      "originalStrongCarrierRate",
      "semanticMissingCount",
      "readerMultiStrongWordCount",
      "readerOverBudgetStrongCount",
      "placementRiskCount",
      "placementQuality",
      "readerTaggedTokenCount",
      "advancedTaggedTokenCount",
      "readerTokenCoverage",
      "advancedTokenCoverage"
    ].map((key) => [key, 0])
  ) as unknown as StrongLedgerVerseMetrics;
  const verse: StrongLedgerVerse = {
    ref: "Gen.28.19",
    bookId: "Gen",
    chapter: 28,
    verse: 19,
    text: fixture.verse.text,
    tokens: fixture.verse.tokens,
    annotations: fixture.verse.annotations,
    views: { readerHtml: "", advancedHtml: "", debugHtml: "" },
    inventories: {
      references: { Sg1910: ["H7121", "H1008"], Darby: [], DarbyR: [] },
      original: ["H7121", "H1008", "H1008"],
      reader: ["H7121"],
      advanced: ["H7121", "H1008", "H1008"]
    },
    metrics: { ...metrics, wordCount: 3, readerVisibleStrongCount: 1 }
  };
  return { ...fixture, verse };
}

test("ledger: option N runs before the reader baseline and only when enabled", () => {
  const policy = {
    readingInvariantVariants: true,
    strongIdentifierFamilies: true
  };
  const off = bethelLedgerVerse();
  const untouched = JSON.stringify(off.verse);
  const run = (
    fixture: ReturnType<typeof bethelLedgerVerse>,
    compoundTargetWords: boolean,
    maxStrongPerWord = 3
  ) =>
    applyCompoundTargetWordsToLedger({
      verses: [fixture.verse],
      inputs: new Map([[fixture.verse.ref, fixture.input]]),
      sourceRows: fixture.sourceRows,
      enginePolicy: { ...policy, compoundTargetWords },
      maxStrongPerWord
    });
  assert.deepEqual([...run(off, false)], []);
  assert.equal(JSON.stringify(off.verse), untouched);
  // The profile's limit reaches the pass.
  const closed = bethelLedgerVerse();
  assert.deepEqual([...run(closed, true, 0)], []);
  assert.equal(JSON.stringify(closed.verse), untouched);

  const on = bethelLedgerVerse();
  assert.deepEqual([...run(on, true)], ["Gen.28.19"]);
  // The verse is refreshed: the reader now shows « H1008 » once on « Béthel ».
  assert.deepEqual(on.verse.inventories.reader, ["H7121", "H1008"]);
  assert.equal(on.verse.metrics.readerVisibleStrongCount, 2);
  assert.match(on.verse.views.readerHtml, /H1008/u);
  const reader = readerView(on.verse.annotations);
  const metrics = JSON.stringify(on.verse.metrics);
  const resolution = resolveCanonicalVerse({
    bible: on.bible,
    verse: on.verse,
    input: on.input,
    sourceRows: on.sourceRows,
    lexicalItems: [],
    policy: { ...policy, compoundTargetWords: true }
  });
  // Occurrence resolution leaves the reader as the baseline measured it.
  assert.equal(readerView(on.verse.annotations), reader);
  assert.equal(JSON.stringify(on.verse.metrics), metrics);
  assert.deepEqual(
    resolution.decisions.map((d) => d.state),
    ["visible", "visible", "visible"]
  );
});
