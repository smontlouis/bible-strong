import assert from "node:assert/strict";
import test from "node:test";
import {
  biblicalNameFingerprint,
  buildCorrespondenceIndex,
  extractCorrespondenceAliases
} from "./build-correspondences.mjs";

test("extracts explicit French, English and Translation Words aliases", () => {
  assert.deepEqual(
    extractCorrespondenceAliases("Nebuchadnezzar, or Nebuchadrezzar", "smith"),
    ["nebuchadnezzar or nebuchadrezzar", "nebuchadnezzar", "nebuchadrezzar"]
  );
  assert.deepEqual(
    extractCorrespondenceAliases(
      "Abraham, Abram",
      "unfoldingword-translation-words"
    ),
    ["abraham abram", "abraham", "abram"]
  );
});

test("normalizes the attested Nebuchadnezzar transliterations", () => {
  assert.equal(
    biblicalNameFingerprint("Nébucadnetsar"),
    biblicalNameFingerprint("Nebuchadnezzar")
  );
  assert.equal(
    biblicalNameFingerprint("Nebuchadnezar"),
    biblicalNameFingerprint("Nebuchadnezzar")
  );
});

test("groups the Nebuchadnezzar variants across languages without merging definitions", () => {
  const index = buildCorrespondenceIndex({
    namedSubjects: ["Nebuchadnezzar"],
    records: [
      {
        work: "westphal",
        resourceId: "WESTPHAL",
        language: "fr",
        id: 1,
        word: "Nébucadnetsar"
      },
      {
        work: "calmet",
        resourceId: "CALMET",
        language: "fr",
        id: 2,
        word: "Nebuchadnezar"
      },
      {
        work: "easton-webster",
        resourceId: "EASTON_WEBSTER",
        language: "en",
        id: 3,
        word: "Nebuchadnezzar"
      },
      {
        work: "smith",
        resourceId: "SMITH",
        language: "en",
        id: 4,
        word: "Nebuchadnezzar, or Nebuchadrezzar"
      },
      {
        work: "isbe",
        resourceId: "ISBE",
        language: "en",
        id: 5,
        word: "Nebuchadnezzar; Nebuchadrezzar."
      }
    ]
  });
  assert.equal(index.groups.length, 1);
  assert.equal(index.groups[0].label, "Nebuchadnezzar");
  assert.equal(index.groups[0].members.length, 5);
  assert.deepEqual(index.groups[0].strategies, [
    "same-language-headword",
    "explicit-headword-alias",
    "named-subject-transliteration"
  ]);
});

test("does not join an unseeded bilingual homograph", () => {
  const index = buildCorrespondenceIndex({
    namedSubjects: [],
    records: [
      {
        work: "english",
        resourceId: "EN",
        language: "en",
        id: 1,
        word: "Pain"
      },
      { work: "french", resourceId: "FR", language: "fr", id: 2, word: "Pain" }
    ]
  });
  assert.equal(index.groups.length, 0);
});

test("does not attach an English homograph through an aggressive name fingerprint", () => {
  const index = buildCorrespondenceIndex({
    namedSubjects: ["Baal"],
    records: [
      {
        work: "unfoldingword-translation-words",
        resourceId: "UNFOLDINGWORD_TW",
        language: "en",
        id: 1,
        word: "Baal"
      },
      {
        work: "easton-webster",
        resourceId: "EASTON_WEBSTER",
        language: "en",
        id: 2,
        word: "Ball"
      },
      {
        work: "westphal",
        resourceId: "WESTPHAL",
        language: "fr",
        id: 3,
        word: "Baal"
      }
    ]
  });
  assert.equal(index.groups.length, 1);
  assert.deepEqual(
    index.groups[0].members.map((member) => member.word),
    ["Baal", "Baal"]
  );
});
