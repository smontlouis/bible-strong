import test from "node:test";
import assert from "node:assert/strict";

import {
  alignCompleteVerse,
  renderCompleteTaggedText
} from "../src/completeAlignment.js";
import { type OriginalVerse } from "../src/originalSource.js";
import { parseStrongTokens } from "../src/strongCsv.js";
import { type StrongTranslationLexicon } from "../src/translationLexicon.js";

test("represents unaligned original Strong occurrences as empty tags", () => {
  const original: OriginalVerse = {
    bookId: "Gen",
    chapter: 1,
    verse: 4,
    tokens: [
      token("o1", "Dieu", ["H0430"]),
      token("o2", "vit", ["H7200"]),
      token("o3", "entre", ["H0996"])
    ],
    strongSet: new Set(["H0430", "H7200", "H0996"])
  };

  const result = alignCompleteVerse({
    targetText: "Dieu vit.",
    original,
    references: [
      {
        name: "fixture",
        verse: {
          row: { bookId: "Gen", chapter: 1, verse: 4, text: "" },
          tokens: parseStrongTokens(
            '<w strong="H0430">Dieu</w> <w strong="H7200">vit</w>.'
          )
        }
      }
    ]
  });

  assert.equal(result.originalStrongOccurrenceCount, 3);
  assert.equal(result.representedStrongOccurrenceCount, 3);
  assert.equal(result.realWordStrongOccurrenceCount, 2);
  assert.equal(result.emptyStrongOccurrenceCount, 1);
  assert.match(renderCompleteTaggedText(result), /data-empty="true"/);
  assert.match(renderCompleteTaggedText(result), /strong="H0996"/);
});

test("supports multiple original Strong occurrences on one French word", () => {
  const original: OriginalVerse = {
    bookId: "Gen",
    chapter: 5,
    verse: 3,
    tokens: [token("o1", "trente", ["H7970"]), token("o2", "cent", ["H3967"])],
    strongSet: new Set(["H7970", "H3967"])
  };

  const result = alignCompleteVerse({
    targetText: "130 ans",
    original,
    references: [
      {
        name: "fixture",
        verse: {
          row: { bookId: "Gen", chapter: 5, verse: 3, text: "" },
          tokens: parseStrongTokens('<w strong="H7970 H3967">130</w> ans')
        }
      }
    ]
  });

  assert.equal(result.multiStrongWordCount, 1);
  assert.match(renderCompleteTaggedText(result), /strong="H7970 H3967"/);
});

test("uses learned translation lexicon to move an empty occurrence onto a word", () => {
  const original: OriginalVerse = {
    bookId: "Gen",
    chapter: 1,
    verse: 1,
    tokens: [token("o1", "house", ["H1004"])],
    strongSet: new Set(["H1004"])
  };
  const translationLexicon: StrongTranslationLexicon = {
    exact: new Map([
      [
        "H1004",
        new Map([
          [
            "maison",
            {
              strong: "H1004",
              normalized: "maison",
              score: 1,
              source: "fixture",
              method: "learned-translation"
            }
          ]
        ])
      ]
    ]),
    stem: new Map()
  };

  const result = alignCompleteVerse({
    targetText: "maison",
    original,
    references: [],
    translationLexicon
  });

  assert.equal(result.realWordStrongOccurrenceCount, 1);
  assert.equal(result.emptyStrongOccurrenceCount, 0);
  assert.match(
    renderCompleteTaggedText(result),
    /data-method="learned-translation"/
  );
});

test("globally assigns competing learned translations instead of choosing greedily", () => {
  const original: OriginalVerse = {
    bookId: "Gen",
    chapter: 1,
    verse: 1,
    tokens: [token("o1", "first", ["H0001"]), token("o2", "second", ["H0002"])],
    strongSet: new Set(["H0001", "H0002"])
  };
  const translationLexicon: StrongTranslationLexicon = {
    exact: new Map([
      [
        "H0001",
        new Map([
          ["alpha", translation("H0001", "alpha", 1)],
          ["beta", translation("H0001", "beta", 0.8)]
        ])
      ],
      ["H0002", new Map([["alpha", translation("H0002", "alpha", 0.9)]])]
    ]),
    stem: new Map()
  };

  const result = alignCompleteVerse({
    targetText: "alpha beta",
    original,
    references: [],
    translationLexicon
  });

  assert.deepEqual(result.wordAssignments.get(0)?.strong, ["H0002"]);
  assert.deepEqual(result.wordAssignments.get(1)?.strong, ["H0001"]);
  assert.equal(result.emptyStrongOccurrenceCount, 0);
});

test("uses remaining word capacity when distinct Strong codes share one carrier", () => {
  const original: OriginalVerse = {
    bookId: "Gen",
    chapter: 1,
    verse: 1,
    tokens: [token("o1", "first", ["H0001"]), token("o2", "second", ["H0002"])],
    strongSet: new Set(["H0001", "H0002"])
  };
  const translationLexicon: StrongTranslationLexicon = {
    exact: new Map([
      ["H0001", new Map([["roi", translation("H0001", "roi", 1)]])],
      ["H0002", new Map([["roi", translation("H0002", "roi", 1)]])]
    ]),
    stem: new Map()
  };

  const result = alignCompleteVerse({
    targetText: "roi",
    original,
    references: [],
    translationLexicon
  });

  assert.deepEqual(result.wordAssignments.get(0)?.strong, ["H0001", "H0002"]);
  assert.equal(result.emptyStrongOccurrenceCount, 0);
});

test("does not stack duplicate occurrences of one Strong on the same carrier", () => {
  const original: OriginalVerse = {
    bookId: "Gen",
    chapter: 1,
    verse: 1,
    tokens: [token("o1", "first", ["H0001"]), token("o2", "second", ["H0001"])],
    strongSet: new Set(["H0001"])
  };
  const translationLexicon: StrongTranslationLexicon = {
    exact: new Map([
      ["H0001", new Map([["roi", translation("H0001", "roi", 1)]])]
    ]),
    stem: new Map()
  };

  const result = alignCompleteVerse({
    targetText: "roi",
    original,
    references: [],
    translationLexicon
  });

  assert.deepEqual(result.wordAssignments.get(0)?.strong, ["H0001"]);
  assert.equal(result.emptyStrongOccurrenceCount, 1);
});

test("normalizes source position by original tokens rather than Strong occurrences", () => {
  const original: OriginalVerse = {
    bookId: "Gen",
    chapter: 1,
    verse: 1,
    tokens: [
      token("o1", "first", ["H0010", "H0011"]),
      token("o2", "middle", ["H0012", "H0013"]),
      token("o3", "last", ["H0001"])
    ],
    strongSet: new Set(["H0010", "H0011", "H0012", "H0013", "H0001"])
  };
  const translationLexicon: StrongTranslationLexicon = {
    exact: new Map([
      ["H0001", new Map([["roi", translation("H0001", "roi", 1)]])]
    ]),
    stem: new Map()
  };

  const result = alignCompleteVerse({
    targetText: "roi neutre roi",
    original,
    references: [],
    translationLexicon
  });

  assert.deepEqual(result.wordAssignments.get(2)?.strong, ["H0001"]);
  assert.equal(result.wordAssignments.get(0), undefined);
});

test("applies the translation profile threshold to complete alignment", () => {
  const original: OriginalVerse = {
    bookId: "Gen",
    chapter: 1,
    verse: 1,
    tokens: [token("o1", "house", ["H1004"])],
    strongSet: new Set(["H1004"])
  };
  const translationLexicon: StrongTranslationLexicon = {
    exact: new Map([
      ["H1004", new Map([["maison", translation("H1004", "maison", 0.4)]])]
    ]),
    stem: new Map()
  };

  const result = alignCompleteVerse({
    targetText: "maison ailleurs",
    original,
    references: [],
    translationLexicon,
    readerPolicy: {
      maxStrongPerWord: 1,
      minEmptySourceAgreement: 3,
      learnedTranslationMinScore: 0.8,
      learnedFunctionWordMode: "reference-only"
    }
  });

  assert.equal(result.realWordStrongOccurrenceCount, 0);
  assert.equal(result.emptyStrongOccurrenceCount, 1);
});

test("matches extended original Strong subcodes to classical reference Strong codes", () => {
  const original: OriginalVerse = {
    bookId: "Gen",
    chapter: 1,
    verse: 10,
    tokens: [token("o1", "place", ["H4723a"])],
    strongSet: new Set(["H4723a"])
  };

  const result = alignCompleteVerse({
    targetText: "la masse des eaux",
    original,
    references: [
      {
        name: "fixture",
        verse: {
          row: { bookId: "Gen", chapter: 1, verse: 10, text: "" },
          tokens: parseStrongTokens('<w strong="H4723">masse</w> des eaux')
        }
      }
    ]
  });

  assert.equal(result.realWordStrongOccurrenceCount, 1);
  assert.equal(result.emptyStrongOccurrenceCount, 0);
  assert.match(renderCompleteTaggedText(result), /strong="H4723"/);
  assert.doesNotMatch(renderCompleteTaggedText(result), /H4723a/);
});

function token(
  id: string,
  text: string,
  strong: string[]
): OriginalVerse["tokens"][number] {
  return {
    id,
    text,
    strong,
    gloss: text,
    lemma: text,
    pos: "noun",
    morph: ""
  };
}

function translation(strong: string, normalized: string, score: number) {
  return {
    strong,
    normalized,
    score,
    source: "fixture",
    method: "learned-translation" as const
  };
}
