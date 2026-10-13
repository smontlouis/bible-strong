import assert from "node:assert/strict";
import test from "node:test";
import { alignVerse, type ReferenceSource } from "../src/align.js";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import { parseFrenchNumeral } from "../src/frenchNumerals.js";
import {
  addNumeralValueCarriers,
  isNumeralGloss,
  shownNumeralStrongs
} from "../src/numeralValues.js";
import { alignReaderVerse } from "../src/readerAlignment.js";
import { parseStrongTokens } from "../src/strongCsv.js";
import type { ReaderAlignmentPolicy } from "../src/translationProfiles.js";

const witness = (name: string, tagged: string): ReferenceSource => ({
  name,
  verse: {
    row: { bookId: "1Chr", chapter: 12, verse: 27, text: tagged },
    tokens: parseStrongTokens(tagged)
  }
});

const policy = (
  numeralValues: boolean,
  maxStrongPerWord = 3
): ReaderAlignmentPolicy => ({
  maxStrongPerWord,
  minEmptySourceAgreement: 2,
  learnedTranslationMinScore: 0.36,
  learnedFunctionWordMode: "restricted",
  transferMatching: {
    digitNumerals: true,
    witnessLocutions: true,
    witnessPositions: true,
    ...(numeralValues ? { numeralValues: true } : {})
  }
});

const align = (
  targetText: string,
  references: ReferenceSource[],
  numeralValues = true,
  maxStrongPerWord = 3
) =>
  alignReaderVerse({
    targetText,
    references,
    readerPolicy: policy(numeralValues, maxStrongPerWord)
  });

const carried = (result: ReturnType<typeof align>, wordIndex: number) =>
  result.assignments.get(wordIndex)?.strong;

test("French numbers are read by value, in digits or in words", () => {
  const value = (text: string) => {
    const numeral = parseFrenchNumeral(text);
    return numeral && [numeral.value, numeral.ordinal];
  };
  assert.deepEqual(value("4600"), [4600, false]);
  assert.deepEqual(value("180'000"), [180000, false]);
  assert.deepEqual(value("4 600"), [4600, false]);
  assert.deepEqual(value("cent quatre-vingt mille"), [180000, false]);
  assert.deepEqual(value("sept mille sept cents"), [7700, false]);
  assert.deepEqual(value("mille et cent"), [1100, false]);
  assert.deepEqual(value("quatre-vingt-dix-neuf"), [99, false]);
  assert.deepEqual(value("soixante et onze"), [71, false]);
  assert.deepEqual(value("vingt-quatrième"), [24, true]);
  assert.deepEqual(value("24e"), [24, true]);
  assert.deepEqual(value("premier"), [1, true]);
  // Two numbers, a fraction or a compound name are not one number.
  assert.equal(value("deux et deux"), undefined);
  assert.equal(value("trois quatre"), undefined);
  assert.equal(value("dixièmes"), undefined);
  assert.equal(value("second-premier"), undefined);
  assert.equal(value("2er"), undefined);
});

test("only whole English number words make a numeral gloss", () => {
  assert.equal(isNumeralGloss("and/ six"), true);
  assert.equal(isNumeralGloss("thousand<s>"), true);
  assert.equal(isNumeralGloss("one's own"), false);
  assert.equal(isNumeralGloss("new"), false);
});

test("a witness number gives all its source words to the target word of the same value", () => {
  const references = [
    witness(
      "Sg1910",
      'Des <w strong="H1121" pos="2">fils</w> de <w strong="H3878" pos="3">Lévi</w>, <w strong="H0702" pos="4">quatre</w> <w strong="H0505" pos="5">mille</w> <w strong="H8337" pos="6">six</w> <w strong="H3967" pos="7">cents</w> ;'
    ),
    witness(
      "Darby",
      'Des <w strong="H1121" pos="2">fils</w> de <w strong="H3878" pos="3">Lévi</w>, <w strong="H0702 H0505 H8337 H3967" pos="4+5+6+7">4 600</w>.'
    )
  ];
  const target = "Des Lévites: 4600";
  assert.equal(carried(align(target, references, false), 2), undefined);
  // A profile that shows four numbers on a word.
  const on = align(target, references, true, 4);
  assert.deepEqual(carried(on, 2), ["H0702", "H0505", "H8337", "H3967"]);
  const carrier = on.assignments.get(2)!;
  assert.equal(carrier.method, "exact");
  assert.match(carrier.source, /^Sg1910\+Darby~numeral-value/u);
  assert.deepEqual(carrier.sourcePositions, [
    "1Chr.12.27#4",
    "1Chr.12.27#5",
    "1Chr.12.27#6",
    "1Chr.12.27#7"
  ]);
});

test("a hyphenated number completes the carrier holding part of it", () => {
  const references = [
    witness(
      "Sg1910",
      'en tout <w strong="H7970" pos="16">trente</w>-<w strong="H7969" pos="17">trois</w> <w strong="H5315" pos="13">personnes</w>.'
    ),
    witness(
      "Darby",
      'les <w strong="H5315" pos="13">âmes</w>, <w strong="H7970 H7969" pos="16+17">33</w>.'
    )
  ];
  const target = "formaient en tout trente-trois personnes.";
  // Without O, « trente » reaches « trente-trois » alone.
  assert.deepEqual(carried(align(target, references, false), 3), ["H7970"]);
  assert.deepEqual(carried(align(target, references), 3), ["H7970", "H7969"]);
});

test("repeated digit values pair in order, each source word once", () => {
  const references = [
    witness(
      "Sg1910",
      '<w strong="H7651" pos="14">sept</w> <w strong="H0505" pos="15">mille</w> <w strong="H7651" pos="16">sept</w> <w strong="H3967" pos="17">cents</w> <w strong="H0352" pos="13">béliers</w> et <w strong="H7651" pos="19">sept</w> <w strong="H0505" pos="20">mille</w> <w strong="H7651" pos="21">sept</w> <w strong="H3967" pos="22">cents</w> <w strong="H8495" pos="18">boucs</w>.'
    )
  ];
  const on = align("du bétail: 7700 béliers et 7700 boucs.", references);
  // The word shows « sept » once; both source words remain named.
  assert.deepEqual(carried(on, 2), ["H7651", "H0505", "H3967"]);
  assert.deepEqual(on.assignments.get(2)!.sourcePositions, [
    "1Chr.12.27#14",
    "1Chr.12.27#15",
    "1Chr.12.27#16",
    "1Chr.12.27#17"
  ]);
  assert.deepEqual(
    on.assignments.get(5)!.sourcePositions?.[0],
    "1Chr.12.27#19"
  );
  // Spelled repeated values are not paired.
  const spelled = align("sept mille sept cents et sept mille sept cents", [
    witness(
      "Darby",
      '<w strong="H7651 H0505 H3967" pos="14+15+16+17">7 700</w> et <w strong="H7651 H0505 H3967" pos="19+20+21+22">7 700</w>'
    )
  ]);
  assert.equal(spelled.assignments.size, 0);
});

test("articles, conversions, partial numbers and other carriers are left alone", () => {
  // « un » is too often an article.
  assert.equal(
    carried(
      align("Il y avait un homme.", [
        witness("Darby", 'Il y avait <w strong="H0259" pos="1">1</w> homme.')
      ]),
      3
    ),
    undefined
  );
  // A modern unit after the target number: S21 converts.
  const cubits = [
    witness(
      "Sg1910",
      'longue de <w strong="H6242" pos="3">vingt</w>-<w strong="H2568" pos="4">cinq</w> <w strong="H0520" pos="5">coudées</w>'
    )
  ];
  assert.equal(carried(align("longue de 25 mètres", cubits), 2), undefined);
  // The target drops the ancient measure.
  assert.equal(carried(align("longue de 25, en tout", cubits), 2), undefined);
  // An untagged number word makes the witness number partial.
  assert.equal(
    carried(
      align("2000 hommes", [
        witness("Sg1910", 'deux <w strong="H0505" pos="2">mille</w> hommes')
      ]),
      0
    ),
    undefined
  );
  // A value written twice in the target and once in the witness is ambiguous.
  assert.equal(
    align("33 ans et 33 jours", [
      witness(
        "Sg1910",
        '<w strong="H7970" pos="1">trente</w>-<w strong="H7969" pos="2">trois</w> ans'
      )
    ]).assignments.size,
    0
  );
  // A word carrying another Strong number keeps its carrier.
  const references = [
    witness(
      "Sg1910",
      '<w strong="H7970" pos="1">trente</w>-<w strong="H7969" pos="2">trois</w> ans'
    )
  ];
  const result = alignVerse("33 ans", references);
  result.assignments.set(0, {
    strong: ["H1234"],
    confidence: 0.6,
    source: "lexicon",
    method: "lexicon",
    originalConfirmed: false
  });
  addNumeralValueCarriers({ result, references });
  assert.deepEqual(result.assignments.get(0)?.strong, ["H1234"]);
  // A source word another word already carries is not given twice.
  const claimed = alignVerse(
    "33 ans, trois",
    references,
    undefined,
    undefined,
    {
      witnessPositions: true
    }
  );
  claimed.assignments.set(3, {
    strong: ["H7969"],
    confidence: 0.6,
    source: "Sg1910",
    method: "exact",
    originalConfirmed: false,
    sourcePositions: ["1Chr.12.27#2"]
  });
  addNumeralValueCarriers({
    result: claimed,
    references,
    witnessPositions: true
  });
  assert.equal(claimed.assignments.has(0), false);
});

test("a target digit group is one phrase carrier", () => {
  const references = [
    witness(
      "Sg1910",
      '<w strong="H0702" pos="4">quatre</w> <w strong="H0505" pos="5">mille</w> <w strong="H8337" pos="6">six</w> <w strong="H3967" pos="7">cents</w> ;'
    )
  ];
  const on = align("Des Lévites: 4 600", references, true, 4);
  assert.deepEqual(
    on.phraseAssignments.map((phrase) => [
      phrase.startWordIndex,
      phrase.endWordIndex,
      phrase.strong,
      phrase.transferMethod
    ]),
    [[2, 3, ["H0702", "H0505", "H8337", "H3967"], "exact"]]
  );
  assert.match(on.phraseAssignments[0]!.source, /numeral-value/u);
  assert.equal(on.assignments.has(2), false);
});

test("the numeral Strong numbers come from the source words of the verse", () => {
  const references = [
    witness("Sg1910", 'un cantique <w strong="H2319" pos="2">neuf</w>')
  ];
  const occurrence = (strong: string, gloss: string) =>
    ({ strong, gloss }) as OriginalStrongOccurrence;
  const run = (gloss: string) => {
    const result = alignVerse(
      "un cantique 9",
      references,
      undefined,
      undefined,
      {
        witnessPositions: true
      }
    );
    addNumeralValueCarriers({
      result,
      references,
      originalOccurrences: [occurrence("H2319", gloss)],
      witnessPositions: true
    });
    return result.assignments.get(2)?.strong;
  };
  assert.equal(run("new"), undefined);
  assert.deepEqual(run("nine"), ["H2319"]);
});

test("a number in several words completes its words one by one", () => {
  const references = [
    witness(
      "Sg1910",
      'la <w strong="H2416" pos="2">vie</w> : <w strong="H3967" pos="5">cent</w> <w strong="H7970" pos="7">trente</w>-<w strong="H7651" pos="9">sept</w> <w strong="H8141" pos="4">ans</w>.'
    ),
    witness(
      "Darby",
      'la <w strong="H2416" pos="2">vie</w> : <w strong="H3967 H7970 H7651" pos="5+7+9">137</w> <w strong="H8141" pos="4">ans</w>.'
    )
  ];
  const target = "la vie: cent trente-sept ans.";
  assert.deepEqual(carried(align(target, references, false), 3), ["H7970"]);
  const on = align(target, references);
  assert.deepEqual(carried(on, 2), ["H3967"]);
  assert.deepEqual(carried(on, 3), ["H7970", "H7651"]);
  assert.deepEqual(on.assignments.get(3)!.sourcePositions, [
    "1Chr.12.27#7",
    "1Chr.12.27#9"
  ]);
});

test("a number word matches only inside the same written number", () => {
  const references = [
    witness(
      "Sg1910",
      '<w strong="H6235" pos="12">dix</w> <w strong="H0505" pos="13">mille</w> <w strong="H7273" pos="14">fantassins</w> et <w strong="H6235" pos="10">dix</w> <w strong="H7393" pos="11">chars</w>'
    )
  ];
  const target = "10 chars et 10'000 fantassins";
  // Without O, the « dix » of « dix mille » reaches « 10 ».
  const off = alignVerse(target, references, undefined, undefined, {
    digitNumerals: true,
    witnessPositions: true
  });
  assert.deepEqual(off.assignments.get(0)?.sourcePositions, ["1Chr.12.27#12"]);
  const on = align(target, references);
  assert.deepEqual(on.assignments.get(0)?.sourcePositions, ["1Chr.12.27#10"]);
  assert.deepEqual(carried(on, 3), ["H6235", "H0505"]);
  // An ordinal and a cardinal of one value are the same number.
  const third = align("Trois jours après", [
    witness("Darby", 'le <w strong="H7992" pos="1">troisième</w> jour')
  ]);
  assert.deepEqual(carried(third, 0), ["H7992"]);
});

test("a numeral carrier shows each number once and no more than the profile allows", () => {
  // Ezra.2.13 « 666 » : Segond writes it word by word.
  const references = [
    witness(
      "Sg1910",
      'les fils d’Adonikam, <w strong="H8337" pos="3">six</w> <w strong="H3967" pos="4">cent</w> <w strong="H8346" pos="5">soixante</w>-<w strong="H8337" pos="6">six</w> ;'
    )
  ];
  const target = "descendants d'Adonikam: 666";
  // Without O, nothing reaches « 666 ».
  assert.equal(carried(align(target, references, false), 2), undefined);
  // H8337 once, not « H8337 H3967 H8346 H8337 »: the second « six » keeps
  // no carrier here (option N may share this one with it).
  assert.deepEqual(carried(align(target, references), 2), [
    "H8337",
    "H3967",
    "H8346"
  ]);
  // A profile of two numbers per word shows the first two.
  assert.deepEqual(carried(align(target, references, true, 2), 2), [
    "H8337",
    "H3967"
  ]);
  // « 6800 » with a profile of three: the first three numbers.
  assert.deepEqual(
    shownNumeralStrongs(["H8337", "H0505", "H8083", "H3967"], [], 3),
    ["H8337", "H0505", "H8083"]
  );
  // The numbers the word already shows are never taken away.
  assert.deepEqual(
    shownNumeralStrongs(["H8337", "H0505", "H8083", "H3967"], ["H3967"], 2),
    ["H8337", "H3967"]
  );
});

test("under T a number in digits shows every number of its value", () => {
  // 1Chr.12.25 « 6800 » : four numbers, one more than the profile allows.
  const references = [
    witness(
      "Sg1910",
      '<w strong="H8337" pos="6">six</w> <w strong="H0505" pos="7">mille</w> <w strong="H8083" pos="8">huit</w> <w strong="H3967" pos="9">cents</w> hommes'
    )
  ];
  const withT = (digitNumberStrongs: boolean, targetText: string) =>
    alignReaderVerse({
      targetText,
      references,
      readerPolicy: {
        ...policy(true),
        transferMatching: {
          ...policy(true).transferMatching,
          ...(digitNumberStrongs ? { digitNumberStrongs: true } : {})
        }
      }
    });
  assert.deepEqual(carried(withT(false, "6800 hommes"), 0), [
    "H8337",
    "H0505",
    "H8083"
  ]);
  assert.deepEqual(carried(withT(true, "6800 hommes"), 0), [
    "H8337",
    "H0505",
    "H8083",
    "H3967"
  ]);
});
