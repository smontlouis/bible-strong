import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeStrongLedgerVerseScopes,
  renderStrongTaggedText,
  validateStrongLedgerAnnotation,
  type StrongLedgerAnnotation,
  type StrongLedgerVerse
} from "../src/strongLedger.js";
import { tokenizeText } from "../src/tokenize.js";

test("renders reader and advanced modes from one canonical annotation set", () => {
  const segments = tokenizeText("Dieu créa.");
  const annotations: StrongLedgerAnnotation[] = [
    annotation({
      strong: "H0430",
      visibility: "reader",
      placement: "word",
      wordIndex: 0
    }),
    annotation({
      strong: "H0853",
      visibility: "advanced",
      placement: "technical",
      insertAfterWordIndex: 0,
      sourceStrong: "H0853a",
      lexiconLookup: false
    })
  ];

  const reader = renderStrongTaggedText(segments, annotations, "reader");
  const advanced = renderStrongTaggedText(segments, annotations, "advanced");

  assert.match(reader, /strong="H0430"/);
  assert.doesNotMatch(reader, /H0853/);
  assert.match(advanced, /strong="H0430"/);
  assert.match(advanced, /strong="H0853"/);
  assert.match(advanced, /data-source-strong="H0853a"/);
  assert.match(advanced, /data-lexicon="false"/);
});

test("renders STEP disambiguation separately from WLC source suffixes", () => {
  const segments = tokenizeText("Les eaux s’amassent.");
  const annotations: StrongLedgerAnnotation[] = [
    annotation({
      strong: "H6960",
      visibility: "reader",
      placement: "word",
      wordIndex: 2,
      sourceStrong: "H6960a",
      step: [
        {
          source: "TAHOT",
          classicalStrong: "H6960",
          dStrong: "H6960B",
          tokenIndex: 3,
          type: "L",
          surface: "יִקָּו֨וּ",
          transliteration: "yi.ka.Vu",
          gloss: "let them gather",
          morphology: "HVNi3mp",
          editions: ""
        }
      ]
    })
  ];

  const html = renderStrongTaggedText(segments, annotations, "reader");

  assert.match(html, /strong="H6960"/);
  assert.doesNotMatch(html, /<w strong="H6960a"/);
  assert.match(html, /data-source-strong="H6960a"/);
  assert.match(html, /data-step-strong="H6960B"/);
});

test("renders a multi-word phrase as one Strong wrapper", () => {
  const segments = tokenizeText("Dans la mesure où il vint.");
  const annotations: StrongLedgerAnnotation[] = [
    annotation({
      strong: "G3745",
      visibility: "reader",
      placement: "phrase",
      startWordIndex: 0,
      endWordIndex: 3,
      normalizedPhrase: "dans la mesure ou"
    })
  ];

  const html = renderStrongTaggedText(segments, annotations, "reader");

  assert.match(html, /<w strong="G3745"[^>]*>Dans la mesure où<\/w>/);
});

test("rejects annotations whose Strong is absent from the verse inventory", () => {
  assert.equal(
    validateStrongLedgerAnnotation({
      annotation: { strong: "H0430" },
      allowedStrong: new Set(["H0430"])
    }),
    true
  );
  assert.equal(
    validateStrongLedgerAnnotation({
      annotation: { strong: "H9999" },
      allowedStrong: new Set(["H0430"])
    }),
    false
  );
});

test("merges refreshed scoped verses without duplicating stale verses", () => {
  const merged = mergeStrongLedgerVerseScopes(
    [
      verse({ ref: "Gen.1.1", bookId: "Gen", text: "old gen" }),
      verse({ ref: "Joel.1.1", bookId: "Joel", text: "old joel" }),
      verse({ ref: "Matt.1.1", bookId: "Matt", text: "old matt" })
    ],
    [
      verse({ ref: "Joel.1.1", bookId: "Joel", text: "new joel" }),
      verse({ ref: "Joel.1.2", bookId: "Joel", verse: 2, text: "new joel 2" })
    ]
  );

  assert.deepEqual(
    merged.map((item) => `${item.ref}:${item.text}`),
    [
      "Gen.1.1:old gen",
      "Joel.1.1:new joel",
      "Joel.1.2:new joel 2",
      "Matt.1.1:old matt"
    ]
  );
});

function annotation(
  partial: Partial<StrongLedgerAnnotation> &
    Pick<StrongLedgerAnnotation, "strong" | "visibility" | "placement">
): StrongLedgerAnnotation {
  return {
    id: "",
    source: "original-complete",
    confidence: 0.9,
    reason: "test",
    diagnostics: [],
    ...partial
  };
}

function verse(
  partial: Pick<StrongLedgerVerse, "ref" | "bookId" | "text"> &
    Partial<StrongLedgerVerse>
): StrongLedgerVerse {
  return {
    chapter: 1,
    verse: 1,
    tokens: [],
    annotations: [],
    views: {
      readerHtml: "",
      advancedHtml: "",
      debugHtml: ""
    },
    inventories: {
      references: {
        Sg1910: [],
        Darby: [],
        DarbyR: []
      },
      original: [],
      reader: [],
      advanced: []
    },
    metrics: {} as StrongLedgerVerse["metrics"],
    ...partial
  };
}
