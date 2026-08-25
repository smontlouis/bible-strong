import assert from "node:assert/strict";
import test from "node:test";

import {
  frenchCodexPilotDraftOutputSchema,
  parseFrenchCodexPilotBatchArgs
} from "../scripts/buildLexiconV3FrenchCodexPilotBatches.js";
import { FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION } from "../src/lexiconV3/frenchAgentDrafts.js";

test("uses a strict pilot-batch CLI parser", () => {
  assert.throws(
    () => parseFrenchCodexPilotBatchArgs(["positionnel"]),
    /unexpected-argument:positionnel/u
  );
  assert.throws(
    () => parseFrenchCodexPilotBatchArgs(["--unknown", "value"]),
    /unknown-option:unknown/u
  );
  assert.throws(
    () => parseFrenchCodexPilotBatchArgs(["--output-dir"]),
    /missing-value:output-dir/u
  );
  assert.throws(
    () => parseFrenchCodexPilotBatchArgs(["--output-dir="]),
    /missing-value:output-dir/u
  );
  assert.throws(
    () =>
      parseFrenchCodexPilotBatchArgs([
        "--output-dir",
        "first",
        "--output-dir=second"
      ]),
    /duplicate-option:output-dir/u
  );

  for (const value of [
    "0",
    "-1",
    "+1",
    "1.0",
    "1e3",
    " 1",
    "9007199254740992"
  ]) {
    assert.throws(
      () => parseFrenchCodexPilotBatchArgs(["--max-combined-bytes", value]),
      /invalid-positive-safe-integer:max-combined-bytes/u,
      value
    );
  }

  const parsed = parseFrenchCodexPilotBatchArgs([
    "--max-combined-bytes=300000",
    "--short-max-items",
    "20",
    "--medium-max-items=8",
    "--long-max-items",
    "3",
    "--very-long-max-items=1"
  ]);
  assert.equal(parsed.maxCombinedBytes, 300_000);
  assert.deepEqual(parsed.maxItems, {
    short: 20,
    medium: 8,
    long: 3,
    very_long: 1
  });
});

test("the pilot proposer schema requires structured entity mentions", () => {
  const schema = frenchCodexPilotDraftOutputSchema(
    "proposerA",
    ["greek:G0001"],
    ["a".repeat(64)],
    ["meaning-text-0001"],
    1
  ) as {
    properties: {
      drafts: {
        items: {
          required: string[];
          properties: Record<string, unknown>;
        };
      };
    };
  };
  const draft = schema.properties.drafts.items;
  assert.ok(draft.required.includes("entityMentionsFr"));
  assert.deepEqual(draft.properties.entityMentionsFr, {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["mentionId", "segmentId", "chosenFrenchForm"],
      properties: {
        mentionId: { type: "string", minLength: 1 },
        segmentId: { type: "string", minLength: 1 },
        chosenFrenchForm: { type: "string", minLength: 1 }
      }
    }
  });
  assert.match(
    JSON.stringify(schema),
    new RegExp(FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION)
  );
});
