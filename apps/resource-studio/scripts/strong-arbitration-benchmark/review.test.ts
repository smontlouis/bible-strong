import assert from "node:assert/strict";
import test from "node:test";
import { validateReview, type SemanticReview } from "./review.js";
function review(): SemanticReview {
  return {
    status: "complete",
    reviewer: "fixture",
    sourcesConsulted: [],
    groups: [
      {
        id: "g",
        sourceOccurrenceIds: ["s1", "s2"],
        targetWordIndices: [0, 2],
        certainty: "sure",
        relation: "idiomatic",
        carrierOptions: [{ occurrenceId: "s1", tokenIndices: [0] }],
        rationale: "fixture"
      }
    ],
    absent: [],
    uncertain: [],
    problems: []
  };
}
test("many-to-many and discontinuous groups remain explicit", () => {
  assert.doesNotThrow(() => validateReview(["s1", "s2"], 3, review()));
});
test("a carrier cannot silently fill the gap in a discontinuous group", () => {
  const r = review();
  r.groups[0].carrierOptions[0].tokenIndices = [0, 1, 2];
  assert.throws(
    () => validateReview(["s1", "s2"], 3, r),
    /carrier-outside-group/
  );
});
test("linked source cannot simultaneously be marked absent", () => {
  const r = review();
  r.absent.push({ occurrenceId: "s1", rationale: "fixture" });
  assert.throws(
    () => validateReview(["s1", "s2"], 3, r),
    /contradictory-disposition/
  );
});
test("complete review requires source coverage and identified reviewer", () => {
  assert.throws(
    () => validateReview(["s1", "s2", "s3"], 3, review()),
    /incomplete-source-coverage/
  );
  const r = review();
  r.reviewer = null;
  assert.throws(() => validateReview(["s1", "s2"], 3, r), /missing-reviewer/);
});
test("unknown occurrence cannot be substituted by a matching Strong", () => {
  const r = review();
  r.groups[0].sourceOccurrenceIds = ["H0001"];
  assert.throws(
    () => validateReview(["s1", "s2"], 3, r),
    /unknown-or-duplicate-group-source/
  );
});
