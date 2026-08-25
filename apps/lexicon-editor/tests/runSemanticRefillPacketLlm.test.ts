import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGatewayRequestBody,
  defaultOutputPath,
  packetReviewModelSlug,
  parseGatewayDecisions,
  type AgentPacketFile
} from "../src/runSemanticRefillPacketLlm.js";
import { type SemanticRefillLlmCandidatePacket } from "../src/semanticRefillLlm.js";

test("packet runner sends a strict provider-side JSON schema with bounded choices", () => {
  const packet = testPacket();
  const body = buildGatewayRequestBody({
    model: "test/model",
    packet
  });

  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(
    body.response_format.json_schema.schema.properties.decisions.minItems,
    2
  );
  assert.equal(
    body.response_format.json_schema.schema.properties.decisions.maxItems,
    2
  );
  const branches =
    body.response_format.json_schema.schema.properties.decisions.items.anyOf;
  assert.deepEqual(
    branches.map((branch) => branch.properties.id.enum[0]),
    ["candidate-a", "candidate-b"]
  );
  assert.deepEqual(branches[0]?.properties.choiceId.enum, ["word:1", "reject"]);
  assert.equal(body.messages[0]?.content, "custom policy");
  assert.doesNotMatch(body.messages[1]?.content ?? "", /availableTargets/u);
  const prompt = JSON.parse(body.messages[1]?.content ?? "{}") as {
    verses?: unknown[];
    candidates?: unknown[];
  };
  assert.equal(prompt.verses?.length, 1);
  assert.equal(prompt.candidates?.length, 2);
  assert.ok(
    (body.messages[1]?.content.length ?? Number.POSITIVE_INFINITY) <
      JSON.stringify(packet.candidates).length
  );
  assert.doesNotMatch(body.messages[1]?.content ?? "", /"schema"\s*:/u);
});

test("packet parser expands bounded selections and rejects incomplete or ambiguous output", () => {
  const packet = testPacket();
  const valid = JSON.stringify({
    decisions: [
      selection("candidate-a", "word:1"),
      selection("candidate-b", "reject")
    ]
  });
  const parsed = parseGatewayDecisions(valid, packet);

  assert.equal(parsed.parseError, undefined);
  assert.equal(parsed.decisions.length, 2);
  assert.deepEqual(parsed.decisions[0], {
    id: "candidate-a",
    choiceId: "word:1",
    ref: "Gen.1.1",
    decision: "word",
    strong: ["H0001"],
    confidence: 0.91,
    reason: "bounded test selection",
    wordIndex: 1,
    normalized: "crea",
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null,
    evidence: ["test"]
  });

  const missing = parseGatewayDecisions(
    JSON.stringify({ decisions: [selection("candidate-a", "word:1")] }),
    packet
  );
  assert.match(missing.parseError ?? "", /decision-count-mismatch/);
  assert.deepEqual(missing.decisions, []);

  const duplicate = parseGatewayDecisions(
    JSON.stringify({
      decisions: [
        selection("candidate-a", "word:1"),
        selection("candidate-a", "reject")
      ]
    }),
    packet
  );
  assert.match(duplicate.parseError ?? "", /duplicate-candidate-id/);
  assert.deepEqual(duplicate.decisions, []);

  const unknown = parseGatewayDecisions(
    JSON.stringify({
      decisions: [
        selection("candidate-x", "word:1"),
        selection("candidate-b", "reject")
      ]
    }),
    packet
  );
  assert.match(unknown.parseError ?? "", /unknown-candidate-id/);

  const wrongChoice = parseGatewayDecisions(
    JSON.stringify({
      decisions: [
        selection("candidate-a", "word:999"),
        selection("candidate-b", "reject")
      ]
    }),
    packet
  );
  assert.match(wrongChoice.parseError ?? "", /unknown-choice-id/);

  const fenced = parseGatewayDecisions(`\`\`\`json\n${valid}\n\`\`\``, packet);
  assert.match(fenced.parseError ?? "", /JSON/u);
});

test("standalone packet output names cannot collide after model sanitization", () => {
  assert.notEqual(packetReviewModelSlug("a/b"), packetReviewModelSlug("a-b"));
  assert.notEqual(
    defaultOutputPath("/tmp/packet.json", "a/b"),
    defaultOutputPath("/tmp/packet.json", "a-b")
  );
});

function selection(id: string, choiceId: string): Record<string, unknown> {
  return {
    id,
    choiceId,
    confidence: 0.91,
    reason: "bounded test selection",
    evidence: ["test"]
  };
}

function testPacket(): AgentPacketFile {
  return {
    bible: "nbs",
    scope: "Gen.1.1",
    promptPolicy: "custom policy",
    candidates: [
      candidate("candidate-a", "H0001", "crea"),
      candidate("candidate-b", "H0002", "terre")
    ]
  };
}

function candidate(
  id: string,
  strong: string,
  normalized: string
): SemanticRefillLlmCandidatePacket {
  return {
    id,
    bible: "nbs",
    ref: "Gen.1.1",
    text: "Dieu crea la terre",
    auditKind: "missing",
    priority: "semantic-high",
    strong,
    currentPlacement: "empty",
    sourcePlacement: { placement: "empty", insertAfterWordIndex: 0 },
    reason: "test candidate",
    eligible: true,
    tokens: [{ wordIndex: 1, text: normalized, normalized }],
    originalInventory: [strong],
    referenceInventory: { Sg1910: [strong] },
    existingReaderStrong: [],
    occupiedTargets: [],
    availableTargets: [
      {
        wordIndex: 1,
        text: normalized,
        normalized,
        weak: false,
        occupiedStrong: []
      }
    ],
    blockedTargets: [],
    openContentTargets: [{ wordIndex: 1, text: normalized, normalized }],
    nearbyOpenTargets: [],
    placementWarnings: [],
    deterministicCandidates: [],
    choices: [
      {
        id: "word:1",
        decision: "word",
        description: "bounded word",
        wordIndex: 1,
        normalized,
        startWordIndex: null,
        endWordIndex: null,
        normalizedPhrase: null
      },
      {
        id: "reject",
        decision: "reject",
        description: "reject candidate",
        wordIndex: null,
        normalized: null,
        startWordIndex: null,
        endWordIndex: null,
        normalizedPhrase: null
      }
    ]
  };
}
