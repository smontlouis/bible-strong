import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCanonicalBibleFromLegacy } from "../src/legacyBiblePublication.js";
import {
  type CanonicalBibleVerse,
  verifyCanonicalBiblePublication
} from "../src/strongBibleMobilePublication.js";
import {
  applyWordsOfJesus,
  carrySpansThroughInsertedSpaces,
  extractWordsOfJesusSpans,
  hashVerseText,
  importLegacyRedWords,
  insertWordsOfJesusSpans,
  parseWordsOfJesusDataset,
  refineGluedBoundaries,
  serializeWordsOfJesusDataset,
  transferSpans,
  wordRangesToSpans,
  type WordsOfJesusDataset
} from "../src/wordsOfJesus.js";
import {
  auditWordsOfJesus,
  buildWordsOfJesusReference,
  hasSuspiciousBoundary
} from "../src/wordsOfJesusAudit.js";

const SPEECH = "Jésus lui dit : Suis-moi.";

const publicationOf = (verses: Record<string, string>) =>
  buildCanonicalBibleFromLegacy({
    versionId: "TEST",
    sourceVersion: "fixture",
    sourceSha256: "a".repeat(64),
    bible: Object.entries(verses).reduce<
      Record<string, Record<string, Record<string, string>>>
    >((bible, [ref, text]) => {
      const [book, chapter, verse] = ref.split("-") as [string, string, string];
      ((bible[book] ??= {})[chapter] ??= {})[verse] = text;
      return bible;
    }, {})
  });

const datasetOf = (
  verses: WordsOfJesusDataset["verses"]
): WordsOfJesusDataset => ({
  format: "bible-strong-words-of-jesus",
  schemaVersion: 1,
  versionId: "TEST",
  verses
});

const verseOf = (
  overrides: Partial<CanonicalBibleVerse>
): CanonicalBibleVerse => ({
  text: SPEECH,
  startTags: [],
  layout: [],
  notes: [],
  headings: [],
  ...overrides
});

describe("words of Jesus", () => {
  it("converts historical word indexes into trimmed character spans", () => {
    assert.deepEqual(wordRangesToSpans(SPEECH, [{ start: 4, end: 4 }]), {
      spans: [[16, 25]],
      outOfRange: false
    });
    assert.deepEqual(wordRangesToSpans(SPEECH, [{ start: 3, end: 9 }]), {
      spans: [[14, 25]],
      outOfRange: true
    });
  });

  it("imports a legacy red-word file and reports ranges authored for another text", () => {
    const imported = importLegacyRedWords({
      versionId: "TEST",
      publication: publicationOf({ "40-4-19": SPEECH }),
      redWords: {
        "40-4-19": [{ start: 4, end: 4 }],
        "40-4-20": [{ start: 0, end: 1 }],
        "40-4-21": [{ start: 9, end: 9 }]
      }
    });

    assert.deepEqual(imported.dataset.verses, [
      {
        ref: "40-4-19",
        verseSha256: hashVerseText(SPEECH),
        spans: [[16, 25]],
        origin: "legacy-red-words"
      }
    ]);
    assert.deepEqual(imported.missingVerseRefs, ["40-4-20", "40-4-21"]);
  });

  it("carries spans to another wording only when both boundaries are anchored", () => {
    const pivot =
      "Jésus répondit : Il est écrit : l’homme ne vivra pas de pain seulement.";
    const pivotSpans: Array<[number, number]> = [[17, pivot.length]];

    assert.deepEqual(
      transferSpans(
        pivot,
        pivotSpans,
        "Jésus répondit: Il est écrit: L'homme ne vivra pas de pain seulement !"
      ),
      [[16, 70]]
    );
    assert.equal(
      transferSpans(
        pivot,
        pivotSpans,
        "Mais, répondant, il dit : Il est écrit : l’homme ne vivra pas de pain seulement."
      ),
      undefined
    );
  });

  it("cuts word-level spans at speaker changes glued to a word", () => {
    const text =
      "Il leur dit ces paraboles.—Écoutez bien. Il ajouta encore.—Allez !";
    const glued = refineGluedBoundaries(text, [[16, 64]]);

    assert.deepEqual(glued, [[26, 58]]);
    assert.equal(text.slice(...glued[0]!), "—Écoutez bien. Il ajouta encore.");
    assert.deepEqual(refineGluedBoundaries(SPEECH, [[16, 25]]), [[16, 25]]);
    const neighbours =
      "Il dit:Heureux les pauvres, gloire à ton nom!Et la voix répondit.";
    assert.equal(
      neighbours.slice(...refineGluedBoundaries(neighbours, [[15, 40]])[0]!),
      "Heureux les pauvres, gloire à ton nom!"
    );
  });

  it("carries spans exactly through restored spaces only", () => {
    const previous = "Thou shalt worship the Lord thyGod.";
    const next = "Thou shalt worship the Lord thy God.";
    const [span] = carrySpansThroughInsertedSpaces(previous, next, [
      [0, previous.length]
    ])!;
    assert.equal(next.slice(...span!), next);
    assert.equal(
      carrySpansThroughInsertedSpaces(previous, "Thou shalt adore.", [[0, 4]]),
      undefined
    );
  });

  it("round-trips the line-based dataset and rejects malformed spans", () => {
    const dataset = datasetOf([
      {
        ref: "43-14-6",
        verseSha256: "0123456789abcdef",
        spans: [[0, 3]],
        origin: "manual"
      },
      {
        ref: "40-5-3",
        verseSha256: "fedcba9876543210",
        spans: [],
        origin: "aligned"
      }
    ]);
    const serialized = serializeWordsOfJesusDataset(dataset);

    assert.match(serialized.split("\n")[1]!, /"ref":"40-5-3"/u);
    assert.deepEqual(
      parseWordsOfJesusDataset(serialized).verses.map((verse) => verse.ref),
      ["40-5-3", "43-14-6"]
    );
    assert.throws(
      () => parseWordsOfJesusDataset(serialized.replace("[[0,3]]", "[[3,3]]")),
      /words-of-jesus-span-invalid/u
    );
  });

  it("nests inserted spans inside paragraphs and keeps note order", () => {
    const verse = insertWordsOfJesusSpans(
      verseOf({
        layout: [
          { offset: 0, order: 3, type: "open", tag: "p" },
          { offset: 25, order: 9, type: "close", tag: "p" }
        ],
        notes: [
          { offset: 25, order: 7, kind: "note", markup: "<note>n</note>" }
        ]
      }),
      [[16, 25]]
    );

    assert.deepEqual(
      [...verse.layout, ...verse.notes]
        .sort((left, right) => left.order - right.order)
        .map((event) =>
          "tag" in event
            ? `${event.type}:${event.tag}@${event.offset}`
            : `note@${event.offset}`
        ),
      ["open:p@0", "open:wj@16", "close:wj@25", "note@25", "close:p@25"]
    );
  });

  it("splits a span at a paragraph boundary inside the verse", () => {
    const verse = insertWordsOfJesusSpans(
      verseOf({
        layout: [
          { offset: 0, order: 0, type: "open", tag: "p" },
          { offset: 20, order: 1, type: "close", tag: "p" },
          { offset: 20, order: 2, type: "open", tag: "p" },
          { offset: 25, order: 3, type: "close", tag: "p" }
        ]
      }),
      [[16, 25]]
    );

    assert.deepEqual(
      verse.layout.map((event) => `${event.type}:${event.tag}@${event.offset}`),
      [
        "open:p@0",
        "open:wj@16",
        "close:wj@20",
        "close:p@20",
        "open:p@20",
        "open:wj@20",
        "close:wj@25",
        "close:p@25"
      ]
    );
  });

  it("applies decisions and recomputes a verifiable text identity", () => {
    const publication = publicationOf({
      "40-4-19": SPEECH,
      "40-4-20": "Et ils le suivirent."
    });
    const applied = applyWordsOfJesus(
      publication,
      datasetOf([
        {
          ref: "40-4-19",
          verseSha256: hashVerseText(SPEECH),
          spans: [[16, 25]],
          origin: "aligned"
        },
        {
          ref: "40-4-20",
          verseSha256: hashVerseText("Et ils le suivirent."),
          spans: [],
          origin: "aligned"
        }
      ])
    );

    assert.equal(applied.verseCount, 1);
    assert.notEqual(applied.publication.textRevision, publication.textRevision);
    assert.equal(
      verifyCanonicalBiblePublication(applied.publication).verseCount,
      2
    );
    assert.deepEqual(
      extractWordsOfJesusSpans(applied.publication.verses["40"]!["4"]!["19"]!),
      [[16, 25]]
    );
  });

  it("fails closed when the text changed or the source already marks the verse", () => {
    const publication = publicationOf({ "40-4-19": SPEECH });
    assert.throws(
      () =>
        applyWordsOfJesus(
          publication,
          datasetOf([
            {
              ref: "40-4-19",
              verseSha256: hashVerseText("autre texte"),
              spans: [[0, 5]],
              origin: "aligned"
            }
          ])
        ),
      /words-of-jesus-text-drift:TEST:40-4-19/u
    );

    publication.verses["40"]!["4"]!["19"]!.layout = [
      { offset: 16, order: 0, type: "open", tag: "red" },
      { offset: 25, order: 1, type: "close", tag: "red" }
    ];
    assert.throws(
      () =>
        applyWordsOfJesus(
          publication,
          datasetOf([
            {
              ref: "40-4-19",
              verseSha256: hashVerseText(SPEECH),
              spans: [[16, 25]],
              origin: "aligned"
            }
          ])
        ),
      /words-of-jesus-source-markup-conflict/u
    );
  });

  it("reads source markup inherited from the previous verse", () => {
    assert.deepEqual(
      extractWordsOfJesusSpans(
        verseOf({
          startTags: [{ tag: "red" }],
          layout: [{ offset: 5, order: 0, type: "close", tag: "red" }]
        })
      ),
      [[0, 5]]
    );
  });

  it("suspects spans that start or end inside a sentence", () => {
    const text = "Jésus lui dit : Je le veux : sois nettoyé ; et il fut guéri.";
    assert.equal(hasSuspiciousBoundary(text, [[16, 41]]), false);
    assert.equal(hasSuspiciousBoundary(text, [[16, 33]]), true);
    assert.equal(hasSuspiciousBoundary(text, [[14, 41]]), true);
    assert.equal(
      hasSuspiciousBoundary("O femme, ta foi est grande.", [[2, 27]]),
      true
    );
  });

  it("flags disagreements with the reference Bibles but trusts reviewed decisions", () => {
    const referenceText = "Jesus said, Follow me.";
    const referencePublication = publicationOf({
      "40-4-19": referenceText,
      "40-4-20": "And they followed him.",
      "43-3-16": "For God so loved the world."
    });
    referencePublication.verses["40"]!["4"]!["19"]!.layout = [
      { offset: 12, order: 0, type: "open", tag: "red" },
      { offset: 22, order: 1, type: "close", tag: "red" }
    ];
    referencePublication.verses["43"]!["3"]!["16"]!.layout = [
      { offset: 0, order: 0, type: "open", tag: "red" },
      { offset: 27, order: 1, type: "close", tag: "red" }
    ];
    const references = ["A", "B"].map((versionId) =>
      buildWordsOfJesusReference(versionId, referencePublication)
    );
    const target = publicationOf({
      "40-4-19": SPEECH,
      "40-4-20": "Et ils le suivirent.",
      "43-3-16": "Car Dieu a tant aimé le monde."
    });

    const result = auditWordsOfJesus({
      versionId: "TEST",
      publication: target,
      references,
      dataset: datasetOf([
        {
          ref: "40-4-19",
          verseSha256: hashVerseText(SPEECH),
          spans: [[16, 25]],
          origin: "legacy-red-words"
        },
        {
          ref: "40-4-20",
          verseSha256: hashVerseText("Et ils le suivirent."),
          spans: [[0, 2]],
          origin: "legacy-red-words"
        },
        {
          ref: "43-3-16",
          verseSha256: hashVerseText("Car Dieu a tant aimé le monde."),
          spans: [],
          origin: "aligned"
        }
      ])
    });

    assert.deepEqual(
      result.flags.map((flag) => `${flag.ref}:${flag.kind}`),
      ["40-4-20:unsupported"]
    );

    const underived = auditWordsOfJesus({
      versionId: "TEST",
      publication: target,
      references
    });
    assert.deepEqual(
      underived.flags.map((flag) => `${flag.ref}:${flag.kind}`),
      ["40-4-19:missing", "43-3-16:missing"]
    );
  });
});
