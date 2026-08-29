import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  buildApprovalApplicationScopes,
  validateApprovalBundle
} from "../src/semanticRefillApprovalPlan";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((temporaryPath) =>
        rm(temporaryPath, { recursive: true, force: true })
      )
  );
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function decision(ref: string, wordIndex: number) {
  return {
    bible: "ost",
    ref,
    strong: ["H1234"],
    confidence: 0.99,
    source: "semantic-refill:llm",
    reason: "audited safe",
    target: "word",
    wordIndex,
    normalized: `mot${wordIndex}`
  };
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "approval-plan-"));
  temporaryPaths.push(directory);
  const firstDecisions = [decision("Gen.2.1", 3), decision("Matt.1.1", 4)];
  const secondDecisions = [
    { ...firstDecisions[0], reason: "reviewed twice" },
    decision("Gen.1.1", 2)
  ];
  const firstPath = path.join(directory, "first.json");
  const secondPath = path.join(directory, "second.json");
  const firstRaw = `${JSON.stringify({ decisions: firstDecisions }, null, 2)}\n`;
  const secondRaw = `${JSON.stringify(secondDecisions, null, 2)}\n`;
  await writeFile(firstPath, firstRaw);
  await writeFile(secondPath, secondRaw);
  const decisions = [...firstDecisions, secondDecisions[1]];
  const duplicateKey = JSON.stringify([
    "ost",
    "Gen.2.1",
    ["H1234"],
    "word",
    3,
    null,
    null,
    "mot3"
  ]);
  const bundle = {
    generatedAt: "2026-07-13T00:00:00.000Z",
    bible: "ost",
    status: "awaiting-explicit-human-durable-approval",
    internalOnly: true,
    aiGatewayCalls: 0,
    sourceDecisionCount: 4,
    decisionCount: 3,
    duplicateCount: 1,
    sources: [
      {
        label: "first",
        path: firstPath,
        sha256: sha256(firstRaw),
        decisionCount: 2
      },
      {
        label: "second",
        path: secondPath,
        sha256: sha256(secondRaw),
        decisionCount: 2
      }
    ],
    duplicates: [
      { key: duplicateKey, keptSource: "first", skippedSource: "second" }
    ],
    sha256: sha256(JSON.stringify(decisions)),
    decisions
  };
  const bundlePath = path.join(directory, "bundle.json");
  await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  return { bundlePath, bundle };
}

test("replays every source before accepting an approval bundle", async () => {
  const { bundlePath, bundle } = await fixture();
  const validated = await validateApprovalBundle({
    bundlePath,
    bible: "ost",
    approvedSha256: bundle.sha256
  });
  assert.equal(validated.bundle.decisionCount, 3);
  assert.equal(validated.bundle.duplicateCount, 1);
  assert.equal(
    validated.bundleFileSha256,
    sha256(await readFile(bundlePath, "utf8"))
  );
});

test("rejects a mismatched explicit approval hash and changed source", async () => {
  const { bundlePath, bundle } = await fixture();
  await assert.rejects(
    validateApprovalBundle({
      bundlePath,
      bible: "ost",
      approvedSha256: "0".repeat(64)
    }),
    /explicit-approval-hash-mismatch/u
  );
  await writeFile(bundle.sources[0].path, "[]\n");
  await assert.rejects(
    validateApprovalBundle({ bundlePath, bible: "ost" }),
    /approval-source-hash-mismatch:first/u
  );
});

test("groups decisions chapter by chapter in canonical order", () => {
  const scopes = buildApprovalApplicationScopes([
    decision("Matt.1.2", 5),
    decision("Gen.2.2", 7),
    decision("Gen.1.3", 4),
    decision("Gen.2.1", 6)
  ]);
  assert.deepEqual(
    scopes.map((scope) => [scope.ordinal, scope.scope, scope.decisionCount]),
    [
      [1, "Gen.1", 1],
      [2, "Gen.2", 2],
      [3, "Matt.1", 1]
    ]
  );
  assert.ok(
    scopes.every((scope) => /^[a-f0-9]{64}$/u.test(scope.decisionPayloadSha256))
  );
});
