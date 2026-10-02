import assert from "node:assert/strict";
import test from "node:test";
import {
  learnCarrierLexicon,
  refineConcordanceContext,
  type ContextPolicy
} from "../src/strongConcordanceContext.js";
import type {
  ReconstructionVerse,
  ReconstructionWitness,
  ReconstructionPlacement
} from "../src/strongConcordanceRefinement.js";
import type { CanonicalOccurrenceDecision } from "../src/strongCanonicalResolution.js";
import { tokenizeText } from "../src/tokenize.js";
const policy: ContextPolicy = {
  lightVerbs: true,
  localContext: true,
  measuredGroups: true
};
function unit(
  id: string,
  strong: string,
  morphology: string,
  at: number,
  unresolved = false
): CanonicalOccurrenceDecision {
  return {
    sourceUnitId: id,
    occurrenceIds: [id + ":0"],
    strong: [strong],
    source: {
      surface: "source",
      gloss: "fixture",
      morphology,
      evidenceSha256: "test",
      readingUnresolved: unresolved
    },
    state: unresolved ? "unresolved" : "visible",
    assurance: "existing-reader-carrier",
    targetWordIndices: unresolved ? [] : [at],
    reasons: [],
    annotationIds: [id],
    placementEvidence: [],
    exploration: {
      status: "completed-locally",
      methods: [],
      exactWitnessProposal: null,
      lexicalCandidates: [],
      remainingReason: unresolved ? "variant" : null
    }
  };
}
function word(
  u: CanonicalOccurrenceDecision,
  at: number
): ReconstructionPlacement {
  return {
    id: u.sourceUnitId,
    strong: u.strong[0],
    originalOccurrenceId: u.occurrenceIds[0],
    kind: "word",
    startWordIndex: at,
    endWordIndex: at,
    confidence: 0.99,
    source: "reference-transfer:exact|fixture"
  };
}
function verse(
  text: string,
  units: CanonicalOccurrenceDecision[],
  placements: ReconstructionPlacement[]
): ReconstructionVerse {
  return {
    ref: "Gen.1.1",
    text,
    words: tokenizeText(text)
      .filter((t) => t.kind === "word")
      .map((t) => t.text),
    units,
    placements,
    issues: [],
    unownedAnnotationIds: []
  };
}
function witness(
  words: string[],
  spec: Array<[string, number]>,
  family = "family-a"
): ReconstructionWitness {
  return {
    name: family,
    family,
    words,
    placements: spec.map(([strong, at]) => ({
      strong,
      kind: "word",
      startWordIndex: at,
      endWordIndex: at
    }))
  };
}
function run(
  initial: ReconstructionVerse,
  witnesses: ReconstructionWitness[],
  corpus: Array<ReconstructionWitness & { ref: string }> = [],
  display: "expressions" | "heads" = "expressions"
) {
  return refineConcordanceContext({
    initial,
    witnesses,
    lexicon: learnCarrierLexicon(corpus),
    policy,
    display
  });
}
test("retains a light-verb relation and uses its independently attested content carrier", () => {
  const u = unit("u", "H0500", "HVqi2ms", 2),
    v = verse("Tu ne commettras pas de fraude.", [u], [word(u, 2)]);
  const corpus = [
    { ...witness(["fraude"], [["H0500", 0]], "a"), ref: "Gen.2.1" },
    { ...witness(["fraudes"], [["H0500", 0]], "b"), ref: "Gen.3.1" }
  ];
  const full = run(v, [], corpus);
  assert.equal(full.prediction.placements[0].startWordIndex, 5);
  assert.deepEqual(full.prediction.units[0].targetWordIndices, [2, 5]);
  assert.equal(
    run(v, [], corpus, "heads").prediction.placements[0].startWordIndex,
    2
  );
  assert.equal(v.placements[0].startWordIndex, 2);
  const correlated = corpus.map((c) => ({ ...c, family: "a" }));
  assert.equal(run(v, [], correlated).changes.length, 0);
});
test("does not steal a content carrier already owned by another source unit", () => {
  const u = unit("u", "H0500", "HVqi2ms", 0),
    n = unit("n", "H0600", "HNcmsa", 2),
    v = verse("fait une fraude", [u, n], [word(u, 0), word(n, 2)]);
  const corpus = [
    { ...witness(["fraude"], [["H0500", 0]], "a"), ref: "Gen.2.1" },
    { ...witness(["fraude"], [["H0500", 0]], "b"), ref: "Gen.3.1" }
  ];
  assert.equal(run(v, [], corpus).changes.length, 0);
});
test("a unique witnessed nominal context corrects an occurrence while retaining an alternate reading", () => {
  const u = unit("u", "G0001", "N-NSF", 7),
    a = unit("a", "G0002", "N-NSM", 3),
    alt = unit("alt", "G0001", "N-NSF", -1, true);
  const v = verse(
    "une flamme du flambeau puis une autre flamme",
    [u, a, alt],
    [word(u, 7), word(a, 3)]
  );
  const w = witness(
    ["une", "flamme", "du", "flambeau"],
    [
      ["G0001", 1],
      ["G0002", 3]
    ]
  );
  const r = run(v, [w, { ...w, name: "independent", family: "family-b" }]);
  assert.equal(run(v, [w, { ...w, name: "correlated" }]).changes.length, 0);
  assert.equal(r.prediction.placements[0].startWordIndex, 1);
  assert.equal(r.prediction.units[2].state, "unresolved");
  assert.deepEqual(
    r.prediction.units.map((u) => u.sourceUnitId),
    v.units.map((u) => u.sourceUnitId)
  );
});
test("context matching keeps accents significant and refuses a word in another grammatical context", () => {
  const u = unit("u", "G0001", "N-NSF", 4),
    a = unit("a", "G0002", "N-NSM", 1),
    v = verse("là flambeau puis une flamme", [u, a], [word(u, 4), word(a, 1)]);
  const w = witness(
    ["la", "flambeau"],
    [
      ["G0001", 0],
      ["G0002", 1]
    ]
  );
  assert.equal(run(v, [w]).changes.length, 0);
});
test("source and witnessed imperative form distinguish a command from the later narrative", () => {
  const u = unit("u", "G0001", "V-AAM-2S", 2),
    v = verse("Il fut levé. Lève-toi maintenant.", [u], [word(u, 2)]);
  const r = run(v, [witness(["Lève-toi"], [["G0001", 0]])]);
  assert.equal(r.prediction.placements[0].startWordIndex, 3);
  assert.equal(r.changes[0].rule, "witness-imperative-form");
});
test("a conflicting predicate neighborhood yields uncertainty, never an inferred empty", () => {
  const u = unit("u", "G0001", "V-PAI-3S", 3),
    a = unit("a", "G0002", "N-NSM", 11),
    o = unit("o", "G0003", "V-PAN", 7);
  const v = verse(
    "Voici la récompense est avec moi, pour payer chacun selon son travail.",
    [u, o, a],
    [word(u, 3), word(o, 7), word(a, 11)]
  );
  const words = [
    "payer",
    "chacun",
    "selon",
    "ce",
    "que",
    "sera",
    "son",
    "travail"
  ];
  const specs: Array<[string, number]> = [
    ["G0001", 5],
    ["G0002", 7],
    ["G0003", 0]
  ];
  const r = run(v, [witness(words, specs, "a"), witness(words, specs, "b")]);
  assert.equal(r.prediction.units[0].state, "unresolved");
  assert.equal(r.prediction.units[0].anchor, undefined);
  assert(!r.prediction.placements.some((p) => p.id === "u"));
  assert.equal(r.prediction.units[1].state, "visible");
});
test("compressed measurement nouns remain unresolved together when witness families conflict", () => {
  const a = unit("a", "H0200", "HNcmsa", 1),
    n = unit("n", "H0702", "HAomsa", 0),
    m = unit("m", "H0259", "HAomsa", 2),
    b = unit("b", "H0200", "HNcmsa", 3);
  const v = verse(
    "première mesure seconde unité",
    [a, n, m, b],
    [word(a, 1), word(n, 0), word(m, 2), word(b, 3)]
  );
  const corpus = Array.from({ length: 20 }, (_, i) => ({
    ...witness(["unité"], [["H0200", 0]], i % 2 ? "a" : "b"),
    ref: `Gen.2.${i + 1}`
  }));
  corpus.push({ ...witness(["mesure"], [["H0200", 0]], "a"), ref: "Gen.3.1" });
  const w = [
    witness(
      ["mesure", "unité"],
      [
        ["H0200", 0],
        ["H0200", 1]
      ],
      "a"
    ),
    witness(
      ["unité", "unité"],
      [
        ["H0200", 0],
        ["H0200", 1]
      ],
      "b"
    )
  ];
  const r = run(v, w, corpus);
  assert.equal(r.prediction.units[0].state, "unresolved");
  assert.equal(r.prediction.units[3].state, "unresolved");
  assert(!r.prediction.placements.some((p) => p.strong === "H0200"));
  assert.equal(r.prediction.units[0].anchor, undefined);
});

test("a frequently tagged grammatical word is never selected as a lexical content carrier", () => {
  for (const functionWord of ["en", "pour", "lui", "se", "ne", "mais"]) {
    const u = unit("u", "H0500", "HVqi3ms", 1);
    const v = verse(`se mit ${functionWord} autre`, [u], [word(u, 1)]);
    const corpus = [
      { ...witness([functionWord], [["H0500", 0]], "a"), ref: "Gen.2.1" },
      { ...witness([functionWord], [["H0500", 0]], "b"), ref: "Gen.3.1" }
    ];
    assert.equal(
      run(v, [], corpus).prediction.placements[0].startWordIndex,
      1,
      functionWord
    );
    assert.equal(run(v, [], corpus).changes.length, 0, functionWord);
  }
});

test("an imperative display correction preserves its adjacent translation complement", () => {
  const u = unit("u", "G0001", "V-AAM-2S", 2),
    v = verse("ici tiens-toi debout", [u], [word(u, 2)]);
  const r = run(v, [witness(["tiens-toi"], [["G0001", 0]])]);
  assert.equal(r.prediction.placements[0].startWordIndex, 1);
  assert.deepEqual(r.prediction.units[0].targetWordIndices, [1, 2]);
});
