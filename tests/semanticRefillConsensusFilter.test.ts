import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { filterConsensusReview } from "../src/semanticRefillConsensusFilter.js";
import { type SemanticRefillLlmCandidatePacket } from "../src/semanticRefillLlm.js";

interface TestReviewOutput {
  decisions: Array<{ id: string; strong: string[] }>;
}

interface TestReportDecision {
  ref: string;
  strong: string[];
  target: string;
  normalized: string | null;
  status: string;
  reasons: string[];
}

test("post-consensus filter holds generic carriers and resolves same-target stacking by witnesses", async () => {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "semantic-refill-consensus-filter-")
  );
  const sgPath = path.join(dir, "Sg1910.csv");
  const darbyPath = path.join(dir, "Darby.csv");
  const darbyRPath = path.join(dir, "DarbyR.csv");
  const reviewPath = path.join(dir, "review.json");
  const packetPath = path.join(dir, "packet.json");
  const outputPath = path.join(dir, "filtered.json");
  const reportJsonPath = path.join(dir, "report.json");
  const reportMarkdownPath = path.join(dir, "report.md");

  await Promise.all([
    writeFile(
      sgPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Hos\t2\t7\tElle a <w strong="H0559">dit</w> cela.',
        'Rev\t5\t1\tun livre écrit en <w strong="G1855">dehors</w>'
      ].join("\n")
    ),
    writeFile(
      darbyPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Hos\t2\t7\tElle <w strong="H0559">dit</w> encore.',
        'Rev\t5\t1\técrit sur le <w strong="G1855">revers</w>'
      ].join("\n")
    ),
    writeFile(
      darbyRPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Hos\t2\t7\tElle <w strong="H0559">dit</w> encore.',
        'Rev\t5\t1\técrit à l’<w strong="G1855">extérieur</w>'
      ].join("\n")
    )
  ]);

  const packet = {
    bible: "nbs",
    scope: "test",
    candidates: [
      candidate("hos-generic", "Hos.2.7", "H0559"),
      candidate("rev-g1855", "Rev.5.1", "G1855"),
      candidate("rev-g3693", "Rev.5.1", "G3693")
    ]
  };
  const review = {
    bible: "nbs",
    scope: "test",
    generatedAt: "2026-06-30T00:00:00.000Z",
    sourcePacket: packetPath,
    model: "consensus",
    decisions: [
      decision("hos-generic", "Hos.2.7", ["H0559"], 3, "quoi"),
      decision("rev-g1855", "Rev.5.1", ["G1855"], 22, "dos"),
      decision("rev-g3693", "Rev.5.1", ["G3693"], 22, "dos")
    ]
  };

  await Promise.all([
    writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`),
    writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`)
  ]);

  const report = await filterConsensusReview({
    reviewPath,
    packetPath,
    outputPath,
    reportJsonPath,
    reportMarkdownPath,
    referencePaths: [
      { name: "Sg1910", path: sgPath },
      { name: "Darby", path: darbyPath },
      { name: "DarbyR", path: darbyRPath }
    ]
  });
  const output = JSON.parse(
    await readFile(outputPath, "utf8")
  ) as TestReviewOutput;
  const decisions = report.decisions as TestReportDecision[];

  assert.deepEqual(report.counts, {
    input: 3,
    acceptedSafe: 1,
    needsWitnessReview: 1,
    rejectedRisky: 1
  });
  assert.deepEqual(
    output.decisions.map((item) => item.id),
    ["rev-g1855"]
  );
  assert.equal(findDecision(decisions, "H0559").status, "needs-witness-review");
  assert.deepEqual(findDecision(decisions, "H0559").reasons, [
    "generic-carrier-needs-witness-review"
  ]);
  assert.equal(findDecision(decisions, "G1855").status, "accepted-safe");
  assert.equal(findDecision(decisions, "G3693").status, "rejected-risky");
  assert.equal(
    findDecision(decisions, "G3693").reasons.includes(
      "same-target-stacking-lacks-witness-support"
    ),
    true
  );
});

test("post-consensus filter accepts generic carriers only with two exact witness matches", async () => {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "semantic-refill-consensus-filter-")
  );
  const sgPath = path.join(dir, "Sg1910.csv");
  const darbyPath = path.join(dir, "Darby.csv");
  const darbyRPath = path.join(dir, "DarbyR.csv");
  const reviewPath = path.join(dir, "review.json");
  const packetPath = path.join(dir, "packet.json");
  const outputPath = path.join(dir, "filtered.json");
  const reportJsonPath = path.join(dir, "report.json");
  const reportMarkdownPath = path.join(dir, "report.md");

  await Promise.all([
    writeFile(
      sgPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Acts\t3\t10\tC’<w strong="G2258">était</w> lui.'
      ].join("\n")
    ),
    writeFile(
      darbyPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Acts\t3\t10\tC’<w strong="G2258">était</w> lui.'
      ].join("\n")
    ),
    writeFile(
      darbyRPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Acts\t3\t10\tIl <w strong="G2258">fut</w> reconnu.'
      ].join("\n")
    )
  ]);

  const packet = {
    bible: "nbs",
    scope: "test",
    candidates: [candidate("acts-g2258", "Acts.3.10", "G2258")]
  };
  const review = {
    bible: "nbs",
    scope: "test",
    generatedAt: "2026-06-30T00:00:00.000Z",
    sourcePacket: packetPath,
    model: "consensus",
    decisions: [decision("acts-g2258", "Acts.3.10", ["G2258"], 1, "etait")]
  };

  await Promise.all([
    writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`),
    writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`)
  ]);

  const report = await filterConsensusReview({
    reviewPath,
    packetPath,
    outputPath,
    reportJsonPath,
    reportMarkdownPath,
    referencePaths: [
      { name: "Sg1910", path: sgPath },
      { name: "Darby", path: darbyPath },
      { name: "DarbyR", path: darbyRPath }
    ]
  });
  const output = JSON.parse(
    await readFile(outputPath, "utf8")
  ) as TestReviewOutput;

  assert.deepEqual(report.counts, {
    input: 1,
    acceptedSafe: 1,
    needsWitnessReview: 0,
    rejectedRisky: 0
  });
  assert.deepEqual(
    output.decisions.map((item) => item.id),
    ["acts-g2258"]
  );
  assert.deepEqual(report.decisions[0]?.reasons, [
    "generic-carrier-exact-witness-supported"
  ]);
});

test("post-consensus filter holds original-only decisions with no Strong witness support", async () => {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "semantic-refill-consensus-filter-")
  );
  const sgPath = path.join(dir, "Sg1910.csv");
  const darbyPath = path.join(dir, "Darby.csv");
  const darbyRPath = path.join(dir, "DarbyR.csv");
  const reviewPath = path.join(dir, "review.json");
  const packetPath = path.join(dir, "packet.json");
  const outputPath = path.join(dir, "filtered.json");
  const reportJsonPath = path.join(dir, "report.json");
  const reportMarkdownPath = path.join(dir, "report.md");

  await Promise.all([
    writeFile(
      sgPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Rom\t4\t17\tce qui <w strong="G1510">est</w>'
      ].join("\n")
    ),
    writeFile(
      darbyPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Rom\t4\t17\tce qui <w strong="G1510">est</w>'
      ].join("\n")
    ),
    writeFile(
      darbyRPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Rom\t4\t17\tce qui <w strong="G1510">est</w>'
      ].join("\n")
    )
  ]);

  const packet = {
    bible: "nbs",
    scope: "test",
    candidates: [
      candidate("rom-original-only", "Rom.4.17", "G5607", {
        Sg1910: ["G1510"],
        Darby: ["G1510"],
        DarbyR: ["G1510"]
      })
    ]
  };
  const review = {
    bible: "nbs",
    scope: "test",
    generatedAt: "2026-06-30T00:00:00.000Z",
    sourcePacket: packetPath,
    model: "consensus",
    decisions: [
      decision("rom-original-only", "Rom.4.17", ["G5607"], 35, "existe")
    ]
  };

  await Promise.all([
    writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`),
    writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`)
  ]);

  const report = await filterConsensusReview({
    reviewPath,
    packetPath,
    outputPath,
    reportJsonPath,
    reportMarkdownPath,
    referencePaths: [
      { name: "Sg1910", path: sgPath },
      { name: "Darby", path: darbyPath },
      { name: "DarbyR", path: darbyRPath }
    ]
  });
  const output = JSON.parse(
    await readFile(outputPath, "utf8")
  ) as TestReviewOutput;

  assert.deepEqual(report.counts, {
    input: 1,
    acceptedSafe: 0,
    needsWitnessReview: 1,
    rejectedRisky: 0
  });
  assert.deepEqual(output.decisions, []);
  assert.deepEqual(report.decisions[0]?.reasons, ["no-strong-witness-support"]);
});

function candidate(
  id: string,
  ref: string,
  strong: string,
  referenceInventory: Record<string, string[]> = {}
): SemanticRefillLlmCandidatePacket {
  return {
    id,
    bible: "nbs",
    ref,
    text: "",
    auditKind: "missing",
    priority: "lexical-high",
    strong,
    currentPlacement: "empty",
    sourcePlacement: { placement: "empty" },
    reason: "",
    eligible: true,
    tokens: [],
    originalInventory: [strong],
    referenceInventory,
    existingReaderStrong: [],
    occupiedTargets: [],
    availableTargets: [],
    blockedTargets: [],
    openContentTargets: [],
    nearbyOpenTargets: [],
    placementWarnings: [],
    deterministicCandidates: []
  };
}

function decision(
  id: string,
  ref: string,
  strong: string[],
  wordIndex: number,
  normalized: string
) {
  return {
    id,
    ref,
    decision: "word",
    strong,
    confidence: 0.91,
    reason: "",
    wordIndex,
    normalized,
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null,
    evidence: []
  };
}

function findDecision(
  decisions: TestReportDecision[],
  strong: string
): TestReportDecision {
  const found = decisions.find((item) => item.strong.includes(strong));
  assert.ok(found);
  return found;
}
