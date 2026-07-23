import assert from "node:assert/strict";
import test from "node:test";

import {
  arbiterFallback,
  mergeBatchValuesInInputOrder,
  overlayJsonlByEntryKey,
  parseFrenchCoreTargetedArgs,
  recoverFailedBatchAsSingletons,
  reconstructBaselineDraft,
  reviewerFallback,
  salvageStructurallyReadableBatch,
  translatorFallback
} from "../scripts/runLexiconV3FrenchCoreTargetedRevision.js";
import {
  FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION,
  FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
  FRENCH_ADAPTIVE_TASK_SCHEMA_VERSION,
  applyFrenchAdaptiveReview,
  buildFrenchAdaptiveFinalRecord,
  frenchAdaptiveTranslationHash,
  validateFrenchAdaptiveDraft,
  type FrenchAdaptiveDraft,
  type FrenchAdaptiveReview,
  type FrenchAdaptiveTask
} from "../src/lexiconV3/frenchAdaptivePipeline.js";
import { buildFrenchHtmlTemplate } from "../src/lexiconV3/frenchHtmlRenderer.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";

test("keeps every non-selected JSONL line byte-identical", () => {
  const baseline = [
    {
      raw: '{ "entryKey": "greek:G0001", "kept": true }',
      value: { entryKey: "greek:G0001" }
    },
    {
      raw: '{"entryKey":"greek:G0002","old":true}',
      value: { entryKey: "greek:G0002" }
    },
    {
      raw: '\t{"entryKey":"hebrew:H0001","kept":true}',
      value: { entryKey: "hebrew:H0001" }
    }
  ];
  const output = overlayJsonlByEntryKey(
    baseline,
    new Map([["greek:G0002", '{"entryKey":"greek:G0002","new":true}']])
  );
  assert.equal(
    output,
    '{ "entryKey": "greek:G0001", "kept": true }\n' +
      '{"entryKey":"greek:G0002","new":true}\n' +
      '\t{"entryKey":"hebrew:H0001","kept":true}\n'
  );
  assert.throws(
    () =>
      overlayJsonlByEntryKey(
        baseline,
        new Map([["greek:G9999", '{"entryKey":"greek:G9999"}']])
      ),
    /overlay-coverage/u
  );
});

test("reconstructs the exact baseline final draft and rejects drift", () => {
  const task = fixtureTask();
  const translation = fixtureDraft();
  const review: FrenchAdaptiveReview = {
    schemaVersion: FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
    entryKey: task.entryKey,
    sourceHash: task.sourceHash,
    translationHash: frenchAdaptiveTranslationHash(translation),
    verdict: "correct",
    reasons: ["Formulation plus naturelle."],
    patch: {
      gloss: { apply: false, value: "" },
      segmentUpdates: [{ id: "t1", text: " de H0001 dans Gen.1:1" }],
      entityMentions: { apply: false, value: [] },
      confidence: { apply: true, value: 0.97 }
    }
  };
  const reviewed = applyFrenchAdaptiveReview(task, translation, review);
  const final = buildFrenchAdaptiveFinalRecord({
    task,
    translation,
    review,
    reviewedDraft: reviewed,
    arbitration: null,
    model: "fixture-reviewer"
  });
  assert.deepEqual(
    reconstructBaselineDraft({
      task,
      final,
      translation,
      review,
      arbitration: null
    }),
    reviewed
  );

  const drifted = { ...final, finalHash: "f".repeat(64) };
  assert.throws(
    () =>
      reconstructBaselineDraft({
        task,
        final: drifted,
        translation,
        review,
        arbitration: null
      }),
    /baseline-drift/u
  );
});

test("uses strict targeted-run arguments and safe internal defaults", () => {
  const options = parseFrenchCoreTargetedArgs([]);
  assert.match(options.tasksPath, /triage\/core\/tasks[.]jsonl$/u);
  assert.match(options.outputRoot, /revision\/core$/u);
  assert.equal(options.limit, null);
  assert.equal(options.translatorModel, "gpt-5.6-sol");
  assert.equal(options.reviewerModel, "gpt-5.6-terra");
  assert.throws(
    () => parseFrenchCoreTargetedArgs(["--unknown", "x"]),
    /unknown-option/u
  );
  assert.throws(
    () => parseFrenchCoreTargetedArgs(["--limit", "0"]),
    /invalid-integer/u
  );
});

test("isolates only the exhausted batch and falls back per persistently invalid entry", async () => {
  const executed: string[][] = [];
  const batch = {
    id: "translator-short-00007",
    items: [
      { key: "greek:G0001" },
      { key: "greek:G0002" },
      { key: "greek:G0003" }
    ],
    inputHash: "a".repeat(64)
  };
  const recovered = await recoverFailedBatchAsSingletons({
    batch,
    parentError: new Error("invalid combined response"),
    key: (item) => item.key,
    execute: async (isolated) => {
      executed.push(isolated.items.map((item) => item.key));
      const key = isolated.items[0]!.key;
      if (key === "greek:G0002") throw new Error("invalid unit response");
      return {
        values: [{ entryKey: key, decision: "agent" }],
        responseHash: `agent-${key}`
      };
    },
    fallback: (item) => ({
      value: { entryKey: item.key, decision: "baseline" },
      candidate: "baseline"
    })
  });

  assert.deepEqual(executed, [
    ["greek:G0001"],
    ["greek:G0002"],
    ["greek:G0003"]
  ]);
  assert.deepEqual(
    recovered.map((item) => [item.value.entryKey, item.value.decision]),
    [
      ["greek:G0001", "agent"],
      ["greek:G0002", "baseline"],
      ["greek:G0003", "agent"]
    ]
  );
  assert.equal(recovered[0]!.recovery.mode, "isolated-retry");
  assert.equal(recovered[1]!.recovery.mode, "deterministic-fallback");
  assert.equal(recovered[1]!.recovery.fallbackCandidate, "baseline");
  assert.equal(recovered[1]!.recovery.parentBatchId, batch.id);
  assert.match(recovered[1]!.recovery.isolatedError ?? "", /invalid unit/u);
  assert.equal(
    new Set(recovered.map((item) => item.recovery.isolatedBatchId)).size,
    3
  );
});

test("salvages valid batch items and leaves only invalid, duplicate, or missing items unresolved", () => {
  const items = [
    { key: "greek:G0001" },
    { key: "greek:G0002" },
    { key: "greek:G0003" },
    { key: "greek:G0004" }
  ];
  const salvaged = salvageStructurallyReadableBatch({
    raw: {
      revisions: [
        { entryKey: "greek:G0003", valid: true },
        { entryKey: "greek:G0001", valid: true },
        { entryKey: "greek:G0002", valid: false },
        { entryKey: "greek:G0003", valid: true },
        { entryKey: "greek:G9999", valid: true }
      ]
    },
    items,
    key: (item) => item.key,
    rootKey: "revisions",
    parse: (raw, selected) => {
      const revisions = (raw as { revisions: unknown[] }).revisions;
      const value = revisions[0] as { entryKey: string; valid: boolean };
      if (!value.valid || value.entryKey !== selected[0]!.key) {
        throw new Error("invalid item");
      }
      return [{ entryKey: value.entryKey, decision: "agent" }];
    }
  });

  assert.deepEqual(salvaged.values, [
    { entryKey: "greek:G0001", decision: "agent" }
  ]);
  assert.deepEqual(salvaged.unresolvedKeys, [
    "greek:G0002",
    "greek:G0003",
    "greek:G0004"
  ]);
});

test("retries only unresolved keys at their stable parent positions and merges in input order", async () => {
  const batch = {
    id: "translator-short-00007",
    items: [
      { key: "greek:G0001" },
      { key: "greek:G0002" },
      { key: "greek:G0003" }
    ],
    inputHash: "c".repeat(64)
  };
  const executed: string[] = [];
  const recovered = await recoverFailedBatchAsSingletons({
    batch,
    parentError: new Error("partial parse"),
    onlyKeys: new Set(["greek:G0002"]),
    key: (item) => item.key,
    execute: async (isolated) => {
      executed.push(isolated.id);
      return {
        values: [{ entryKey: isolated.items[0]!.key, decision: "retry" }],
        responseHash: "retry-hash"
      };
    },
    fallback: (item) => ({
      value: { entryKey: item.key, decision: "fallback" },
      candidate: "baseline"
    })
  });

  assert.equal(executed.length, 1);
  assert.match(executed[0]!, /--isolated-002-/u);
  assert.deepEqual(
    mergeBatchValuesInInputOrder({
      batch,
      key: (item) => item.key,
      values: [
        { entryKey: "greek:G0003", decision: "salvaged" },
        recovered[0]!.value,
        { entryKey: "greek:G0001", decision: "salvaged" }
      ]
    }).map((value) => [value.entryKey, value.decision]),
    [
      ["greek:G0001", "salvaged"],
      ["greek:G0002", "retry"],
      ["greek:G0003", "salvaged"]
    ]
  );
  assert.throws(
    () =>
      mergeBatchValuesInInputOrder({
        batch,
        key: (item) => item.key,
        values: [
          { entryKey: "greek:G0001" },
          { entryKey: "greek:G0002" },
          { entryKey: "greek:G0003" },
          { entryKey: "greek:G9999" }
        ]
      }),
    /merged-extra/u
  );
});

test("fails closed when no deterministic valid singleton fallback exists", async () => {
  await assert.rejects(
    recoverFailedBatchAsSingletons({
      batch: {
        id: "arbiter-very_long-00001",
        items: [{ key: "hebrew:H9999" }],
        inputHash: "b".repeat(64)
      },
      parentError: new Error("invalid arbitration"),
      key: (item) => item.key,
      execute: async () => {
        throw new Error("invalid unit arbitration");
      },
      fallback: () => {
        throw new Error("french-core-targeted-no-valid-fallback");
      }
    }),
    /no-valid-fallback/u
  );
});

test("translator fallback retains only a deterministically valid baseline", () => {
  const task = fixtureTask();
  const baselineDraft = fixtureDraft();
  const fallback = translatorFallback(
    { task, baselineDraft } as Parameters<typeof translatorFallback>[0],
    new Error("malformed unit response"),
    "fixture-model"
  );
  const result = applyFrenchAdaptiveReview(task, baselineDraft, fallback.value);
  assert.equal(fallback.candidate, "baseline");
  assert.equal(fallback.value.verdict, "escalate");
  assert.deepEqual(result, baselineDraft);
  assert.equal(
    validateFrenchAdaptiveDraft({ task, draft: result, model: "fixture-model" })
      .valid,
    true
  );

  assert.throws(
    () =>
      translatorFallback(
        {
          task,
          baselineDraft: {
            ...baselineDraft,
            meaningSegmentsFr: baselineDraft.meaningSegmentsFr.map((segment) =>
              segment.id === "t1" ? { ...segment, text: " sans code" } : segment
            )
          }
        } as Parameters<typeof translatorFallback>[0],
        new Error("malformed unit response"),
        "fixture-model"
      ),
    /no-valid-fallback/u
  );
});

test("reviewer fallback restores the valid baseline when translator output is invalid", () => {
  const task = fixtureTask();
  const baselineDraft = fixtureDraft();
  const translation = {
    ...baselineDraft,
    meaningSegmentsFr: baselineDraft.meaningSegmentsFr.map((segment) =>
      segment.id === "t1" ? { ...segment, text: " sans code" } : segment
    )
  };
  const validation = validateFrenchAdaptiveDraft({
    task,
    draft: translation,
    model: "fixture-model"
  });
  assert.equal(validation.valid, false);
  const fallback = reviewerFallback(
    {
      task,
      baselineDraft,
      translation,
      validation
    } as Parameters<typeof reviewerFallback>[0],
    new Error("malformed reviewer response"),
    "fixture-model"
  );
  const restored = applyFrenchAdaptiveReview(task, translation, fallback.value);
  assert.equal(fallback.candidate, "baseline");
  assert.deepEqual(restored, baselineDraft);
  assert.equal(
    validateFrenchAdaptiveDraft({
      task,
      draft: restored,
      model: "fixture-model"
    }).valid,
    true
  );
});

test("arbiter fallback selects the best deterministically valid reviewed draft", () => {
  const task = fixtureTask();
  const baselineDraft = fixtureDraft();
  const translation = {
    ...baselineDraft,
    meaningSegmentsFr: baselineDraft.meaningSegmentsFr.map((segment) =>
      segment.id === "t1" ? { ...segment, text: " sans code" } : segment
    )
  };
  const validation = validateFrenchAdaptiveDraft({
    task,
    draft: translation,
    model: "fixture-model"
  });
  const review = reviewerFallback(
    {
      task,
      baselineDraft,
      translation,
      validation
    } as Parameters<typeof reviewerFallback>[0],
    new Error("reviewer fallback"),
    "fixture-model"
  ).value;
  const reviewedDraft = applyFrenchAdaptiveReview(task, translation, review);
  const reviewedValidation = validateFrenchAdaptiveDraft({
    task,
    draft: reviewedDraft,
    model: "fixture-model"
  });
  const fallback = arbiterFallback(
    {
      task,
      baselineDraft,
      translation,
      validation,
      review,
      reviewedDraft,
      reviewedValidation
    } as Parameters<typeof arbiterFallback>[0],
    new Error("malformed arbiter response"),
    "fixture-model"
  );
  assert.equal(fallback.candidate, "reviewer");
  assert.equal(fallback.value.verdict, "reviewer");
  assert.deepEqual(fallback.value.finalDraft, baselineDraft);
  assert.equal(reviewedValidation.valid, true);
});

function fixtureTask(): FrenchAdaptiveTask {
  const meaningHtml = "<b>father</b> of H0001 in Gen.1:1";
  const htmlTemplate = buildFrenchHtmlTemplate(meaningHtml);
  const content = {
    schemaVersion: FRENCH_ADAPTIVE_TASK_SCHEMA_VERSION,
    entryKey: "hebrew:H9999",
    sourceHash: "a".repeat(64),
    releaseKey: "fixture-release",
    identity: {
      stepEntryId: 9999,
      language: "hebrew" as const,
      eStrong: "H9999",
      dStrong: "H9999 =",
      uStrong: "H9999",
      original: "אָב",
      transliteration: "av",
      morph: "H:N-M"
    },
    english: {
      gloss: "father",
      meaning: "father of H0001 in Gen.1:1",
      meaningHtml,
      segments: htmlTemplate.tokens.flatMap((token) =>
        token.kind === "text" && token.translatable
          ? [{ id: token.id, text: token.sourceText }]
          : []
      )
    },
    htmlTemplate,
    protectedContent: {
      strongCodes: ["H0001"],
      references: ["Gen.1.1"],
      referenceLiterals: ["Gen.1:1"],
      originalTokens: [],
      numericLiterals: ["1"],
      sigla: []
    },
    entityGlossFr: null,
    entityMentions: [],
    riskReasons: [],
    size: "short" as const
  };
  return { ...content, taskHash: hashFrenchInternalJson(content) };
}

function fixtureDraft(): FrenchAdaptiveDraft {
  return {
    schemaVersion: FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION,
    entryKey: "hebrew:H9999",
    sourceHash: "a".repeat(64),
    glossFr: "père",
    meaningSegmentsFr: [
      { id: "t0", text: "père" },
      { id: "t1", text: " de H0001 en Gen.1:1" }
    ],
    entityMentionsFr: [],
    confidence: 0.9
  };
}
