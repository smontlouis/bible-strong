import assert from "node:assert/strict";
import test from "node:test";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import {
  ARTICLE_CARRIER_FROM_READER,
  ARTICLE_DETERMINER_ASSURANCE,
  ARTICLE_DETERMINER_DUPLICATE,
  readArticleWitnessMarks
} from "../src/strongArticleDeterminers.js";
import { assertResolutionKeptReader } from "../src/strongAutonomous.js";
import {
  emptyResolutionReaderChanges,
  resolveCanonicalVerse
} from "../src/strongCanonicalResolution.js";
import { parseStrongTokens } from "../src/strongCsv.js";
import {
  resolveEnginePolicy,
  type StrongLedger,
  type StrongLedgerAnnotation,
  type StrongLedgerMetrics,
  type StrongLedgerVerse
} from "../src/strongLedger.js";
import { parseSourceRow } from "../src/strongSourceUnits.js";
import type { VerseCorrespondenceBlock } from "../src/verseCorrespondence.js";

/** One STEP word of Matt.1.1: position, Strong, morphology. */
const row = (position: number, strong: string, morph: string) =>
  [
    `Mat.1.1#${String(position).padStart(2, "0")}=NKO`,
    "λόγος",
    "word",
    `${strong}=${morph}`,
    "λόγος=word",
    "NA28+NA27+TR",
    "",
    "",
    "",
    "",
    "",
    strong
  ].join("\t");

interface Carrier {
  position: number;
  wordIndex: number;
  visibility?: StrongLedgerAnnotation["visibility"];
  source?: StrongLedgerAnnotation["source"];
  diagnostic?: string;
}

/**
 * A verse whose source words sit at the given positions. Placed words carry a
 * reader witness transfer; the article keeps the complete alignment's guess.
 */
function fixture(options: {
  words: string[];
  source: Array<[number, string, string]>;
  carriers: Carrier[];
  witness?: string;
  mapping?: VerseCorrespondenceBlock;
}) {
  const rows = options.source.map(([position, strong, morph], index) =>
    parseSourceRow(row(position, strong, morph), "TAGNT fixture.txt", index)!
  );
  const occurrences: OriginalStrongOccurrence[] = rows.map((r, index) => ({
    occurrenceId: `${r.id}.main:0`,
    tokenId: `${r.id}.main`,
    tokenIndex: index + 1,
    sourceIdentity: r.id,
    strong: options.source[index]![1],
    sourceStrong: options.source[index]![1],
    text: r.surface,
    gloss: r.gloss,
    lemma: r.surface,
    morph: options.source[index]![2],
    pos: ""
  }));
  const annotations: StrongLedgerAnnotation[] = options.carriers.map(
    (carrier, index) => {
      const occurrence =
        occurrences[options.source.findIndex(([p]) => p === carrier.position)]!;
      return {
        id: `Matt.1.1:${index}:${occurrence.strong}`,
        strong: occurrence.strong,
        visibility: carrier.visibility ?? "reader",
        placement: "word",
        source: carrier.source ?? "reference-transfer",
        confidence: 0.99,
        reason: "fixture",
        diagnostics: [carrier.diagnostic ?? "exact"],
        wordIndex: carrier.wordIndex,
        originalOccurrenceId: occurrence.occurrenceId
      };
    }
  );
  return {
    bible: "fixture",
    verse: {
      ref: "Matt.1.1",
      text: options.words.join(" "),
      tokens: options.words.map((text, wordIndex) => ({
        wordIndex,
        text,
        normalized: text.toLowerCase()
      })),
      annotations
    },
    input: {
      ...(options.mapping ? { mapping: options.mapping } : {}),
      occurrences,
      references: options.witness
        ? [
            {
              name: "Sg1910",
              family: "Sg1910",
              verse: {
                row: {
                  bookId: "Matt",
                  chapter: 1,
                  verse: 1,
                  text: options.witness
                },
                tokens: parseStrongTokens(options.witness)
              }
            }
          ]
        : [],
      issues: []
    },
    sourceRows: new Map(rows.map((r) => [r.id, r])),
    lexicalItems: []
  };
}

const ARTICLE: [number, string, string] = [4, "G3588", "T-ASF"];
const HOUSE: [number, string, string] = [5, "G3614", "N-ASF"];
const INTO: [number, string, string] = [3, "G1519", "PREP"];
// « Il entra dans la maison » ; the witness: « dans la maison ».
const house = (overrides: Partial<Parameters<typeof fixture>[0]> = {}) =>
  fixture({
    words: ["Il", "entra", "dans", "la", "maison"],
    source: [INTO, ARTICLE, HOUSE],
    carriers: [
      { position: 3, wordIndex: 2 },
      { position: 5, wordIndex: 4 },
      {
        position: 4,
        wordIndex: 1,
        visibility: "advanced",
        source: "original-complete",
        diagnostic: "learned-translation"
      }
    ],
    witness:
      'il entra <w strong="G1519" pos="3">dans</w> <w strong="G3588" pos="4">la</w> <w strong="G3614" pos="5">maison</w>',
    ...overrides
  });
const articleDecision = (r: ReturnType<typeof resolveCanonicalVerse>) =>
  r.decisions.find((d) => d.strong.includes("G3588"))!;
const on = { articleDeterminers: true };

test("option R is declared and on by default", () => {
  assert.equal(resolveEnginePolicy().articleDeterminers, true);
});

test("witness marks keep their gaps and pair Strong numbers with positions", () => {
  const marks = readArticleWitnessMarks(
    'a <w strong="G5216 G3588" pos="6+4">vos</w> <w strong="G2359" pos="5">cheveux</w>, <w strong="G1161">et</w>'
  );
  assert.deepEqual(
    marks.map((m) => [m.text, m.gapBefore, m.items]),
    [
      [
        "vos",
        "a ",
        [
          { strong: "G5216", position: 6 },
          { strong: "G3588", position: 4 }
        ]
      ],
      ["cheveux", " ", [{ strong: "G2359", position: 5 }]],
      ["et", ", ", [{ strong: "G1161", position: undefined }]]
    ]
  );
});

test("the article follows the witness onto the determiner of its placed head", () => {
  const off = house();
  assert.equal(articleDecision(resolveCanonicalVerse(off)).state, "unresolved");
  assert.equal(off.verse.annotations[2]!.visibility, "advanced");

  const f = house();
  const decision = articleDecision(resolveCanonicalVerse({ ...f, policy: on }));
  assert.equal(decision.state, "visible");
  assert.equal(decision.assurance, ARTICLE_DETERMINER_ASSURANCE);
  assert.deepEqual(decision.targetWordIndices, [3]);
  // The complete alignment's guess moves onto « la »: one carrier, labelled.
  const carrier = f.verse.annotations[2]!;
  assert.equal(carrier.visibility, "reader");
  assert.equal(carrier.placement, "word");
  assert.equal(carrier.wordIndex, 3);
  assert.equal(carrier.source, "reference-transfer");
  assert.deepEqual(carrier.diagnostics.slice(0, 3), [
    ARTICLE_DETERMINER_ASSURANCE,
    "determiner",
    "head:G3614@5"
  ]);
  assert.equal(carrier.resolutionState, "visible");
  assert.deepEqual(decision.annotationIds, [carrier.id]);
  assert.equal(f.verse.annotations.length, 3);
});

test("the article stacks on a determiner that carries another word", () => {
  // « vos cheveux » : the possessive and the article share « vos ».
  const f = fixture({
    words: ["Il", "compte", "vos", "cheveux"],
    source: [
      [4, "G3588", "T-NPF"],
      [5, "G2359", "N-NPF"],
      [6, "G5216", "P-2GP"]
    ],
    carriers: [
      { position: 6, wordIndex: 2 },
      { position: 5, wordIndex: 3 }
    ],
    witness:
      'il compte <w strong="G5216 G3588" pos="6+4">vos</w> <w strong="G2359" pos="5">cheveux</w>'
  });
  const decision = articleDecision(resolveCanonicalVerse({ ...f, policy: on }));
  assert.deepEqual(decision.targetWordIndices, [2]);
  // No weak carrier existed: one is added, labelled.
  const added = f.verse.annotations.at(-1)!;
  assert.equal(added.strong, "G3588");
  assert.equal(added.wordIndex, 2);
  assert.equal(added.diagnostics[0], ARTICLE_DETERMINER_ASSURANCE);
  assert.deepEqual(
    f.verse.annotations
      .filter((a) => a.visibility === "reader" && a.wordIndex === 2)
      .map((a) => a.strong),
    ["G5216", "G3588"]
  );
});

test("an elided article stays on its noun and jusqu'au is a determiner", () => {
  const water = fixture({
    words: ["Il", "marcha", "sur", "l'eau"],
    source: [
      [3, "G1909", "PREP"],
      [4, "G3588", "T-ASN"],
      [5, "G5204", "N-ASN"]
    ],
    carriers: [
      { position: 3, wordIndex: 2 },
      { position: 5, wordIndex: 3 }
    ],
    witness:
      'il marcha <w strong="G1909" pos="3">sur</w> <w strong="G3588" pos="4">les</w> <w strong="G5204" pos="5">eaux</w>'
  });
  const elided = articleDecision(
    resolveCanonicalVerse({ ...water, policy: on })
  );
  assert.deepEqual(elided.targetWordIndices, [3]);
  assert.equal(water.verse.annotations.at(-1)!.diagnostics[1], "elided");

  const glued = fixture({
    words: ["Il", "alla", "jusqu'au", "ciel"],
    source: [
      [4, "G3588", "T-GSM"],
      [5, "G3772", "N-GSM"]
    ],
    carriers: [{ position: 5, wordIndex: 3 }],
    witness:
      'il alla jusqu’<w strong="G3588" pos="4">au</w> <w strong="G3772" pos="5">ciel</w>'
  });
  assert.deepEqual(
    articleDecision(resolveCanonicalVerse({ ...glued, policy: on }))
      .targetWordIndices,
    [2]
  );
});

test("the article stays unresolved without every piece of evidence", () => {
  const unresolved = (f: ReturnType<typeof fixture>) =>
    articleDecision(resolveCanonicalVerse({ ...f, policy: on })).state;
  // Something other than spaces between the witness article and its head.
  assert.equal(
    unresolved(
      house({
        witness:
          'il entra <w strong="G1519" pos="3">dans</w> <w strong="G3588" pos="4">la</w>, <w strong="G3614" pos="5">maison</w>'
      })
    ),
    "unresolved"
  );
  // The witness renders the article with something other than a determiner.
  assert.equal(
    unresolved(
      house({
        witness:
          'il entra <w strong="G1519" pos="3">dans</w> <w strong="G3588" pos="4">celle</w> <w strong="G3614" pos="5">maison</w>'
      })
    ),
    "unresolved"
  );
  // The witness tags another article at that position: no position, no rule.
  assert.equal(
    unresolved(
      house({
        witness:
          'il entra <w strong="G1519" pos="3">dans</w> <w strong="G3588">la</w> <w strong="G3614" pos="5">maison</w>'
      })
    ),
    "unresolved"
  );
  // The witness names as head a word the article does not precede.
  assert.equal(
    unresolved(
      fixture({
        words: ["Il", "entra", "dans", "la", "maison"],
        source: [INTO, HOUSE, [6, "G3588", "T-ASF"]],
        carriers: [
          { position: 3, wordIndex: 2 },
          { position: 5, wordIndex: 4 }
        ],
        witness:
          'il entra <w strong="G1519" pos="3">dans</w> <w strong="G3588" pos="6">la</w> <w strong="G3614" pos="5">maison</w>'
      })
    ),
    "unresolved"
  );
  // No determiner before our head in the target.
  assert.equal(
    unresolved(
      house({
        words: ["Il", "entra", "dans", "une", "maison"]
      })
    ),
    "unresolved"
  );
  // Our head is not placed.
  assert.equal(
    unresolved(
      house({
        carriers: [{ position: 3, wordIndex: 2 }]
      })
    ),
    "unresolved"
  );
  // The determiner already carries an article.
  assert.equal(
    unresolved(
      fixture({
        words: ["dans", "la", "maison"],
        source: [INTO, ARTICLE, HOUSE, [6, "G3588", "T-GSM"]],
        carriers: [
          { position: 3, wordIndex: 0 },
          { position: 5, wordIndex: 2 },
          { position: 6, wordIndex: 1 }
        ],
        witness:
          '<w strong="G1519" pos="3">dans</w> <w strong="G3588" pos="4">la</w> <w strong="G3614" pos="5">maison</w>'
      })
    ),
    "unresolved"
  );
  // No Segond witness (excluded, or the target itself).
  assert.equal(unresolved(house({ witness: undefined })), "unresolved");
  // A witness row joined from several verses.
  assert.equal(
    unresolved(
      house({
        mapping: {
          targetRefs: ["Matt.1.1"],
          canonicalRefs: ["Matt.1.1", "Matt.1.2"],
          kind: "merge"
        } as VerseCorrespondenceBlock
      })
    ),
    "unresolved"
  );
});

test("two articles claiming one determiner are both left unresolved", () => {
  const f = fixture({
    words: ["dans", "la", "maison"],
    source: [
      INTO,
      ARTICLE,
      HOUSE,
      [6, "G3588", "T-ASF"],
      [7, "G3614", "N-ASF"]
    ],
    carriers: [
      { position: 3, wordIndex: 0 },
      { position: 5, wordIndex: 2 },
      { position: 7, wordIndex: 2 }
    ],
    witness:
      '<w strong="G1519" pos="3">dans</w> <w strong="G3588" pos="4">la</w> <w strong="G3614" pos="5">maison</w> <w strong="G3588" pos="6">la</w> <w strong="G3614" pos="7">maison</w>'
  });
  const r = resolveCanonicalVerse({ ...f, policy: on });
  assert.deepEqual(
    r.decisions.filter((d) => d.strong.includes("G3588")).map((d) => d.state),
    ["unresolved", "unresolved"]
  );
});

test("a verse resolved again keeps R's decision and carrier", () => {
  const f = house();
  const first = resolveCanonicalVerse({ ...f, policy: on });
  const carrier = structuredClone(f.verse.annotations[2]!);
  // Q resolves the verses it changed a second time: the article's carrier is
  // then an existing placement, still R's.
  const second = resolveCanonicalVerse({ ...f, policy: on });
  // Decisions and their provenance are the same; only the exploration record
  // differs (« la » is now occupied, so no exact witness proposal is left).
  const provenance = (r: typeof first) =>
    r.decisions.map((decision) => ({ ...decision, exploration: undefined }));
  assert.deepEqual(provenance(second), provenance(first));
  assert.equal(articleDecision(second).assurance, ARTICLE_DETERMINER_ASSURANCE);
  assert.deepEqual(articleDecision(second).reasons, [
    "article-on-head-determiner:Sg1910:la:G3614@5:determiner"
  ]);
  assert.deepEqual(f.verse.annotations[2], carrier);
});

/** Ledger metrics with only the reader counts the autonomous check reads. */
const readerMetrics = (
  readerVisibleStrongCount: number,
  readerTaggedTokenCount: number,
  readerOverBudgetStrongCount = 0
) =>
  ({
    verseCount: 1,
    wordCount: 5,
    readerVisibleStrongCount,
    readerTaggedTokenCount,
    readerOverBudgetStrongCount
  }) as unknown as StrongLedgerMetrics;

/** A fixture verse as a ledger verse, with its source budget. */
const ledgerVerse = (f: ReturnType<typeof fixture>) =>
  ({
    ...f.verse,
    inventories: {
      references: {},
      original: f.input.occurrences.map((o) => o.strong),
      reader: [],
      advanced: []
    }
  }) as unknown as StrongLedgerVerse;

type ReaderLedger = Pick<
  StrongLedger,
  | "metrics"
  | "resolutionBaselineMetrics"
  | "articleDeterminers"
  | "lexicalGapFill"
  | "witnessEmptyContexts"
  | "verses"
>;

test("the autonomous reader check accepts exactly the counted R carriers", () => {
  // The complete alignment's guess (advanced) becomes a reader carrier on
  // « la »: one more reader Strong, one more tagged word.
  const f = house();
  const changes = emptyResolutionReaderChanges();
  resolveCanonicalVerse({ ...f, policy: on, readerChanges: changes });
  assert.deepEqual(changes.articleDeterminers, {
    carriers: 1,
    fromReaderEmpties: 0,
    hiddenDuplicates: 0
  });
  const placed: ReaderLedger = {
    verses: [ledgerVerse(f)],
    resolutionBaselineMetrics: readerMetrics(2, 2),
    metrics: readerMetrics(3, 3),
    articleDeterminers: changes.articleDeterminers
  };
  assert.doesNotThrow(() => assertResolutionKeptReader("s21", placed));
  // R carriers the ledger does not report, or reports otherwise.
  assert.throws(
    () =>
      assertResolutionKeptReader("s21", {
        ...placed,
        articleDeterminers: undefined
      }),
    /reader-regression:s21:article-determiners/
  );
  assert.throws(
    () =>
      assertResolutionKeptReader("s21", {
        ...placed,
        articleDeterminers: { ...changes.articleDeterminers, carriers: 2 }
      }),
    /reader-regression:s21:article-determiners/
  );
  // Any other change of the reader is still a regression.
  assert.throws(
    () =>
      assertResolutionKeptReader("s21", {
        ...placed,
        metrics: readerMetrics(4, 3)
      }),
    /reader-regression:s21:readerVisibleStrongCount/
  );
  const hidden = ledgerVerse(f);
  hidden.annotations = hidden.annotations.map((a) =>
    a.strong === "G1519" ? { ...a, visibility: "hidden" } : a
  );
  assert.throws(
    () =>
      assertResolutionKeptReader("s21", {
        ...placed,
        verses: [hidden],
        // What the ledger would count for that verse.
        metrics: readerMetrics(2, 2)
      }),
    /reader-regression:s21:readerVisibleStrongCount/
  );
});

test("an R carrier taken from a reader empty only tags its word", () => {
  // The article had two reader empties: one becomes the carrier, the other
  // its hidden duplicate.
  const f = house();
  const article = f.verse.annotations[2]!;
  const empty = (id: string): StrongLedgerAnnotation => ({
    ...article,
    id,
    visibility: "reader",
    placement: "empty",
    source: "reference-transfer",
    diagnostics: ["empty-reference"],
    wordIndex: undefined,
    insertAfterWordIndex: 2
  });
  f.verse.annotations.splice(2, 1, empty("empty:a"), empty("empty:b"));
  const changes = emptyResolutionReaderChanges();
  const decision = articleDecision(
    resolveCanonicalVerse({ ...f, policy: on, readerChanges: changes })
  );
  assert.equal(decision.state, "visible");
  assert.deepEqual(changes.articleDeterminers, {
    carriers: 1,
    fromReaderEmpties: 1,
    hiddenDuplicates: 1
  });
  const [carrier, duplicate] = f.verse.annotations.slice(2);
  assert.equal(carrier!.visibility, "reader");
  assert.ok(carrier!.diagnostics.includes(ARTICLE_CARRIER_FROM_READER));
  assert.equal(duplicate!.visibility, "hidden");
  assert.ok(duplicate!.diagnostics.includes(ARTICLE_DETERMINER_DUPLICATE));
  // Baseline: four reader Strongs (two of them empties), two tagged words.
  // Final: three reader Strongs, three tagged words.
  const ledger: ReaderLedger = {
    verses: [ledgerVerse(f)],
    resolutionBaselineMetrics: readerMetrics(4, 2, 1),
    metrics: readerMetrics(3, 3),
    articleDeterminers: changes.articleDeterminers
  };
  assert.doesNotThrow(() => assertResolutionKeptReader("s21", ledger));
  assert.throws(
    () =>
      assertResolutionKeptReader("s21", {
        ...ledger,
        articleDeterminers: {
          ...changes.articleDeterminers,
          fromReaderEmpties: 0
        }
      }),
    /reader-regression:s21:article-determiners/
  );
});
