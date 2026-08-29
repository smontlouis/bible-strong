import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStrongTranslationLexicon,
  findTranslationCandidate
} from "../src/translationLexicon.js";
import { buildStrongVerseMap } from "../src/strongCsv.js";

test("downranks a form shared by many Strong codes", () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({
    bookId: "Gen",
    chapter: 1,
    verse: index + 1,
    text: `<w strong="H${String(index + 1).padStart(4, "0")}">chose</w> <w strong="H0001">père</w>`
  }));
  const map = buildStrongVerseMap(rows);
  const lexicon = buildStrongTranslationLexicon([
    { name: "Sg1910", map },
    { name: "Darby", map },
    { name: "DarbyR", map }
  ]);

  assert.equal(findTranslationCandidate(lexicon, "H0001", "chose"), undefined);
  assert.ok(findTranslationCandidate(lexicon, "H0001", "pere"));
  assert.equal(
    findTranslationCandidate(lexicon, "H0001", "pere")?.source,
    "Darby-family+Sg1910"
  );
});

test("does not count a Darby and DarbyR duplicate hapax twice", () => {
  const map = buildStrongVerseMap([
    {
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      text: '<w strong="H0001">père</w>'
    }
  ]);
  const lexicon = buildStrongTranslationLexicon([
    { name: "Darby", map },
    { name: "DarbyR", map }
  ]);

  assert.equal(findTranslationCandidate(lexicon, "H0001", "pere"), undefined);
});

test("counts repeated evidence in distinct verses of one family", () => {
  const map = buildStrongVerseMap([
    {
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      text: '<w strong="H0001">père</w>'
    },
    {
      bookId: "Gen",
      chapter: 1,
      verse: 2,
      text: '<w strong="H0001">père</w>'
    }
  ]);
  const lexicon = buildStrongTranslationLexicon([
    { name: "Darby", map },
    { name: "DarbyR", map }
  ]);

  assert.ok(findTranslationCandidate(lexicon, "H0001", "pere"));
  assert.equal(
    findTranslationCandidate(lexicon, "H0001", "pere")?.source,
    "Darby-family"
  );
});

test("uses family-aware effective counts for learned stems", () => {
  const map = buildStrongVerseMap([
    {
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      text: '<w strong="H0001">royaumes</w> <w strong="H0001">royaumes</w>'
    }
  ]);
  const lexicon = buildStrongTranslationLexicon([
    { name: "Darby", map },
    { name: "DarbyR", map }
  ]);

  assert.equal(lexicon.stem.get("H0001"), undefined);
});

test("never applies a sense-specific carrier without the exact STEP identity", () => {
  const lexicon = buildStrongTranslationLexicon([], {
    dictionaryCandidates: [
      {
        strong: "G1492",
        stepStrong: "G1492G",
        normalized: "voir",
        score: 0.5,
        source: "fixture",
        method: "dictionary-fr-exact"
      }
    ]
  });

  assert.equal(findTranslationCandidate(lexicon, "G1492", "voir"), undefined);
  assert.equal(
    findTranslationCandidate(lexicon, "G1492", "voir", "G1492H"),
    undefined
  );
  assert.ok(findTranslationCandidate(lexicon, "G1492", "voir", "G1492G"));
});

test("preserves lowercase STEP suffixes as distinct identities", () => {
  const lexicon = buildStrongTranslationLexicon([], {
    dictionaryCandidates: [
      {
        strong: "H2148",
        stepStrong: "H2148V",
        normalized: "male",
        score: 0.5,
        source: "fixture",
        method: "dictionary-fr-exact"
      },
      {
        strong: "H2148",
        stepStrong: "H2148v",
        normalized: "souvenir",
        score: 0.5,
        source: "fixture",
        method: "dictionary-fr-exact"
      }
    ]
  });

  assert.ok(findTranslationCandidate(lexicon, "H2148", "male", "H2148V"));
  assert.equal(
    findTranslationCandidate(lexicon, "H2148", "male", "H2148v"),
    undefined
  );
  assert.ok(findTranslationCandidate(lexicon, "H2148", "souvenir", "H2148v"));
});
