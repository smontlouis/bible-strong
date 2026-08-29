import test from "node:test";
import assert from "node:assert/strict";

import { maximumWeightMatching } from "../src/maximumWeightMatching.js";

test("finds the global optimum instead of taking the best first edge", () => {
  const matches = maximumWeightMatching({
    leftCount: 2,
    rightCount: 2,
    edges: [
      { left: 0, right: 0, weight: 0.9, value: "a-0" },
      { left: 0, right: 1, weight: 0.8, value: "a-1" },
      { left: 1, right: 0, weight: 0.85, value: "b-0" }
    ]
  });

  assert.deepEqual(
    matches.map((match) => match.value),
    ["a-1", "b-0"]
  );
});

test("leaves a node unmatched instead of using a non-positive edge", () => {
  const matches = maximumWeightMatching({
    leftCount: 2,
    rightCount: 1,
    edges: [
      { left: 0, right: 0, weight: -1, value: "bad" },
      { left: 1, right: 0, weight: 0.5, value: "good" }
    ]
  });

  assert.deepEqual(
    matches.map((match) => match.value),
    ["good"]
  );
});
