import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSemanticRefillLlmBatch,
  runSemanticRefillLlm,
  SEMANTIC_REFILL_LLM_JSON_SCHEMA,
  SEMANTIC_REFILL_LLM_SYSTEM_PROMPT,
  type SemanticRefillLlmBatch,
  type SemanticRefillLlmCandidatePacket,
  type SemanticRefillLlmResponse
} from "../src/semanticRefillLlm.js";
import {
  buildSemanticRefill,
  validateSemanticRefillDecision,
  type SemanticRefillDecision
} from "../src/semanticRefill.js";
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
  assert.equal(
    result.request.responseSchema.schema.properties.decisions.minItems,
    result.batch.candidates.length
  );
  assert.equal(
    result.request.responseSchema.schema.properties.decisions.maxItems,
    result.batch.candidates.length
  );
  assert.deepEqual(
    result.request.responseSchema.schema.properties.decisions.items.anyOf.map(
      (branch) => branch.properties.id.enum[0]
    ),
    result.batch.candidates.map((candidate) => candidate.id)
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

test("semantic refill LLM mock validates bounded word and terminal decisions", async () => {
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
      selection(byStrong.get("H8317")!, "word:5", 0.92, [
        "candidate form grouillent"
      ]),
      selection(byStrong.get("H8318")!, "word:8", 0.91, [
        "candidate word betes"
      ]),
      selection(byStrong.get("H8064")!, "pending-human", 0.7),
      selection(byStrong.get("H7549")!, "not-rendered", 0.86)
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
        decision.target === "word" &&
        decision.wordIndex === 8 &&
        decision.normalized === "betes" &&
        decision.strong.includes("H8318")
    ),
    true
  );
  assert.equal(result.pending[0]?.decisionType, "pending-human");
  assert.equal(result.rejected[0]?.reason, "llm-classified-not-rendered");
});

test("semantic refill LLM holds word stacking created by decisions in the same batch", async () => {
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
      selection(byStrong.get("H8317")!, "word:5", 0.92),
      selection(byStrong.get("H8318")!, "word:5", 0.91),
      selection(byStrong.get("H8064")!, "pending-human", 0.7),
      selection(byStrong.get("H7549")!, "not-rendered", 0.86)
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

  assert.equal(result.validated.length, 0);
  assert.deepEqual(
    result.pending
      .filter(
        (decision) =>
          decision.reason === "suspicious-batch-stacking-on-same-word"
      )
      .map((decision) => decision.strong[0])
      .sort(),
    ["H8317", "H8318"]
  );
});

test("semantic refill LLM only accepts bounded choices and rejects reader duplicates", async () => {
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
  const invalidResponse = completeResponse(batch, {
    H7549: { choiceId: "phrase:24-25", confidence: 0.93 }
  });

  await assert.rejects(
    runSemanticRefillLlm({
      bible: "nbs",
      scope: "Gen.1.20",
      verses,
      candidates: deterministic.candidates,
      mode: "mock",
      mockResponse: invalidResponse
    }),
    /unknown-choice-id/
  );

  const mockResponse = completeResponse(batch, {
    H8317: { choiceId: "word:5", confidence: 0.95 }
  });

  const result = await runSemanticRefillLlm({
    bible: "nbs",
    scope: "Gen.1.20",
    verses,
    candidates: deterministic.candidates,
    mode: "mock",
    mockResponse
  });

  assert.equal(
    result.rejected.some(
      (decision) => decision.reason === "duplicate-reader-word-strong"
    ),
    true
  );
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
    decisions: [selection(candidate, "word:4", 0.95, ["desirable"])]
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

test("semantic refill LLM reference-style finalization converts suspicious stacking to empty", async () => {
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
    decisions: [selection(candidate, "word:4", 0.95, ["desirable"])]
  };

  const result = await runSemanticRefillLlm({
    bible: "nbs",
    scope: "Gen.3.6",
    verses,
    candidates: deterministic.candidates,
    mode: "mock",
    mockResponse,
    referenceStyleFinalization: true
  });

  assert.equal(result.pending.length, 0);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.validated.length, 1);
  assert.equal(result.validated[0]?.target, "empty");
  assert.equal(result.validated[0]?.wordIndex, 1);
  assert.equal(result.validated[0]?.normalized, "");
  assert.deepEqual(result.validated[0]?.strong, ["H8378"]);
  assert.equal(result.validated[0]?.confidence, 0.83);
  assert.match(
    result.validated[0]?.reason ?? "",
    /reference-style-empty-fallback:suspicious-stacking-on-occupied-word/
  );
});

test("semantic refill LLM rejects missing candidate decisions instead of fabricating empty", async () => {
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
      selection(byStrong.get("H8317")!, "word:5", 0.92, [
        "candidate form grouillent"
      ])
    ]
  };

  await assert.rejects(
    runSemanticRefillLlm({
      bible: "nbs",
      scope: "Gen.1.20",
      verses,
      candidates: deterministic.candidates,
      mode: "mock",
      mockResponse,
      referenceStyleFinalization: true
    }),
    /decision-count-mismatch/
  );
});

test("semantic refill LLM applies the auto-accept threshold to visible overrides", async () => {
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
  const response = completeResponse(batch, {
    H8378: { choiceId: "word:1", confidence: 0.89 }
  });

  const result = await runSemanticRefillLlm({
    bible: "nbs",
    scope: "Gen.3.6",
    verses,
    candidates: deterministic.candidates,
    mode: "mock",
    mockResponse: response,
    autoAcceptThreshold: 0.9
  });

  assert.equal(result.validated.length, 0);
  assert.equal(result.pending.length, 1);
  assert.equal(
    result.pending[0]?.reason,
    "below-auto-accept-threshold:0.89<0.9"
  );
  assert.equal(result.pending[0]?.override?.wordIndex, 1);
});

test("semantic refill candidate ids do not depend on queue order or position", () => {
  const verses = [genesisOneTwenty()];
  const deterministic = buildSemanticRefill({
    bible: "nbs",
    scope: "Gen.1.20",
    verses
  });
  const full = buildSemanticRefillLlmBatch({
    bible: "nbs",
    scope: "Gen.1.20",
    candidates: deterministic.candidates
  });
  const selectedAudit = deterministic.candidates.find(
    (candidate) => candidate.strong === "H8064"
  )!;
  const isolated = buildSemanticRefillLlmBatch({
    bible: "nbs",
    scope: "Gen.1.20",
    candidates: [selectedAudit]
  });

  assert.equal(
    full.candidates.find((candidate) => candidate.strong === "H8064")?.id,
    isolated.candidates[0]?.id
  );
});

test("relocation fails closed when its source coordinate is not unique", () => {
  const base = genesisOneTwentyWithReaderDuplicate();
  const verseWithDuplicateSource: StrongLedgerVerse = {
    ...base,
    annotations: [
      ...base.annotations,
      annotation({
        strong: "H8317",
        visibility: "reader",
        placement: "word",
        wordIndex: 5,
        normalizedWord: "grouillent"
      })
    ]
  };
  const decision: SemanticRefillDecision = {
    bible: "nbs",
    ref: base.ref,
    target: "word",
    replace: { target: "word", wordIndex: 5 },
    wordIndex: 8,
    normalized: "betes",
    strong: ["H8317"],
    confidence: 0.91,
    source: "semantic-refill:llm",
    reason: "test",
    status: "accept",
    score: 0.91,
    priority: "semantic-high",
    evidence: []
  };

  assert.deepEqual(
    validateSemanticRefillDecision({
      verse: verseWithDuplicateSource,
      decision
    }),
    { status: "rejected", reason: "relocation-source-not-unique:2" }
  );
  assert.deepEqual(
    validateSemanticRefillDecision({
      verse: {
        ...verseWithDuplicateSource,
        annotations: verseWithDuplicateSource.annotations.filter(
          (item, index) => item.strong !== "H8317" || index === 0
        )
      },
      decision
    }),
    { status: "validated" }
  );
});

function selection(
  candidate: SemanticRefillLlmCandidatePacket,
  choiceId: string,
  confidence: number,
  evidence: string[] = []
): SemanticRefillLlmResponse["decisions"][number] {
  return {
    id: candidate.id,
    choiceId,
    confidence,
    reason: `test selection ${choiceId}`,
    evidence
  };
}

function completeResponse(
  batch: SemanticRefillLlmBatch,
  byStrong: Record<
    string,
    { choiceId: string; confidence: number; evidence?: string[] }
  >
): SemanticRefillLlmResponse {
  return {
    decisions: batch.candidates.map((candidate) => {
      const requested = byStrong[candidate.strong];
      return selection(
        candidate,
        requested?.choiceId ?? "reject",
        requested?.confidence ?? 0.99,
        requested?.evidence
      );
    })
  };
}

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
