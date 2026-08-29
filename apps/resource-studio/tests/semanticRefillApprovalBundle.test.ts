import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  approvalDecisionKey,
  dedupeApprovalDecisions
} from "../src/semanticRefillApprovalBundle";

describe("semantic refill approval bundle", () => {
  it("keeps the first reviewed decision and records later exact duplicates", () => {
    const first = {
      bible: "ost",
      ref: "Acts.16.12",
      strong: ["G1304"],
      target: "word",
      wordIndex: 23,
      normalized: "sejournames",
      reason: "first"
    };
    const duplicate = { ...first, reason: "later review" };
    const distinctEmpty = {
      ...first,
      target: "empty",
      normalized: "",
      reason: "distinct occurrence"
    };
    const result = dedupeApprovalDecisions([
      { label: "pre", decisions: [first] },
      { label: "direct", decisions: [duplicate, distinctEmpty] }
    ]);
    assert.deepEqual(result.decisions, [first, distinctEmpty]);
    assert.deepEqual(result.duplicates, [
      {
        key: approvalDecisionKey(first),
        keptSource: "pre",
        skippedSource: "direct"
      }
    ]);
  });
});
