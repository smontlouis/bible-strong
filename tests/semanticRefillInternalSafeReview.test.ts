import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyFreezeManifest } from "../src/semanticRefillArtifactFreeze.js";
import { buildInternalSafeReview } from "../src/semanticRefillInternalSafeReview.js";
import { type SemanticRefillLlmCandidatePacket } from "../src/semanticRefillLlm.js";

function candidate(
  id: string,
  strong: string,
  choiceId: string
): SemanticRefillLlmCandidatePacket {
  return {
    id,
    ref: "Gen.1.1",
    strong,
    choices: [
      {
        id: choiceId,
        decision: "word",
        description: "word 0: Au",
        wordIndex: 0,
        normalized: "au",
        startWordIndex: null,
        endWordIndex: null,
        normalizedPhrase: null
      }
    ]
  } as SemanticRefillLlmCandidatePacket;
}

test("internal safe review emits only green decisions independently audited safe", () => {
  const green = candidate("green", "H0001", "word:0");
  const yellow = candidate("yellow", "H0002", "word:0");
  const result = buildInternalSafeReview({
    packet: { bible: "ost", scope: "all", candidates: [green, yellow] },
    arbiter: {
      decisions: [
        {
          id: "green",
          choiceId: "word:0",
          confidence: 0.99,
          reason: "exact carrier",
          classification: "green"
        },
        {
          id: "yellow",
          choiceId: "word:0",
          confidence: 0.8,
          reason: "compression",
          classification: "yellow"
        }
      ]
    },
    auditor: {
      audits: [
        {
          id: "green",
          choiceId: "word:0",
          verdict: "safe"
        }
      ]
    },
    sourcePacket: "packet.json"
  });

  assert.equal(result.counts.green, 1);
  assert.equal(result.counts.safe, 1);
  assert.equal(result.review.decisions.length, 1);
  assert.deepEqual(result.review.decisions[0]?.strong, ["H0001"]);
  assert.deepEqual(result.review.decisions[0]?.evidence, [
    "internal-auditor:safe"
  ]);
});

test("internal safe review rejects a green decision missing its audit", () => {
  const green = candidate("green", "H0001", "word:0");
  assert.throws(
    () =>
      buildInternalSafeReview({
        packet: { bible: "ost", scope: "all", candidates: [green] },
        arbiter: {
          decisions: [
            {
              id: "green",
              choiceId: "word:0",
              confidence: 0.99,
              reason: "exact carrier",
              classification: "green"
            }
          ]
        },
        auditor: { audits: [] },
        sourcePacket: "packet.json"
      }),
    /missing-audit:green/
  );
});

test("freeze verification detects any post-freeze source mutation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ost-freeze-"));
  const sourcePath = path.join(directory, "source.json");
  try {
    const original = '{"version":1}\n';
    await writeFile(sourcePath, original);
    const manifest = {
      generatedAt: new Date().toISOString(),
      status: "frozen-for-arbitration" as const,
      packet: "020",
      sources: {
        packet: {
          path: sourcePath,
          sha256: createHash("sha256").update(original).digest("hex")
        }
      }
    };
    await verifyFreezeManifest(manifest);
    await writeFile(sourcePath, '{"version":2}\n');
    await assert.rejects(
      verifyFreezeManifest(manifest),
      /frozen-source-changed/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
