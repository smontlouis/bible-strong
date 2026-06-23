import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSemanticRefill,
  validateSemanticRefillDecision,
  type SemanticRefillDecision
} from "../src/semanticRefill.js";
import {
  type StrongLedgerAnnotation,
  type StrongLedgerVerse
} from "../src/strongLedger.js";

test("semantic refill resolves required NBS Genesis phrase and word cases", () => {
  const result = buildSemanticRefill({
    bible: "nbs",
    scope: "Gen",
    verses: [genesisOneSix(), genesisOneTwenty()]
  });

  assertDecision(result.decisions, {
    ref: "Gen.1.6",
    strong: ["H7549"],
    target: "word",
    normalized: "voute"
  });
  assertDecision(result.decisions, {
    ref: "Gen.1.6",
    strong: ["H1961"],
    target: "phrase",
    normalized: "il y ait"
  });
  assertDecision(result.decisions, {
    ref: "Gen.1.20",
    strong: ["H8317"],
    target: "word",
    normalized: "grouillent"
  });
  assertDecision(result.decisions, {
    ref: "Gen.1.20",
    strong: ["H8318"],
    target: "phrase",
    normalized: "petites betes"
  });
  assertDecision(result.decisions, {
    ref: "Gen.1.20",
    strong: ["H7549", "H8064"],
    target: "phrase",
    normalized: "voute celeste"
  });
});

test("semantic refill rejects weak technical particles instead of promoting them", () => {
  const result = buildSemanticRefill({
    bible: "nbs",
    scope: "Gen",
    verses: [genesisOneSix()]
  });

  assert.equal(
    result.rejected.some(
      (decision) =>
        decision.ref === "Gen.1.6" &&
        decision.strong.includes("H0996") &&
        decision.reason.includes("technical")
    ),
    true
  );
  assert.equal(
    result.decisions.some((decision) => decision.strong.includes("H0996")),
    false
  );
});

test("semantic refill audits misplaced visible reader Strong codes", () => {
  const result = buildSemanticRefill({
    bible: "nbs",
    scope: "Gen.1.27",
    verses: [genesisOneTwentySeven()]
  });

  const relocation = result.candidates.find(
    (candidate) =>
      candidate.auditKind === "relocation" &&
      candidate.ref === "Gen.1.27" &&
      candidate.strong === "H0120"
  );

  assert.ok(relocation);
  assert.equal(relocation.currentTarget?.wordIndex, 14);
  assert.equal(relocation.currentTarget?.normalizedWord, "homme");
  assert.equal(relocation.candidates[0]?.target, "word");
  assert.equal(relocation.candidates[0]?.wordIndex, 3);
  assert.equal(relocation.candidates[0]?.normalizedWord, "humains");
});

test("semantic refill validates Strong inventory and phrase indexes", () => {
  const verse = genesisOneTwenty();

  assert.deepEqual(
    validateSemanticRefillDecision({
      verse,
      decision: decision({
        strong: ["H9999"],
        wordIndex: 5,
        normalized: "grouillent"
      })
    }),
    { status: "rejected", reason: "strong-absent-from-verse" }
  );

  assert.deepEqual(
    validateSemanticRefillDecision({
      verse,
      decision: decision({
        target: "phrase",
        wordIndex: 24,
        startWordIndex: 24,
        endWordIndex: 25,
        normalized: "voute mer",
        normalizedPhrase: ["voute", "mer"],
        strong: ["H7549"]
      })
    }),
    { status: "rejected", reason: "phrase-normalization-mismatch" }
  );

  assert.deepEqual(
    validateSemanticRefillDecision({
      verse,
      decision: decision({
        target: "phrase",
        wordIndex: 24,
        startWordIndex: 24,
        endWordIndex: 25,
        normalized: "voute celeste",
        normalizedPhrase: ["voute", "celeste"],
        strong: ["H7549", "H8064"]
      })
    }),
    { status: "validated" }
  );
});

function assertDecision(
  decisions: SemanticRefillDecision[],
  expected: {
    ref: string;
    strong: string[];
    target: "word" | "phrase";
    normalized: string;
  }
): void {
  assert.equal(
    decisions.some(
      (decision) =>
        decision.ref === expected.ref &&
        decision.target === expected.target &&
        decision.normalized === expected.normalized &&
        expected.strong.every((strong) => decision.strong.includes(strong))
    ),
    true,
    `Expected ${expected.ref} ${expected.strong.join("+")} on ${expected.normalized}`
  );
}

function genesisOneSix(): StrongLedgerVerse {
  return verse({
    ref: "Gen.1.6",
    text: "Dieu dit : Qu’il y ait une voûte au milieu des eaux pour séparer les eaux des eaux !",
    tokens: [
      "dieu",
      "dit",
      "il",
      "y",
      "ait",
      "une",
      "voute",
      "au",
      "milieu",
      "des",
      "eaux",
      "pour",
      "separer",
      "les",
      "eaux",
      "des",
      "eaux"
    ],
    annotations: [
      annotation({
        strong: "H1961",
        visibility: "reader",
        placement: "word",
        wordIndex: 4,
        normalizedWord: "ait"
      }),
      annotation({
        strong: "H7549",
        visibility: "advanced",
        placement: "empty",
        insertAfterWordIndex: 4
      }),
      annotation({
        strong: "H1961",
        visibility: "advanced",
        placement: "empty",
        insertAfterWordIndex: 10
      }),
      annotation({
        strong: "H0996",
        visibility: "advanced",
        placement: "technical",
        insertAfterWordIndex: 12
      })
    ],
    original: ["H1961", "H7549", "H1961", "H0996"],
    references: ["H1961", "H7549", "H1961", "H0996"]
  });
}

function genesisOneTwenty(): StrongLedgerVerse {
  return verse({
    ref: "Gen.1.20",
    text: "Dieu dit : Que les eaux grouillent de petites bêtes, d’êtres vivants, et que des oiseaux volent au-dessus de la terre, face à la voûte céleste !",
    tokens: [
      "dieu",
      "dit",
      "que",
      "les",
      "eaux",
      "grouillent",
      "de",
      "petites",
      "betes",
      "etres",
      "vivants",
      "et",
      "que",
      "des",
      "oiseaux",
      "volent",
      "au",
      "dessus",
      "de",
      "la",
      "terre",
      "face",
      "a",
      "la",
      "voute",
      "celeste"
    ],
    annotations: [
      annotation({
        strong: "H8317",
        visibility: "advanced",
        placement: "empty",
        insertAfterWordIndex: 1
      }),
      annotation({
        strong: "H8318",
        visibility: "advanced",
        placement: "empty",
        insertAfterWordIndex: 4
      }),
      annotation({
        strong: "H7549",
        visibility: "advanced",
        placement: "empty",
        insertAfterWordIndex: 21
      }),
      annotation({
        strong: "H8064",
        visibility: "advanced",
        placement: "empty",
        insertAfterWordIndex: 21
      })
    ],
    original: ["H8317", "H8318", "H7549", "H8064"],
    references: ["H8317", "H8318", "H7549", "H8064"]
  });
}

function genesisOneTwentySeven(): StrongLedgerVerse {
  return verse({
    ref: "Gen.1.27",
    text: "Dieu créa les humains à son image : il les créa à l’image de Dieu ; homme et femme il les créa.",
    tokens: [
      "dieu",
      "crea",
      "les",
      "humains",
      "a",
      "son",
      "image",
      "il",
      "les",
      "crea",
      "a",
      "image",
      "de",
      "dieu",
      "homme",
      "et",
      "femme",
      "il",
      "les",
      "crea"
    ],
    annotations: [
      annotation({
        strong: "H0120",
        visibility: "reader",
        placement: "word",
        wordIndex: 14,
        normalizedWord: "homme"
      }),
      annotation({
        strong: "H2145",
        visibility: "reader",
        placement: "word",
        wordIndex: 14,
        normalizedWord: "homme"
      }),
      annotation({
        strong: "H5347",
        visibility: "reader",
        placement: "word",
        wordIndex: 16,
        normalizedWord: "femme"
      })
    ],
    original: ["H0120", "H2145", "H5347"],
    references: ["H0120", "H2145", "H5347"]
  });
}

function verse(options: {
  ref: string;
  text: string;
  tokens: string[];
  annotations: StrongLedgerAnnotation[];
  original: string[];
  references: string[];
}): StrongLedgerVerse {
  const [bookId, chapterVerse] = options.ref.split(".");
  const [chapter, verseNumber] = chapterVerse.split(":");
  return {
    ref: options.ref,
    bookId,
    chapter: Number(chapter),
    verse: Number(verseNumber),
    text: options.text,
    tokens: options.tokens.map((normalized, wordIndex) => ({
      wordIndex,
      text: normalized,
      normalized
    })),
    annotations: options.annotations.map((item, index) => ({
      ...item,
      id: `${options.ref}:${index}:${item.strong}`,
      referenceSupport: ["Sg1910", "Darby", "DarbyR"]
    })),
    views: { readerHtml: "", advancedHtml: "", debugHtml: "" },
    inventories: {
      original: options.original,
      reader: options.annotations
        .filter((item) => item.visibility === "reader")
        .map((item) => item.strong),
      advanced: options.annotations.map((item) => item.strong),
      references: {
        Sg1910: options.references,
        Darby: options.references,
        DarbyR: options.references
      }
    },
    metrics: {
      wordCount: options.tokens.length,
      readerVisibleStrongCount: 0,
      advancedStrongCount: options.annotations.length,
      emptyStrongCount: 0,
      phraseStrongCount: 0,
      technicalStrongCount: 0,
      pendingHumanCount: 0,
      rejectedCount: 0,
      referenceStrongOccurrenceCount: options.references.length,
      referenceStrongRepresentedCount: 0,
      referenceStrongCoverage: 0,
      originalStrongOccurrenceCount: options.original.length,
      originalRepresentedStrongOccurrenceCount: 0,
      originalRepresentationRate: 0,
      semanticMissingCount: 0,
      readerTaggedTokenCount: 0,
      advancedTaggedTokenCount: 0,
      readerTokenCoverage: 0,
      advancedTokenCoverage: 0
    }
  };
}

function annotation(
  partial: Partial<StrongLedgerAnnotation> &
    Pick<StrongLedgerAnnotation, "strong" | "visibility" | "placement">
): StrongLedgerAnnotation {
  return {
    id: "",
    source: "original-complete",
    confidence: 0.9,
    reason: "test",
    diagnostics: ["test"],
    referenceSupport: ["Sg1910", "Darby", "DarbyR"],
    ...partial
  };
}

function decision(
  partial: Partial<SemanticRefillDecision>
): SemanticRefillDecision {
  return {
    bible: "nbs",
    ref: "Gen.1.20",
    target: "word",
    wordIndex: 5,
    normalized: "grouillent",
    strong: ["H8317"],
    confidence: 0.9,
    source: "test",
    reason: "test",
    status: "accept",
    score: 0.9,
    priority: "semantic-high",
    evidence: ["test"],
    ...partial
  };
}
