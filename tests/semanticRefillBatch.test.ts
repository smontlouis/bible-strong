import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  adaptiveSecondModelMode,
  assertBatchSucceeded,
  assertDistinctBatchModels,
  assertValidBatchLimits,
  batchOutputFileName,
  buildAdaptiveMergedReview,
  buildTasks,
  consensusEligibleCandidateIds,
  deriveAdaptiveSecondModelPacket,
  durableDecisionReplayRequired,
  hasConsensusEligibleVisible,
  lexicalItemIdentity,
  modelArtifactSlug,
  readExistingManifest,
  reviewFileIsUsableForPacket,
  runBatchStartupRecovery,
  selectTaskLexicalItems
} from "../src/runSemanticRefillGapReviewBatch.js";
import {
  collapseSameTokenStepIdentities,
  confidenceForSemanticCandidate,
  isInternalPlacementReviewEligibleAnnotation,
  matchesCandidateClass,
  recomputeLexicalCandidateOccupation,
  resolveStepOccurrenceAnnotation,
  slicePacketItems,
  uniqueByBestTarget
} from "../src/semanticRefillLexicalPacket.js";
import type { StrongLedgerVerse } from "../src/strongLedger.js";

test("splits a chapter larger than the packet limit without truncating it", () => {
  const items = Array.from({ length: 65 }, (_, index) => ({
    ref: `Gen.1.${index + 1}`,
    strong: `H${String(index + 1).padStart(4, "0")}`,
    auditKind: "empty" as const,
    candidates: [
      { target: "word" as const, confidence: "high" as const, occupied: false }
    ]
  }));
  const tasks = buildTasks({ bible: "nbs", items }, {
    maxItemsPerTask: 30,
    minConfidence: "high"
  } as never);

  assert.deepEqual(
    tasks.map(({ scope, offset, itemCount }) => ({ scope, offset, itemCount })),
    [
      { scope: "Gen.1", offset: 0, itemCount: 30 },
      { scope: "Gen.1", offset: 0, itemCount: 30 },
      { scope: "Gen.1", offset: 0, itemCount: 5 }
    ]
  );
  assert.equal(new Set(tasks.map((task) => task.id)).size, 3);
  assert.deepEqual(
    tasks.map((task) => task.itemIds.length),
    [30, 30, 5]
  );
});

test("stable task membership cannot skip candidates when an earlier page disappears", () => {
  const items = Array.from({ length: 65 }, (_, index) => ({
    annotationId: `Gen.1.${index + 1}:0:H${String(index + 1).padStart(4, "0")}`,
    ref: `Gen.1.${index + 1}`,
    strong: `H${String(index + 1).padStart(4, "0")}`,
    auditKind: "empty" as const,
    candidates: [
      { target: "word" as const, confidence: "high" as const, occupied: false }
    ]
  }));
  const report = { bible: "nbs", items };
  const tasks = buildTasks(report, {
    maxItemsPerTask: 30,
    minConfidence: "high"
  } as never);
  const afterFirstPageWasResolved = {
    ...report,
    items: items.slice(30)
  };

  assert.deepEqual(
    selectTaskLexicalItems(afterFirstPageWasResolved, tasks[1]).map(
      lexicalItemIdentity
    ),
    tasks[1].itemIds
  );
  assert.equal(
    selectTaskLexicalItems(afterFirstPageWasResolved, tasks[1]).length,
    30
  );
});

test("applies packet offset after deterministic ranking", () => {
  assert.deepEqual(slicePacketItems([0, 1, 2, 3, 4], 2, 2), [2, 3]);
});

test("keeps distinct Strong candidates that share one best carrier", () => {
  const item = (strong: string) => ({
    ref: "Gen.1.1",
    strong,
    candidates: [
      {
        target: "word" as const,
        strong,
        wordIndex: 2,
        normalizedWord: "terre",
        score: 0.9,
        evidence: []
      }
    ]
  });
  const items = [item("H0001"), item("H0002"), item("H0001")];

  assert.deepEqual(
    uniqueByBestTarget(items as never).map((candidate) => candidate.strong),
    ["H0001", "H0002"]
  );
});

test("collapses STEP aliases from one original token into one carrier question", () => {
  const item = (strong: string, witnesses: string[]) => ({
    ref: "Acts.16.16",
    strong,
    annotation: {
      originalTokenId: "TAGNT.Acts.16.16.13.N(k)O.main",
      originalOccurrenceId: `TAGNT.Acts.16.16.13.N(k)O.main:${strong}`,
      sourceStrong: "G5221",
      step: [
        {
          classicalStrong: strong,
          dStrong: "G5221"
        }
      ]
    },
    referenceInventory: {
      Sg1910: witnesses,
      Darby: witnesses,
      DarbyR: witnesses
    },
    candidates: [
      {
        target: "word" as const,
        strong,
        wordIndex: 29,
        normalizedWord: "rencontra",
        score: 1,
        evidence: []
      }
    ]
  });

  const normalized = collapseSameTokenStepIdentities([
    item("G5221", []),
    item("G0528", ["G0528"])
  ] as never);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].strong, "G0528");
  assert.deepEqual(normalized[0].stepIdentity, {
    originalTokenId: "TAGNT.Acts.16.16.13.N(k)O.main",
    primaryStrong: "G0528",
    associatedStrong: ["G5221"],
    originalOccurrenceIds: [
      "TAGNT.Acts.16.16.13.N(k)O.main:G0528",
      "TAGNT.Acts.16.16.13.N(k)O.main:G5221"
    ],
    classicalStrong: ["G0528", "G5221"],
    eStrong: [],
    dStrong: ["G5221"],
    uStrong: [],
    sourceStrong: ["G5221"]
  });
});

test("keeps real repeated Strong occurrences with distinct original tokens", () => {
  const item = (originalTokenId: string) => ({
    ref: "Acts.1.1",
    strong: "G3165",
    annotation: { originalTokenId },
    candidates: [
      {
        target: "word" as const,
        strong: "G3165",
        wordIndex: 2,
        normalizedWord: "moi",
        score: 1,
        evidence: []
      }
    ]
  });

  assert.equal(
    uniqueByBestTarget([
      item("TAGNT.Acts.1.1.4"),
      item("TAGNT.Acts.1.1.14")
    ] as never).length,
    2
  );
});

test("preserves case-sensitive STEP suffixes in grouped metadata", () => {
  const item = (strong: string) => ({
    ref: "1Chr.1.1",
    strong,
    annotation: {
      originalTokenId: "TAHOT.1Chr.1.1.1",
      step: [
        { classicalStrong: strong, dStrong: "H2148V" },
        { classicalStrong: strong, dStrong: "H2148v" }
      ]
    },
    referenceInventory: {},
    candidates: [
      {
        target: "word" as const,
        strong,
        wordIndex: 0,
        normalizedWord: "mot",
        score: 1,
        evidence: []
      }
    ]
  });

  const [normalized] = collapseSameTokenStepIdentities([
    item("H2148"),
    item("H2149")
  ] as never);
  assert.deepEqual(normalized.stepIdentity?.dStrong, ["H2148V", "H2148v"]);
});

test("exposes STEP occurrence metadata even without an alias sibling", () => {
  const [normalized] = collapseSameTokenStepIdentities([
    {
      ref: "Acts.1.1",
      strong: "G0976",
      annotation: {
        originalTokenId: "TAGNT.Acts.1.1.1",
        originalOccurrenceId: "TAGNT.Acts.1.1.1:0",
        sourceStrong: "G0976",
        step: [{ classicalStrong: "G0976", dStrong: "G0976" }]
      },
      referenceInventory: {},
      candidates: []
    }
  ] as never);

  assert.equal(normalized.stepIdentity?.originalTokenId, "TAGNT.Acts.1.1.1");
  assert.deepEqual(normalized.stepIdentity?.dStrong, ["G0976"]);
  assert.deepEqual(normalized.stepIdentity?.associatedStrong, []);
});

test("resolves visible relocation STEP metadata through the exact occurrence id", () => {
  const visible = {
    id: "1Kgs.22.47:1:H7604",
    strong: "H7604",
    originalOccurrenceId: "TAHOT.1Kgs.22.47.4.L.alt:0"
  };
  const original = {
    id: "1Kgs.22.47:10:H7604",
    strong: "H7604",
    originalTokenId: "TAHOT.1Kgs.22.47.4.L.alt",
    originalOccurrenceId: "TAHOT.1Kgs.22.47.4.L.alt:0",
    step: [{ classicalStrong: "H7604", dStrong: "H7604" }]
  };
  const unrelated = {
    id: "1Kgs.22.47:11:H7604",
    strong: "H7604",
    originalTokenId: "TAHOT.1Kgs.22.47.9.L.alt",
    originalOccurrenceId: "TAHOT.1Kgs.22.47.9.L.alt:0",
    step: [{ classicalStrong: "H7604", dStrong: "H7604" }]
  };

  assert.equal(
    resolveStepOccurrenceAnnotation(
      { annotations: [visible, unrelated, original] } as never,
      visible as never
    )?.originalTokenId,
    "TAHOT.1Kgs.22.47.4.L.alt"
  );
});

test("derives priority confidence from the exact selected target, not an equal score", () => {
  const lexical = [
    {
      target: "word",
      wordIndex: 4,
      normalized: "est",
      score: 0.7315,
      confidence: "medium"
    },
    {
      target: "word",
      wordIndex: 10,
      normalized: "sera",
      score: 0.7315,
      confidence: "high"
    }
  ];

  assert.equal(
    confidenceForSemanticCandidate(
      lexical as never,
      {
        target: "word",
        strong: "G3361",
        wordIndex: 10,
        normalizedWord: "sera",
        score: 0.7315,
        evidence: []
      },
      "medium"
    ),
    "high"
  );
});

test("selects ambiguous and direct high candidate classes deterministically", () => {
  const item = {
    candidates: [
      { confidence: "high", occupied: false },
      { confidence: "high", occupied: true },
      { confidence: "medium", occupied: false }
    ]
  };
  assert.equal(matchesCandidateClass(item as never, "open-high"), true);
  assert.equal(matchesCandidateClass(item as never, "ambiguous-high"), true);
  assert.equal(matchesCandidateClass(item as never, "direct-high"), false);

  const direct = {
    candidates: [{ confidence: "high", occupied: false }]
  };
  assert.equal(matchesCandidateClass(direct as never, "direct-high"), true);
  assert.equal(matchesCandidateClass(direct as never, "ambiguous-high"), false);
});

test("selects relocation candidates only when an open carrier is materially better", () => {
  const better = {
    auditKind: "relocation",
    currentTarget: { wordIndex: 2 },
    candidates: [
      { wordIndex: 2, score: 0.4, occupied: true },
      { wordIndex: 5, score: 0.52, occupied: false }
    ]
  };
  assert.equal(
    matchesCandidateClass(better as never, "relocation-better-open"),
    true
  );

  const insufficientMargin = {
    ...better,
    candidates: [
      { wordIndex: 2, score: 0.4, occupied: true },
      { wordIndex: 5, score: 0.5199, occupied: false }
    ]
  };
  assert.equal(
    matchesCandidateClass(
      insufficientMargin as never,
      "relocation-better-open"
    ),
    false
  );
});

test("excludes reference-only and not-rendered annotations from internal placement review", () => {
  assert.equal(
    isInternalPlacementReviewEligibleAnnotation({
      source: "reference-only",
      placement: "not-rendered"
    } as never),
    false
  );
  assert.equal(
    isInternalPlacementReviewEligibleAnnotation({
      source: "original-complete",
      placement: "not-rendered"
    } as never),
    false
  );
  assert.equal(
    isInternalPlacementReviewEligibleAnnotation({
      source: "original-complete",
      placement: "empty"
    } as never),
    true
  );
});

test("calls the second model only when the first can still reach visible consensus", () => {
  assert.equal(
    hasConsensusEligibleVisible(
      [
        { target: "empty", confidence: 0.99 },
        { target: "word", confidence: 0.8 }
      ],
      0.84
    ),
    false
  );
  assert.equal(
    hasConsensusEligibleVisible([{ target: "phrase", confidence: 0.9 }], 0.84),
    true
  );
});

test("screens the second model per validated visible candidate", () => {
  const packet = adaptivePacketFixture();
  const review = {
    decisions: [
      adaptiveDecision("candidate-word", "word:1", "word", 0.92, {
        wordIndex: 1,
        normalized: "terre"
      }),
      adaptiveDecision("candidate-phrase", "phrase:2-3", "phrase", 0.9, {
        wordIndex: null,
        normalized: null,
        startWordIndex: 2,
        endWordIndex: 3,
        normalizedPhrase: ["sans", "forme"]
      }),
      adaptiveDecision("candidate-held", "word:4", "word", 0.96, {
        wordIndex: 4,
        normalized: "vide"
      })
    ]
  };
  const accepted = [
    {
      ref: "Gen.1.1",
      strong: ["H0001"],
      confidence: 0.92,
      target: "word",
      wordIndex: 1,
      normalized: "terre"
    },
    {
      ref: "Gen.1.2",
      strong: ["H0002"],
      confidence: 0.9,
      target: "phrase",
      startWordIndex: 2,
      endWordIndex: 3,
      normalizedPhrase: ["sans", "forme"]
    }
  ];

  assert.deepEqual(
    consensusEligibleCandidateIds({
      packet,
      review,
      accepted,
      minConfidence: 0.84
    }),
    ["candidate-word", "candidate-phrase"]
  );
  assert.equal(adaptiveSecondModelMode(0, 3), "screen");
  assert.equal(adaptiveSecondModelMode(2, 3), "subset");
  assert.equal(adaptiveSecondModelMode(3, 3), "full");
});

test("derives a compact second-model packet with only eligible context", () => {
  const packet = adaptivePacketFixture();
  const derived = deriveAdaptiveSecondModelPacket(packet, ["candidate-phrase"]);

  assert.deepEqual(
    derived.candidates.map((candidate) => candidate.id),
    ["candidate-phrase"]
  );
  assert.deepEqual(
    derived.verses?.map((verse) => verse.ref),
    ["Gen.1.2"]
  );
  assert.equal(derived.summary?.selectedItems, 1);
  assert.equal(derived.summary?.candidates, 1);
  assert.equal(derived.summary?.verses, 1);
  assert.deepEqual(derived.summary?.topStrong, [["H0002", 1]]);
  assert.equal(derived.promptPolicy, "strict-policy");
});

test("merges a subset model review into the exact original packet contract", () => {
  const packet = adaptivePacketFixture();
  const subsetDecision = adaptiveDecision(
    "candidate-phrase",
    "phrase:2-3",
    "phrase",
    0.88,
    {
      wordIndex: null,
      normalized: null,
      startWordIndex: 2,
      endWordIndex: 3,
      normalizedPhrase: ["sans", "forme"]
    }
  );
  const merged = buildAdaptiveMergedReview({
    packet,
    packetPath: "/tmp/original-packet.json",
    model: "provider/model-b",
    eligibleCandidateIds: ["candidate-phrase"],
    subsetReview: {
      generatedAt: "2026-07-10T00:00:00.000Z",
      sourcePacket: "/tmp/subset-packet.json",
      model: "provider/model-b",
      contract: {
        version: 2,
        schemaName: "semantic_refill_llm_decisions",
        candidateCount: 1
      },
      usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
      decisions: [subsetDecision]
    },
    minConfidence: 0.84
  });

  assert.equal(merged.sourcePacket, "/tmp/original-packet.json");
  assert.equal(merged.model, "provider/model-b");
  assert.deepEqual(merged.contract, {
    version: 2,
    schemaName: "semantic_refill_llm_decisions",
    candidateCount: 3
  });
  assert.deepEqual(
    merged.decisions?.map((decision) => [
      decision.id,
      decision.choiceId,
      decision.decision
    ]),
    [
      ["candidate-word", "reject", "reject"],
      ["candidate-phrase", "phrase:2-3", "phrase"],
      ["candidate-held", "reject", "reject"]
    ]
  );
  assert.deepEqual(merged.usage, {
    promptTokens: 100,
    completionTokens: 20,
    totalTokens: 120
  });
  assert.equal(
    (JSON.parse(merged.rawContent ?? "{}") as { decisions?: unknown[] })
      .decisions?.length,
    3
  );
});

test("accepts an LLM output only for the exact packet, model, ids and choices", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "strong-batch-review-")
  );
  const packetPath = path.join(directory, "packet.json");
  const reviewPath = path.join(directory, "review.json");
  const packet = {
    bible: "nbs",
    scope: "Gen.1.1",
    candidates: [
      {
        id: "candidate-1",
        ref: "Gen.1.1",
        strong: "H0001",
        choices: [
          { id: "word:0", decision: "word" },
          { id: "reject", decision: "reject" }
        ]
      }
    ]
  };
  const review = {
    sourcePacket: packetPath,
    model: "model-a",
    contract: { version: 2, candidateCount: 1 },
    decisions: [
      {
        id: "candidate-1",
        choiceId: "word:0",
        ref: "Gen.1.1",
        strong: ["H0001"]
      }
    ]
  };
  await writeFile(packetPath, JSON.stringify(packet), "utf8");
  await writeFile(reviewPath, JSON.stringify(review), "utf8");

  assert.equal(
    reviewFileIsUsableForPacket(reviewPath, packetPath, "model-a"),
    true
  );
  assert.equal(
    reviewFileIsUsableForPacket(reviewPath, packetPath, "model-b"),
    false
  );
  await writeFile(
    reviewPath,
    JSON.stringify({
      ...review,
      decisions: [{ ...review.decisions[0], choiceId: "word:999" }]
    }),
    "utf8"
  );
  assert.equal(
    reviewFileIsUsableForPacket(reviewPath, packetPath, "model-a"),
    false
  );
});

test("ignores an interrupted or corrupt resume manifest", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "strong-batch-manifest-")
  );
  await writeFile(path.join(directory, "manifest.json"), '{"tasks":', "utf8");
  assert.equal(readExistingManifest(directory), undefined);
});

test("replays durable decisions when resume state is absent or changed", () => {
  const current = {
    skipExisting: true,
    currentRunFingerprint: "run-current",
    currentStateFingerprint: "state-current"
  };
  assert.equal(durableDecisionReplayRequired(current), true);
  assert.equal(
    durableDecisionReplayRequired({
      ...current,
      manifestRunFingerprint: "run-current",
      manifestStateFingerprint: "state-old"
    }),
    true
  );
  assert.equal(
    durableDecisionReplayRequired({
      ...current,
      manifestRunFingerprint: "run-current",
      manifestStateFingerprint: "state-current"
    }),
    false
  );
});

test("recovers an interrupted review transaction while holding the startup lock", async () => {
  const events: string[] = [];
  const result = await runBatchStartupRecovery({
    withLock: async (operation) => {
      events.push("lock-acquired");
      const recovery = await operation();
      events.push("lock-released");
      return recovery;
    },
    recover: async () => {
      events.push("recovered-before-read");
      return "rolled-back";
    }
  });

  assert.equal(result, "rolled-back");
  assert.deepEqual(events, [
    "lock-acquired",
    "recovered-before-read",
    "lock-released"
  ]);
});

test("rejects zero or negative batch loop and timeout limits", () => {
  const valid = {
    maxItemsPerTask: 30,
    taskBatchSize: 3,
    llmAttempts: 2,
    timeoutMs: 120_000
  };
  assert.doesNotThrow(() => assertValidBatchLimits(valid));
  for (const name of Object.keys(valid) as Array<keyof typeof valid>) {
    for (const value of [0, -1]) {
      assert.throws(
        () => assertValidBatchLimits({ ...valid, [name]: value }),
        new RegExp(`invalid-positive-integer:${name}:${value}`, "u")
      );
    }
  }
});

test("requires two distinct normalized model identities", () => {
  assert.doesNotThrow(() =>
    assertDistinctBatchModels("openai/model-a", "openai/model-b")
  );
  assert.throws(
    () => assertDistinctBatchModels(" OpenAI/Model-A ", "openai/model-a"),
    /consensus-requires-distinct-models/u
  );
});

test("adds an identity hash to model artifact slugs", () => {
  assert.notEqual(modelArtifactSlug("a/b"), modelArtifactSlug("a-b"));
  assert.match(modelArtifactSlug("a/b"), /^a-b-[0-9a-f]{10}$/u);
});

test("uses a separate plan artifact and fails a completed run with failed tasks", () => {
  assert.equal(batchOutputFileName(true), "plan.json");
  assert.equal(batchOutputFileName(false), "manifest.json");
  assert.throws(
    () =>
      assertBatchSucceeded({
        outputRoot: "/tmp/review",
        totals: { failed: 1 },
        tasks: [{ id: "Gen-0-a", status: "failed" }]
      }),
    /semantic-refill-batch-failed:1.*manifest\.json/u
  );
  assert.doesNotThrow(() =>
    assertBatchSucceeded({
      outputRoot: "/tmp/review",
      totals: { failed: 0 },
      tasks: []
    })
  );
});

test("recomputes stale lexical occupation from the current ledger", () => {
  const verse = {
    annotations: [
      {
        strong: "H0002",
        visibility: "reader",
        placement: "phrase",
        startWordIndex: 2,
        endWordIndex: 4
      }
    ]
  } as StrongLedgerVerse;
  const staleOpen = {
    target: "word" as const,
    strong: "H0001",
    score: 0.9,
    confidence: "high" as const,
    occupied: false,
    wordIndex: 3,
    normalized: "porte",
    evidence: []
  };
  const staleOccupied = { ...staleOpen, wordIndex: 7, occupied: true };

  assert.equal(
    recomputeLexicalCandidateOccupation(staleOpen, verse).occupied,
    true
  );
  assert.equal(
    recomputeLexicalCandidateOccupation(staleOccupied, verse).occupied,
    false
  );
});

function adaptivePacketFixture() {
  return {
    bible: "nbs",
    scope: "Gen.1",
    promptPolicy: "strict-policy",
    summary: { selectedItems: 3, candidates: 3, verses: 3 },
    verses: [
      { ref: "Gen.1.1", text: "terre" },
      { ref: "Gen.1.2", text: "sans forme" },
      { ref: "Gen.1.3", text: "vide" }
    ],
    candidates: [
      {
        id: "candidate-word",
        ref: "Gen.1.1",
        strong: "H0001",
        choices: [
          { id: "word:1", decision: "word" },
          { id: "reject", decision: "reject" }
        ]
      },
      {
        id: "candidate-phrase",
        ref: "Gen.1.2",
        strong: "H0002",
        choices: [
          { id: "phrase:2-3", decision: "phrase" },
          { id: "reject", decision: "reject" }
        ]
      },
      {
        id: "candidate-held",
        ref: "Gen.1.3",
        strong: "H0003",
        choices: [
          { id: "word:4", decision: "word" },
          { id: "reject", decision: "reject" }
        ]
      }
    ]
  };
}

function adaptiveDecision(
  id: string,
  choiceId: string,
  decision: string,
  confidence: number,
  target: {
    wordIndex?: number | null;
    normalized?: string | null;
    startWordIndex?: number | null;
    endWordIndex?: number | null;
    normalizedPhrase?: string[] | null;
  }
) {
  const candidate = adaptivePacketFixture().candidates.find(
    (item) => item.id === id
  );
  if (!candidate) throw new Error(`missing-test-candidate:${id}`);
  return {
    id,
    choiceId,
    ref: candidate.ref,
    decision,
    strong: [candidate.strong],
    confidence,
    reason: "test",
    wordIndex: target.wordIndex ?? null,
    normalized: target.normalized ?? null,
    startWordIndex: target.startWordIndex ?? null,
    endWordIndex: target.endWordIndex ?? null,
    normalizedPhrase: target.normalizedPhrase ?? null,
    evidence: ["test"]
  };
}
