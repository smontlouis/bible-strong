import assert from "node:assert/strict";
import test from "node:test";
import type { OriginalStrongOccurrence } from "../../src/completeAlignment.js";
import { applyHybrid, project, stableProposals, type Links } from "./engine.js";
import { split, type EvalVerse, type BaselineVerse } from "./shared.js";

function fixture() {
  const source: OriginalStrongOccurrence[] = ["H0001", "H0002"].map(
    (strong, i) => ({
      occurrenceId: `o${i}`,
      tokenId: `t${i}`,
      tokenIndex: i,
      strong,
      sourceStrong: strong,
      text: "",
      gloss: "",
      lemma: "",
      morph: "",
      pos: ""
    })
  );
  const verse: EvalVerse = {
    ref: "Gen.1.1",
    split: "test",
    text: "alpha beta gamma",
    words: ["alpha", "beta", "gamma"],
    normalized: ["alpha", "beta", "gamma"],
    source,
    strong: source.map((s) => s.strong),
    surface: ["a", "b"]
  };
  const baseline: BaselineVerse = {
    ref: verse.ref,
    original: verse.strong,
    items: [],
    placements: source.map((o, i) => ({
      id: `b${i}`,
      originalOccurrenceId: o.occurrenceId,
      strong: o.strong,
      kind: "word",
      startWordIndex: i,
      endWordIndex: i
    }))
  };
  return { verse, baseline };
}
function runs(pairs: [number, number][]): Links[] {
  return [17, 29, 43].map((seed) => ({
    ref: "Gen.1.1",
    seed,
    forward: pairs,
    reverse: pairs
  }));
}
test("chapter split is identical for all verses and editions", () => {
  assert.equal(split("Gen.1.1"), split("Gen.1.31"));
});
test("preserves source occurrence identity and abstains on discontinuous links", () => {
  const { verse } = fixture();
  const output = project(
    verse,
    runs([
      [0, 0],
      [0, 2],
      [1, 1]
    ])[0],
    "union"
  );
  assert.equal(output.discontinuous, 1);
  assert.equal(output.placements.size, 1);
  assert.equal(output.placements.get(1)?.originalOccurrenceId, "o1");
});
test("stable proposals require agreement across seeds", () => {
  const { verse } = fixture();
  const values = runs([[0, 0]]);
  values[2] = { ...values[2], forward: [[0, 1]], reverse: [[0, 1]] };
  assert.equal(stableProposals(verse, values, "intersection").length, 0);
});
test("supports simultaneous swaps without changing the baseline object", () => {
  const { verse, baseline } = fixture();
  const before = JSON.stringify(baseline);
  const result = applyHybrid(
    verse,
    baseline,
    runs([
      [0, 1],
      [1, 0]
    ]),
    "stable-intersection"
  );
  assert.equal(result.counts.applied, 2);
  assert.equal(result.placements.find((p) => p.id === "b0")?.startWordIndex, 1);
  assert.equal(JSON.stringify(baseline), before);
});
test("restored carriers can block another move; neither annotation is lost", () => {
  const { verse, baseline } = fixture();
  baseline.placements.push({
    id: "blocker",
    strong: "H0003",
    kind: "word",
    startWordIndex: 2,
    endWordIndex: 2
  });
  const result = applyHybrid(
    verse,
    baseline,
    runs([
      [0, 1],
      [1, 2]
    ]),
    "stable-intersection"
  );
  assert.equal(result.counts.applied, 0);
  assert.equal(result.counts.blocked, 2);
  assert.deepEqual(result.placements, baseline.placements);
});
test("a missing link abstains and a lexical gate cannot be bypassed by stability", () => {
  const { verse, baseline } = fixture();
  assert.deepEqual(
    applyHybrid(verse, baseline, runs([]), "stable-intersection").placements,
    baseline.placements
  );
  const result = applyHybrid(
    verse,
    baseline,
    runs([
      [0, 1],
      [1, 0]
    ]),
    "stable-intersection-lexical"
  );
  assert.equal(result.counts.applied, 0);
  assert.equal(result.counts.lexicalRejected, 2);
});
