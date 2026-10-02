import assert from "node:assert/strict";
import test from "node:test";

import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import {
  applyLexicalGapFill,
  buildLexicalGapLexicon,
  isContentMorphology,
  isLightStrong,
  lexicalGapEvidence,
  lexicalGapFillPass,
  proposeLexicalGapFills,
  surfaceRelation,
  type LexicalGapCarrier,
  type LexicalGapUnit
} from "../src/lexicalGapFill.js";
import { resolveCanonicalVerse } from "../src/strongCanonicalResolution.js";
import { parseStrongTokens } from "../src/strongCsv.js";
import {
  resolveEnginePolicy,
  type StrongLedgerAnnotation,
  type StrongLedgerVerse
} from "../src/strongLedger.js";
import { parseSourceRow } from "../src/strongSourceUnits.js";
import { normalizeWord } from "../src/tokenize.js";

const verse = (tagged: string) => ({ tokens: parseStrongTokens(tagged) });

/** A small whole-Bible lexicon: witnesses, Kaikki forms, dictionary, synonyms. */
function fixtureLexicon() {
  return buildLexicalGapLexicon({
    witnessVerses: [
      verse('il <w strong="H5493">enleva</w> la pierre'),
      verse('on <w strong="H5493">enlèvera</w> le jabot'),
      verse('la <w strong="H4631">caverne</w> du champ'),
      verse('une <w strong="H4631">caverne</w> au désert'),
      verse('ta <w strong="H2233">postérité</w> sera grande'),
      verse('sa <w strong="H2233">postérité</w> après lui'),
      verse('la <w strong="H2233">postérité</w> du juste'),
      verse('le <w strong="H6419">priai</w> et il <w strong="H6419">pria</w>')
    ],
    formLemmas: new Map([
      ["enleva", ["enlever"]],
      ["enlevera", ["enlever"]],
      ["enleve", ["enlever"]],
      ["priai", ["prier"]],
      ["pria", ["prier"]],
      ["priant", ["prier"]],
      ["fit", ["faire"]],
      ["faites", ["faire"]],
      ["terrasse", ["terrer"]],
      ["terre", ["terrer"]],
      ["terres", ["terre", "terrer"]],
      ["terrasses", ["terrasse"]]
    ]),
    dictionary: [
      {
        strong: "H4631",
        normalized: "grotte",
        source: "strong-lexicon-sqlite:fr-gloss"
      },
      {
        strong: "H4631",
        normalized: "grotte",
        source: "strong-lexicon-sqlite:fr-gloss:stem"
      },
      {
        strong: "H4692",
        normalized: "grotte",
        source: "strong-lexicon-sqlite:fr-gloss"
      }
    ],
    synonyms: new Map([
      ["posterite", new Set(["lignee", "descendance"])],
      ["lignee", new Set(["posterite"])]
    ])
  });
}

const unit = (
  position: number,
  strong: string,
  open = false,
  morphology = "HNcfsa"
): LexicalGapUnit => ({
  id: `TAHOT.Gen.50.13.${position}.L`,
  ref: "Gen.50.13",
  position,
  strong: [strong],
  morphology,
  open
});
const carrier = (position: number, wordIndex: number): LexicalGapCarrier => ({
  unitId: `TAHOT.Gen.50.13.${position}.L`,
  startWordIndex: wordIndex,
  endWordIndex: wordIndex
});
const words = (text: string) => text.split(" ").map((w) => normalizeWord(w));

test("the lexicon learns witness lemmas, dictionary glosses and synonyms of main renderings", () => {
  const lexicon = fixtureLexicon();
  assert.equal(lexicon.witnessLemmaCounts.get("H5493")?.get("enlever"), 2);
  assert.equal(lexicon.witnessStrongTotals.get("H2233"), 3);
  assert.ok(lexicon.dictionaryGlosses.get("H4631")?.has("grotte"));
  // Stems of dictionary forms are not glosses.
  assert.equal(lexicon.dictionaryWords.get("H4631")?.size, 1);
  assert.ok(lexicon.mainLemmas.get("H2233")?.has("posterite"));
  assert.ok(lexicon.synonymsOfMain.get("lignee")?.has("posterite"));
  assert.ok(isLightStrong(lexicon, "H5493"));

  assert.equal(
    lexicalGapEvidence(lexicon, "H5493", "enleve").witness,
    "enlever"
  );
  assert.equal(lexicalGapEvidence(lexicon, "H4631", "grotte").gloss, "grotte");
  assert.equal(
    lexicalGapEvidence(lexicon, "H2233", "lignee").synonym,
    "lignee~posterite"
  );
  assert.equal(lexicalGapEvidence(lexicon, "H4631", "champ").any, false);
});

test("STEP content morphology: nouns, verbs, adjectives and names only", () => {
  assert.ok(isContentMorphology("HTd/Ncmsa"));
  assert.ok(isContentMorphology("Hc/Vqw3mp"));
  assert.ok(isContentMorphology("V-AAI-3S"));
  assert.ok(isContentMorphology("ANcmpd/Ta"));
  assert.ok(!isContentMorphology("HTo"));
  assert.ok(!isContentMorphology("HC/Td"));
  assert.ok(!isContentMorphology("T-APM"));
  assert.ok(!isContentMorphology("CONJ"));
});

test("tier A: the only free word with lexical evidence between placed neighbours", () => {
  const lexicon = fixtureLexicon();
  const target = words("ils l'enterrèrent dans la grotte du champ");
  const units = [unit(1, "H6912"), unit(2, "H4631", true), unit(3, "H7704")];
  const fills = proposeLexicalGapFills({
    words: target,
    units,
    carriers: [carrier(1, 1), carrier(3, 6)],
    lexicon
  });
  assert.deepEqual(
    fills.map((f) => [f.unitId, f.wordIndex, f.tier, f.evidence]),
    [["TAHOT.Gen.50.13.2.L", 4, "A", "gloss:grotte"]]
  );

  // A word whose search failed stays open: no evidence, no carrier.
  assert.deepEqual(
    proposeLexicalGapFills({
      words: words("ils l'enterrèrent dans la tombe du champ"),
      units,
      carriers: [carrier(1, 1), carrier(3, 6)],
      lexicon
    }),
    []
  );
  // Crossed neighbours, or no placed neighbour, give no interval.
  assert.deepEqual(
    proposeLexicalGapFills({
      words: target,
      units,
      carriers: [carrier(1, 6), carrier(3, 1)],
      lexicon
    }),
    []
  );
  assert.deepEqual(
    proposeLexicalGapFills({ words: target, units, carriers: [], lexicon }),
    []
  );
  // A function source word (« HTo ») is never filled.
  assert.deepEqual(
    proposeLexicalGapFills({
      words: target,
      units: [
        unit(1, "H6912"),
        unit(2, "H4631", true, "HTo"),
        unit(3, "H7704")
      ],
      carriers: [carrier(1, 1), carrier(3, 6)],
      lexicon
    }),
    []
  );
});

test("tier A abstains when another free word has evidence, or the pool is wide", () => {
  const lexicon = fixtureLexicon();
  const units = [unit(1, "H6912"), unit(2, "H4631", true), unit(3, "H7704")];
  // « caverne » is a witness rendering too: two candidates, no choice.
  assert.deepEqual(
    proposeLexicalGapFills({
      words: words("ils l'enterrèrent grotte caverne du champ"),
      units,
      carriers: [carrier(1, 1), carrier(3, 5)],
      lexicon
    }),
    []
  );
  // Three free content words: beyond the pool of two.
  assert.deepEqual(
    proposeLexicalGapFills({
      words: words("ils l'enterrèrent profonde grotte obscure du champ"),
      units,
      carriers: [carrier(1, 1), carrier(3, 6)],
      lexicon
    }),
    []
  );
});

test("tier C needs an interval placed on both sides", () => {
  const lexicon = fixtureLexicon();
  const units = [unit(1, "H5414"), unit(2, "H2233", true), unit(3, "H1931")];
  assert.deepEqual(
    proposeLexicalGapFills({
      words: words("donnée à ta lignée pour toujours"),
      units,
      carriers: [carrier(1, 0), carrier(3, 4)],
      lexicon
    }).map((f) => [f.wordIndex, f.tier, f.evidence]),
    [[3, "C", "synonym:lignee~posterite"]]
  );
  assert.deepEqual(
    proposeLexicalGapFills({
      words: words("donnée à ta lignée pour toujours"),
      units,
      carriers: [carrier(1, 0)],
      lexicon
    }),
    []
  );
});

test("two source words on one target word both stay open", () => {
  const lexicon = fixtureLexicon();
  const units = [
    unit(1, "H6912"),
    unit(2, "H4631", true),
    unit(3, "H4631", true),
    unit(4, "H7704")
  ];
  assert.deepEqual(
    proposeLexicalGapFills({
      words: words("ils l'enterrèrent dans la grotte du champ"),
      units,
      carriers: [carrier(1, 1), carrier(4, 6)],
      lexicon
    }),
    []
  );
});

test("a word known to render another source word of the verse stays open", () => {
  const lexicon = fixtureLexicon();
  assert.deepEqual(
    proposeLexicalGapFills({
      words: words("ils l'enterrèrent dans la grotte du champ forteresse"),
      units: [
        unit(1, "H6912"),
        unit(2, "H4631", true),
        unit(3, "H7704"),
        unit(4, "H4692")
      ],
      carriers: [carrier(1, 1), carrier(3, 6), carrier(4, 7)],
      lexicon
    }),
    []
  );
});

test("a copy of the word carrying another source word blocks the fill", () => {
  const lexicon = fixtureLexicon();
  const units = [
    unit(1, "H6912"),
    unit(2, "H4631", true),
    unit(3, "H7704"),
    unit(4, "H0001")
  ];
  assert.deepEqual(
    proposeLexicalGapFills({
      words: words("ils l'enterrèrent dans la grotte du champ grotte"),
      units,
      carriers: [carrier(1, 1), carrier(3, 6), carrier(4, 7)],
      lexicon
    }),
    []
  );
});

test("tier W: an inflection of the witnesses' word for this very source word", () => {
  const lexicon = fixtureLexicon();
  const witnesses = [
    {
      name: "Sg1910",
      ref: "Gen.50.13",
      tokens: parseStrongTokens(
        'je <w strong="H3427" pos="1">restai</w> et je <w strong="H6419" pos="2">priai</w> le <w strong="H0430" pos="3">Dieu</w>'
      )
    }
  ];
  const units = [
    unit(1, "H3427"),
    { ...unit(2, "H6419", true), morphology: "Hc/Vtw1cs" },
    unit(3, "H0430")
  ];
  const fills = proposeLexicalGapFills({
    words: words("je restai longtemps priant le Dieu"),
    units,
    carriers: [carrier(1, 1), carrier(3, 5)],
    lexicon,
    witnesses
  });
  assert.deepEqual(
    fills.map((f) => [f.wordIndex, f.tier, f.evidence, f.strong]),
    [[3, "W", "surface-lemma:Sg1910:priai", "H6419"]]
  );
  // A copy of the word carried by another source word makes it ambiguous.
  assert.deepEqual(
    proposeLexicalGapFills({
      words: words("je restai priant priant le Dieu"),
      units: [...units, unit(4, "H0002")],
      carriers: [carrier(1, 1), carrier(3, 5), carrier(4, 2)],
      lexicon,
      witnesses
    }),
    []
  );
});

test("surface relations: inflection, guarded homographs, generic lemmas, stems", () => {
  const lexicon = fixtureLexicon();
  assert.equal(surfaceRelation(lexicon, "priant", "priai"), "lemma");
  assert.equal(surfaceRelation(lexicon, "priai", "priai"), "exact");
  // « terrasse » and « terre » are both headwords: « terrer » links nothing.
  assert.equal(surfaceRelation(lexicon, "terrasse", "terre"), undefined);
  assert.equal(surfaceRelation(lexicon, "fit", "faites"), undefined);
  assert.equal(surfaceRelation(lexicon, "explication", "expliquer"), "prefix");
});

test("the gap fill becomes a visible decision of its own assurance", () => {
  const rows = [
    "Gen.50.13#01=L\tw1\tw1\tthey buried\t{H6912}\tHVqw3mp\t\t\t\t\t\t",
    "Gen.50.13#02=L\tw2\tw2\tthe cave\t{H4631}\tHNcfsa\t\t\t\t\t\t",
    "Gen.50.13#03=L\tw3\tw3\tthe field\t{H7704}\tHNcmsa\t\t\t\t\t\t"
  ].map((line, i) => parseSourceRow(line, "TAHOT fixture.txt", i + 1)!);
  const occurrences: OriginalStrongOccurrence[] = rows.map((row, i) => ({
    occurrenceId: `${row.id}.main:0`,
    tokenId: `${row.id}.main`,
    tokenIndex: i + 1,
    sourceIdentity: row.id,
    strong: row.primary[0]!,
    sourceStrong: row.primary[0]!,
    text: row.surface,
    gloss: row.gloss,
    lemma: row.surface,
    morph: i === 0 ? "HVqw3mp" : "HNcfsa",
    pos: ""
  }));
  const text = "ils l'enterrèrent dans la grotte du champ";
  const tokens = text.split(" ").map((word, wordIndex) => ({
    wordIndex,
    text: word,
    normalized: normalizeWord(word)
  }));
  const annotation = (
    i: number,
    fields: Partial<StrongLedgerAnnotation>
  ): StrongLedgerAnnotation => ({
    id: `a${i}`,
    strong: occurrences[i]!.strong,
    visibility: "reader",
    placement: "word",
    source: "reference-transfer",
    confidence: 0.99,
    reason: "fixture",
    diagnostics: ["exact"],
    originalOccurrenceId: occurrences[i]!.occurrenceId,
    ...fields
  });
  const ledgerVerse = {
    ref: "Gen.50.13",
    text,
    tokens,
    annotations: [
      annotation(0, { wordIndex: 1 }),
      annotation(1, {
        visibility: "advanced",
        placement: "empty",
        source: "original-complete",
        confidence: 0.35,
        diagnostics: ["empty-original"],
        insertAfterWordIndex: 1
      }),
      annotation(2, { wordIndex: 6 })
    ]
  } as unknown as StrongLedgerVerse;
  const resolve = (v: StrongLedgerVerse) => {
    v.resolution = resolveCanonicalVerse({
      bible: "s21",
      verse: v,
      input: { occurrences, references: [], issues: [] },
      sourceRows: new Map(rows.map((row) => [row.id, row])),
      lexicalItems: []
    });
  };
  resolve(ledgerVerse);
  const before = ledgerVerse.resolution!.decisions[1]!;
  assert.equal(before.state, "unresolved");
  assert.ok(
    before.reasons.includes("missing-carrier-is-not-absent-translation")
  );

  const result = lexicalGapFillPass({
    verses: [ledgerVerse],
    lexicon: fixtureLexicon(),
    witnessesOf: () => [],
    resolve
  });
  assert.equal(result.placed, 1);
  const after = ledgerVerse.resolution!.decisions[1]!;
  assert.equal(after.state, "visible");
  assert.equal(after.assurance, "lexical-gap-fill");
  assert.deepEqual(after.targetWordIndices, [4]);
  const carried = ledgerVerse.annotations[1]!;
  assert.equal(carried.visibility, "reader");
  assert.equal(carried.placement, "word");
  assert.equal(carried.source, "lexical-gap-fill");
  assert.equal(carried.wordIndex, 4);
  assert.equal(carried.insertAfterWordIndex, undefined);
  assert.equal(carried.diagnostics[0], "lexical-gap-fill:A:gloss:grotte");
  // Nothing else moved.
  assert.equal(ledgerVerse.annotations[0]!.wordIndex, 1);
  assert.equal(ledgerVerse.annotations[2]!.wordIndex, 6);
});

test("an annotation of another identifier becomes a hidden duplicate", () => {
  const annotations: StrongLedgerAnnotation[] = [
    {
      id: "x",
      strong: "H1980",
      visibility: "advanced",
      placement: "empty",
      source: "original-complete",
      confidence: 0.35,
      reason: "fixture",
      diagnostics: ["empty-original"],
      insertAfterWordIndex: 0,
      originalOccurrenceId: "o:0"
    },
    {
      id: "y",
      strong: "H3212",
      visibility: "advanced",
      placement: "empty",
      source: "original-complete",
      confidence: 0.35,
      reason: "fixture",
      diagnostics: ["empty-original"],
      insertAfterWordIndex: 0,
      originalOccurrenceId: "o:1"
    }
  ];
  const v = {
    tokens: [
      { wordIndex: 0, text: "il", normalized: "il" },
      { wordIndex: 1, text: "partit", normalized: "partit" }
    ],
    annotations
  };
  assert.ok(
    applyLexicalGapFill(v, ["o:0", "o:1"], {
      unitId: "u",
      strong: "H3212",
      wordIndex: 1,
      tier: "A",
      evidence: "witness:partir",
      poolSize: 1
    })
  );
  assert.equal(annotations[1]!.visibility, "reader");
  assert.equal(annotations[1]!.wordIndex, 1);
  assert.equal(annotations[0]!.visibility, "hidden");
  assert.equal(annotations[0]!.placement, "duplicate");
  assert.equal(annotations[0]!.wordIndex, 1);
});

test("policy Q stays off by default until measured", () => {
  assert.equal(resolveEnginePolicy().lexicalGapFill, false);
  assert.equal(
    resolveEnginePolicy({ lexicalGapFill: true }).lexicalGapFill,
    true
  );
});
