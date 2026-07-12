import test from "node:test";
import assert from "node:assert/strict";

import {
  assertRenderedStrongInventory,
  changedOverrideRefs,
  completeEmptyVisibility,
  completeWordVisibility,
  curatedOverrideFingerprints,
  linkReaderAnnotationsToOriginalOccurrences,
  mergeStrongOccurrenceBudgets,
  mergeStrongLedgerVerseScopes,
  renderStrongTaggedText,
  validateStrongLedgerAnnotation,
  type StrongLedgerAnnotation,
  type StrongLedgerVerse
} from "../src/strongLedger.js";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import type { CuratedStrongOverride } from "../src/curatedStrongOverrides.js";
import { parseStrongOccurrences } from "../src/strongCsv.js";
import { stripTags, tokenizeText } from "../src/tokenize.js";

test("uses the maximum source occurrence count as the placement budget", () => {
  assert.deepEqual(
    mergeStrongOccurrenceBudgets(
      ["H0001", "H0001", "H0002"],
      ["H0001", "H0002", "H0002"]
    ),
    ["H0001", "H0001", "H0002", "H0002"]
  );
});

test("keeps original-complete empty Strong occurrences out of reader mode", () => {
  assert.equal(completeEmptyVisibility(false), "advanced");
  assert.equal(completeEmptyVisibility(true), "hidden");
});

test("keeps original-complete word guesses out of reader mode", () => {
  assert.equal(completeWordVisibility(false), "advanced");
  assert.equal(completeWordVisibility(true), "hidden");
});

test("links repeated reader carriers to distinct original STEP occurrences", () => {
  const linked = linkReaderAnnotationsToOriginalOccurrences({
    annotations: [
      annotation({
        strong: "H6960",
        visibility: "reader",
        placement: "word",
        wordIndex: 0
      }),
      annotation({
        strong: "H6960",
        visibility: "reader",
        placement: "word",
        wordIndex: 9
      })
    ],
    originalOccurrences: [
      originalOccurrence("occurrence-a", 0, "H6960A"),
      originalOccurrence("occurrence-b", 9, "H6960B")
    ],
    wordCount: 10
  });

  assert.deepEqual(
    linked.map((item) => [item.originalOccurrenceId, item.sourceStrong]),
    [
      ["occurrence-a", "H6960A"],
      ["occurrence-b", "H6960B"]
    ]
  );
});

test("links STEP occurrences by ordinal position instead of sparse source indexes", () => {
  const linked = linkReaderAnnotationsToOriginalOccurrences({
    annotations: [
      annotation({
        strong: "H6960",
        visibility: "reader",
        placement: "word",
        wordIndex: 0
      }),
      annotation({
        strong: "H6960",
        visibility: "reader",
        placement: "word",
        wordIndex: 9
      })
    ],
    originalOccurrences: [
      originalOccurrence("occurrence-a", 502, "H6960A", 0),
      originalOccurrence("occurrence-b", 17, "H6960B", 1)
    ],
    wordCount: 10
  });

  assert.deepEqual(
    linked.map((item) => [item.originalOccurrenceId, item.sourceStrong]),
    [
      ["occurrence-a", "H6960A"],
      ["occurrence-b", "H6960B"]
    ]
  );
});

test("fingerprints curated decisions by verse and detects removed decisions", () => {
  const base: CuratedStrongOverride = {
    bible: "test",
    ref: "Gen.1.1",
    target: "word",
    wordIndex: 0,
    normalized: "dieu",
    strong: ["H0430"],
    confidence: 0.99,
    source: "human-approved",
    reason: "fixture"
  };
  const before = curatedOverrideFingerprints("test", [base]);
  const after = curatedOverrideFingerprints("test", [
    { ...base, confidence: 0.98 },
    { ...base, ref: "Gen.1.2", wordIndex: 1 }
  ]);

  assert.deepEqual(changedOverrideRefs(before, after), ["Gen.1.1", "Gen.1.2"]);
  assert.deepEqual(changedOverrideRefs(after, {}), ["Gen.1.1", "Gen.1.2"]);
});

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

test("preserves word and empty Strong occurrences carried inside a phrase", () => {
  const text = "Dans la maison.";
  const segments = tokenizeText(text);
  const annotations: StrongLedgerAnnotation[] = [
    annotation({
      strong: "G1722",
      visibility: "reader",
      placement: "phrase",
      startWordIndex: 0,
      endWordIndex: 2,
      normalizedPhrase: "dans la maison"
    }),
    annotation({
      strong: "G3588",
      visibility: "reader",
      placement: "word",
      wordIndex: 1,
      normalizedWord: "la"
    }),
    annotation({
      strong: "G1519",
      visibility: "reader",
      placement: "empty",
      insertAfterWordIndex: 1
    })
  ];

  const html = renderStrongTaggedText(segments, annotations, "reader");

  assert.deepEqual(parseStrongOccurrences(html).sort(), [
    "G1519",
    "G1722",
    "G3588"
  ]);
  assert.equal(stripTags(html), text);
  assert.match(
    html,
    /<w strong="G1722"[^>]*data-target="phrase"[^>]*data-empty="true"[^>]*data-marker="true"[^>]*data-start-word-index="0"[^>]*data-end-word-index="2"[^>]*><\/w>/
  );
  assert.match(
    html,
    /<w strong="G3588"[^>]*data-target="word"[^>]*data-empty="false"[^>]*data-word-index="1"[^>]*>la<\/w>/
  );
  assert.match(
    html,
    /<w strong="G1519"[^>]*data-target="empty"[^>]*data-empty="true"[^>]*data-insert-after-word-index="1"[^>]*><\/w>/
  );
  assert.doesNotThrow(() =>
    assertRenderedStrongInventory({
      ref: "Gen.1.1",
      wordCount: 3,
      annotations,
      views: { readerHtml: html, advancedHtml: html, debugHtml: html }
    })
  );
});

test("serializes a crossing phrase once as an empty span marker", () => {
  const text = "un deux trois quatre";
  const segments = tokenizeText(text);
  const annotations: StrongLedgerAnnotation[] = [
    annotation({
      strong: "G0001",
      visibility: "reader",
      placement: "phrase",
      startWordIndex: 0,
      endWordIndex: 2,
      normalizedPhrase: "un deux trois"
    }),
    annotation({
      strong: "G0002",
      visibility: "reader",
      placement: "phrase",
      startWordIndex: 1,
      endWordIndex: 3,
      normalizedPhrase: "deux trois quatre"
    })
  ];

  const html = renderStrongTaggedText(segments, annotations, "reader");

  assert.deepEqual(parseStrongOccurrences(html).sort(), ["G0001", "G0002"]);
  assert.equal(stripTags(html), text);
  assert.match(html, /<w strong="G0001"[^>]*>un deux trois<\/w>/);
  assert.match(
    html,
    /<w strong="G0002"[^>]*data-target="phrase"[^>]*data-empty="true"[^>]*data-marker="true"[^>]*data-start-word-index="1"[^>]*data-end-word-index="3"[^>]*><\/w>/
  );
});

test("anchors a conflicting phrase marker before an already open phrase", () => {
  const text = "un deux trois";
  const segments = tokenizeText(text);
  const annotations: StrongLedgerAnnotation[] = [
    annotation({
      strong: "G0001",
      visibility: "reader",
      placement: "phrase",
      startWordIndex: 0,
      endWordIndex: 1,
      normalizedPhrase: "un deux"
    }),
    annotation({
      strong: "G0002",
      visibility: "reader",
      placement: "phrase",
      startWordIndex: 1,
      endWordIndex: 2,
      normalizedPhrase: "deux trois"
    }),
    annotation({
      strong: "G0003",
      visibility: "reader",
      placement: "word",
      wordIndex: 2,
      normalizedWord: "trois"
    })
  ];
  const html = renderStrongTaggedText(segments, annotations, "reader");

  assert.match(html, /^<w strong="G0002"[^>]*><\/w><w strong="G0001"/u);
  assert.match(html, /<w strong="G0001"[^>]*>un deux<\/w>/u);
  assert.match(html, /<w strong="G0003"[^>]*>trois<\/w>/u);
  assert.doesNotThrow(() =>
    assertRenderedStrongInventory({
      ref: "1Sam.17.8",
      wordCount: 3,
      annotations,
      views: { readerHtml: html, advancedHtml: html, debugHtml: html }
    })
  );
});

test("renders an empty duplicate with its anchor instead of as an unindexed word", () => {
  const segments = tokenizeText("Dieu créa.");
  const annotations = [
    annotation({
      strong: "H0430",
      visibility: "hidden",
      placement: "duplicate",
      insertAfterWordIndex: 0
    })
  ];
  const html = renderStrongTaggedText(segments, annotations, "debug");

  assert.match(
    html,
    /<w strong="H0430"[^>]*data-target="duplicate"[^>]*data-insert-after-word-index="0"[^>]*><\/w>/u
  );
  assert.doesNotThrow(() =>
    assertRenderedStrongInventory({
      ref: "Gen.1.1",
      wordCount: 2,
      annotations,
      views: {
        readerHtml: "Dieu créa.",
        advancedHtml: "Dieu créa.",
        debugHtml: html
      }
    })
  );
});

test("fails closed when any rendered view loses a visible Strong", () => {
  const segments = tokenizeText("Dieu créa.");
  const annotations = [
    annotation({
      strong: "H0430",
      visibility: "reader",
      placement: "word",
      wordIndex: 0
    })
  ];
  const html = renderStrongTaggedText(segments, annotations, "reader");
  const views = { readerHtml: html, advancedHtml: html, debugHtml: html };

  assert.doesNotThrow(() =>
    assertRenderedStrongInventory({
      ref: "Gen.1.1",
      wordCount: 2,
      annotations,
      views
    })
  );
  assert.throws(
    () =>
      assertRenderedStrongInventory({
        ref: "Gen.1.1",
        wordCount: 2,
        annotations,
        views: { ...views, readerHtml: "Dieu créa." }
      }),
    /rendered-strong-inventory-mismatch:Gen\.1\.1:reader:H0430\|word\|0\|text:1->0/u
  );
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

function originalOccurrence(
  occurrenceId: string,
  tokenIndex: number,
  sourceStrong: string,
  ordinalTokenIndex = tokenIndex
): OriginalStrongOccurrence {
  return {
    occurrenceId,
    tokenId: `token-${tokenIndex}`,
    tokenIndex,
    ordinalTokenIndex,
    sourceTokenIndex: tokenIndex,
    strong: "H6960",
    sourceStrong,
    text: "",
    gloss: "",
    lemma: "",
    morph: "",
    pos: ""
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
