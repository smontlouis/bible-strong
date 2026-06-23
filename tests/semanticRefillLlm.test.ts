import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSemanticRefillLlmBatch,
  runSemanticRefillLlm,
  SEMANTIC_REFILL_LLM_DECISION_TYPES,
  SEMANTIC_REFILL_LLM_JSON_SCHEMA,
  SEMANTIC_REFILL_LLM_SYSTEM_PROMPT,
  type SemanticRefillLlmResponse
} from "../src/semanticRefillLlm.js";
import { buildSemanticRefill } from "../src/semanticRefill.js";
import {
  type StrongLedgerAnnotation,
  type StrongLedgerVerse
} from "../src/strongLedger.js";

test("semantic refill LLM dry-run builds prompt and strict schema without calling a client", async () => {
  const verses = [genesisOneTwenty()];
  const deterministic = buildSemanticRefill({
    bible: "nbs",
    scope: "Gen.1.20",
    verses
  });
  let called = false;

  const result = await runSemanticRefillLlm({
    bible: "nbs",
    scope: "Gen.1.20",
    verses,
    candidates: deterministic.candidates,
    mode: "dry-run",
    client: {
      async complete() {
        called = true;
        return { decisions: [] };
      }
    }
  });

  assert.equal(called, false);
  assert.equal(result.metrics.dryRun, true);
  assert.equal(result.rawDecisions.length, 0);
  assert.equal(result.request.responseSchema.strict, true);
  assert.deepEqual(
    result.request.responseSchema.schema.properties.decisions.items.properties
      .decision.enum,
    SEMANTIC_REFILL_LLM_DECISION_TYPES
  );
  assert.match(SEMANTIC_REFILL_LLM_SYSTEM_PROMPT, /duplicate/);
  assert.match(SEMANTIC_REFILL_LLM_SYSTEM_PROMPT, /not-rendered/);
  assert.equal(
    SEMANTIC_REFILL_LLM_JSON_SCHEMA.name,
    result.request.responseSchema.name
  );
  assert.equal(
    result.batch.candidates.some((item) => item.strong === "H8317"),
    true
  );
});

test("semantic refill LLM mock validates word and phrase decisions locally", async () => {
  const verses = [genesisOneTwenty()];
  const deterministic = buildSemanticRefill({
    bible: "nbs",
    scope: "Gen.1.20",
    verses
  });
  const batch = buildSemanticRefillLlmBatch({
    bible: "nbs",
    scope: "Gen.1.20",
    candidates: deterministic.candidates
  });
  const byStrong = new Map(batch.candidates.map((item) => [item.strong, item]));
  const mockResponse: SemanticRefillLlmResponse = {
    decisions: [
      {
        id: byStrong.get("H8317")!.id,
        ref: "Gen.1.20",
        decision: "word",
        strong: ["H8317"],
        confidence: 0.92,
        reason: "grouillent rend le mouvement de pullulation.",
        wordIndex: 5,
        normalized: "grouillent",
        startWordIndex: null,
        endWordIndex: null,
        normalizedPhrase: null,
        evidence: ["candidate form grouillent"]
      },
      {
        id: byStrong.get("H8318")!.id,
        ref: "Gen.1.20",
        decision: "phrase",
        strong: ["H8318"],
        confidence: 0.91,
        reason: "petites betes rend la classe de creatures.",
        wordIndex: null,
        normalized: null,
        startWordIndex: 7,
        endWordIndex: 8,
        normalizedPhrase: ["petites", "betes"],
        evidence: ["candidate phrase petites betes"]
      },
      {
        id: byStrong.get("H8064")!.id,
        ref: "Gen.1.20",
        decision: "pending-human",
        strong: ["H8064"],
        confidence: 0.7,
        reason: "celeste peut porter le Strong mais demande revue.",
        wordIndex: null,
        normalized: null,
        startWordIndex: null,
        endWordIndex: null,
        normalizedPhrase: null,
        evidence: []
      },
      {
        id: byStrong.get("H7549")!.id,
        ref: "Gen.1.20",
        decision: "not-rendered",
        strong: ["H7549"],
        confidence: 0.86,
        reason: "test terminal reject classification.",
        wordIndex: null,
        normalized: null,
        startWordIndex: null,
        endWordIndex: null,
        normalizedPhrase: null,
        evidence: []
      }
    ]
  };

  const result = await runSemanticRefillLlm({
    bible: "nbs",
    scope: "Gen.1.20",
    verses,
    candidates: deterministic.candidates,
    mode: "mock",
    mockResponse
  });

  assert.equal(result.validated.length, 2);
  assert.equal(
    result.validated.some(
      (decision) =>
        decision.target === "word" &&
        decision.wordIndex === 5 &&
        decision.strong.includes("H8317")
    ),
    true
  );
  assert.equal(
    result.validated.some(
      (decision) =>
        decision.target === "phrase" &&
        decision.startWordIndex === 7 &&
        decision.endWordIndex === 8 &&
        decision.normalized === "petites betes" &&
        decision.strong.includes("H8318")
    ),
    true
  );
  assert.equal(result.pending[0]?.decisionType, "pending-human");
  assert.equal(result.rejected[0]?.reason, "llm-classified-not-rendered");
});

test("semantic refill LLM rejects invalid phrase normalization and reader duplicates", async () => {
  const verses = [genesisOneTwentyWithReaderDuplicate()];
  const deterministic = buildSemanticRefill({
    bible: "nbs",
    scope: "Gen.1.20",
    verses
  });
  const batch = buildSemanticRefillLlmBatch({
    bible: "nbs",
    scope: "Gen.1.20",
    candidates: deterministic.candidates
  });
  const byStrong = new Map(batch.candidates.map((item) => [item.strong, item]));
  const mockResponse: SemanticRefillLlmResponse = {
    decisions: [
      {
        id: byStrong.get("H7549")!.id,
        ref: "Gen.1.20",
        decision: "phrase",
        strong: ["H7549"],
        confidence: 0.93,
        reason: "normalisation volontairement fausse.",
        wordIndex: null,
        normalized: null,
        startWordIndex: 24,
        endWordIndex: 25,
        normalizedPhrase: ["voute", "mer"],
        evidence: []
      },
      {
        id: byStrong.get("H8317")!.id,
        ref: "Gen.1.20",
        decision: "word",
        strong: ["H8317"],
        confidence: 0.95,
        reason: "doublon deja present sur le mot.",
        wordIndex: 5,
        normalized: "grouillent",
        startWordIndex: null,
        endWordIndex: null,
        normalizedPhrase: null,
        evidence: []
      }
    ]
  };

  const result = await runSemanticRefillLlm({
    bible: "nbs",
    scope: "Gen.1.20",
    verses,
    candidates: deterministic.candidates,
    mode: "mock",
    mockResponse
  });

  assert.deepEqual(result.rejected.map((decision) => decision.reason).sort(), [
    "duplicate-reader-word-strong",
    "phrase-normalization-mismatch"
  ]);
  assert.equal(
    result.batch.candidates
      .find((candidate) => candidate.strong === "H8317")
      ?.existingReaderStrong.some(
        (annotation) => annotation.strong === "H8317"
      ),
    true
  );
  assert.equal(
    result.batch.candidates
      .find((candidate) => candidate.strong === "H8317")
      ?.occupiedTargets.some((target) => target.strong.includes("H8317")),
    true
  );
  assert.equal(result.validated.length, 0);
});

test("semantic refill LLM keeps suspicious stacking pending", async () => {
  const verses = [genesisThreeSixWithOccupiedDesirable()];
  const deterministic = buildSemanticRefill({
    bible: "nbs",
    scope: "Gen.3.6",
    verses
  });
  const batch = buildSemanticRefillLlmBatch({
    bible: "nbs",
    scope: "Gen.3.6",
    candidates: deterministic.candidates,
    verses
  });
  const candidate = batch.candidates.find((item) => item.strong === "H8378")!;
  const mockResponse: SemanticRefillLlmResponse = {
    decisions: [
      {
        id: candidate.id,
        ref: "Gen.3.6",
        decision: "word",
        strong: ["H8378"],
        confidence: 0.95,
        reason: "desirable semble lexicalement direct.",
        wordIndex: 4,
        normalized: "desirable",
        startWordIndex: null,
        endWordIndex: null,
        normalizedPhrase: null,
        evidence: ["desirable"]
      }
    ]
  };

  const result = await runSemanticRefillLlm({
    bible: "nbs",
    scope: "Gen.3.6",
    verses,
    candidates: deterministic.candidates,
    mode: "mock",
    mockResponse
  });

  assert.equal(
    candidate.availableTargets.find(
      (target) => target.normalized === "plaisant"
    )?.occupiedStrong.length,
    0
  );
  assert.deepEqual(
    candidate.availableTargets.find(
      (target) => target.normalized === "desirable"
    )?.occupiedStrong,
    ["H2530"]
  );
  assert.equal(
    candidate.blockedTargets.some(
      (target) =>
        target.normalized === "desirable" &&
        target.occupiedStrong.includes("H2530")
    ),
    true
  );
  assert.equal(
    candidate.openContentTargets.some(
      (target) => target.normalized === "plaisant"
    ),
    true
  );
  assert.equal(candidate.sourcePlacement.insertAfterWordIndex, 1);
  assert.equal(candidate.nearbyOpenTargets[0]?.normalized, "plaisant");
  assert.equal(result.validated.length, 0);
  assert.equal(
    result.pending[0]?.reason,
    "suspicious-stacking-on-occupied-word"
  );
});

function genesisOneTwentyWithReaderDuplicate(): StrongLedgerVerse {
  const base = genesisOneTwenty();
  return {
    ...base,
    annotations: [
      annotation({
        strong: "H8317",
        visibility: "reader",
        placement: "word",
        wordIndex: 5,
        normalizedWord: "grouillent"
      }),
      ...base.annotations
    ],
    inventories: {
      ...base.inventories,
      reader: ["H8317"]
    }
  };
}

function genesisThreeSixWithOccupiedDesirable(): StrongLedgerVerse {
  return verse({
    ref: "Gen.3.6",
    text: "bon plaisant desirable discernement",
    tokens: ["bon", "plaisant", "pour", "la", "desirable", "discernement"],
    annotations: [
      annotation({
        strong: "H2530",
        visibility: "reader",
        placement: "word",
        wordIndex: 4,
        normalizedWord: "desirable"
      }),
      annotation({
        strong: "H8378",
        visibility: "advanced",
        placement: "empty",
        insertAfterWordIndex: 1
      })
    ],
    original: ["H2530", "H8378"],
    references: ["H2530", "H8378"]
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
