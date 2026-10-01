import assert from "node:assert/strict";
import test from "node:test";
import {
  goldVerse,
  type RawVerse
} from "../scripts/strong-concordance-night/contract.js";
import {
  aggregate,
  matching,
  metric
} from "../scripts/strong-concordance-night/score.js";

const tag = (pa: string, start: number, end: number, empty = false) => ({
  pa,
  start,
  end,
  empty,
  ns: ""
});
test("Concordance expressions share occurrence identity but repeated Strongs do not", () => {
  const raw: RawVerse = {
    verse: 1,
    rawText: "en effet encore",
    tags: [tag("8/h3588", 0, 2), tag("8/h3588", 3, 8), tag("9/h3588", 9, 15)]
  };
  const gold = goldVerse("Exod.1", raw);
  assert.equal(gold.placements.length, 2);
  assert.deepEqual(gold.placements[0].targetWordIndices, [0, 1]);
  assert.notEqual(gold.placements[0].id, gold.placements[1].id);
});
test("mask does not depend on Strong, lemma, occurrence ids or empty anchors", () => {
  const raw: RawVerse = {
    verse: 1,
    rawText: "  L’ami  parle. ",
    tags: [tag("1/h0559", 9, 14)]
  };
  const adversarial = {
    ...raw,
    tags: [tag("999/g9999", 0, 0, true), tag("45/h9998", 2, 7)]
  };
  const mask = (v: RawVerse) => {
    const { ref, text } = goldVerse("Exod.1", v);
    return { ref, text };
  };
  assert.deepEqual(mask(raw), mask(adversarial));
  assert.deepEqual(mask(raw), { ref: "Exod.1.1", text: "L’ami parle." });
});
test("two empty occurrences on the same boundary remain two", () => {
  const g = goldVerse("Exod.1", {
    verse: 1,
    rawText: "A B",
    tags: [tag("1/h0001+2/h0001", 1, 1, true)]
  });
  assert.equal(g.placements.length, 2);
  assert(g.placements.every((p) => p.insertAfterWordIndex === 0));
});
test("French elisions share a tokenizer word without double counting an occurrence", () => {
  const g = goldVerse("Exod.1", {
    verse: 1,
    rawText: "l’ami dit",
    tags: [tag("1/h0001", 0, 2), tag("1/h0001", 2, 5)]
  });
  assert.equal(g.placements.length, 1);
  assert.deepEqual(g.placements[0].targetWordIndices, [0]);
});
test("discontinuous relations retain exact sets, never fill gaps", () => {
  const g = goldVerse("Exod.1", {
    verse: 1,
    rawText: "ne vient pas",
    tags: [tag("1/h3808", 0, 2), tag("1/h3808", 9, 12)]
  });
  assert.deepEqual(g.placements[0].targetWordIndices, [0, 2]);
});
test("inconsistent occurrence with visible and empty carriers is reported", () => {
  const g = goldVerse("Exod.1", {
    verse: 1,
    rawText: "A",
    tags: [tag("1/h0001", 0, 1), tag("1/h0001", 1, 1, true)]
  });
  assert.deepEqual(g.diagnostics, ["mixed-empty-visible:1/H0001"]);
});
test("all abstention cannot have a perfect score", () => {
  assert.deepEqual(metric(0, 10, 0), {
    predicted: 0,
    expected: 10,
    tp: 0,
    fp: 0,
    fn: 10,
    precision: 0,
    recall: 0,
    f1: 0
  });
  assert.equal(aggregate([]).uncertaintyRate, 1);
});
test("matching is one-to-one and can augment repeated-occurrence paths", () => {
  const p = [
    { id: "a", strong: "H0001", kind: "word" as const },
    { id: "b", strong: "H0001", kind: "word" as const }
  ];
  const e = [
    { ...p[0], id: "x" },
    { ...p[1], id: "y" }
  ];
  assert.equal(
    matching(p, e, (a, b) => a.id === "a" || b.id === "x").length,
    2
  );
});
