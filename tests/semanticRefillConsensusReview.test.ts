import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildConsensusReview } from "../src/semanticRefillConsensusReview.js";
import {
  type SemanticRefillLlmCandidatePacket,
  type SemanticRefillLlmChoice,
  type SemanticRefillLlmRawDecision
} from "../src/semanticRefillLlm.js";
import { type SemanticRefillDecision } from "../src/semanticRefill.js";

interface ConsensusOutput {
  decisions: SemanticRefillLlmRawDecision[];
}

test("consensus preserves distinct candidate ids even when validated carriers are identical", async () => {
  const fixture = await consensusFixture([
    candidate("candidate-a"),
    candidate("candidate-b")
  ]);
  const decisions = [wordDecision("candidate-a"), wordDecision("candidate-b")];
  await Promise.all([
    writeReview(fixture.leftReviewPath, fixture.packetPath, "left", decisions),
    writeReview(
      fixture.rightReviewPath,
      fixture.packetPath,
      "right",
      decisions
    ),
    writeValidation(fixture.leftValidationDir, [accepted(), accepted()]),
    writeValidation(fixture.rightValidationDir, [accepted(), accepted()])
  ]);

  const result = await buildConsensus(fixture);
  const output = await readOutput(fixture.outputPath);

  assert.equal(result.consensus, 2);
  assert.deepEqual(
    output.decisions.map((decision) => [decision.id, decision.choiceId]),
    [
      ["candidate-a", "word:2"],
      ["candidate-b", "word:2"]
    ]
  );
});

test("consensus does not cross different candidate ids that share the same validated carrier", async () => {
  const fixture = await consensusFixture([
    candidate("candidate-a"),
    candidate("candidate-b")
  ]);
  await Promise.all([
    writeReview(fixture.leftReviewPath, fixture.packetPath, "left", [
      wordDecision("candidate-a"),
      terminalDecision("candidate-b", "reject")
    ]),
    writeReview(fixture.rightReviewPath, fixture.packetPath, "right", [
      terminalDecision("candidate-a", "reject"),
      wordDecision("candidate-b")
    ]),
    writeValidation(
      fixture.leftValidationDir,
      [accepted()],
      [],
      ["candidate-b"]
    ),
    writeValidation(
      fixture.rightValidationDir,
      [accepted()],
      [],
      ["candidate-a"]
    )
  ]);

  const result = await buildConsensus(fixture);
  const output = await readOutput(fixture.outputPath);

  assert.equal(result.consensus, 0);
  assert.deepEqual(output.decisions, []);
});

test("consensus requires the same choice id within a candidate", async () => {
  const choices = [
    wordChoice("carrier-a"),
    wordChoice("carrier-b"),
    terminalChoice("reject")
  ];
  const fixture = await consensusFixture([candidate("candidate-a", choices)]);
  await Promise.all([
    writeReview(fixture.leftReviewPath, fixture.packetPath, "left", [
      wordDecision("candidate-a", "carrier-a")
    ]),
    writeReview(fixture.rightReviewPath, fixture.packetPath, "right", [
      wordDecision("candidate-a", "carrier-b")
    ]),
    writeValidation(fixture.leftValidationDir, [accepted()]),
    writeValidation(fixture.rightValidationDir, [accepted()])
  ]);

  const result = await buildConsensus(fixture);
  const output = await readOutput(fixture.outputPath);

  assert.equal(result.consensus, 0);
  assert.deepEqual(output.decisions, []);
});

test("consensus ignores reference-style empty fallbacks without dropping valid visible identities", async () => {
  const fixture = await consensusFixture([
    candidate("candidate-technical", [
      terminalChoice("technical"),
      terminalChoice("reject")
    ]),
    candidate("candidate-visible")
  ]);
  const decisions = [
    terminalDecision("candidate-technical", "technical"),
    wordDecision("candidate-visible")
  ];
  await Promise.all([
    writeReview(fixture.leftReviewPath, fixture.packetPath, "left", decisions),
    writeReview(
      fixture.rightReviewPath,
      fixture.packetPath,
      "right",
      decisions
    ),
    writeValidation(fixture.leftValidationDir, [acceptedEmpty(), accepted()]),
    writeValidation(fixture.rightValidationDir, [acceptedEmpty(), accepted()])
  ]);

  const result = await buildConsensus(fixture);
  const output = await readOutput(fixture.outputPath);

  assert.equal(result.consensus, 1);
  assert.deepEqual(
    output.decisions.map((decision) => decision.id),
    ["candidate-visible"]
  );
});

test("consensus rejects two reviews from the same normalized model", async () => {
  const fixture = await consensusFixture([candidate("candidate-a")]);
  const decisions = [wordDecision("candidate-a")];
  await Promise.all([
    writeReview(
      fixture.leftReviewPath,
      fixture.packetPath,
      " OpenAI/Model-A ",
      decisions
    ),
    writeReview(
      fixture.rightReviewPath,
      fixture.packetPath,
      "openai/model-a",
      decisions
    )
  ]);

  await assert.rejects(
    buildConsensus(fixture),
    /consensus-requires-distinct-models/u
  );
});

interface ConsensusFixture {
  packetPath: string;
  leftReviewPath: string;
  rightReviewPath: string;
  leftValidationDir: string;
  rightValidationDir: string;
  outputPath: string;
}

async function consensusFixture(
  candidates: SemanticRefillLlmCandidatePacket[]
): Promise<ConsensusFixture> {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "semantic-refill-consensus-review-")
  );
  const packetPath = path.join(dir, "packet.json");
  await writeJson(packetPath, {
    bible: "nbs",
    scope: "Gen.1",
    candidates
  });
  return {
    packetPath,
    leftReviewPath: path.join(dir, "left.json"),
    rightReviewPath: path.join(dir, "right.json"),
    leftValidationDir: path.join(dir, "left-validated"),
    rightValidationDir: path.join(dir, "right-validated"),
    outputPath: path.join(dir, "consensus.json")
  };
}

async function buildConsensus(fixture: ConsensusFixture) {
  return buildConsensusReview({
    leftReviewPath: fixture.leftReviewPath,
    rightReviewPath: fixture.rightReviewPath,
    leftValidationDir: fixture.leftValidationDir,
    rightValidationDir: fixture.rightValidationDir,
    outputPath: fixture.outputPath,
    minConfidence: 0.84
  });
}

function candidate(
  id: string,
  choices: SemanticRefillLlmChoice[] = [
    wordChoice("word:2"),
    terminalChoice("reject")
  ]
): SemanticRefillLlmCandidatePacket {
  return {
    id,
    bible: "nbs",
    ref: "Gen.1.1",
    text: "La porte",
    auditKind: "missing",
    priority: "semantic-high",
    strong: "H6607",
    currentPlacement: "empty",
    sourcePlacement: { placement: "empty", insertAfterWordIndex: 1 },
    reason: "test",
    eligible: true,
    tokens: [{ wordIndex: 2, text: "porte", normalized: "porte" }],
    originalInventory: ["H6607"],
    referenceInventory: {},
    existingReaderStrong: [],
    occupiedTargets: [],
    availableTargets: [
      {
        wordIndex: 2,
        text: "porte",
        normalized: "porte",
        weak: false,
        occupiedStrong: []
      }
    ],
    blockedTargets: [],
    openContentTargets: [{ wordIndex: 2, text: "porte", normalized: "porte" }],
    nearbyOpenTargets: [],
    placementWarnings: [],
    deterministicCandidates: [
      {
        target: "word",
        strong: "H6607",
        score: 0.92,
        wordIndex: 2,
        normalizedWord: "porte",
        evidence: ["seed-term:porte"]
      }
    ],
    choices
  };
}

function wordChoice(id: string): SemanticRefillLlmChoice {
  return {
    id,
    decision: "word",
    description: "porte",
    wordIndex: 2,
    normalized: "porte",
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null
  };
}

function terminalChoice(
  decision: "reject" | "technical"
): SemanticRefillLlmChoice {
  return {
    id: decision,
    decision,
    description: decision,
    wordIndex: null,
    normalized: null,
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null
  };
}

function wordDecision(
  id: string,
  choiceId = "word:2"
): SemanticRefillLlmRawDecision {
  return {
    id,
    choiceId,
    ref: "Gen.1.1",
    decision: "word",
    strong: ["H6607"],
    confidence: 0.93,
    reason: `select ${choiceId}`,
    wordIndex: 2,
    normalized: "porte",
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null,
    evidence: []
  };
}

function terminalDecision(
  id: string,
  decision: "reject" | "technical"
): SemanticRefillLlmRawDecision {
  return {
    id,
    choiceId: decision,
    ref: "Gen.1.1",
    decision,
    strong: ["H6607"],
    confidence: 0.93,
    reason: decision,
    wordIndex: null,
    normalized: null,
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null,
    evidence: []
  };
}

function accepted(): SemanticRefillDecision {
  return {
    bible: "nbs",
    ref: "Gen.1.1",
    target: "word",
    wordIndex: 2,
    normalized: "porte",
    strong: ["H6607"],
    confidence: 0.93,
    source: "semantic-refill:llm",
    reason: "accepted",
    status: "accept",
    score: 0.93,
    priority: "semantic-high",
    evidence: []
  };
}

function acceptedEmpty(): SemanticRefillDecision {
  return {
    bible: "nbs",
    ref: "Gen.1.1",
    target: "empty",
    wordIndex: 1,
    normalized: "",
    strong: ["H6607"],
    confidence: 0.83,
    source: "semantic-refill:llm-reference-style",
    reason: "reference-style empty fallback",
    status: "accept",
    score: 0.83,
    priority: "semantic-high",
    evidence: []
  };
}

async function writeReview(
  filePath: string,
  sourcePacket: string,
  model: string,
  decisions: SemanticRefillLlmRawDecision[]
): Promise<void> {
  await writeJson(filePath, {
    bible: "nbs",
    scope: "Gen.1",
    generatedAt: "2026-07-10T00:00:00.000Z",
    sourcePacket,
    model,
    decisions
  });
}

async function writeValidation(
  dir: string,
  acceptedDecisions: SemanticRefillDecision[],
  pendingIds: string[] = [],
  rejectedIds: string[] = []
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeJson(path.join(dir, "accepted.json"), acceptedDecisions),
    writeJson(
      path.join(dir, "pending.json"),
      pendingIds.map((id) => ({ id }))
    ),
    writeJson(
      path.join(dir, "rejected.json"),
      rejectedIds.map((id) => ({ id }))
    )
  ]);
}

async function readOutput(filePath: string): Promise<ConsensusOutput> {
  return JSON.parse(await readFile(filePath, "utf8")) as ConsensusOutput;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
