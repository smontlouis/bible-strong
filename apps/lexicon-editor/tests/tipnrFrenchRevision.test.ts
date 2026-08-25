import assert from "node:assert/strict";
import test from "node:test";

import { validateTipnrFrenchFields } from "../scripts/runTipnrFrenchRevision.js";

test("accepts faithful TIPNR French with localized references and protected tokens", () => {
  const task = fixtureTask();
  const validation = validateTipnrFrenchFields(task, {
    articleHtml:
      'Dieu <strong="H0430G">Dieu</strong> est mentionné en Genèse 1:1 (אֱלֹהִים).'
  });

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});

test("rejects Strong, tag, reference, original-token and English residue drift", () => {
  const task = fixtureTask();
  const validation = validateTipnrFrenchFields(task, {
    articleHtml: 'God <em><strong="H0431G">Dieu</strong></em> en Genèse 1:2.'
  });

  assert.equal(validation.valid, false);
  const codes = validation.issues.map((issue) => issue.code);
  assert.ok(codes.includes("tag-order-mismatch"));
  assert.ok(codes.includes("strong-order-mismatch"));
  assert.ok(codes.includes("reference-order-mismatch"));
  assert.ok(codes.includes("original-token-order-mismatch"));
  assert.ok(codes.includes("english-residue"));
});

test("enforces the canonical French label for a linked Strong termbase entry", () => {
  const task = fixtureTask();
  task.deterministicIssues = [
    {
      code: "linked-strong-label-not-french",
      severity: "blocking",
      field: "articleHtml",
      details: { code: "H0430G", current: "God", canonical: "Dieu" }
    }
  ];

  const validation = validateTipnrFrenchFields(task, {
    articleHtml:
      'Dieu <strong="H0430G">Seigneur</strong> est mentionné en Genèse 1:1 (אֱלֹהִים).'
  });

  assert.equal(validation.valid, false);
  assert.ok(
    validation.issues.some((issue) => issue.code === "termbase-linked-label-mismatch")
  );
});

function fixtureTask() {
  return {
    key: "God@Gen.1.1",
    sourceId: 1,
    stepCode: "H0430G",
    sourceHash: "a".repeat(64),
    translationHash: "b".repeat(64),
    deterministicIssues: [],
    fields: {
      articleHtml: {
        english:
          'God <strong="H0430G">God</strong> is mentioned at Gen.1.1 (אֱלֹהִים).',
        french:
          'Dieu <strong="H0430G">Dieu</strong> est mentionné en Genèse 1:1 (אֱלֹהִים).'
      }
    }
  };
}
