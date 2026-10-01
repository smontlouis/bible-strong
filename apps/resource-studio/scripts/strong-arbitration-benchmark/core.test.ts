import assert from "node:assert/strict";
import test from "node:test";
import {
  applyChoices,
  expectedChoice,
  makeCases,
  requestFor,
  type Result
} from "./core.js";
import type {
  BaselineVerse,
  EvalVerse
} from "../strong-alignment-benchmark/shared.js";

function fixture() {
  const verse: EvalVerse = {
    ref: "Gen.1.1",
    split: "test",
    text: "alpha beta gamma",
    words: ["alpha", "beta", "gamma"],
    normalized: ["alpha", "beta", "gamma"],
    strong: ["H0001", "H0002"],
    surface: ["a", "b"],
    source: ["H0001", "H0002"].map((strong, i) => ({
      occurrenceId: `o${i}`,
      tokenId: `t${i}`,
      tokenIndex: i,
      strong,
      sourceStrong: strong,
      text: `s${i}`,
      gloss: `meaning${i}`,
      lemma: "",
      morph: "noun",
      pos: ""
    }))
  };
  const baseline: BaselineVerse = {
    ref: verse.ref,
    original: verse.strong,
    items: [],
    placements: verse.source.map((s, i) => ({
      id: `b${i}`,
      originalOccurrenceId: s.occurrenceId,
      strong: s.strong,
      kind: "word",
      startWordIndex: i,
      endWordIndex: i
    }))
  };
  const runs = [
    {
      ref: verse.ref,
      seed: 17,
      forward: [
        [0, 1],
        [1, 0]
      ] as [number, number][],
      reverse: [
        [0, 1],
        [1, 0]
      ] as [number, number][]
    }
  ];
  return {
    verse,
    baseline,
    cases: makeCases("Sg1910", verse, baseline, runs, 3)
  };
}
test("candidates contain original carriers and Eflomal targets without exposing scores or origins", () => {
  const { cases } = fixture();
  assert.deepEqual(
    cases[0].lexical.filter((c) => c.placement).map((c) => c.key),
    ["C0_0"]
  );
  assert.equal(cases[0].enriched.filter((c) => c.placement).length, 2);
  const lexical = requestFor(cases[0], "lexical"),
    enriched = requestFor(cases[0], "enriched"),
    context = requestFor(cases[0], "context");
  assert.equal(lexical.state, enriched.state);
  assert.deepEqual(enriched.questions, context.questions);
  assert(!enriched.state.includes("meaning1"));
  assert(context.state.includes("meaning1"));
  assert(!JSON.stringify(context).includes("baseline"));
});
test("missing CSV annotations stay unscorable; explicit empty and missing offered target differ", () => {
  const c = fixture().cases[0];
  assert.equal(expectedChoice(c, "enriched", []), null);
  assert.equal(
    expectedChoice(c, "enriched", [
      { strong: c.strong, kind: "empty", insertAfterWordIndex: 0 }
    ]),
    "NONE"
  );
  assert.equal(
    expectedChoice(c, "lexical", [
      { strong: c.strong, kind: "word", startWordIndex: 1, endWordIndex: 1 }
    ]),
    "UNSURE"
  );
  assert.equal(
    expectedChoice(c, "enriched", [
      { strong: c.strong, kind: "word", startWordIndex: 1, endWordIndex: 1 }
    ]),
    "C1_1"
  );
});
test("simultaneous choices permit swaps and preserve immutable input", () => {
  const { baseline, cases } = fixture(),
    saved = JSON.stringify(baseline);
  const results = new Map(
    cases.map((c, i) => [
      `${c.id}:context`,
      {
        id: `${c.id}:context`,
        requestSha256: "",
        status: "ok",
        choice: `C${1 - i}_${1 - i}`,
        probability: 1
      } satisfies Result
    ])
  );
  const out = applyChoices(baseline, cases, results, "context", 0.95);
  assert.equal(out.changed.length, 2);
  assert.equal(out.placements.find((p) => p.id === "b0")?.startWordIndex, 1);
  assert.equal(JSON.stringify(baseline), saved);
});
test("NONE, invalid responses and low probability preserve the baseline", () => {
  const { baseline, cases } = fixture();
  for (const [status, choice, probability] of [
    ["ok", "NONE", 1],
    ["error", "C1_1", 1],
    ["ok", "C1_1", 0.2]
  ] as const) {
    const result: Result = {
      id: `${cases[0].id}:context`,
      requestSha256: "",
      status,
      choice,
      probability
    };
    assert.deepEqual(
      applyChoices(
        baseline,
        cases,
        new Map([[result.id, result]]),
        "context",
        0.95
      ).placements,
      baseline.placements
    );
  }
});
test("restoring a rejected move blocks dependent moves without losing existing annotations", () => {
  const { baseline, cases } = fixture();
  baseline.placements.push({
    id: "block",
    strong: "H0003",
    kind: "word",
    startWordIndex: 2,
    endWordIndex: 2
  });
  cases[1].enriched.push({
    key: "C2_2",
    description: "gamma",
    placement: {
      strong: "H0002",
      kind: "word",
      startWordIndex: 2,
      endWordIndex: 2
    }
  });
  const results = new Map(
    cases.map((c, i) => [
      `${c.id}:context`,
      {
        id: `${c.id}:context`,
        requestSha256: "",
        status: "ok",
        choice: `C${i + 1}_${i + 1}`,
        probability: 1
      } satisfies Result
    ])
  );
  const out = applyChoices(baseline, cases, results, "context", 0);
  assert.equal(out.blocked, 2);
  assert.deepEqual(out.placements, baseline.placements);
});
test("repeated source identities are excluded rather than joined by Strong alone", () => {
  const { verse, baseline } = fixture();
  verse.source[1].strong = "H0001";
  assert.equal(makeCases("Sg1910", verse, baseline, [], 3).length, 0);
});
