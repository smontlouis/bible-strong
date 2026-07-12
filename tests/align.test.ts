import test from "node:test";
import assert from "node:assert/strict";

import { alignVerse } from "../src/align.js";
import { parseStrongTokens } from "../src/strongCsv.js";
import { renderTaggedText } from "../src/render.js";

test("transfers Strong codes from matching reference words", () => {
  const result = alignVerse("Au commencement, Dieu créa.", [
    {
      name: "fixture",
      verse: {
        row: {
          bookId: "Gen",
          chapter: 1,
          verse: 1,
          text: ""
        },
        tokens: parseStrongTokens(
          'Au <w strong="H7225">commencement</w>, <w strong="H0430">Dieu</w> <w strong="H1254">créa</w>.'
        )
      }
    }
  ]);

  assert.equal(result.wordCount, 4);
  assert.equal(result.taggedWordCount, 3);
  assert.match(renderTaggedText(result), /strong="H7225"/);
  assert.match(renderTaggedText(result), /data-confidence="0\.95"/);
});

test("uses agreement across references to raise confidence", () => {
  const result = alignVerse("Dieu", [
    {
      name: "a",
      verse: {
        row: { bookId: "Gen", chapter: 1, verse: 1, text: "" },
        tokens: parseStrongTokens('<w strong="H0430">Dieu</w>')
      }
    },
    {
      name: "b",
      verse: {
        row: { bookId: "Gen", chapter: 1, verse: 1, text: "" },
        tokens: parseStrongTokens('<w strong="H0430">Dieu</w>')
      }
    }
  ]);

  assert.equal([...result.assignments.values()][0]?.confidence, 0.99);
});

test("matches repeated surface forms to distinct reference occurrences", () => {
  const result = alignVerse("Dieu vit et Dieu parla", [
    {
      name: "fixture",
      verse: {
        row: { bookId: "Gen", chapter: 1, verse: 1, text: "" },
        tokens: parseStrongTokens(
          '<w strong="H0430">Dieu</w> vit et <w strong="H0410">Dieu</w> parla'
        )
      }
    }
  ]);

  assert.deepEqual(result.assignments.get(0)?.strong, ["H0430"]);
  assert.deepEqual(result.assignments.get(3)?.strong, ["H0410"]);
});

test("does not count Darby and DarbyR as independent consensus families", () => {
  const references = ["Darby", "DarbyR"].map((name) => ({
    name,
    verse: {
      row: { bookId: "Gen", chapter: 1, verse: 1, text: "" },
      tokens: parseStrongTokens('<w strong="H0430">Dieu</w>')
    }
  }));
  const result = alignVerse("Dieu", references);

  assert.equal(result.assignments.get(0)?.confidence, 0.95);
});
