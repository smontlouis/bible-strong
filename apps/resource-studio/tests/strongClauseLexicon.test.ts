import assert from "node:assert/strict";
import test from "node:test";
import {
  createClauseLexicon,
  type SemanticLinks,
  type MeaningBridge
} from "../src/strongClauseLexicon.js";
import type { CanonicalOccurrenceDecision } from "../src/strongCanonicalResolution.js";
import type { SourceRow } from "../src/strongSourceUnits.js";
const unit = (
  morphology = "V-PAI-1P",
  gloss = "we lead astray"
): CanonicalOccurrenceDecision => ({
  sourceUnitId: "TAGNT.John.1.1.1.NKO",
  occurrenceIds: ["o1"],
  strong: ["G0001"],
  source: {
    surface: "fixture",
    gloss,
    morphology,
    evidenceSha256: "fixture",
    readingUnresolved: false
  },
  state: "unresolved",
  assurance: "unresolved",
  targetWordIndices: [],
  reasons: [],
  annotationIds: [],
  placementEvidence: [],
  exploration: {
    status: "completed-locally",
    methods: [],
    exactWitnessProposal: null,
    lexicalCandidates: [],
    remainingReason: "unresolved"
  }
});
const row = (
  u: CanonicalOccurrenceDecision,
  identity = "G0001"
): SourceRow => ({
  id: u.sourceUnitId,
  source: "TAGNT",
  reference: "John.1.1",
  tokenIndex: 1,
  reading: "NKO",
  file: "fixture-TAGNT.txt",
  line: 1,
  surface: "fixture",
  gloss: u.source.gloss,
  primary: [identity],
  alternatives: [],
  technicalMarkers: [],
  evidence: {
    primary: identity,
    instances: "",
    alternatives: "",
    expanded: "",
    meaningVariants: "",
    spellingVariants: "",
    conjoin: "",
    editions: ""
  }
});
const semantics = (): SemanticLinks => ({
  schemaVersion: 1,
  openOffice: {},
  wolf: []
});
const meanings = (): MeaningBridge => ({
  schemaVersion: 1,
  stepSenses: {
    G0001: [
      {
        identity: "G0001",
        classicalStrong: "G0001",
        rootIdentity: "G0001",
        partOfSpeech: "G:V",
        gloss: "to lead astray",
        meaning: "fixture",
        sourceFile: "fixture",
        sourceLine: 1
      }
    ]
  },
  frenchMeanings: {
    tromper: [
      {
        partOfSpeech: "verb",
        senses: [
          {
            id: "fixture-tromper",
            glosses: ["to deceive, lead astray, mislead"],
            tags: []
          }
        ]
      }
    ]
  }
});

test("source-specific English meaning bridges independently indexed French inflections", () => {
  const u = unit(),
    lookup = createClauseLexicon({
      inflections: {
        trompons: { verb: ["tromper"] },
        égarons: { verb: ["égarer"] }
      },
      semantics: semantics(),
      meanings: meanings()
    });
  const proof = lookup(u, ["trompons"], ["égarons"], "meaning", row(u));
  assert.equal(proof?.kind, "source-definition");
  assert(proof?.provenance.includes("G0001"));
  assert.equal(
    lookup(u, ["trompons"], ["égarons"], "reviewed", row(u)),
    undefined
  );
});
test("exact semantic identity, including suffix case, cannot be replaced by the classical Strong alone", () => {
  const u = unit(),
    lookup = createClauseLexicon({
      inflections: { trompons: { verb: ["tromper"] } },
      semantics: semantics(),
      meanings: meanings()
    });
  assert.equal(
    lookup(u, ["trompons"], ["égarons"], "meaning", row(u, "G0001a")),
    undefined
  );
});
test("an automatically translated WOLF term is not treated as a reviewed sense link", () => {
  for (const reviewedInDictionary of [false, true]) {
    const s = semantics();
    s.wolf = [
      {
        id: "fixture-sense",
        partOfSpeech: "v",
        definition: "fixture",
        terms: [
          {
            text: "regarder",
            reviewedInDictionary: true,
            provenance: "fixture"
          },
          { text: "observer", reviewedInDictionary, provenance: "fixture" }
        ]
      }
    ];
    const lookup = createClauseLexicon({
      inflections: {
        regardons: { verb: ["regarder"] },
        observons: { verb: ["observer"] }
      },
      semantics: s,
      meanings: { schemaVersion: 1, stepSenses: {}, frenchMeanings: {} }
    });
    assert.equal(
      lookup(unit(), ["regardons"], ["observons"], "reviewed")?.kind,
      reviewedInDictionary ? "reviewed-synset" : undefined
    );
  }
});
test("OpenOffice links require direct reciprocity and remain a separate weaker variant", () => {
  const s = semantics();
  s.openOffice = {
    tromper: [{ rawPartOfSpeech: "(Verbe)", terms: ["égarer"] }],
    égarer: [{ rawPartOfSpeech: "(Verbe)", terms: ["tromper"] }]
  };
  const lookup = createClauseLexicon({
    inflections: {},
    semantics: s,
    meanings: { schemaVersion: 1, stepSenses: {}, frenchMeanings: {} }
  });
  assert.equal(
    lookup(unit(), ["tromper"], ["égarer"], "reciprocal")?.kind,
    "reciprocal-synonym"
  );
  assert.equal(lookup(unit(), ["tromper"], ["égarer"], "meaning"), undefined);
  const oneWay = createClauseLexicon({
    inflections: {},
    semantics: { ...s, openOffice: { tromper: s.openOffice.tromper } },
    meanings: { schemaVersion: 1, stepSenses: {}, frenchMeanings: {} }
  });
  assert.equal(
    oneWay(unit(), ["tromper"], ["égarer"], "reciprocal"),
    undefined
  );
});
test("a shared phrase does not erase polarity differences in lexical definitions", () => {
  const u = unit("A-NSM", "not worthy of trust"),
    m = meanings();
  m.stepSenses.G0001[0].gloss = u.source.gloss;
  m.frenchMeanings = {
    fiable: [
      {
        partOfSpeech: "adj",
        senses: [
          { id: "fixture-fiable", glosses: ["worthy of trust"], tags: [] }
        ]
      }
    ]
  };
  const lookup = createClauseLexicon({
    inflections: {},
    semantics: semantics(),
    meanings: m
  });
  assert.equal(
    lookup(u, ["fiable"], ["douteux"], "meaning", row(u)),
    undefined
  );
});
test("a lexical source cannot acquire a bare function word from an accidental reference tag", () => {
  const lookup = createClauseLexicon({
    inflections: { son: { noun: ["son"] } },
    semantics: semantics(),
    meanings: meanings()
  });
  assert.equal(lookup(unit(), ["de"], ["de"], "literal"), undefined);
  assert.equal(
    lookup(unit("PREP"), ["de"], ["de"], "literal")?.kind,
    "literal"
  );
  assert.equal(
    lookup(unit("N-NSM", "sound"), ["son"], ["son"], "literal")?.kind,
    "literal"
  );
});
