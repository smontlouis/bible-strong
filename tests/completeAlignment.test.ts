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
