import test from "node:test";
import assert from "node:assert/strict";

import {
  alignReaderVerse,
  renderReaderTaggedText
} from "../src/readerAlignment.js";
import { applyCuratedStrongOverrides } from "../src/curatedStrongOverrides.js";
import { parseStrongTokens } from "../src/strongCsv.js";

test("does not add empty tags only because the original has extra Strong occurrences", () => {
  const result = alignReaderVerse({
    targetText: "Dieu vit.",
    original: {
      strongSet: new Set(["H0430", "H7200", "H0996"]),
      source: "original"
    },
    references: [
      reference("one", '<w strong="H0430">Dieu</w> <w strong="H7200">vit</w>.')
    ]
  });

  assert.equal(result.emptyStrongOccurrenceCount, 0);
  assert.doesNotMatch(renderReaderTaggedText(result), /data-empty="true"/);
});

test("adds editorial empty tags when at least two references agree", () => {
  const result = alignReaderVerse({
    targetText: "Dieu sépara la lumière avec les ténèbres.",
    references: [
      reference(
        "Sg1910",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w><w strong="H0996"></w> la <w strong="H0216">lumière</w> <w strong="H0996">avec</w> les <w strong="H2822">ténèbres</w>.'
      ),
      reference(
        "Darby",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w><w strong="H0996"></w> la <w strong="H0216">lumière</w> d’<w strong="H0996">avec</w> les <w strong="H2822">ténèbres</w>.'
      ),
      reference(
        "DarbyR",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w> la <w strong="H0216">lumière</w> <w strong="H0996">avec</w> les <w strong="H2822">ténèbres</w>.'
      )
    ]
  });

  assert.equal(result.emptyStrongOccurrenceCount, 1);
  assert.match(renderReaderTaggedText(result), /data-method="editorial-empty"/);
});

test("does not add editorial empty tags when target already has enough occurrences", () => {
  const result = alignReaderVerse({
    targetText: "Dieu sépara avec la lumière et avec les ténèbres.",
    references: [
      reference(
        "Sg1910",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w><w strong="H0996"></w> la <w strong="H0216">lumière</w> <w strong="H0996">avec</w> les <w strong="H2822">ténèbres</w>.'
      ),
      reference(
        "Darby",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w><w strong="H0996"></w> la <w strong="H0216">lumière</w> d’<w strong="H0996">avec</w> les <w strong="H2822">ténèbres</w>.'
      )
    ]
  });

  assert.equal(result.emptyStrongOccurrenceCount, 0);
});

test("enriches reader tags from original and learned translation variants", () => {
  const result = alignReaderVerse({
    targetText: "Dieu créa le ciel.",
    references: [
      reference(
        "Sg1910",
        '<w strong="H0430">Dieu</w> créa les <w strong="H8064">cieux</w>.'
      )
    ],
    translationLexicon: {
      exact: new Map([
        [
          "H8064",
          new Map([
            [
              "cieux",
              {
                strong: "H8064",
                normalized: "cieux",
                score: 1,
                source: "test",
                method: "learned-translation"
              }
            ]
          ])
        ]
      ]),
      stem: new Map()
    },
    original: {
      strongSet: new Set(["H0430", "H1254", "H8064"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      strongSet: new Set(["H0430", "H1254", "H8064"]),
      tokens: [
        originalToken("o1", ["H0430"]),
        originalToken("o2", ["H1254"]),
        originalToken("o3", ["H8064"])
      ]
    }
  });

  assert.match(renderReaderTaggedText(result), /ciel<\/w>/);
  assert.match(renderReaderTaggedText(result), /strong="H8064"/);
  assert.equal(result.emptyStrongOccurrenceCount, 0);
});

test("enriches reader tags with curated original Strong rules", () => {
  const result = alignReaderVerse({
    targetText: "Qu’il y ait de la lumière, et il y eut de la lumière.",
    references: [],
    translationLexicon: { exact: new Map(), stem: new Map() },
    original: {
      strongSet: new Set(["H1961", "H0216"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 1,
      verse: 3,
      strongSet: new Set(["H1961", "H0216"]),
      tokens: [
        originalToken("o1", ["H1961"]),
        originalToken("o2", ["H0216"]),
        originalToken("o3", ["H1961"])
      ]
    }
  });

  const rendered = renderReaderTaggedText(result);
  assert.match(rendered, />ait<\/w>/);
  assert.match(rendered, />eut<\/w>/);
  assert.equal(result.emptyStrongOccurrenceCount, 0);
});

test("applies reviewed LLM transfer overrides only when the target word still matches", () => {
  const result = alignReaderVerse({
    targetText:
      "La terre était un chaos, elle était vide ; il y avait des ténèbres au-dessus de l’abîme, et le souffle de Dieu tournoyait au-dessus des eaux.",
    references: []
  });

  const applied = applyCuratedStrongOverrides({
    bible: "nbs",
    ref: "Gen.1.2",
    result
  });

  assert.equal(applied, 2);
  assert.deepEqual(result.assignments.get(19)?.strong, ["H7307"]);
  assert.deepEqual(result.assignments.get(22)?.strong, ["H7363"]);
  assert.equal(result.assignments.get(19)?.method, "curated-llm-transfer");
});

test("skips reviewed LLM transfer overrides when token indexes drift", () => {
  const result = alignReaderVerse({
    targetText:
      "La terre était informe et vide ; le souffle puissant de Dieu tournoyait au-dessus des eaux.",
    references: []
  });

  const applied = applyCuratedStrongOverrides({
    bible: "nbs",
    ref: "Gen.1.2",
    result
  });

  assert.equal(applied, 0);
  assert.equal(result.assignments.size, 0);
});

function reference(name: string, text: string) {
  return {
    name,
    verse: {
      row: { bookId: "Gen", chapter: 1, verse: 4, text },
      tokens: parseStrongTokens(text)
    }
  };
}

function originalToken(id: string, strong: string[]) {
  return {
    id,
    text: "",
    strong,
    gloss: "",
    lemma: "",
    pos: "",
    morph: ""
  };
}
