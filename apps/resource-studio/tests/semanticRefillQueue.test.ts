import test from "node:test";
import assert from "node:assert/strict";

import { buildSemanticRefillQueueManifest } from "../src/semanticRefillQueue.js";

test("semantic refill queue filters weak technical/function items and groups by chapter", () => {
  const manifest = buildSemanticRefillQueueManifest(
    [
      pending({
        ref: "Gen.1.2",
        strong: ["H6440"],
        priority: "semantic-medium",
        score: 0.35
      }),
      pending({
        ref: "Gen.1.3",
        strong: ["H0216"],
        priority: "semantic-high",
        normalized: "lumiere",
        score: 0.92
      }),
      pending({
        ref: "Exod.2.1",
        strong: ["H1121"],
        priority: "semantic-high",
        normalized: "fils",
        score: 0.89
      }),
      pending({
        ref: "Gen.1.4",
        strong: ["G2532"],
        priority: "semantic-medium",
        normalized: "et",
        score: 0.4
      }),
      pending({
        ref: "Gen.1.5",
        target: "technical",
        strong: ["H0853"],
        priority: "semantic-high",
        score: 0.5
      }),
      pending({
        ref: "Gen.1.6",
        strong: ["H5117"],
        priority: "function-low",
        score: 0.35
      })
    ],
    {
      bible: "nbs",
      sourcePath: "semantic-refill-pending.json"
    }
  );

  assert.equal(manifest.totals.inputItems, 6);
  assert.equal(manifest.totals.eligibleItems, 3);
  assert.equal(manifest.totals.excludedItems, 3);
  assert.equal(manifest.totals.books, 2);
  assert.equal(manifest.totals.chapters, 2);
  assert.equal(manifest.tasks.length, 2);

  assert.equal(manifest.tasks[0]?.scope, "Gen.1");
  assert.equal(manifest.tasks[0]?.priority, "semantic-high");
  assert.deepEqual(
    manifest.tasks[0]?.items.map((item) => item.strong[0]),
    ["H0216", "H6440"]
  );
  assert.equal(manifest.tasks[1]?.scope, "Exod.2");
  assert.equal(manifest.excludedSummary["weak-function-strong"], 1);
  assert.equal(manifest.excludedSummary["excluded-target"], 1);
  assert.equal(manifest.excludedSummary["excluded-priority"], 1);
});

test("semantic refill queue can group by book and split oversized tasks", () => {
  const manifest = buildSemanticRefillQueueManifest(
    [
      pending({ ref: "Gen.1.1", strong: ["H7225"], priority: "semantic-high" }),
      pending({
        ref: "Gen.1.2",
        strong: ["H6440"],
        priority: "semantic-medium"
      }),
      pending({
        ref: "Gen.2.1",
        strong: ["H8064"],
        priority: "semantic-medium"
      })
    ],
    {
      bible: "nbs",
      groupBy: "book",
      maxItemsPerTask: 2
    }
  );

  assert.equal(manifest.policy.groupBy, "book");
  assert.equal(manifest.tasks.length, 2);
  assert.deepEqual(
    manifest.tasks.map((task) => task.id),
    ["nbs:Gen:part-1", "nbs:Gen:part-2"]
  );
  assert.equal(manifest.books[0]?.book, "Gen");
  assert.equal(manifest.books[0]?.itemCount, 3);
  assert.equal(manifest.books[0]?.taskCount, 2);
});

function pending(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    bible: "nbs",
    ref: "Gen.1.1",
    target: "word",
    wordIndex: 0,
    normalized: "",
    strong: ["H0001"],
    confidence: 0.35,
    source: "semantic-refill",
    reason: "test fixture",
    status: "pending-human",
    score: 0.35,
    priority: "semantic-medium",
    evidence: ["test fixture"],
    ...overrides
  };
}
