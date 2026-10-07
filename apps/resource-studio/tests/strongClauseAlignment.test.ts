import assert from "node:assert/strict";
import test from "node:test";
import {
  alignWitnessClauses,
  type ClauseLexicalProof,
  type ClauseWitness
} from "../src/strongClauseAlignment.js";
import type { ReconstructionVerse } from "../src/strongConcordanceRefinement.js";

function verse(
  words: string[],
  spec: Array<[string, number | undefined]>
): ReconstructionVerse {
  const units: ReconstructionVerse["units"] = spec.map(([strong, at], i) => ({
    sourceUnitId: `TAGNT.John.1.1.${i + 1}.NKO`,
    occurrenceIds: [`occ-${i}`],
    strong: [strong],
    source: {
      surface: "fixture",
      gloss: "fixture",
      morphology: "V-PAI-1P",
      evidenceSha256: "fixture",
      readingUnresolved: false
    },
    state: at === undefined ? "unresolved" : "visible",
    assurance:
      at === undefined ? "unresolved" : "exact-witness-families-and-source",
    targetWordIndices: at === undefined ? [] : [at],
    reasons: [],
    annotationIds: [],
    placementEvidence: [],
    exploration: {
      status: "completed-locally",
      methods: [],
      exactWitnessProposal: null,
      lexicalCandidates: [],
      remainingReason:
        at === undefined ? "missing-carrier-is-not-absent-translation" : null
    }
  }));
  return {
    ref: "John.1.1",
    text: words.join(" "),
    words,
    units,
    issues: [],
    unownedAnnotationIds: [],
    placements: units.flatMap((u, i) =>
      u.state === "visible"
        ? [
            {
              id: `p-${i}`,
              strong: u.strong[0],
              originalOccurrenceId: u.occurrenceIds[0],
              kind: "word" as const,
              startWordIndex: spec[i][1],
              endWordIndex: spec[i][1]
            }
          ]
        : []
    )
  };
}
function witnesses(
  words: string[],
  spec: Array<[string, number, number?]>
): ClauseWitness[] {
  return ["Segond-family", "Darby-family"].map((family, i) => ({
    name: `w${i}`,
    family,
    ref: "John.1.1",
    text: words.join(" "),
    words,
    placements: spec.map(([strong, a, b = a]) => ({
      strong,
      kind: a === b ? "word" : "phrase",
      startWordIndex: a,
      endWordIndex: b
    }))
  }));
}
const proof = (target: string[], source: string[]): ClauseLexicalProof => ({
  kind: "source-definition",
  sourceTerms: source,
  targetTerms: target,
  provenance: ["fixture-independent-lexicon"]
});

test("one mapped pronoun plus an agreed expression locates the predicate without two outside lexical anchors", () => {
  const initial = verse(
      ["nous", "nous", "trompons", "nous-mêmes"],
      [
        ["G0001", undefined],
        ["G0002", 3]
      ]
    ),
    before = structuredClone(initial);
  const result = alignWitnessClauses({
    initial,
    witnesses: witnesses(
      ["nous", "nous", "égarons", "nous-mêmes"],
      [
        ["G0001", 2],
        ["G0002", 3]
      ]
    ),
    lexicalProof: (_u, t, w) =>
      t.join(" ") === "trompons" ? proof(t, w) : undefined
  });
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].placement.startWordIndex, 2);
  assert.equal(result.changes[0].matches.length, 2);
  assert.deepEqual(initial, before);
  assert.deepEqual(
    result.prediction.placements.slice(0, 1),
    initial.placements
  );
});
test("an evidenced expression may contain several words while the previous carriers and identities remain unchanged", () => {
  const initial = verse(
    ["il", "a", "fait", "mourir", "le", "roi"],
    [
      ["G0001", undefined],
      ["G0002", 5]
    ]
  );
  const result = alignWitnessClauses({
    initial,
    witnesses: witnesses(
      ["il", "a", "tué", "le", "roi"],
      [
        ["G0001", 2],
        ["G0002", 4]
      ]
    ),
    lexicalProof: (_u, t, w) =>
      t.join(" ") === "fait mourir" ? proof(t, w) : undefined
  });
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].placement.kind, "phrase");
  assert.deepEqual(result.changes[0].relationWordIndices, [2, 3]);
  assert.deepEqual(
    result.prediction.units.map((u) => [
      u.sourceUnitId,
      u.occurrenceIds,
      u.strong
    ]),
    initial.units.map((u) => [u.sourceUnitId, u.occurrenceIds, u.strong])
  );
  assert.deepEqual(result.prediction.units[1], initial.units[1]);
});
test("context alone and correlated witnesses do not establish a new carrier", () => {
  const initial = verse(
    ["nous", "nous", "trompons", "nous-mêmes"],
    [
      ["G0001", undefined],
      ["G0002", 3]
    ]
  );
  const w = witnesses(
    ["nous", "nous", "égarons", "nous-mêmes"],
    [
      ["G0001", 2],
      ["G0002", 3]
    ]
  );
  assert.equal(
    alignWitnessClauses({
      initial,
      witnesses: w,
      lexicalProof: () => undefined
    }).changes.length,
    0
  );
  assert.equal(
    alignWitnessClauses({
      initial,
      witnesses: w.map((x) => ({ ...x, family: "Darby-family" })),
      lexicalProof: (_u, t, s) => (t.length === 1 ? proof(t, s) : undefined)
    }).changes.length,
    0
  );
});
test("a candidate cannot move across a new proposition boundary", () => {
  const initial = verse(
    ["un", "feu", "jaillit", "venu", "du", "ciel"],
    [
      ["G0001", undefined],
      ["G0002", 1],
      ["G0003", 5]
    ]
  );
  initial.text = "un feu jaillit, venu du ciel";
  const result = alignWitnessClauses({
    initial,
    witnesses: witnesses(
      ["un", "feu", "sortit", "du", "ciel"],
      [
        ["G0001", 2],
        ["G0002", 1],
        ["G0003", 4]
      ]
    ),
    lexicalProof: (_u, t, w) => (t.includes("venu") ? proof(t, w) : undefined)
  });
  assert.equal(result.changes.length, 0);
  assert.equal(result.prediction.units[0].state, "unresolved");
  assert.equal(result.prediction.units[0].anchor, undefined);
});
test("contradictory contextual anchors preserve ambiguity instead of selecting the strongest-looking slot", () => {
  const initial = verse(
    ["père", "aime", "son", "fils", "père", "hait", "son", "fils"],
    [
      ["G0001", undefined],
      ["G0002", 3],
      ["G0003", 4]
    ]
  );
  const result = alignWitnessClauses({
    initial,
    witnesses: witnesses(
      ["père", "aime", "son", "fils"],
      [
        ["G0001", 1],
        ["G0002", 3],
        ["G0003", 0]
      ]
    ),
    lexicalProof: (_u, t, w) =>
      t.length === 1 && ["aime", "hait"].includes(t[0])
        ? proof(t, w)
        : undefined
  });
  assert.equal(result.changes.length, 0);
  assert(
    result.rejected.some((r) => r.reason === "competing-expression-alignments")
  );
});
test("sharing a word requires the same two occurrences to share the witnessed carrier", () => {
  const initial = verse(
    ["de", "son", "amour"],
    [
      ["G0001", undefined],
      ["G0002", 2],
      ["G0003", 0]
    ]
  );
  const w = witnesses(
    ["de", "son", "amour"],
    [
      ["G0001", 2],
      ["G0002", 2],
      ["G0003", 0]
    ]
  );
  const lexicalProof = (_u: unknown, t: string[], s: string[]) =>
    t.join(" ") === "amour" ? proof(t, s) : undefined;
  assert.equal(
    alignWitnessClauses({ initial, witnesses: w, lexicalProof }).changes.length,
    0
  );
  const result = alignWitnessClauses({
    initial,
    witnesses: w,
    lexicalProof,
    policy: { minimumFamilies: 2, maximumSlotWords: 4, sharedCarriers: true }
  });
  assert.equal(result.changes.length, 1);
  assert.deepEqual(result.prediction.units[1], initial.units[1]);
  const bad = w.map((x) => ({
    ...x,
    placements: x.placements.map((p) =>
      p.strong === "G0002" ? { ...p, startWordIndex: 1, endWordIndex: 1 } : p
    )
  }));
  assert.equal(
    alignWitnessClauses({
      initial,
      witnesses: bad,
      lexicalProof,
      policy: { minimumFamilies: 2, maximumSlotWords: 4, sharedCarriers: true }
    }).changes.length,
    0
  );
});
test("source readings, native-reference mismatches and repeated source identities are not guessed", () => {
  const initial = verse(
    ["nous", "nous", "trompons", "nous-mêmes"],
    [
      ["G0001", undefined],
      ["G0002", 3]
    ]
  );
  const w = witnesses(
    ["nous", "nous", "égarons", "nous-mêmes"],
    [
      ["G0001", 2],
      ["G0002", 3]
    ]
  );
  const lexicalProof = (_u: unknown, t: string[], s: string[]) => proof(t, s);
  initial.units[0].source.readingUnresolved = true;
  assert.equal(
    alignWitnessClauses({ initial, witnesses: w, lexicalProof }).changes.length,
    0
  );
  initial.units[0].source.readingUnresolved = false;
  assert.equal(
    alignWitnessClauses({
      initial,
      witnesses: w.map((x) => ({ ...x, ref: "John.1.2" })),
      lexicalProof
    }).changes.length,
    0
  );
  initial.units.push({
    ...structuredClone(initial.units[0]),
    sourceUnitId: "TAGNT.John.1.1.9.NKO",
    occurrenceIds: ["other"]
  });
  assert.equal(
    alignWitnessClauses({ initial, witnesses: w, lexicalProof }).changes.length,
    0
  );
});

test("displaying a lexical head preserves the complete proven expression relation", () => {
  const initial = verse(
    ["il", "y", "eut", "un", "débat"],
    [
      ["G0001", undefined],
      ["G0002", 4]
    ]
  );
  const w = witnesses(
    ["il", "arriva", "un", "débat"],
    [
      ["G0001", 1],
      ["G0002", 3]
    ]
  );
  const result = alignWitnessClauses({
    initial,
    witnesses: w,
    lexicalProof: (_u, t, s) =>
      t.join(" ") === "y eut" ? proof(t, s) : undefined,
    policy: {
      minimumFamilies: 2,
      maximumSlotWords: 4,
      sharedCarriers: false,
      display: "lexical-head"
    }
  });
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].placement.kind, "word");
  assert.equal(result.changes[0].placement.startWordIndex, 2);
  assert.deepEqual(result.changes[0].relationWordIndices, [1, 2]);
  assert.deepEqual(result.prediction.units[0].targetWordIndices, [1, 2]);
});
