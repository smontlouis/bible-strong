import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeFrenchAdaptiveMechanicalStepArtifacts,
  parseFrenchAdaptiveArgs
} from "../scripts/runLexiconV3FrenchAdaptivePipeline.js";
import {
  FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION,
  FRENCH_ADAPTIVE_PIPELINE_VERSION,
  FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
  FRENCH_ADAPTIVE_TASK_SCHEMA_VERSION,
  applyFrenchAdaptiveReview,
  buildFrenchAdaptiveFinalRecord,
  frenchAdaptiveNeedsArbitration,
  frenchAdaptiveReferenceIsMechanicallyAttested,
  filterFrenchAdaptiveProtectedNumericLiterals,
  frenchAdaptiveReviewHash,
  frenchAdaptiveTranslationHash,
  validateFrenchAdaptiveDraft,
  type FrenchAdaptiveDraft,
  type FrenchAdaptiveReview,
  type FrenchAdaptiveTask
} from "../src/lexiconV3/frenchAdaptivePipeline.js";
import { buildFrenchHtmlTemplate } from "../src/lexiconV3/frenchHtmlRenderer.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";

test("validates a faithful STEP translation and rejects protected-content loss", () => {
  const task = fixtureTask();
  const draft = fixtureDraft();
  const valid = validateFrenchAdaptiveDraft({
    task,
    draft,
    model: "internal/test"
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.rendered?.meaningHtmlFr, "<b>père</b> de H0001 dans Gen.1:1");

  const missingStrong = structuredClone(draft);
  missingStrong.meaningSegmentsFr[1]!.text = " de l'entrée dans Gen.1:1";
  const invalid = validateFrenchAdaptiveDraft({
    task,
    draft: missingStrong,
    model: "internal/test"
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.some((issue) => issue.code === "missing-strong"));
});

test("applies only a minimal reviewer patch and escalates disagreements", () => {
  const task = fixtureTask();
  const draft = fixtureDraft();
  const initial = validateFrenchAdaptiveDraft({ task, draft, model: "translator" });
  const review: FrenchAdaptiveReview = {
    schemaVersion: FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
    entryKey: task.entryKey,
    sourceHash: task.sourceHash,
    translationHash: frenchAdaptiveTranslationHash(draft),
    verdict: "correct",
    reasons: ["Préposition plus naturelle."],
    patch: {
      gloss: { apply: false, value: "" },
      segmentUpdates: [{ id: "t1", text: " de H0001, voir Gen.1:1" }],
      entityMentions: { apply: false, value: [] },
      confidence: { apply: true, value: 0.99 }
    }
  };
  const reviewed = applyFrenchAdaptiveReview(task, draft, review);
  assert.equal(reviewed.meaningSegmentsFr[0]!.text, "père");
  assert.equal(reviewed.meaningSegmentsFr[1]!.text, " de H0001, voir Gen.1:1");
  const reviewedValidation = validateFrenchAdaptiveDraft({
    task,
    draft: reviewed,
    model: "reviewer"
  });
  assert.equal(reviewedValidation.valid, true);
  assert.equal(
    frenchAdaptiveNeedsArbitration({
      task,
      translatorValidation: initial,
      review,
      reviewedValidation
    }),
    true
  );
});

test("builds a minimal final record without arbitration for a clean acceptance", () => {
  const task = fixtureTask();
  const draft = fixtureDraft();
  const review: FrenchAdaptiveReview = {
    schemaVersion: FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
    entryKey: task.entryKey,
    sourceHash: task.sourceHash,
    translationHash: frenchAdaptiveTranslationHash(draft),
    verdict: "accept",
    reasons: [],
    patch: {
      gloss: { apply: false, value: "" },
      segmentUpdates: [],
      entityMentions: { apply: false, value: [] },
      confidence: { apply: false, value: 0 }
    }
  };
  const final = buildFrenchAdaptiveFinalRecord({
    task,
    translation: draft,
    review,
    reviewedDraft: draft,
    arbitration: null,
    model: "reviewer"
  });
  assert.equal(final.pipelineVersion, FRENCH_ADAPTIVE_PIPELINE_VERSION);
  assert.equal(final.arbitrationHash, null);
  assert.equal(final.validation.valid, true);
  assert.equal(final.reviewHash, frenchAdaptiveReviewHash(review));
});

test("uses a strict adaptive CLI parser", () => {
  assert.throws(
    () => parseFrenchAdaptiveArgs(["--mode", "unknown"]),
    /invalid-french-adaptive-mode/u
  );
  assert.throws(
    () => parseFrenchAdaptiveArgs(["--mode", "pilot", "--wat", "x"]),
    /unknown-option:wat/u
  );
  assert.throws(
    () => parseFrenchAdaptiveArgs(["--mode", "pilot", "--concurrency", "0"]),
    /invalid-integer:concurrency/u
  );
});

test("filters only mechanically unattested normalized references", () => {
  assert.equal(
    frenchAdaptiveReferenceIsMechanicallyAttested(
      "Ezek.16.22",
      "Eze.16:7, 22 16:39"
    ),
    true
  );
  assert.equal(
    frenchAdaptiveReferenceIsMechanicallyAttested(
      "2Pet.3.18",
      "2Pe.3:2; ib. 18"
    ),
    true
  );
  assert.equal(
    frenchAdaptiveReferenceIsMechanicallyAttested(
      "1Cor.13.1",
      "1Co.13:5; ib. 1Co.7:36"
    ),
    false
  );
  assert.equal(
    frenchAdaptiveReferenceIsMechanicallyAttested("Num.14.3", "Num.14:3o"),
    false
  );
});

test("allows a STEP bibliographic title without allowing English prose", () => {
  const task = fixtureTask();
  task.english.meaning += " Gifford, The Incarnation.";
  const draft = fixtureDraft();
  draft.meaningSegmentsFr[1]!.text += " ; Gifford, The Incarnation.";
  const title = validateFrenchAdaptiveDraft({ task, draft, model: "internal/test" });
  assert.equal(title.valid, true);

  draft.meaningSegmentsFr[1]!.text += " The lexical meaning.";
  const prose = validateFrenchAdaptiveDraft({ task, draft, model: "internal/test" });
  assert.ok(
    prose.issues.some((issue) => issue.code === "residual-english-extended")
  );
});

test("normalizes only manifest STEP reference corruption", () => {
  assert.equal(
    normalizeFrenchAdaptiveMechanicalStepArtifacts(
      "Meyer, l.with; JThS, ll.with; travailler avec soin"
    ),
    "Meyer, au passage cité; JThS, aux passages cités; travailler avec soin"
  );
  assert.deepEqual(
    filterFrenchAdaptiveProtectedNumericLiterals([
      "39 -29",
      "12 111",
      "59-71",
      "30,000"
    ]),
    ["59-71", "30,000"]
  );
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
      { id: "t1", text: " de H0001 dans Gen.1:1" }
    ],
    entityMentionsFr: [],
    confidence: 0.98
  };
}
