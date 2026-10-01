import assert from "node:assert/strict";
import test from "node:test";
import { excludedReferenceNamesForGold } from "../../src/evaluateStrongGold.js";
import {
  requestFor,
  splitForRef,
  type BenchmarkCase,
  type BenchmarkVerse
} from "./prepare.js";
import { applyChoices, expectedChoice } from "./report.js";

const visible = {
  strong: "H0001",
  kind: "word" as const,
  startWordIndex: 2,
  endWordIndex: 2
};
function fixture(): BenchmarkCase {
  return {
    id: "case",
    gold: "Darby",
    ref: "Gen.1.1",
    annotationId: "source-1",
    strong: "H0001",
    auditKind: "empty",
    split: "test",
    state: "French verse and STEP meaning",
    choices: [
      { key: "C2", description: "père", placement: visible },
      { key: "NONE", description: "No equivalent" },
      { key: "UNSURE", description: "Uncertain" }
    ],
    expected: [visible],
    uniqueOccurrence: true
  };
}
function verse(): BenchmarkVerse {
  return {
    gold: "Darby",
    ref: "Gen.1.1",
    split: "test",
    baseline: [],
    expected: [visible]
  };
}
test("model request cannot include expected placements, baseline scores, or split", () => {
  const c = fixture();
  const a = requestFor(c);
  const b = requestFor({
    ...c,
    expected: [{ strong: "SECRET", kind: "empty" }],
    uniqueOccurrence: false,
    split: "calibration",
    baseline: { strong: "SECRET", kind: "empty" }
  });
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a), ["id", "state", "questions"]);
  assert.equal(JSON.stringify(a).includes("SECRET"), false);
});
test("Darby siblings are held out together and chapter splits agree", () => {
  assert.deepEqual(excludedReferenceNamesForGold("Darby", false), [
    "Darby",
    "DarbyR"
  ]);
  assert.deepEqual(excludedReferenceNamesForGold("DarbyR", false), [
    "Darby",
    "DarbyR"
  ]);
  assert.equal(splitForRef("Gen.1.1"), splitForRef("Gen.1.31"));
});
test("abstention and failed calls preserve the baseline", () => {
  const v = { ...verse(), baseline: [{ ...visible, id: "source-1" }] };
  assert.deepEqual(
    applyChoices(v, [fixture()], new Map(), 0).predicted,
    v.baseline
  );
  assert.deepEqual(
    applyChoices(
      v,
      [fixture()],
      new Map([
        ["case", { id: "case", status: "ok", choice: "UNSURE", probability: 1 }]
      ]),
      0
    ).predicted,
    v.baseline
  );
});
test("model choice adds only an allowed span and never consults gold", () => {
  const c = fixture(),
    v = verse();
  const r = new Map([
    ["case", { id: "case", status: "ok", choice: "C2", probability: 0.96 }]
  ]);
  const actual = applyChoices(v, [c], r, 0.95);
  assert.equal(actual.counts.applied, 1);
  assert.deepEqual(actual.predicted, [{ ...visible, id: "source-1" }]);
  assert.deepEqual(
    actual,
    applyChoices({ ...v, expected: [] }, [{ ...c, expected: [] }], r, 0.95)
  );
  assert.equal(applyChoices(v, [c], r, 0.99).counts.abstained, 1);
});
test("duplicate original occurrences and occupied targets cannot be stacked", () => {
  const v = { ...verse(), baseline: [{ ...visible, id: "other-occurrence" }] };
  const r = new Map([
    ["case", { id: "case", status: "ok", choice: "C2", probability: 1 }]
  ]);
  assert.equal(applyChoices(v, [fixture()], r, 0).counts.blocked, 1);
  assert.equal(
    applyChoices(
      { ...v, baseline: [{ ...visible, strong: "H0002", id: "other" }] },
      [fixture()],
      r,
      0
    ).counts.blocked,
    1
  );
});
test("NONE demotes visible carriers but does not invent empty anchors", () => {
  const v = { ...verse(), baseline: [{ ...visible, id: "source-1" }] };
  const r = new Map([
    ["case", { id: "case", status: "ok", choice: "NONE", probability: 1 }]
  ]);
  assert.deepEqual(applyChoices(v, [fixture()], r, 0).predicted, []);
});
test("missing reference inventory and repeated occurrences are not false NONE labels", () => {
  assert.equal(
    expectedChoice({ ...fixture(), expected: [], uniqueOccurrence: false }),
    undefined
  );
  assert.equal(
    expectedChoice({
      ...fixture(),
      expected: [visible, visible],
      uniqueOccurrence: false
    }),
    undefined
  );
  assert.equal(
    expectedChoice({
      ...fixture(),
      expected: [{ strong: "H0001", kind: "empty", insertAfterWordIndex: 1 }]
    }),
    "NONE"
  );
  assert.equal(
    expectedChoice({
      ...fixture(),
      expected: [{ ...visible, startWordIndex: 5, endWordIndex: 5 }]
    }),
    "UNSURE"
  );
});
